document.addEventListener('DOMContentLoaded', () => {
  const webhookInput = document.getElementById('webhook-url');
  const saveBtn      = document.getElementById('btn-save');
  const saveStatus   = document.getElementById('save-status');
  const secOnPncp    = document.getElementById('sec-on-pncp');
  const secNotPncp   = document.getElementById('sec-not-pncp');
  const openPanelBtn = document.getElementById('btn-open-panel');

  chrome.storage.local.get('webhookUrl', ({ webhookUrl }) => {
    if (webhookUrl) webhookInput.value = webhookUrl;
  });

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const onPncp = tab?.url?.includes('pncp.gov.br');
    secOnPncp.style.display  = onPncp ? 'block' : 'none';
    secNotPncp.style.display = onPncp ? 'none'  : 'block';
  });

  openPanelBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) return;

      // Try to send message. If content script isn't loaded yet, inject it first.
      chrome.tabs.sendMessage(tab.id, { action: 'openPanel' }, () => {
        if (chrome.runtime.lastError) {
          // Content script not ready — inject it programmatically then retry
          Promise.all([
            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }),
            chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['styles.css'] }),
          ]).then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { action: 'openPanel' });
              window.close();
            }, 300);
          }).catch(() => {
            // Last resort: just reload the tab on PNCP
            chrome.tabs.reload(tab.id);
            window.close();
          });
        } else {
          window.close();
        }
      });
    });
  });

  saveBtn.addEventListener('click', () => {
    const url = webhookInput.value.trim();
    chrome.storage.local.set({ webhookUrl: url }, () => {
      saveStatus.style.display = 'block';
      setTimeout(() => { saveStatus.style.display = 'none'; }, 2500);
    });
  });
});
