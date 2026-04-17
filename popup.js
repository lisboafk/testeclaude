document.addEventListener('DOMContentLoaded', () => {
  const webhookInput  = document.getElementById('webhook-url');
  const saveBtn       = document.getElementById('btn-save');
  const saveStatus    = document.getElementById('save-status');
  const secOnPncp     = document.getElementById('sec-on-pncp');
  const secNotPncp    = document.getElementById('sec-not-pncp');
  const openPanelBtn  = document.getElementById('btn-open-panel');

  // Load saved webhook URL
  chrome.storage.local.get('webhookUrl', ({ webhookUrl }) => {
    if (webhookUrl) webhookInput.value = webhookUrl;
  });

  // Detect if current tab is on pncp.gov.br
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const onPncp = tab?.url?.includes('pncp.gov.br');
    secOnPncp.style.display  = onPncp ? 'block' : 'none';
    secNotPncp.style.display = onPncp ? 'none'  : 'block';
  });

  // Open panel in content script
  openPanelBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'openPanel' });
        window.close();
      }
    });
  });

  // Save webhook URL
  saveBtn.addEventListener('click', () => {
    const url = webhookInput.value.trim();
    chrome.storage.local.set({ webhookUrl: url }, () => {
      saveStatus.style.display = 'block';
      setTimeout(() => { saveStatus.style.display = 'none'; }, 2500);
    });
  });
});
