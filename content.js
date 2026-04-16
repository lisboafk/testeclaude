(() => {
  'use strict';

  let currentResults = [];
  let selectedItems = new Set();
  let containerEl = null;
  let floatingBarEl = null;

  // --- Receber mensagens do background ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'displayResults') {
      currentResults = message.results || [];
      selectedItems.clear();
      renderResults(currentResults, message.filters);
      sendResponse({ ok: true });
    }
  });

  // --- Renderizar resultados na página ---
  function renderResults(results, filters) {
    removeExistingUI();
    createContainer();
    createFloatingBar();

    // Header
    const header = document.createElement('div');
    header.className = 'pncp-ext-header';

    const title = document.createElement('h2');
    title.textContent = `Resultados - Filtros Avançados (${results.length})`;
    header.appendChild(title);

    // Info sobre os filtros aplicados
    const filterInfo = document.createElement('div');
    filterInfo.className = 'pncp-ext-filter-info';
    const filterParts = [];
    if (filters.keywords && filters.keywords.length > 0) {
      filterParts.push(`Palavras-chave: "${filters.keywords.join(`" ${filters.operator} "`)}""`);
    }
    if (filters.excluirRegistroPreco) filterParts.push('SRP excluído');
    if (filters.tipoObjeto) {
      const tipos = { '1': 'Material/Compras', '2': 'Serviço', '3': 'Obra' };
      filterParts.push(`Tipo: ${tipos[filters.tipoObjeto] || filters.tipoObjeto}`);
    }
    if (filters.dataDisputaInicial || filters.dataDisputaFinal) {
      filterParts.push(`Data disputa: ${filters.dataDisputaInicial || '...'} até ${filters.dataDisputaFinal || '...'}`);
    }
    filterInfo.textContent = filterParts.join(' | ');
    header.appendChild(filterInfo);

    // Botões do header
    const headerActions = document.createElement('div');
    headerActions.className = 'pncp-ext-header-actions';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'pncp-ext-btn pncp-ext-btn-secondary';
    selectAllBtn.textContent = 'Selecionar todos';
    selectAllBtn.addEventListener('click', () => toggleSelectAll());
    headerActions.appendChild(selectAllBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'pncp-ext-btn pncp-ext-btn-close';
    closeBtn.textContent = 'Fechar';
    closeBtn.addEventListener('click', () => removeExistingUI());
    headerActions.appendChild(closeBtn);

    header.appendChild(headerActions);
    containerEl.appendChild(header);

    // Lista de resultados
    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pncp-ext-empty';
      empty.textContent = 'Nenhum resultado encontrado com os filtros aplicados.';
      containerEl.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'pncp-ext-list';

      results.forEach((item, index) => {
        const card = createResultCard(item, index);
        list.appendChild(card);
      });

      containerEl.appendChild(list);
    }

    document.body.appendChild(containerEl);
    updateFloatingBar();
  }

  // --- Criar card individual de resultado ---
  function createResultCard(item, index) {
    const card = document.createElement('div');
    card.className = 'pncp-ext-card';
    card.dataset.index = index;

    // Checkbox
    const checkboxWrap = document.createElement('div');
    checkboxWrap.className = 'pncp-ext-checkbox-wrap';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'pncp-ext-checkbox';
    checkbox.checked = selectedItems.has(index);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedItems.add(index);
      } else {
        selectedItems.delete(index);
      }
      updateFloatingBar();
    });
    checkboxWrap.appendChild(checkbox);
    card.appendChild(checkboxWrap);

    // Content
    const content = document.createElement('div');
    content.className = 'pncp-ext-card-content';

    // Objeto (título)
    const objeto = document.createElement('div');
    objeto.className = 'pncp-ext-card-title';
    objeto.textContent = item.objetoCompra || item.description || 'Sem descrição';
    content.appendChild(objeto);

    // Meta info
    const meta = document.createElement('div');
    meta.className = 'pncp-ext-card-meta';

    const orgao = item.orgaoEntidade?.razaoSocial || item.orgaoNome || 'Órgão não informado';
    const cnpj = item.orgaoEntidade?.cnpj || '';
    const modalidade = item.modalidadeNome || '';
    const numero = item.numeroCompra || '';
    const ano = item.ano || '';

    meta.innerHTML = `
      <span class="pncp-ext-tag">${modalidade}</span>
      <span>${orgao}</span>
      ${cnpj ? `<span class="pncp-ext-cnpj">${formatCnpj(cnpj)}</span>` : ''}
      ${numero && ano ? `<span>Nº ${numero}/${ano}</span>` : ''}
    `;
    content.appendChild(meta);

    // Detalhes
    const details = document.createElement('div');
    details.className = 'pncp-ext-card-details';

    const valor = item.valorTotalEstimado || item.valorTotalHomologado;
    const dataPublicacao = item.dataPublicacaoPncp ? formatDate(item.dataPublicacaoPncp) : '';
    const dataDisputa = item.dataAberturaProposta || item.dataEncerramentoProposta;
    const srp = item.srp;

    const detailParts = [];
    if (valor != null) detailParts.push(`Valor est.: ${formatCurrency(valor)}`);
    if (dataPublicacao) detailParts.push(`Publicação: ${dataPublicacao}`);
    if (dataDisputa) detailParts.push(`Disputa: ${formatDate(dataDisputa)}`);
    if (srp) detailParts.push('SRP: Sim');

    details.textContent = detailParts.join(' | ');
    content.appendChild(details);

    // Link
    const link = buildEditalLink(item);
    if (link) {
      const linkEl = document.createElement('a');
      linkEl.href = link;
      linkEl.target = '_blank';
      linkEl.className = 'pncp-ext-card-link';
      linkEl.textContent = 'Ver edital';
      content.appendChild(linkEl);
    }

    card.appendChild(content);
    return card;
  }

  // --- Floating bar (seleção) ---
  function createFloatingBar() {
    if (floatingBarEl) floatingBarEl.remove();

    floatingBarEl = document.createElement('div');
    floatingBarEl.className = 'pncp-ext-floating-bar';
    floatingBarEl.style.display = 'none';

    floatingBarEl.innerHTML = `
      <div class="pncp-ext-floating-info">
        <span class="pncp-ext-floating-count">0</span> oportunidade(s) selecionada(s)
      </div>
      <div class="pncp-ext-floating-actions">
        <button class="pncp-ext-btn pncp-ext-btn-secondary pncp-ext-btn-deselect">Desmarcar todas</button>
        <button class="pncp-ext-btn pncp-ext-btn-primary pncp-ext-btn-send">Enviar para Proposta Pronta</button>
      </div>
    `;

    floatingBarEl.querySelector('.pncp-ext-btn-deselect').addEventListener('click', () => {
      selectedItems.clear();
      document.querySelectorAll('.pncp-ext-checkbox').forEach(cb => { cb.checked = false; });
      updateFloatingBar();
    });

    floatingBarEl.querySelector('.pncp-ext-btn-send').addEventListener('click', () => {
      sendToPropostaPronta();
    });

    document.body.appendChild(floatingBarEl);
  }

  function updateFloatingBar() {
    if (!floatingBarEl) return;

    const count = selectedItems.size;
    floatingBarEl.querySelector('.pncp-ext-floating-count').textContent = count;

    if (count > 0) {
      floatingBarEl.style.display = 'flex';
    } else {
      floatingBarEl.style.display = 'none';
    }
  }

  // --- Selecionar/desselecionar todos ---
  function toggleSelectAll() {
    const allSelected = selectedItems.size === currentResults.length;
    const checkboxes = document.querySelectorAll('.pncp-ext-checkbox');

    if (allSelected) {
      selectedItems.clear();
      checkboxes.forEach(cb => { cb.checked = false; });
    } else {
      currentResults.forEach((_, i) => selectedItems.add(i));
      checkboxes.forEach(cb => { cb.checked = true; });
    }

    updateFloatingBar();
  }

  // --- Enviar para Proposta Pronta ---
  function sendToPropostaPronta() {
    if (selectedItems.size === 0) return;

    const items = Array.from(selectedItems).map(i => currentResults[i]);

    const sendBtn = floatingBarEl.querySelector('.pncp-ext-btn-send');
    sendBtn.textContent = 'Enviando...';
    sendBtn.disabled = true;

    chrome.runtime.sendMessage({
      action: 'sendToWebhook',
      items,
    }, (response) => {
      sendBtn.disabled = false;
      if (response && response.success) {
        sendBtn.textContent = `Enviado! (${response.count})`;
        setTimeout(() => {
          sendBtn.textContent = 'Enviar para Proposta Pronta';
        }, 3000);
      } else {
        const errorMsg = response?.error || 'Erro ao enviar.';
        sendBtn.textContent = 'Erro!';
        showNotification(errorMsg, 'error');
        setTimeout(() => {
          sendBtn.textContent = 'Enviar para Proposta Pronta';
        }, 3000);
      }
    });
  }

  // --- Notificação ---
  function showNotification(message, type) {
    const notif = document.createElement('div');
    notif.className = `pncp-ext-notification pncp-ext-notification-${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 5000);
  }

  // --- Helpers ---
  function formatCnpj(cnpj) {
    if (!cnpj || cnpj.length !== 14) return cnpj;
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  function formatCurrency(value) {
    if (value == null) return '';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = dateStr.substring(0, 10);
    const parts = d.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return d;
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

  // --- Cleanup ---
  function removeExistingUI() {
    if (containerEl) {
      containerEl.remove();
      containerEl = null;
    }
    if (floatingBarEl) {
      floatingBarEl.remove();
      floatingBarEl = null;
    }
    const old = document.getElementById('pncp-ext-container');
    if (old) old.remove();
    const oldBar = document.querySelector('.pncp-ext-floating-bar');
    if (oldBar) oldBar.remove();
  }

  // --- Criar container principal ---
  function createContainer() {
    containerEl = document.createElement('div');
    containerEl.id = 'pncp-ext-container';
  }
})();
