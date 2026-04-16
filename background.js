const PNCP_API_BASE = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao';
const MAX_PAGES = 20;
const PAGE_SIZE = 50;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'search') {
    handleSearch(message.filters)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.action === 'sendToWebhook') {
    handleWebhookSend(message.items)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// --- Busca na API do PNCP ---
async function handleSearch(filters) {
  const { keywords, operator, excluirRegistroPreco, tipoObjeto, modalidade, uf,
          dataInicial, dataFinal, dataDisputaInicial, dataDisputaFinal } = filters;

  // Se operador OR: busca cada palavra-chave separadamente e une resultados
  // Se operador AND: busca cada palavra-chave separadamente e intersecciona
  let allResults = [];

  if (keywords.length === 0) {
    // Busca sem palavra-chave (somente filtros de data, etc.)
    allResults = await fetchAllPages('', { tipoObjeto, modalidade, uf, dataInicial, dataFinal });
  } else if (keywords.length === 1) {
    allResults = await fetchAllPages(keywords[0], { tipoObjeto, modalidade, uf, dataInicial, dataFinal });
  } else {
    // Múltiplas palavras-chave
    const resultsByKeyword = [];
    for (const kw of keywords) {
      const results = await fetchAllPages(kw, { tipoObjeto, modalidade, uf, dataInicial, dataFinal });
      resultsByKeyword.push(results);
    }

    if (operator === 'OR') {
      // Union: merge all, deduplicate by unique key
      const seen = new Set();
      for (const results of resultsByKeyword) {
        for (const item of results) {
          const key = buildItemKey(item);
          if (!seen.has(key)) {
            seen.add(key);
            allResults.push(item);
          }
        }
      }
    } else {
      // AND: intersection - item must appear in ALL keyword result sets
      if (resultsByKeyword.length > 0) {
        const keySets = resultsByKeyword.map(results => {
          const map = new Map();
          for (const item of results) {
            map.set(buildItemKey(item), item);
          }
          return map;
        });

        // Start with the smallest set for efficiency
        keySets.sort((a, b) => a.size - b.size);
        const [smallest, ...rest] = keySets;

        for (const [key, item] of smallest) {
          if (rest.every(set => set.has(key))) {
            allResults.push(item);
          }
        }
      }
    }
  }

  // --- Filtros client-side ---

  // Excluir Registro de Preço (SRP)
  if (excluirRegistroPreco) {
    allResults = allResults.filter(item => {
      const srp = item.srp;
      const objeto = (item.objetoCompra || item.description || '').toLowerCase();
      return !srp && !objeto.includes('registro de preço') && !objeto.includes('registro de preços');
    });
  }

  // Filtro por data de disputa (client-side)
  if (dataDisputaInicial || dataDisputaFinal) {
    allResults = allResults.filter(item => {
      const dataDisputa = item.dataAberturaProposta || item.dataEncerramentoProposta || null;
      if (!dataDisputa) return false;

      const disputaDate = dataDisputa.substring(0, 10); // YYYY-MM-DD
      if (dataDisputaInicial && disputaDate < dataDisputaInicial) return false;
      if (dataDisputaFinal && disputaDate > dataDisputaFinal) return false;
      return true;
    });
  }

  // Ordenar por data de publicação (mais recente primeiro)
  allResults.sort((a, b) => {
    const dateA = a.dataPublicacaoPncp || '';
    const dateB = b.dataPublicacaoPncp || '';
    return dateB.localeCompare(dateA);
  });

  // Enviar resultados para a tab ativa do PNCP
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const pncpTab = tabs.find(t => t.url && t.url.includes('pncp.gov.br'));

  if (pncpTab) {
    await chrome.tabs.sendMessage(pncpTab.id, {
      action: 'displayResults',
      results: allResults,
      filters,
    });
  } else {
    // Abrir o PNCP e enviar depois
    const newTab = await chrome.tabs.create({ url: 'https://pncp.gov.br/app/editais' });
    // Wait for tab to load, then send results
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === newTab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(() => {
          chrome.tabs.sendMessage(newTab.id, {
            action: 'displayResults',
            results: allResults,
            filters,
          });
        }, 1000);
      }
    });
  }

  return { success: true, totalCount: allResults.length };
}

// --- Fetch all pages from the PNCP API ---
async function fetchAllPages(query, params) {
  const allItems = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= MAX_PAGES) {
    const url = buildApiUrl(query, params, page);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`PNCP API error: ${response.status} for page ${page}`);
        break;
      }

      const data = await response.json();

      // The API returns an array or an object with data
      let items = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data.data && Array.isArray(data.data)) {
        items = data.data;
      } else if (data.result && Array.isArray(data.result)) {
        items = data.result;
      } else {
        // Might be a single-level object — try to use it directly
        items = data.items || [];
      }

      if (items.length === 0) {
        hasMore = false;
      } else {
        allItems.push(...items);
        if (items.length < PAGE_SIZE) {
          hasMore = false;
        }
        page++;
      }
    } catch (err) {
      console.error('Fetch error:', err);
      break;
    }
  }

  return allItems;
}

// --- Build API URL ---
function buildApiUrl(query, params, page) {
  const url = new URL(PNCP_API_BASE);
  const sp = url.searchParams;

  if (query) sp.set('q', query);
  sp.set('pagina', page);
  sp.set('tamanhoPagina', PAGE_SIZE);

  if (params.dataInicial) {
    sp.set('dataInicial', params.dataInicial.replace(/-/g, ''));
  }
  if (params.dataFinal) {
    sp.set('dataFinal', params.dataFinal.replace(/-/g, ''));
  }
  if (params.tipoObjeto) {
    sp.set('tipos', params.tipoObjeto);
  }
  if (params.modalidade) {
    sp.set('modalidade', params.modalidade);
  }
  if (params.uf) {
    sp.set('uf', params.uf);
  }

  // Always request items that are receiving proposals
  sp.set('status', 'recebendo_proposta');

  return url.toString();
}

// --- Unique key for deduplication ---
function buildItemKey(item) {
  return `${item.orgaoEntidade?.cnpj || ''}-${item.ano || ''}-${item.sequencialCompra || ''}-${item.numeroCompra || ''}`;
}

// --- Send selected items to webhook ---
async function handleWebhookSend(items) {
  const { webhookUrl } = await chrome.storage.local.get('webhookUrl');

  if (!webhookUrl) {
    return { success: false, error: 'URL do webhook não configurada. Configure nas opções da extensão.' };
  }

  const payload = {
    source: 'pncp-filtros-avancados',
    timestamp: new Date().toISOString(),
    oportunidades: items.map(item => ({
      objeto: item.objetoCompra || item.description || '',
      orgao: item.orgaoEntidade?.razaoSocial || item.orgaoNome || '',
      cnpj: item.orgaoEntidade?.cnpj || '',
      valorEstimado: item.valorTotalEstimado || item.valorTotalHomologado || null,
      dataPublicacao: item.dataPublicacaoPncp || '',
      dataDisputa: item.dataAberturaProposta || item.dataEncerramentoProposta || '',
      modalidade: item.modalidadeNome || '',
      numero: item.numeroCompra || '',
      ano: item.ano || '',
      srp: item.srp || false,
      linkEdital: buildEditalLink(item),
      linkPncp: buildPncpLink(item),
    })),
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { success: false, error: `Webhook retornou status ${response.status}` };
  }

  return { success: true, count: items.length };
}

function buildEditalLink(item) {
  const cnpj = item.orgaoEntidade?.cnpj || '';
  const ano = item.ano || '';
  const seq = item.sequencialCompra || '';
  if (cnpj && ano && seq) {
    return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`;
  }
  return '';
}

function buildPncpLink(item) {
  return buildEditalLink(item);
}
