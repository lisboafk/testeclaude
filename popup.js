document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    keywords: document.getElementById('keywords'),
    opAnd: document.getElementById('op-and'),
    opOr: document.getElementById('op-or'),
    excluirRegistroPreco: document.getElementById('excluirRegistroPreco'),
    tipoObjeto: document.getElementById('tipoObjeto'),
    modalidade: document.getElementById('modalidade'),
    uf: document.getElementById('uf'),
    dataInicial: document.getElementById('dataInicial'),
    dataFinal: document.getElementById('dataFinal'),
    dataDisputaInicial: document.getElementById('dataDisputaInicial'),
    dataDisputaFinal: document.getElementById('dataDisputaFinal'),
    webhookUrl: document.getElementById('webhookUrl'),
    btnBuscar: document.getElementById('btnBuscar'),
    btnLimpar: document.getElementById('btnLimpar'),
    saveConfig: document.getElementById('saveConfig'),
    toggleConfig: document.getElementById('toggleConfig'),
    configSection: document.getElementById('configSection'),
    statusBar: document.getElementById('statusBar'),
  };

  let operator = 'AND';

  // --- Operador AND/OR toggle ---
  elements.opAnd.addEventListener('click', () => {
    operator = 'AND';
    elements.opAnd.classList.add('active');
    elements.opOr.classList.remove('active');
  });

  elements.opOr.addEventListener('click', () => {
    operator = 'OR';
    elements.opOr.classList.add('active');
    elements.opAnd.classList.remove('active');
  });

  // --- Toggle config section ---
  elements.toggleConfig.addEventListener('click', () => {
    elements.configSection.classList.toggle('visible');
  });

  // --- Carregar dados salvos ---
  chrome.storage.local.get(['pncpFilters', 'webhookUrl'], (data) => {
    if (data.webhookUrl) {
      elements.webhookUrl.value = data.webhookUrl;
    }
    if (data.pncpFilters) {
      const f = data.pncpFilters;
      if (f.keywords) elements.keywords.value = f.keywords;
      if (f.operator) {
        operator = f.operator;
        if (operator === 'OR') {
          elements.opOr.classList.add('active');
          elements.opAnd.classList.remove('active');
        }
      }
      if (f.excluirRegistroPreco) elements.excluirRegistroPreco.checked = true;
      if (f.tipoObjeto) elements.tipoObjeto.value = f.tipoObjeto;
      if (f.modalidade) elements.modalidade.value = f.modalidade;
      if (f.uf) elements.uf.value = f.uf;
      if (f.dataInicial) elements.dataInicial.value = f.dataInicial;
      if (f.dataFinal) elements.dataFinal.value = f.dataFinal;
      if (f.dataDisputaInicial) elements.dataDisputaInicial.value = f.dataDisputaInicial;
      if (f.dataDisputaFinal) elements.dataDisputaFinal.value = f.dataDisputaFinal;
    }
  });

  // --- Salvar config webhook ---
  elements.saveConfig.addEventListener('click', () => {
    const url = elements.webhookUrl.value.trim();
    chrome.storage.local.set({ webhookUrl: url }, () => {
      setStatus('Configuração salva!', 'success');
    });
  });

  // --- Limpar filtros ---
  elements.btnLimpar.addEventListener('click', () => {
    elements.keywords.value = '';
    elements.excluirRegistroPreco.checked = false;
    elements.tipoObjeto.value = '';
    elements.modalidade.value = '';
    elements.uf.value = '';
    elements.dataInicial.value = '';
    elements.dataFinal.value = '';
    elements.dataDisputaInicial.value = '';
    elements.dataDisputaFinal.value = '';
    operator = 'AND';
    elements.opAnd.classList.add('active');
    elements.opOr.classList.remove('active');
    chrome.storage.local.remove('pncpFilters');
    setStatus('Filtros limpos.', '');
  });

  // --- Buscar ---
  elements.btnBuscar.addEventListener('click', () => {
    const filters = buildFilters();

    if (!filters.keywords.length && !filters.dataInicial) {
      setStatus('Informe ao menos uma palavra-chave ou data de publicação.', 'error');
      return;
    }

    // Salvar filtros para reutilização
    chrome.storage.local.set({ pncpFilters: {
      keywords: elements.keywords.value,
      operator,
      excluirRegistroPreco: elements.excluirRegistroPreco.checked,
      tipoObjeto: elements.tipoObjeto.value,
      modalidade: elements.modalidade.value,
      uf: elements.uf.value,
      dataInicial: elements.dataInicial.value,
      dataFinal: elements.dataFinal.value,
      dataDisputaInicial: elements.dataDisputaInicial.value,
      dataDisputaFinal: elements.dataDisputaFinal.value,
    }});

    setStatus('Buscando...', '');
    elements.btnBuscar.disabled = true;

    // Enviar mensagem ao background para iniciar a busca
    chrome.runtime.sendMessage({
      action: 'search',
      filters,
    }, (response) => {
      elements.btnBuscar.disabled = false;
      if (chrome.runtime.lastError) {
        setStatus('Erro ao comunicar com a extensão.', 'error');
        return;
      }
      if (response && response.success) {
        const count = response.totalCount || 0;
        setStatus(`${count} resultado(s) encontrado(s). Veja na página do PNCP.`, 'success');
      } else {
        setStatus(response?.error || 'Erro na busca.', 'error');
      }
    });
  });

  function buildFilters() {
    const rawKeywords = elements.keywords.value
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    return {
      keywords: rawKeywords,
      operator,
      excluirRegistroPreco: elements.excluirRegistroPreco.checked,
      tipoObjeto: elements.tipoObjeto.value,
      modalidade: elements.modalidade.value,
      uf: elements.uf.value,
      dataInicial: elements.dataInicial.value,
      dataFinal: elements.dataFinal.value,
      dataDisputaInicial: elements.dataDisputaInicial.value,
      dataDisputaFinal: elements.dataDisputaFinal.value,
    };
  }

  function setStatus(message, type) {
    elements.statusBar.textContent = message;
    elements.statusBar.className = 'status-bar';
    if (type) elements.statusBar.classList.add(type);
  }
});
