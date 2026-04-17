chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'sendToWebhook') {
    handleWebhookSend(message.items)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function handleWebhookSend(items) {
  const { webhookUrl } = await chrome.storage.local.get('webhookUrl');

  if (!webhookUrl) {
    return { success: false, error: 'URL do webhook não configurada. Configure no ícone da extensão.' };
  }

  const payload = {
    source: 'pncp-filtros-avancados',
    timestamp: new Date().toISOString(),
    oportunidades: items.map(item => ({
      objeto: item.objetoCompra || item.description || '',
      orgao: item.orgaoEntidade?.razaoSocial || '',
      cnpj: item.orgaoEntidade?.cnpj || '',
      valorEstimado: item.valorTotalEstimado ?? null,
      dataPublicacao: item.dataPublicacaoPncp || '',
      dataDisputa: item.dataAberturaProposta || item.dataEncerramentoProposta || '',
      modalidade: item.modalidadeNome || '',
      numero: item.numeroCompra || '',
      ano: item.anoCompra || item.ano || '',
      srp: item.srp || false,
      linkEdital: buildEditalLink(item),
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
  const ano = item.anoCompra || item.ano || '';
  const seq = item.sequencialCompra || '';
  if (cnpj && ano && seq) {
    return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`;
  }
  return '';
}
