// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  products: [],
  categories: [],
  currentCategory: 'todas',
  currentEstado: 'todos',
  search: '',
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,
  editing: null,
  currentTab: 'catalogo',
  sprintData: null,
  pendingEditId: null,
  loading: false,
};

// ─── DOM refs ────────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const categoryList = $('#categoryList');
const productsBody = $('#productsBody');
const searchInput = $('#searchInput');
const estadoFilter = $('#estadoFilter');
const prevPage = $('#prevPage');
const nextPage = $('#nextPage');
const pageInfo = $('#pageInfo');
const resultCount = $('#resultCount');
const currentCategory = $('#currentCategory');
const editPanel = $('#editPanel');
const btnExport = $('#btnExport');

const editId = $('#editId');
const editTitle = $('#editTitle');
const editMetaDesc = $('#editMetaDesc');
const editPrincipio = $('#editPrincipio');
const editPresentacion = $('#editPresentacion');
const editLabLink = $('#editLabLink');
const editKeywords = $('#editKeywords');
const editBullets = $('#editBullets');
const editRegistro = $('#editRegistro');
const editEstado = $('#editEstado');
const editNotas = $('#editNotas');
const editIntranetDesc = $('#editIntranetDesc');
const editProductName = $('#editProductName');
const btnSaveEdit = $('#btnSaveEdit');
const btnCancelEdit = $('#btnCancelEdit');
const btnCloseEdit = $('#btnCloseEdit');
const titleCount = $('#titleCount');
const metaCount = $('#metaCount');

const sprintContent = $('#sprintContent');
const objetivosContent = $('#objetivosContent');

// Config modal
const objModal = $('#objModal');
const cfgMetaVisitas = $('#cfgMetaVisitas');
const cfgVisitasActuales = $('#cfgVisitasActuales');
const cfgInicioProyecto = $('#cfgInicioProyecto');
const cfgFeeMensual = $('#cfgFeeMensual');
const cfgSprintActual = $('#cfgSprintActual');
const btnSaveConfig = $('#btnSaveConfig');
const btnCancelConfig = $('#btnCancelConfig');
const btnCloseModal = $('#btnCloseModal');

// ─── Toast System ────────────────────────────────────────────────────────────
function ensureToastContainer() {
  if (!$('#toastContainer')) {
    const el = document.createElement('div');
    el.id = 'toastContainer';
    document.body.appendChild(el);
  }
}

function toast(msg, type = 'info', duration = 3500) {
  ensureToastContainer();
  const container = $('#toastContainer');
  const icons = { success: '\u2705', error: '\u274C', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${msg}</span>
    <button class="toast-close">&times;</button>
  `;
  el.querySelector('.toast-close').addEventListener('click', () => dismissToast(el));
  container.appendChild(el);
  setTimeout(() => dismissToast(el), duration);
}

function dismissToast(el) {
  if (el.classList.contains('toast-dismissing')) return;
  el.classList.add('toast-dismissing');
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
}

// ─── API calls ───────────────────────────────────────────────────────────────
const api = {
  async get(endpoint) {
    const res = await fetch(`/api${endpoint}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async put(endpoint, data) {
    const res = await fetch(`/api${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async patch(endpoint, data) {
    const res = await fetch(`/api${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

// ─── Tab Switching ───────────────────────────────────────────────────────────
function switchTab(tab) {
  state.currentTab = tab;
  $$('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${tab}`));

  if (tab === 'sprint' && !state.sprintData) {
    loadSprint();
  }
  if (tab === 'objetivos' && !state.sprintData) {
    loadSprint();
  }
}

// ─── Load functions ──────────────────────────────────────────────────────────
async function loadCategories() {
  const categories = await api.get('/categories');
  state.categories = categories;
  renderCategories();
}

async function loadStats() {
  const stats = await api.get('/stats');
  document.getElementById('statTotal').textContent = stats.total;
  document.getElementById('statOptimizados').textContent = stats.optimizados;
  document.getElementById('statPendientes').textContent = stats.pendientes;
  document.getElementById('statRevisar').textContent = stats.revisar;
  document.getElementById('statStock').textContent = stats.conStock;

  const pct = stats.total > 0 ? Math.round((stats.optimizados / stats.total) * 100) : 0;
  document.getElementById('progressPercent').textContent = `${pct}%`;
  document.getElementById('progressFill').style.width = `${pct}%`;
}

async function loadProducts() {
  state.loading = true;
  productsBody.innerHTML = `<tr><td colspan="10"><div style="padding:12px">${renderSkeleton(8)}</div></td></tr>`;

  const params = new URLSearchParams({
    page: state.page,
    limit: state.limit,
  });
  if (state.currentCategory !== 'todas') params.set('subCategory', state.currentCategory);
  if (state.currentEstado !== 'todos') params.set('estado', state.currentEstado);
  if (state.search) params.set('search', state.search);

  try {
    const data = await api.get(`/products?${params}`);
    state.products = data.products;
    state.total = data.total;
    state.totalPages = data.totalPages;
    state.page = data.page;
    state.loading = false;

    renderProducts();
    renderPagination();
    resultCount.textContent = `${data.total} producto${data.total !== 1 ? 's' : ''}`;
  } catch (err) {
    state.loading = false;
    toast('Error al cargar productos: ' + err.message, 'error');
  }
}

async function loadSprint() {
  try {
    const data = await api.get('/sprint');
    state.sprintData = data;
    renderSprint();
    renderObjetivos();
  } catch (err) {
    toast('Error al cargar sprint: ' + err.message, 'error');
  }
}

// ─── Render: Categorías ──────────────────────────────────────────────────────
function renderCategories() {
  let html = '<li data-category="todas" class="active">Todas</li>';
  state.categories.forEach(cat => {
    const isActive = state.currentCategory === cat.name;
    html += `<li data-category="${escHtml(cat.name)}" class="${isActive ? 'active' : ''}">
      ${escHtml(cat.name)}
      <span class="cat-count">${cat.total}</span>
    </li>`;
  });
  categoryList.innerHTML = html;

  categoryList.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      categoryList.querySelectorAll('li').forEach(l => l.classList.remove('active'));
      li.classList.add('active');
      state.currentCategory = li.dataset.category;
      state.page = 1;
      currentCategory.textContent = state.currentCategory === 'todas'
        ? 'Todas las categorías'
        : state.currentCategory;
      loadProducts();
    });
  });
}

function renderSkeleton(rows = 5) {
  let html = '';
  for (let i = 0; i < rows; i++) {
    html += `<div class="skeleton-row">
      <div class="skeleton skeleton-tiny"></div>
      <div class="skeleton"></div>
      <div class="skeleton skeleton-short"></div>
      <div class="skeleton skeleton-tiny"></div>
      <div class="skeleton skeleton-short"></div>
      <div class="skeleton skeleton-badge"></div>
      <div class="skeleton skeleton-tiny"></div>
      <div class="skeleton skeleton-tiny"></div>
      <div class="skeleton skeleton-tiny"></div>
      <div class="skeleton skeleton-tiny"></div>
    </div>`;
  }
  return html;
}

function renderProducts() {
  if (state.products.length === 0) {
    const isFiltered = state.currentCategory !== 'todas' || state.currentEstado !== 'todos' || state.search;
    productsBody.innerHTML = `<tr><td colspan="10"><div class="empty-state">
      <span class="empty-icon">${isFiltered ? '\uD83D\uDD0D' : '\uD83D\uDED2'}</span>
      <div class="empty-title">${isFiltered ? 'Sin resultados' : 'No hay productos'}</div>
      <div class="empty-text">${isFiltered ? 'Probá cambiar los filtros o buscar otro término.' : 'Aún no hay productos en esta categoría.'}</div>
    </div></td></tr>`;
    return;
  }

  let html = '';
  state.products.forEach(p => {
    const stockClass = p.stock_total > 0 ? 'stock-ok' : 'stock-zero';
    const stockLabel = p.stock_total > 0 ? p.stock_total : '0';

    html += `<tr data-id="${p.id}">
      <td class="col-sku">${escHtml(p.sku)}</td>
      <td class="col-name">
        <a href="${escHtml(p.url)}" target="_blank" class="product-link" title="Abrir en farmaloop.cl">
          ${escHtml(truncate(p.fullName, 60))}
        </a>
      </td>
      <td class="col-category">${escHtml(p.subCategory || '-')}</td>
      <td class="col-stock"><span class="${stockClass}">${stockLabel}</span></td>
      <td class="col-principle">${escHtml(p.principio_activo || '-')}</td>
      <td class="col-status">
        <select class="estado-select" data-id="${p.id}" data-sku="${escHtml(p.sku)}">
          <option value="pendiente" ${(p.estado || 'pendiente') === 'pendiente' ? 'selected' : ''}>🙈 pendiente</option>
          <option value="qa completo" ${(p.estado || 'pendiente') === 'qa completo' ? 'selected' : ''}>✅ qa completo</option>
          <option value="qa incompleto" ${(p.estado || 'pendiente') === 'qa incompleto' ? 'selected' : ''}>🔄 qa incompleto</option>
          <option value="prod completo" ${(p.estado || 'pendiente') === 'prod completo' ? 'selected' : ''}>🚀 prod completo</option>
          <option value="prod incompleto" ${(p.estado || 'pendiente') === 'prod incompleto' ? 'selected' : ''}>⚠️ prod incompleto</option>
        </select>
      </td>
      <td class="col-intranet">
        <select class="intranet-select" data-id="${p.id}" data-sku="${escHtml(p.sku)}">
          <option value="pendiente" ${(p.estado_intranet || 'pendiente') === 'pendiente' ? 'selected' : ''}>🙈 pendiente</option>
          <option value="ingresado qa" ${(p.estado_intranet || 'pendiente') === 'ingresado qa' ? 'selected' : ''}>📋 ingresado qa</option>
          <option value="ingresado prod" ${(p.estado_intranet || 'pendiente') === 'ingresado prod' ? 'selected' : ''}>🔍 ingresado prod</option>
          <option value="completado" ${(p.estado_intranet || 'pendiente') === 'completado' ? 'selected' : ''}>✅ completado</option>
        </select>
      </td>
      <td class="col-qa">
        ${p.url_qa ? `<a href="${escHtml(p.url_qa)}" target="_blank" class="qa-link" title="Abrir en QA">🔍</a>` : '<span class="qa-na">—</span>'}
      </td>
      <td class="col-actions">
        <button class="btn btn-sm btn-edit" data-id="${p.id}">✎ Editar</button>
      </td>
      <td class="col-copy">
        <button class="btn btn-sm btn-copy-desc" data-sku="${escHtml(p.sku)}" title="Copiar descripción intranet">📋</button>
      </td>
    </tr>`;
  });
  productsBody.innerHTML = html;

  productsBody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEdit(parseInt(btn.dataset.id)));
  });

  productsBody.querySelectorAll('.btn-copy-desc').forEach(btn => {
    btn.addEventListener('click', () => {
      const sku = btn.dataset.sku;
      const p = state.products.find(x => String(x.sku) === sku);
      if (p && p.descripcion_intranet) {
        copyText(p.descripcion_intranet, btn);
      }
    });
  });

  productsBody.querySelectorAll('.intranet-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = parseInt(sel.dataset.id);
      const estado = sel.value;
      try {
        await api.patch(`/products/${id}/intranet`, { estado_intranet: estado });
        sel.classList.add('saved');
        setTimeout(() => sel.classList.remove('saved'), 1500);
        toast(`Intranet actualizado a "${estado}"`, 'success', 2000);
      } catch (e) { toast('Error: ' + e.message, 'error'); }
    });
  });

  productsBody.querySelectorAll('.estado-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = parseInt(sel.dataset.id);
      const estado = sel.value;
      try {
        await api.patch(`/products/${id}/estado`, { estado });
        sel.classList.add('saved');
        setTimeout(() => sel.classList.remove('saved'), 1500);
        toast(`Estado actualizado a "${estado}"`, 'success', 2000);
      } catch (e) { toast('Error: ' + e.message, 'error'); }
    });
  });
}

function renderPagination() {
  prevPage.disabled = state.page <= 1;
  nextPage.disabled = state.page >= state.totalPages;
  pageInfo.textContent = `Página ${state.page} de ${state.totalPages}`;
}

// ─── Render: Sprint ──────────────────────────────────────────────────────────
function renderSprint() {
  const d = state.sprintData;
  const currentWeek = d.currentWeek;

  let html = `
    <div class="sprint-header">
      <h2>📊 Sprint ${currentWeek}/8</h2>
      <span class="sprint-week-label">${d.timeline[currentWeek - 1]?.label || 'Checkpoint Final'}</span>
    </div>

    <div class="sprint-global-progress">
      <div class="sprint-gp-left">
        <div class="sprint-gp-number">${d.completado}</div>
        <div class="sprint-gp-label">completados</div>
      </div>
      <div class="sprint-gp-center">
        <div class="sprint-triple-bars">
          <div class="triple-bar-row">
            <span class="triple-bar-icon">🟡</span>
            <span class="triple-bar-label">QA</span>
            <div class="triple-bar-track">
              <div class="triple-bar-fill fill-qa" style="width: ${d.globalPctQA}%"></div>
            </div>
            <span class="triple-bar-pct">${d.globalPctQA}%</span>
            <span class="triple-bar-num">${d.enQA}</span>
          </div>
          <div class="triple-bar-row">
            <span class="triple-bar-icon">🔵</span>
            <span class="triple-bar-label">PROD</span>
            <div class="triple-bar-track">
              <div class="triple-bar-fill fill-prod" style="width: ${d.globalPctPROD}%"></div>
            </div>
            <span class="triple-bar-pct">${d.globalPctPROD}%</span>
            <span class="triple-bar-num">${d.enPROD}</span>
          </div>
          <div class="triple-bar-row">
            <span class="triple-bar-icon">🟢</span>
            <span class="triple-bar-label">Completado</span>
            <div class="triple-bar-track">
              <div class="triple-bar-fill fill-comp" style="width: ${d.globalPctComp}%"></div>
            </div>
            <span class="triple-bar-pct">${d.globalPctComp}%</span>
            <span class="triple-bar-num">${d.completado}</span>
          </div>
        </div>
        <div class="sprint-gp-sub">${d.totalProducts} productos totales</div>
      </div>
      <div class="sprint-gp-right">
        <div class="sprint-gp-number">${d.totalProducts - d.enQA}</div>
        <div class="sprint-gp-label">pendientes</div>
      </div>
    </div>
  `;

  // Timeline con minibarras triples
  html += `<div class="sprint-timeline"><h3>📅 Timeline</h3><div class="timeline-grid">`;
  d.timeline.forEach(s => {
    const isCurrent = s.week === currentWeek;
    const isPast = s.week < currentWeek;
    const isFuture = s.week > currentWeek;
    const cls = `timeline-card ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`;
    const icon = isPast ? '✅' : (isCurrent ? '▶️' : '○');

    html += `
      <div class="${cls}">
        <div class="tl-week">${icon} Semana ${s.week}</div>
        <div class="tl-label">${escHtml(s.label)}</div>
        <div class="tl-triple-minibars">
          <div class="tl-minibar"><span class="tl-mini-dot fill-qa"></span><span class="tl-mini-pct">${s.pct_qa}%</span></div>
          <div class="tl-minibar"><span class="tl-mini-dot fill-prod"></span><span class="tl-mini-pct">${s.pct_prod}%</span></div>
          <div class="tl-minibar"><span class="tl-mini-dot fill-comp"></span><span class="tl-mini-pct">${s.pct_comp}%</span></div>
        </div>
        <div class="tl-stats">
          ${s.week === 8 ? '—' : `${s.en_qa}/${s.total} QA · ${s.completado} OK`}
        </div>
      </div>`;
  });
  html += `</div></div>`;

  // Categorías priorizadas con QA/PROD/Completado
  html += `<div class="sprint-categories"><h3>📦 Categorías Priorizadas</h3><div class="sprint-cat-table">`;
  html += `
    <div class="sprint-cat-row sprint-cat-header">
      <span class="sct-name">Categoría</span>
      <span class="sct-total">Total</span>
      <span class="sct-qa">QA</span>
      <span class="sct-prod">PROD</span>
      <span class="sct-comp">Comp.</span>
      <span class="sct-bar">Avance</span>
    </div>`;

  d.categoryStats.forEach(c => {
    const pctQA = c.total > 0 ? Math.round((c.en_qa / c.total) * 100) : 0;
    const pctComp = c.total > 0 ? Math.round((c.completado / c.total) * 100) : 0;
    html += `
      <div class="sprint-cat-row">
        <span class="sct-name">${escHtml(c.name)}</span>
        <span class="sct-total">${c.total}</span>
        <span class="sct-qa">${c.en_qa || 0}</span>
        <span class="sct-prod">${c.en_prod || 0}</span>
        <span class="sct-comp">${c.completado || 0}</span>
        <span class="sct-bar">
          <div class="tl-bar"><div class="tl-fill" style="width: ${pctComp}%"></div></div>
          <small>${pctComp}%</small>
        </span>
      </div>`;
  });
  html += `</div></div>`;

  sprintContent.innerHTML = html;
}

// ─── Config Modal ────────────────────────────────────────────────────────────
async function openConfigModal() {
  try {
    const cfg = await api.get('/config');
    cfgMetaVisitas.value = cfg.meta_visitas || '150000';
    cfgVisitasActuales.value = cfg.visitas_actuales || '50000';
    cfgInicioProyecto.value = cfg.inicio_proyecto || '2026-05-25';
    cfgFeeMensual.value = cfg.fee_mensual || '980000';
    cfgSprintActual.value = cfg.sprint_actual || '1';
    objModal.classList.remove('hidden');
  } catch (err) {
    toast('Error al cargar configuración: ' + err.message, 'error');
  }
}

function closeConfigModal() {
  objModal.classList.add('hidden');
}

async function saveConfig() {
  try {
    await api.put('/config', {
      meta_visitas: cfgMetaVisitas.value,
      visitas_actuales: cfgVisitasActuales.value,
      inicio_proyecto: cfgInicioProyecto.value,
      fee_mensual: cfgFeeMensual.value,
      sprint_actual: cfgSprintActual.value,
    });
    closeConfigModal();
    state.sprintData = null;
    loadSprint();
  } catch (err) {
    toast('Error al guardar configuración: ' + err.message, 'error');
  }
}

// ─── Render: Objetivos ───────────────────────────────────────────────────────
function renderObjetivos() {
  const d = state.sprintData;
  const o = d.objectives;

  let html = `
    <div class="obj-header">
      <div class="obj-header-top">
        <h2>🎯 Objetivos del Proyecto</h2>
        <button id="btnEditObjetivos" class="btn btn-outline btn-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Editar
        </button>
      </div>
      <p class="obj-sub">Meta: ${o.target.toLocaleString()} visitas orgánicas/mes en 8 semanas</p>
    </div>

    <div class="obj-main-metric">
      <div class="obj-metric-card">
        <div class="obj-metric-label">Meta</div>
        <div class="obj-metric-value">${(o.target / 1000).toFixed(0)}K</div>
      </div>
      <div class="obj-metric-card current">
        <div class="obj-metric-label">Actual</div>
        <div class="obj-metric-value">${(o.current / 1000).toFixed(0)}K</div>
      </div>
      <div class="obj-metric-card gap">
        <div class="obj-metric-label">Brecha</div>
        <div class="obj-metric-value">${(o.gap / 1000).toFixed(0)}K</div>
      </div>
      <div class="obj-metric-card pct">
        <div class="obj-metric-label">Progreso</div>
        <div class="obj-metric-value">${o.pct}%</div>
      </div>
    </div>

    <div class="obj-bar-section">
      <div class="tl-bar obj-bar">
        <div class="tl-fill" style="width: ${o.pct}%"></div>
      </div>
      <div class="obj-bar-labels">
        <span>0</span>
        <span>${Math.round(o.target / 3 / 1000)}K</span>
        <span>${Math.round((o.target * 2) / 3 / 1000)}K</span>
        <span>${(o.target / 1000).toFixed(0)}K</span>
      </div>
    </div>

    <div class="obj-block">
      <h3>📄 Bloque 1 — Cobertura por Principios Activos</h3>
      <div class="obj-block-list">`;

  d.categoryStats.forEach(c => {
    const hasQA = c.en_qa > 0;
    const pct = c.total > 0 ? Math.round((c.en_qa / c.total) * 100) : 0;
    html += `
      <div class="obj-block-item ${hasQA ? 'done' : ''}">
        <span class="obj-check">${hasQA ? '✅' : '⬜'}</span>
        <span class="obj-name">${escHtml(c.name)}</span>
        <span class="obj-progress">${c.en_qa}/${c.total} (${pct}%)</span>
      </div>`;
  });

  html += `
      </div>
    </div>

    <div class="obj-block">
      <h3>🔗 Bloque 2 — Enlazado Interno</h3>
      <div class="obj-block-list">
        <div class="obj-block-item">
          <span class="obj-check">⬜</span>
          <span class="obj-name">Producto → Categoría correspondiente</span>
        </div>
        <div class="obj-block-item">
          <span class="obj-check">⬜</span>
          <span class="obj-name">Categoría → Productos principales</span>
        </div>
        <div class="obj-block-item">
          <span class="obj-check">⬜</span>
          <span class="obj-name">Home → Categorías estratégicas</span>
        </div>
      </div>
    </div>

    <div class="obj-block">
      <h3>📈 Checkpoints</h3>
      <div class="obj-block-list">
        <div class="obj-block-item">
          <span class="obj-check">⬜</span>
          <span class="obj-name">Semana 8 — Evaluación final vs ${o.target.toLocaleString()} visitas</span>
        </div>
      </div>
    </div>

    <div class="obj-footer">
      <p>📅 Inicio: 25 Mayo 2026 · Duración: 8 semanas · Inversión: $980.000/mes</p>
    </div>
  `;

  objetivosContent.innerHTML = html;

  // Event listener para botón Editar
  document.getElementById('btnEditObjetivos')?.addEventListener('click', openConfigModal);
}

// ─── Edit panel ──────────────────────────────────────────────────────────────
function openEdit(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;

  state.editing = id;
  editId.value = product.id;
  editProductName.textContent = product.fullName || `Producto SKU: ${product.sku}`;
  editTitle.value = product.title_optimizado || '';
  editMetaDesc.value = product.meta_description_optimizado || '';
  editPrincipio.value = product.principio_activo || '';
  editPresentacion.value = product.presentacion_optimizada || '';
  editLabLink.value = product.link_laboratorio || '';
  editKeywords.value = product.keywords_ocultos || '';
  editBullets.value = product.bullets_atributos || '';
  editRegistro.value = product.registro_isp || '';
  editEstado.value = product.estado || 'pendiente';
  editNotas.value = product.notas || '';
  editIntranetDesc.value = product.descripcion_intranet || '';

  updateCharCounts();
  editPanel.classList.remove('hidden');
  editPanel.classList.add('visible');
  editPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeEdit() {
  state.editing = null;
  editPanel.classList.remove('visible');
  editPanel.classList.add('hidden');
}

async function saveEdit() {
  const id = parseInt(editId.value);
  if (!id) return;

  const data = {
    title_optimizado: editTitle.value.trim(),
    meta_description_optimizado: editMetaDesc.value.trim(),
    principio_activo: editPrincipio.value.trim(),
    presentacion_optimizada: editPresentacion.value.trim(),
    link_laboratorio: editLabLink.value.trim(),
    keywords_ocultos: editKeywords.value.trim(),
    bullets_atributos: editBullets.value.trim(),
    registro_isp: editRegistro.value.trim(),
    estado: editEstado.value,
    notas: editNotas.value.trim(),
  };

  try {
    await api.put(`/products/${id}`, data);
    closeEdit();
    toast('Producto guardado correctamente', 'success');
    loadStats();
    loadProducts();
    // Recargar sprint si está visible
    if (state.currentTab !== 'catalogo') {
      state.sprintData = null;
      loadSprint();
    }
  } catch (err) {
    toast('Error al guardar: ' + err.message, 'error');
  }
}

function updateCharCounts() {
  const tLen = editTitle.value.length;
  const mLen = editMetaDesc.value.length;
  titleCount.textContent = `${tLen}/60`;
  metaCount.textContent = `${mLen}/160`;
  titleCount.className = 'char-count' + (tLen > 60 ? ' over' : tLen > 50 ? ' warn' : '');
  metaCount.className = 'char-count' + (mLen > 160 ? ' over' : mLen > 145 ? ' warn' : '');
}

// ─── Event listeners ─────────────────────────────────────────────────────────
// Tabs
$$('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

searchInput.addEventListener('input', debounce(() => {
  state.search = searchInput.value.trim();
  state.page = 1;
  loadProducts();
}, 300));

estadoFilter.addEventListener('change', () => {
  state.currentEstado = estadoFilter.value;
  state.page = 1;
  loadProducts();
});

prevPage.addEventListener('click', () => {
  if (state.page > 1) { state.page--; loadProducts(); }
});

nextPage.addEventListener('click', () => {
  if (state.page < state.totalPages) { state.page++; loadProducts(); }
});

editTitle.addEventListener('input', updateCharCounts);
editMetaDesc.addEventListener('input', updateCharCounts);

btnSaveEdit.addEventListener('click', saveEdit);
btnCancelEdit.addEventListener('click', closeEdit);
btnCloseEdit.addEventListener('click', closeEdit);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.editing) closeEdit();
});

btnExport.addEventListener('click', async () => {
  const params = new URLSearchParams();
  if (state.currentCategory !== 'todas') params.set('subCategory', state.currentCategory);
  if (state.currentEstado !== 'todos') params.set('estado', state.currentEstado);

  const url = `/api/export/excel?${params}`;
  window.open(url, '_blank');
});

// Import Excel
const btnImport = $('#btnImport');
const fileInput = $('#fileInput');

btnImport?.addEventListener('click', () => {
  fileInput?.click();
});

fileInput?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/import/excel', { method: 'POST', body: formData });
    const result = await res.json();
    toast(result.message || 'Importacion completada', 'success');
    if (result.feedback && result.feedback.length > 0) {
      console.log('Feedback recibido:', result.feedback);
    }
    loadStats();
    loadProducts();
  } catch (err) {
    toast('Error al importar: ' + err.message, 'error');
  }

  fileInput.value = '';
});

// Config modal
btnSaveConfig.addEventListener('click', saveConfig);
btnCancelConfig.addEventListener('click', closeConfigModal);
btnCloseModal.addEventListener('click', closeConfigModal);

// Cerrar modal con Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !objModal.classList.contains('hidden')) closeConfigModal();
});

// Cerrar modal haciendo clic fuera
document.querySelector('.modal-backdrop')?.addEventListener('click', closeConfigModal);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max) + '…' : str;
}

// Copiar texto al portapapeles (funciona en HTTP y HTTPS)
function copyText(text, btn) {
  const done = () => {
    if (btn) {
      btn.textContent = '\u2705';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = '\uD83D\uDCCB'; btn.classList.remove('copied'); }, 2000);
    }
    toast('Descripcion copiada al portapapeles', 'success', 2000);
  };
  // Método moderno (HTTPS)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, btn));
    return;
  }
  fallbackCopy(text, btn);
}

function fallbackCopy(text, btn) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    if (btn) {
      btn.textContent = '\u2705';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = '\uD83D\uDCCB'; btn.classList.remove('copied'); }, 2000);
    }
    toast('Descripcion copiada', 'success', 2000);
  } catch (e) {
    toast('Error al copiar', 'error');
  }
  document.body.removeChild(ta);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ─── Init ────────────────────────────────────────────────────────────────────
// ─── Theme toggle ─────────────────────────────────────────────────────────────
const themeToggle = document.getElementById('themeToggle');
const themeIcon = { dark: '☀️', light: '🌙' };

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (themeToggle) themeToggle.textContent = themeIcon[theme] || '🌙';
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Cargar tema guardado
const saved = localStorage.getItem('theme') || 'light';
applyTheme(saved);
if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

async function init() {
  await loadStats();
  await loadCategories();
  await loadProducts();
}

init();
