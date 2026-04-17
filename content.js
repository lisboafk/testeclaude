(() => {
  'use strict';

  if (document.getElementById('pncp-ext-root')) return;

  const PNCP_API = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao';
  const PAGE_SIZE = 50;
  const MAX_PAGES = 10;

  const state = {
    isOpen: false,
    isLoading: false,
    results: [],
    selected: new Set(),
    operator: 'OR',
  };

  function todayStr() {
    return new Date().toISOString().substring(0, 10);
  }
  function daysAgoStr(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().substring(0, 10);
  }

  // ─── Inject root ───────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'pncp-ext-root';
  root.innerHTML = `
    <button id="pncp-fab" title="PNCP Filtros Avançados">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      Filtros+
    </button>

    <div id="pncp-panel">
      <div id="pncp-ph">
        <div class="pncp-ph-title">PNCP Filtros Avançados</div>
        <button id="pncp-close-btn" title="Fechar">✕</button>
      </div>

      <div id="pncp-pb">

        <div class="pncp-sec">
          <div class="pncp-lbl">Palavras-chave <span class="pncp-hint-inline">(separadas por vírgula)</span></div>
          <textarea id="pncp-kw" rows="2" placeholder="notebook, computador, impressora"></textarea>
          <div class="pncp-op-row">
            <span class="pncp-hint">Combinar com:</span>
            <button class="pncp-op active" data-op="OR">OR</button>
            <button class="pncp-op" data-op="AND">AND</button>
            <span class="pncp-hint">(filtro local nos resultados)</span>
          </div>
        </div>

        <div class="pncp-sec">
          <div class="pncp-lbl">Período de Publicação <span class="pncp-req">*obrigatório</span></div>
          <div class="pncp-r2">
            <div><label>De</label><input type="date" id="pncp-pub-ini"></div>
            <div><label>Até</label><input type="date" id="pncp-pub-fim"></div>
          </div>
        </div>

        <div class="pncp-sec">
          <div class="pncp-lbl">Data de Disputa <span class="pncp-hint-inline">(filtro local)</span></div>
          <div class="pncp-r2">
            <div><label>De</label><input type="date" id="pncp-disp-ini"></div>
            <div><label>Até</label><input type="date" id="pncp-disp-fim"></div>
          </div>
        </div>

        <div class="pncp-sec">
          <label class="pncp-chk-lbl">
            <input type="checkbox" id="pncp-excl-srp">
            Excluir Registro de Preço (SRP)
          </label>
        </div>

        <div class="pncp-sec">
          <div class="pncp-lbl">Tipo de Objeto</div>
          <select id="pncp-tipo">
            <option value="">Todos</option>
            <option value="3">Compras / Material</option>
            <option value="2">Serviço</option>
            <option value="1">Obra</option>
            <option value="5">Outros</option>
          </select>

          <div class="pncp-lbl">Modalidade</div>
          <select id="pncp-modal">
            <option value="">Todas</option>
            <option value="6">Pregão Eletrônico</option>
            <option value="7">Pregão Presencial</option>
            <option value="4">Concorrência Eletrônica</option>
            <option value="5">Concorrência Presencial</option>
            <option value="8">Dispensa de Licitação</option>
            <option value="9">Inexigibilidade</option>
            <option value="1">Leilão Eletrônico</option>
            <option value="13">Leilão Presencial</option>
            <option value="2">Diálogo Competitivo</option>
            <option value="3">Concurso</option>
            <option value="10">Manifestação de Interesse</option>
            <option value="11">Pré-qualificação</option>
            <option value="12">Credenciamento</option>
          </select>

          <div class="pncp-lbl">UF</div>
          <select id="pncp-uf">
            <option value="">Todas</option>
            <option>AC</option><option>AL</option><option>AM</option><option>AP</option>
            <option>BA</option><option>CE</option><option>DF</option><option>ES</option>
            <option>GO</option><option>MA</option><option>MG</option><option>MS</option>
            <option>MT</option><option>PA</option><option>PB</option><option>PE</option>
            <option>PI</option><option>PR</option><option>RJ</option><option>RN</option>
            <option>RO</option><option>RR</option><option>RS</option><option>SC</option>
            <option>SE</option><option>SP</option><option>TO</option>
          </select>
        </div>

        <div id="pncp-act-row">
          <button id="pncp-search-btn" class="pncp-pri-btn">Buscar no PNCP</button>
          <button id="pncp-clear-btn" class="pncp-ghost-btn">Limpar</button>
        </div>

        <div id="pncp-status"></div>

        <div id="pncp-res-header">
          <span id="pncp-res-count"></span>
          <button id="pncp-selall-btn" class="pncp-link-btn">Selecionar todos</button>
        </div>

        <div id="pncp-res-list"></div>

      </div>
    </div>

    <div id="pncp-floatbar">
      <div class="pncp-fb-info">
        <span id="pncp-fb-count">0</span> selecionada(s)
      </div>
      <div class="pncp-fb-actions">
        <button id="pncp-desel-btn" class="pncp-fb-sec">Desmarcar</button>
        <button id="pncp-send-btn" class="pncp-fb-pri">Enviar para Proposta Pronta</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  // ─── Default dates ─────────────────────────────────────────────────────────
  document.getElementById('pncp-pub-ini').value = daysAgoStr(30);
  document.getElementById('pncp-pub-fim').value = todayStr();

  // ─── Restore saved state ───────────────────────────────────────────────────
  chrome.storage.local.get('pncpState', ({ pncpState: s }) => {
    if (!s) return;
    if (s.kw)       document.getElementById('pncp-kw').value = s.kw;
    if (s.op)       setOp(s.op);
    if (s.pubIni)   document.getElementById('pncp-pub-ini').value = s.pubIni;
    if (s.pubFim)   document.getElementById('pncp-pub-fim').value = s.pubFim;
    if (s.dispIni)  document.getElementById('pncp-disp-ini').value = s.dispIni;
    if (s.dispFim)  document.getElementById('pncp-disp-fim').value = s.dispFim;
    if (s.exclSRP)  document.getElementById('pncp-excl-srp').checked = true;
    if (s.tipo)     document.getElementById('pncp-tipo').value = s.tipo;
    if (s.modal)    document.getElementById('pncp-modal').value = s.modal;
    if (s.uf)       document.getElementById('pncp-uf').value = s.uf;
  });

  // ─── Events ────────────────────────────────────────────────────────────────
  document.getElementById('pncp-fab').addEventListener('click', openPanel);
  document.getElementById('pncp-close-btn').addEventListener('click', closePanel);
  document.getElementById('pncp-search-btn').addEventListener('click', doSearch);
  document.getElementById('pncp-clear-btn').addEventListener('click', clearFilters);
  document.getElementById('pncp-selall-btn').addEventListener('click', toggleSelectAll);
  document.getElementById('pncp-desel-btn').addEventListener('click', deselectAll);
  document.getElementById('pncp-send-btn').addEventListener('click', sendWebhook);

  document.querySelectorAll('.pncp-op').forEach(btn => {
    btn.addEventListener('click', () => setOp(btn.dataset.op));
  });

  // Message from popup (open panel)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'openPanel') openPanel();
  });

  // ─── Panel open/close ──────────────────────────────────────────────────────
  function openPanel() {
    document.getElementById('pncp-panel').classList.add('pncp-open');
    document.getElementById('pncp-fab').style.display = 'none';
    state.isOpen = true;
  }

  function closePanel() {
    document.getElementById('pncp-panel').classList.remove('pncp-open');
    document.getElementById('pncp-fab').style.display = 'flex';
    state.isOpen = false;
  }

  function setOp(op) {
    state.operator = op;
    document.querySelectorAll('.pncp-op').forEach(b => b.classList.toggle('active', b.dataset.op === op));
  }

  // ─── Read current filter values ────────────────────────────────────────────
  function readFilters() {
    return {
      kw:      document.getElementById('pncp-kw').value,
      op:      state.operator,
      pubIni:  document.getElementById('pncp-pub-ini').value,
      pubFim:  document.getElementById('pncp-pub-fim').value,
      dispIni: document.getElementById('pncp-disp-ini').value,
      dispFim: document.getElementById('pncp-disp-fim').value,
      exclSRP: document.getElementById('pncp-excl-srp').checked,
      tipo:    document.getElementById('pncp-tipo').value,
      modal:   document.getElementById('pncp-modal').value,
      uf:      document.getElementById('pncp-uf').value,
    };
  }

  // ─── Search ────────────────────────────────────────────────────────────────
  async function doSearch() {
    const f = readFilters();

    if (!f.pubIni || !f.pubFim) {
      showStatus('Preencha as datas de publicação (obrigatórias).', 'error');
      return;
    }

    chrome.storage.local.set({ pncpState: f });

    state.isLoading = true;
    state.results = [];
    state.selected.clear();
    updateFloatBar();

    const btn = document.getElementById('pncp-search-btn');
    btn.disabled = true;
    btn.textContent = 'Buscando...';
    document.getElementById('pncp-res-list').innerHTML = '';
    document.getElementById('pncp-res-header').style.display = 'none';

    showStatus('Consultando API do PNCP...', 'loading');

    try {
      const raw = await fetchAPI(f);
      const filtered = applyLocalFilters(raw, f);
      state.results = filtered;
      renderResults(filtered);
      showStatus('', '');
    } catch (err) {
      showStatus('Erro ao consultar a API: ' + err.message, 'error');
      console.error('[PNCP+]', err);
    } finally {
      state.isLoading = false;
      btn.disabled = false;
      btn.textContent = 'Buscar no PNCP';
    }
  }

  // ─── API fetch (paginated) ─────────────────────────────────────────────────
  async function fetchAPI(f) {
    const all = [];
    let page = 1;

    while (page <= MAX_PAGES) {
      const url = new URL(PNCP_API);
      url.searchParams.set('dataInicial', f.pubIni.replace(/-/g, ''));
      url.searchParams.set('dataFinal',   f.pubFim.replace(/-/g, ''));
      url.searchParams.set('pagina',       page);
      url.searchParams.set('tamanhoPagina', PAGE_SIZE);

      if (f.tipo)  url.searchParams.set('codigosTipoContratacao', f.tipo);
      if (f.modal) url.searchParams.set('codigoModalidadeContratacao', f.modal);
      if (f.uf)    url.searchParams.set('uf', f.uf);

      showStatus(`Carregando p.${page}… (${all.length} registros até agora)`, 'loading');

      const resp = await fetch(url.toString());

      // 204 No Content or 404 = no more pages
      if (resp.status === 204 || resp.status === 404) break;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      const items = Array.isArray(data)
        ? data
        : (data.data ?? data.resultado ?? data.content ?? data.items ?? []);

      all.push(...items);
      if (items.length < PAGE_SIZE) break;
      page++;
    }

    return all;
  }

  // ─── Client-side filters ───────────────────────────────────────────────────
  function applyLocalFilters(items, f) {
    let res = items;

    // Keyword filter
    const kws = f.kw.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    if (kws.length > 0) {
      res = res.filter(item => {
        const txt = (
          (item.objetoCompra || '') + ' ' + (item.orgaoEntidade?.razaoSocial || '')
        ).toLowerCase();
        return f.op === 'AND'
          ? kws.every(k => txt.includes(k))
          : kws.some(k => txt.includes(k));
      });
    }

    // Exclude SRP
    if (f.exclSRP) {
      res = res.filter(item =>
        !item.srp &&
        !(item.objetoCompra || '').toLowerCase().includes('registro de preç')
      );
    }

    // Dispute date
    if (f.dispIni || f.dispFim) {
      res = res.filter(item => {
        const dt = (item.dataAberturaProposta || item.dataEncerramentoProposta || '').substring(0, 10);
        if (!dt) return false;
        if (f.dispIni && dt < f.dispIni) return false;
        if (f.dispFim && dt > f.dispFim) return false;
        return true;
      });
    }

    return res;
  }

  // ─── Render results ────────────────────────────────────────────────────────
  function renderResults(items) {
    const list   = document.getElementById('pncp-res-list');
    const header = document.getElementById('pncp-res-header');
    list.innerHTML = '';

    if (items.length === 0) {
      list.innerHTML = '<div class="pncp-empty">Nenhum resultado com os filtros aplicados.</div>';
      header.style.display = 'none';
      return;
    }

    header.style.display = 'flex';
    document.getElementById('pncp-res-count').textContent = `${items.length} resultado(s)`;
    document.getElementById('pncp-selall-btn').textContent = 'Selecionar todos';
    items.forEach((item, i) => list.appendChild(makeCard(item, i)));
  }

  function makeCard(item, idx) {
    const div = document.createElement('div');
    div.className = 'pncp-card';

    const objeto   = esc(item.objetoCompra || item.description || 'Sem descrição');
    const orgao    = esc(item.orgaoEntidade?.razaoSocial || '');
    const cnpjRaw  = item.orgaoEntidade?.cnpj || '';
    const cnpj     = cnpjRaw ? fmtCnpj(cnpjRaw) : '';
    const modal    = esc(item.modalidadeNome || '');
    const valor    = item.valorTotalEstimado != null ? fmtMoeda(item.valorTotalEstimado) : '';
    const pubDate  = fmtDate(item.dataPublicacaoPncp || '');
    const dispDate = fmtDate(item.dataAberturaProposta || item.dataEncerramentoProposta || '');
    const srpTag   = item.srp ? '<span class="pncp-tag pncp-srp-tag">SRP</span>' : '';
    const ano      = item.anoCompra || item.ano || '';
    const seq      = item.sequencialCompra || '';
    const link     = cnpjRaw && ano && seq
      ? `https://pncp.gov.br/app/editais/${cnpjRaw}/${ano}/${seq}`
      : '';

    const detailParts = [];
    if (valor)    detailParts.push(`R$ ${valor}`);
    if (pubDate)  detailParts.push(`Pub: ${pubDate}`);
    if (dispDate) detailParts.push(`Disputa: ${dispDate}`);

    div.innerHTML = `
      <div class="pncp-card-chk">
        <input type="checkbox" data-idx="${idx}">
      </div>
      <div class="pncp-card-body">
        <div class="pncp-card-title">${objeto}</div>
        <div class="pncp-card-meta">
          ${modal ? `<span class="pncp-tag">${modal}</span>` : ''}
          ${srpTag}
          <span>${orgao}</span>
          ${cnpj ? `<span class="pncp-cnpj">${cnpj}</span>` : ''}
        </div>
        ${detailParts.length ? `<div class="pncp-card-detail">${detailParts.join(' · ')}</div>` : ''}
        ${link ? `<a href="${link}" target="_blank" rel="noopener" class="pncp-card-link">Ver edital →</a>` : ''}
      </div>
    `;

    const cb = div.querySelector('input[type="checkbox"]');
    cb.checked = state.selected.has(idx);
    cb.addEventListener('change', () => {
      state.selected[cb.checked ? 'add' : 'delete'](idx);
      updateFloatBar();
    });

    return div;
  }

  // ─── Selection helpers ─────────────────────────────────────────────────────
  function toggleSelectAll() {
    const allSel = state.selected.size === state.results.length && state.results.length > 0;
    const btn = document.getElementById('pncp-selall-btn');

    if (allSel) {
      state.selected.clear();
      btn.textContent = 'Selecionar todos';
    } else {
      state.results.forEach((_, i) => state.selected.add(i));
      btn.textContent = 'Desmarcar todos';
    }

    document.querySelectorAll('.pncp-card-chk input').forEach(cb => {
      cb.checked = state.selected.has(Number(cb.dataset.idx));
    });
    updateFloatBar();
  }

  function deselectAll() {
    state.selected.clear();
    document.querySelectorAll('.pncp-card-chk input').forEach(cb => { cb.checked = false; });
    document.getElementById('pncp-selall-btn').textContent = 'Selecionar todos';
    updateFloatBar();
  }

  function updateFloatBar() {
    const n = state.selected.size;
    document.getElementById('pncp-fb-count').textContent = n;
    document.getElementById('pncp-floatbar').style.display = n > 0 ? 'flex' : 'none';
  }

  // ─── Webhook ───────────────────────────────────────────────────────────────
  function sendWebhook() {
    const items = Array.from(state.selected).map(i => state.results[i]);
    const btn = document.getElementById('pncp-send-btn');
    btn.disabled = true;
    btn.textContent = 'Enviando…';

    chrome.runtime.sendMessage({ action: 'sendToWebhook', items }, (res) => {
      btn.disabled = false;
      if (res?.success) {
        btn.textContent = `✓ Enviado (${res.count})`;
        setTimeout(() => { btn.textContent = 'Enviar para Proposta Pronta'; }, 3000);
      } else {
        btn.textContent = 'Erro!';
        alert(res?.error || 'Configure a URL do webhook nas configurações da extensão (ícone na barra do Chrome).');
        setTimeout(() => { btn.textContent = 'Enviar para Proposta Pronta'; }, 3000);
      }
    });
  }

  // ─── Clear ─────────────────────────────────────────────────────────────────
  function clearFilters() {
    document.getElementById('pncp-kw').value      = '';
    document.getElementById('pncp-excl-srp').checked = false;
    document.getElementById('pncp-tipo').value    = '';
    document.getElementById('pncp-modal').value   = '';
    document.getElementById('pncp-uf').value      = '';
    document.getElementById('pncp-pub-ini').value  = daysAgoStr(30);
    document.getElementById('pncp-pub-fim').value  = todayStr();
    document.getElementById('pncp-disp-ini').value = '';
    document.getElementById('pncp-disp-fim').value = '';
    setOp('OR');
    chrome.storage.local.remove('pncpState');
  }

  // ─── Status bar ────────────────────────────────────────────────────────────
  function showStatus(msg, type) {
    const el = document.getElementById('pncp-status');
    el.textContent = msg;
    el.className = 'pncp-status' + (type ? ' pncp-st-' + type : '');
    el.style.display = msg ? 'block' : 'none';
  }

  // ─── Formatters ────────────────────────────────────────────────────────────
  function fmtCnpj(v) {
    return v.length === 14
      ? v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
      : v;
  }
  function fmtMoeda(v) {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  }
  function fmtDate(s) {
    if (!s) return '';
    const [y, m, d] = s.substring(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
