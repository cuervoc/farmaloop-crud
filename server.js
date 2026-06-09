const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs');
const multer = require('multer');

const app = express();
const PORT = 3001;

// ─── Config ──────────────────────────────────────────────────────────────────
const DB_CONFIG = {
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3307'),
  user: process.env.MYSQLUSER || process.env.DB_USER || 'seo_user',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || 'seo_pass_2026',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'farmaloop_seo',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
};

let pool;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Constantes ──────────────────────────────────────────────────────────────
const CATEGORIAS_BLOQUE1 = [
  'Control de Peso', 'Diabetes', 'Colesterol', 'Salud Mental',
  'Anticonceptivos y Hormonas', 'Fertilidad', 'Hipertensión',
  'Sistema Digestivo', 'Huesos y Articulaciones', 'Bienestar Sexual',
  'Sistema Inmune', 'Omega 3', 'Probióticos',
];
const CAT_IN_CLAUSE = () => CATEGORIAS_BLOQUE1.map(() => '?').join(',');

// ─── Multer (import Excel) ─────────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildWhereClause(filters) {
  const conditions = [];
  const params = [];

  // Siempre filtrar por las 13 categorías del Bloque 1
  conditions.push(`subCategory IN (${CAT_IN_CLAUSE()})`);
  params.push(...CATEGORIAS_BLOQUE1);

  if (filters.subCategory && filters.subCategory !== 'todas') {
    conditions.push('subCategory = ?');
    params.push(filters.subCategory);
  }
  if (filters.estado && filters.estado !== 'todos') {
    conditions.push('estado = ?');
    params.push(filters.estado);
  }
  if (filters.search) {
    conditions.push('(fullName LIKE ? OR sku LIKE ? OR principio_activo LIKE ?)');
    const s = `%${filters.search}%`;
    params.push(s, s, s);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

function buildQaUrl(productUrl) {
  if (!productUrl) return '';
  const url = productUrl.trim();
  if (url.startsWith('/')) {
    return `https://qa.farmaloop.cl${url}`;
  }
  if (url.includes('farmaloop.cl')) {
    return url.replace(/https?:\/\/[^\/]+farmaloop\.cl/, 'https://qa.farmaloop.cl');
  }
  return url;
}

function enrichProducts(rows) {
  return rows.map(r => ({
    ...r,
    descripcion_intranet: (r.descripcion_intranet && r.descripcion_intranet.trim() !== '')
      ? r.descripcion_intranet
      : buildIntranetDescription(r),
    url_qa: buildQaUrl(r.url),
  }));
}

// ─── API Routes ──────────────────────────────────────────────────────────────

// GET /api/products - Listar productos con filtros
app.get('/api/products', async (req, res) => {
  try {
    const { where, params } = buildWhereClause(req.query);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const countRows = await query(`SELECT COUNT(*) as total FROM products ${where}`, params);
    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limit) || 1;

    const products = await query(
      `SELECT * FROM products ${where} ORDER BY priority DESC, fullName ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ products: enrichProducts(products), total, page, limit, totalPages });
  } catch (error) {
    console.error('GET /api/products error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/products/:id
app.get('/api/products/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(enrichProducts(rows)[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/products/:id - Actualizar campos SEO
app.put('/api/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const seoFields = [
      'title_optimizado', 'meta_description_optimizado', 'link_laboratorio',
      'principio_activo', 'presentacion_optimizada', 'keywords_ocultos',
      'bullets_atributos', 'registro_isp', 'descripcion_intranet', 'estado', 'notas'
    ];

    const updates = [];
    const values = [];

    seoFields.forEach(f => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    if (req.body.estado === 'prod completo') {
      updates.push('fecha_optimizacion = NOW()');
    }
    values.push(id);

    await query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);

    const rows = await query('SELECT * FROM products WHERE id = ?', [id]);
    res.json(enrichProducts(rows)[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/products/:id/estado
app.patch('/api/products/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body;
      const validEstados = ['pendiente', 'qa completo', 'qa incompleto', 'prod completo', 'prod incompleto'];
    if (!validEstados.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const fechaOpt = estado === 'prod completo' ? 'NOW()' : 'NULL';
    await query(
      `UPDATE products SET estado = ?, fecha_optimizacion = ${fechaOpt} WHERE id = ?`,
      [estado, parseInt(req.params.id)]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/products/:id/intranet - Actualizar estado de intranet
app.patch('/api/products/:id/intranet', async (req, res) => {
  try {
    const { estado_intranet } = req.body;
    if (!['pendiente', 'ingresado qa', 'ingresado prod', 'completado'].includes(estado_intranet)) {
      return res.status(400).json({ error: 'Estado intranet inv\u00E1lido' });
    }
    await query(
      'UPDATE products SET estado_intranet = ? WHERE id = ?',
      [estado_intranet, parseInt(req.params.id)]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/categories
app.get('/api/categories', async (req, res) => {
  try {
    const rows = await query(`
      SELECT subCategory as name,
             COUNT(*) as total,
             CAST(SUM(CASE WHEN estado IN ('qa completo','prod completo','prod incompleto') THEN 1 ELSE 0 END) AS UNSIGNED) as en_qa,
             CAST(SUM(CASE WHEN estado IN ('prod completo','prod incompleto') THEN 1 ELSE 0 END) AS UNSIGNED) as en_prod,
             CAST(SUM(CASE WHEN estado = 'prod completo' THEN 1 ELSE 0 END) AS UNSIGNED) as completado,
             CAST(SUM(CASE WHEN estado = 'pendiente' OR estado IS NULL THEN 1 ELSE 0 END) AS UNSIGNED) as pendientes
      FROM products
      WHERE subCategory IN (${CAT_IN_CLAUSE()})
      GROUP BY subCategory
      ORDER BY total DESC
    `, CATEGORIAS_BLOQUE1);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/stats
app.get('/api/stats', async (req, res) => {
  try {
    const [total] = await query(`SELECT COUNT(*) as total FROM products WHERE subCategory IN (${CAT_IN_CLAUSE()})`, CATEGORIAS_BLOQUE1);
    const [enQA] = await query(`SELECT CAST(COUNT(*) AS UNSIGNED) as total FROM products WHERE subCategory IN (${CAT_IN_CLAUSE()}) AND estado IN ('qa completo','prod completo','prod incompleto')`, CATEGORIAS_BLOQUE1);
    const [enPROD] = await query(`SELECT CAST(COUNT(*) AS UNSIGNED) as total FROM products WHERE subCategory IN (${CAT_IN_CLAUSE()}) AND estado IN ('prod completo','prod incompleto')`, CATEGORIAS_BLOQUE1);
    const [completado] = await query(`SELECT CAST(COUNT(*) AS UNSIGNED) as total FROM products WHERE subCategory IN (${CAT_IN_CLAUSE()}) AND estado = 'prod completo'`, CATEGORIAS_BLOQUE1);
    const [pendientes] = await query(`SELECT CAST(COUNT(*) AS UNSIGNED) as total FROM products WHERE subCategory IN (${CAT_IN_CLAUSE()}) AND (estado = 'pendiente' OR estado IS NULL)`, CATEGORIAS_BLOQUE1);
    const [conStock] = await query(`SELECT CAST(COUNT(*) AS UNSIGNED) as total FROM products WHERE subCategory IN (${CAT_IN_CLAUSE()}) AND stock_total > 0`, CATEGORIAS_BLOQUE1);

    res.json({
      total: total.total,
      enQA: enQA.total,
      enPROD: enPROD.total,
      completado: completado.total,
      pendientes: pendientes.total,
      conStock: conStock.total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── SPRINT CONFIG ───────────────────────────────────────────────────────────
const SPRINT_PLAN = [
  { week: 1, categories: ['Control de Peso', 'Fertilidad'], label: 'Control Peso + Fertilidad' },
  { week: 2, categories: ['Diabetes', 'Colesterol'], label: 'Diabetes + Colesterol' },
  { week: 3, categories: ['Salud Mental'], label: 'Salud Mental (1/2)' },
  { week: 4, categories: ['Anticonceptivos y Hormonas'], label: 'Salud Mental (2/2) + Anticonceptivos' },
  { week: 5, categories: ['Hipertensión'], label: 'Hipertensión' },
  { week: 6, categories: ['Sistema Digestivo', 'Huesos y Articulaciones'], label: 'Digestivo + Huesos' },
  { week: 7, categories: ['Bienestar Sexual', 'Sistema Inmune', 'Omega 3', 'Probióticos', 'Vitaminas y Minerales', 'Vitaminas', 'Suplementos'], label: 'Resto + Vitaminas' },
  { week: 8, categories: [], label: '🏁 Checkpoint Final' },
];

const PRIORITY_CATEGORIES = SPRINT_PLAN.flatMap(s => s.categories).filter(Boolean);

// GET /api/sprint - Datos del plan de 8 semanas
app.get('/api/sprint', async (req, res) => {
  try {
    // Stats globales (productos del Bloque 1)
    const [total] = await query('SELECT COUNT(*) as total FROM products');
    const [qaProd] = await query("SELECT COUNT(*) as total FROM products WHERE estado IN ('qa completo','prod completo','prod incompleto')");
    const [enProd] = await query("SELECT COUNT(*) as total FROM products WHERE estado IN ('prod completo','prod incompleto')");
    const [completado] = await query("SELECT COUNT(*) as total FROM products WHERE estado = 'prod completo'");

    // Stats por categoría prioritaria
    const placeholders = PRIORITY_CATEGORIES.map(() => '?').join(',');
    const catStats = await query(
      `SELECT subCategory as name, COUNT(*) as total,
              CAST(SUM(CASE WHEN estado IN ('qa completo','prod completo','prod incompleto') THEN 1 ELSE 0 END) AS UNSIGNED) as en_qa,
              CAST(SUM(CASE WHEN estado IN ('prod completo','prod incompleto') THEN 1 ELSE 0 END) AS UNSIGNED) as en_prod,
              CAST(SUM(CASE WHEN estado = 'prod completo' THEN 1 ELSE 0 END) AS UNSIGNED) as completado,
              CAST(SUM(CASE WHEN estado = 'pendiente' OR estado IS NULL THEN 1 ELSE 0 END) AS UNSIGNED) as pendientes
       FROM products
       WHERE subCategory IN (${placeholders})
       GROUP BY subCategory`,
      PRIORITY_CATEGORIES
    );

    // Calcular avance por semana (mismo cálculo que el nuevo esquema)
    const catMap = {};
    catStats.forEach(c => { catMap[c.name] = c; });

    const timeline = SPRINT_PLAN.map(sprint => {
      let totalWeek = 0, qaWeek = 0, prodWeek = 0, compWeek = 0;
      sprint.categories.forEach(cat => {
        if (catMap[cat]) {
          totalWeek += catMap[cat].total;
          qaWeek += Number(catMap[cat].en_qa) || 0;
          prodWeek += Number(catMap[cat].en_prod) || 0;
          compWeek += Number(catMap[cat].completado) || 0;
        }
      });
      return {
        week: sprint.week,
        label: sprint.label,
        categories: sprint.categories,
        total: totalWeek,
        en_qa: qaWeek,
        en_prod: prodWeek,
        completado: compWeek,
        pendientes: totalWeek - qaWeek,
        pct_qa: totalWeek > 0 ? Math.round((qaWeek / totalWeek) * 100) : 0,
        pct_prod: totalWeek > 0 ? Math.round((prodWeek / totalWeek) * 100) : 0,
        pct_comp: totalWeek > 0 ? Math.round((compWeek / totalWeek) * 100) : 0,
      };
    });

    // Leer configuración desde DB
    const configRows = await query('SELECT key_name, value FROM config');
    const cfg = {};
    configRows.forEach(r => { cfg[r.key_name] = r.value; });

    const target = parseInt(cfg.meta_visitas) || 150000;
    const current = parseInt(cfg.visitas_actuales) || 50000;
    const sprintOverride = parseInt(cfg.sprint_actual) || 0;

    const currentWeek = sprintOverride > 0
      ? sprintOverride
      : Math.min(Math.max(Math.floor((Date.now() - new Date(cfg.inicio_proyecto || '2026-05-25').getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1, 1), 8);

    res.json({
      currentWeek,
      totalWeeks: 8,
      totalProducts: total.total,
      enQA: qaProd.total,
      enPROD: enProd.total,
      completado: completado.total,
      globalPctQA: total.total > 0 ? Math.round((qaProd.total / total.total) * 100) : 0,
      globalPctPROD: total.total > 0 ? Math.round((enProd.total / total.total) * 100) : 0,
      globalPctComp: total.total > 0 ? Math.round((completado.total / total.total) * 100) : 0,
      timeline,
      categoryStats: catStats,
      priorityCategories: PRIORITY_CATEGORIES,
      objectives: {
        target,
        current,
        gap: target - current,
        pct: target > 0 ? Math.round((current / target) * 100) : 0
      }
    });
  } catch (error) {
    console.error('GET /api/sprint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/config - Obtener config completa
app.get('/api/config', async (req, res) => {
  try {
    const rows = await query('SELECT key_name, value FROM config ORDER BY key_name');
    const cfg = {};
    rows.forEach(r => { cfg[r.key_name] = r.value; });
    res.json(cfg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/config - Actualizar configuración
app.put('/api/config', async (req, res) => {
  try {
    const allowed = ['meta_visitas', 'visitas_actuales', 'inicio_proyecto', 'fee_mensual', 'sprint_actual'];
    let updated = 0;

    for (const [key, value] of Object.entries(req.body)) {
      if (allowed.includes(key)) {
        await query(
          'INSERT INTO config (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
          [key, String(value), String(value)]
        );
        updated++;
      }
    }

    res.json({ success: true, updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Helpers de estilo ──────────────────────────────────────────────────────
const ESTADO_COLORS = {
  'prod completo':  { bg: 'FFC8E6C9', font: 'FF2E7D32' },  // verde
  'prod incompleto':{ bg: 'FFFFCDD2', font: 'FFC62828' },  // rojo
  'qa completo':    { bg: 'FFE3F2FD', font: 'FF1565C0' },  // azul
  'qa incompleto':  { bg: 'FFFFE082', font: 'FFF57F17' },  // ámbar
  pendiente:        { bg: 'FFF3F4F6', font: 'FF6B7280' },  // gris
};

function applyRowStyle(row, estado) {
  const colors = ESTADO_COLORS[estado] || ESTADO_COLORS.pendiente;
  const estadoIcon = {
    'pendiente':     '\uD83D\uDE48',  // 🙈
    'qa completo':   '\u2705',        // ✅
    'qa incompleto': '\uD83D\uDD04',  // 🔄
    'prod completo': '\uD83D\uDE80',  // 🚀
    'prod incompleto':'\u26A0\uFE0F', // ⚠️
  }[estado] || '\uD83D\uDE48';
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
    cell.font = { ...cell.font, color: { argb: colors.font }, size: 10 };
    cell.border = {
      top:    { style: 'hair', color: { argb: 'FFE0E0E0' } },
      left:   { style: 'hair', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'hair', color: { argb: 'FFE0E0E0' } },
      right:  { style: 'hair', color: { argb: 'FFE0E0E0' } }
    };
    cell.alignment = { ...cell.alignment, vertical: 'top', wrapText: true };
  });
  // Marcar estado con icono
  const estadoCell = row.getCell('estado');
  if (estadoCell) estadoCell.value = `${estadoIcon} ${estado}`;
  row.height = Math.max(row.height || 18, 28);
}

function buildIntranetDescription(p) {
  const lab = p.laboratorio || '';
  const pres = p.presentacion_optimizada || '';
  const titulo = p.title_optimizado || '';
  const bullets = p.bullets_atributos || '';
  const isp = p.registro_isp || '';

  // Nombre base del producto
  const nombre = titulo.split('|')[0].trim() || pres || 'Producto';

  // Formatear bullets: si ya tienen guión dejarlos, si no agregarlo
  const bulletsFormatted = bullets
    .split('\n')
    .filter(b => b.trim())
    .map(b => {
      const trimmed = b.trim();
      return trimmed.startsWith('-') ? trimmed : `- ${trimmed}`;
    })
    .join('\n');

  const descripcion = [
    `${nombre}${lab ? ' - ' + lab : ''}`,
    `Compra online en Farmaloop y recibe con despacho a domicilio.`,
    `Revisa precio, stock y disponibilidad actualizada antes de comprar.`,
    `Venta sujeta a receta m\u00E9dica cuando aplique. Uso responsable seg\u00FAn indicaci\u00F3n profesional.`,
    ``,
  ];

  if (bulletsFormatted) {
    descripcion.push(`${bulletsFormatted}`);
    descripcion.push('');
  }

  if (isp) {
    descripcion.push(`Registro ISP: ${isp}`);
    descripcion.push('');
  }

  descripcion.push(`Condici\u00F3n de almacenado:`);
  descripcion.push(`Mantener en lugar fresco y seco, protegido de la luz. Evitar temperaturas extremas. Mantener fuera del alcance de los ni\u00F1os.`);
  descripcion.push('');
  descripcion.push(`Indicaciones de embarazo y lactancia:`);
  descripcion.push(`Uso solo bajo indicaci\u00F3n m\u00E9dica. Si est\u00E1s embarazada, planeas estarlo o en per\u00EDodo de lactancia, consulta a tu m\u00E9dico antes de usar.`);

  return descripcion.join('\n');
}

function addGroupHeader(sheet, paName, count) {
  const endCol = 15; // DETAIL_COLUMNS.length
  const row = sheet.addRow([`\u{1F9EA}  ${paName}  ·  ${count} producto${count !== 1 ? 's' : ''}`]);
  const rowNum = row.number;
  sheet.mergeCells(`A${rowNum}:O${rowNum}`);
  const cell = row.getCell(1);
  cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF334155' }, // slate-700
  };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  cell.border = {
    top:    { style: 'medium', color: { argb: 'FF1E293B' } },
    bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
  };
  row.height = 24;
  return row;
}

function buildProgressBar(pct, length = 20) {
  const filled = Math.round((pct / 100) * length);
  const empty = length - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty) + `  ${pct}%`;
}

// ─── Columnas del detalle ────────────────────────────────────────────────────
const DETAIL_COLUMNS = [
  { header: 'Principio Activo',  key: 'principio_activo',          width: 25 },
  { header: 'SKU',               key: 'sku',                       width: 12 },
  { header: 'Producto',          key: 'fullName',                  width: 45 },
  { header: 'Estado SEO',        key: 'estado',                    width: 14 },
  { header: 'Title SEO',         key: 'title_optimizado',          width: 50 },
  { header: 'Meta Description',  key: 'meta_description_optimizado', width: 60 },
  { header: 'Presentación',      key: 'presentacion_optimizada',   width: 22 },
  { header: 'Registro ISP',      key: 'registro_isp',              width: 18 },
  { header: 'Link Laboratorio',  key: 'link_laboratorio',          width: 35 },
  { header: 'Keywords Ocultos',  key: 'keywords_ocultos',          width: 40 },
  { header: 'Bullets Atributos', key: 'bullets_atributos',         width: 40 },
  { header: 'Stock',             key: 'stock_total',                width: 8 },
  { header: 'Receta',            key: 'prescriptionType',           width: 22 },
  { header: 'Fec. Optimización', key: 'fecha_optimizacion',        width: 18 },
  { header: 'Descripción Intranet', key: 'descripcion_intranet',   width: 80 },
  { header: 'Feedback / Observaciones', key: 'feedback',           width: 40 },
];

// GET /api/export/excel
app.get('/api/export/excel', async (req, res) => {
  try {
    const { where, params } = buildWhereClause(req.query);
    const products = await query(
      `SELECT * FROM products ${where} ORDER BY subCategory, principio_activo, fullName`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Farmaloop SEO';
    workbook.created = new Date();
    workbook.title = 'Farmaloop · Catálogo SEO';

    // ── Agrupar por subCategoría ─────────────────────────────────────────
    const grouped = {};
    products.forEach(p => {
      const cat = p.subCategory || 'Sin categoría';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });

    // ── Calcular métricas globales (solo Bloque 1) ──────────────────────
    const bloque1Cats = Object.entries(grouped).filter(([cat]) => CATEGORIAS_BLOQUE1.includes(cat));
    const bloque1Prods = bloque1Cats.flatMap(([, prods]) => prods);
    const totalProd   = bloque1Prods.length;
    const enQA        = bloque1Prods.filter(p => ['qa completo','prod completo','prod incompleto'].includes(p.estado)).length;
    const enPROD      = bloque1Prods.filter(p => ['prod completo','prod incompleto'].includes(p.estado)).length;
    const completado  = bloque1Prods.filter(p => p.estado === 'prod completo').length;
    const totalPend   = totalProd - enQA;
    const globalPct   = totalProd > 0 ? Math.round((completado / totalProd) * 100) : 0;
    const globalPctQA = totalProd > 0 ? Math.round((enQA / totalProd) * 100) : 0;
    const allDates    = bloque1Prods.filter(p => p.fecha_optimizacion).map(p => new Date(p.fecha_optimizacion));
    const lastDate    = allDates.length > 0 ? allDates.reduce((a, b) => a > b ? a : b) : null;
    const allPA       = new Set(bloque1Prods.map(p => p.principio_activo).filter(Boolean));

    // ── HOJA 1: PORTADA ──────────────────────────────────────────────────
    const cover = workbook.addWorksheet('Portada', { properties: { tabColor: { argb: 'FF1A73E8' } } });
    cover.getColumn(1).width = 4;
    cover.getColumn(2).width = 36;
    cover.getColumn(3).width = 36;
    cover.getColumn(4).width = 4;

    // Banner superior
    cover.mergeCells('B2:C2');
    cover.getCell('B2').value = 'FARMALOOP';
    cover.getCell('B2').font = { name: 'Arial', size: 32, bold: true, color: { argb: 'FFFFFFFF' } };
    cover.getCell('B2').alignment = { vertical: 'middle', horizontal: 'center' };
    cover.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A73E8' } };
    cover.getRow(2).height = 60;

    cover.mergeCells('B3:C3');
    cover.getCell('B3').value = 'Catálogo SEO — Bloque 1';
    cover.getCell('B3').font = { name: 'Arial', size: 14, color: { argb: 'FFFFFFFF' } };
    cover.getCell('B3').alignment = { vertical: 'middle', horizontal: 'center' };
    cover.getCell('B3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4285F4' } };
    cover.getRow(3).height = 32;

    // Generar espacio
    cover.addRow();
    cover.addRow();

    // KPIs en grid 2x2
    const kpiRow1 = cover.addRow([null, null, null, null]);
    kpiRow1.height = 70;
    const kpiStyle = (cell, label, value, color) => {
      cell.value = { richText: [
        { text: label + '\n', font: { size: 9, color: { argb: 'FF64748B' }, bold: false } },
        { text: value, font: { size: 24, color: { argb: color }, bold: true } },
      ] };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.border = {
        top:    { style: 'medium', color: { argb: color } },
        left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    };
    kpiStyle(cover.getCell('B6'), 'TOTAL PRODUCTOS', String(totalProd), 'FF0F172A');
    kpiStyle(cover.getCell('C6'), 'COMPLETADOS',    `${completado}  ·  ${globalPct}%`, 'FF16A34A');

    const kpiRow2 = cover.addRow([null, null, null, null]);
    kpiRow2.height = 70;
    kpiStyle(cover.getCell('B7'), 'EN QA',         `${enQA}  ·  ${globalPctQA}%`,     'FF2563EB');
    kpiStyle(cover.getCell('C7'), 'PENDIENTES',    String(totalPend),   'FFDC2626');

    cover.addRow();

    // Barra de progreso global
    const progRow = cover.addRow([null, null, null, null]);
    progRow.height = 36;
    cover.mergeCells('B9:C9');
    const progCell = cover.getCell('B9');
    progCell.value = buildProgressBar(globalPct, 30);
    progCell.font = { name: 'Courier New', size: 12, bold: true, color: { argb: 'FF1A73E8' } };
    progCell.alignment = { vertical: 'middle', horizontal: 'center' };
    progCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
    progCell.border = {
      top:    { style: 'thin', color: { argb: 'FFBFDBFE' } },
      bottom: { style: 'thin', color: { argb: 'FFBFDBFE' } },
    };

    // Metadata
    cover.addRow();
    const metaRows = [
      ['Fecha de exportación',   new Date().toLocaleString('es-CL')],
      ['Categorías en el informe', String(bloque1Cats.length)],
      ['Principios activos únicos', String(allPA.size)],
      ['Última optimización',     lastDate ? lastDate.toISOString().split('T')[0] : '—'],
    ];
    metaRows.forEach(([k, v]) => {
      const r = cover.addRow([null, k, v, null]);
      r.height = 20;
      cover.getCell(`B${r.number}`).font = { size: 10, color: { argb: 'FF64748B' } };
      cover.getCell(`B${r.number}`).alignment = { vertical: 'middle', horizontal: 'right' };
      cover.getCell(`C${r.number}`).font = { size: 10, bold: true, color: { argb: 'FF0F172A' } };
      cover.getCell(`C${r.number}`).alignment = { vertical: 'middle', horizontal: 'left' };
    });

    // Footer
    cover.addRow();
    cover.addRow();
    const footerRow = cover.addRow([null]);
    cover.mergeCells(`B${footerRow.number}:C${footerRow.number}`);
    cover.getCell(`B${footerRow.number}`).value = 'Generado automáticamente · Proyecto SEO Farmaloop Segunda Etapa';
    cover.getCell(`B${footerRow.number}`).font = { size: 8, italic: true, color: { argb: 'FF94A3B8' } };
    cover.getCell(`B${footerRow.number}`).alignment = { vertical: 'middle', horizontal: 'center' };

    // ── HOJA 2: RESUMEN POR CATEGORÍA ───────────────────────────────────
    const summary = workbook.addWorksheet('Resumen', { properties: { tabColor: { argb: 'FF16A34A' } } });
    summary.columns = [
      { header: 'Categoría',           key: 'category',     width: 32 },
      { header: 'Total',               key: 'total',        width: 10 },
      { header: 'QA',                  key: 'en_qa',        width: 8 },
      { header: 'PROD',                key: 'en_prod',      width: 8 },
      { header: 'Completado',          key: 'completado',   width: 12 },
      { header: 'Pendientes',          key: 'pendientes',   width: 14 },
      { header: 'Avance',              key: 'avance',       width: 32 },
      { header: 'Última optimización', key: 'last_opt',     width: 22 },
    ];

    const summaryRows = bloque1Cats
      .map(([cat, prods]) => {
        const enQaCount = prods.filter(p => ['qa completo','prod completo','prod incompleto'].includes(p.estado)).length;
        const enProdCount = prods.filter(p => ['prod completo','prod incompleto'].includes(p.estado)).length;
        const compCount = prods.filter(p => p.estado === 'prod completo').length;
        const paSet = new Set(prods.map(p => p.principio_activo).filter(Boolean));
        const dates = prods
          .filter(p => p.fecha_optimizacion)
          .map(p => new Date(p.fecha_optimizacion));
        const lastOpt = dates.length > 0
          ? dates.reduce((a, b) => a > b ? a : b).toISOString().split('T')[0]
          : '—';
        const pctQA = prods.length > 0 ? Math.round((enQaCount / prods.length) * 100) : 0;
        return {
          category: cat,
          total: prods.length,
          en_qa: enQaCount,
          en_prod: enProdCount,
          completado: compCount,
          pendientes: prods.length - enQaCount,
          avance: buildProgressBar(pctQA, 18),
          last_opt: lastOpt,
          _pct: pctQA,
        };
      })
      .sort((a, b) => b._pct - a._pct);

    const summaryTotal = {
      category: 'TOTAL GENERAL',
      total: summaryRows.reduce((s, r) => s + r.total, 0),
      en_qa: summaryRows.reduce((s, r) => s + r.en_qa, 0),
      en_prod: summaryRows.reduce((s, r) => s + r.en_prod, 0),
      completado: summaryRows.reduce((s, r) => s + r.completado, 0),
      pendientes: summaryRows.reduce((s, r) => s + r.pendientes, 0),
      avance: buildProgressBar(globalPctQA, 18),
      last_opt: lastDate ? lastDate.toISOString().split('T')[0] : '—',
      _pct: globalPctQA,
    };
    summaryRows.push(summaryTotal);

    summary.addRows(summaryRows);
    summary.autoFilter = `A1:H${summaryRows.length}`;
    summary.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    // Header
    const summaryHeader = summary.getRow(1);
    summaryHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    summaryHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A73E8' } };
    summaryHeader.alignment = { vertical: 'middle', horizontal: 'center' };
    summaryHeader.height = 28;
    summaryHeader.eachCell(cell => {
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF1E40AF' } },
        bottom: { style: 'medium', color: { argb: 'FF1E40AF' } },
      };
    });

    // Filas con colores por avance
    summary.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const isTotal = rowNum === summaryRows.length;
      const pct = (summaryRows[rowNum - 2] && summaryRows[rowNum - 2]._pct) || 0;
      const bg = isTotal ? 'FF1E293B' : (pct >= 100 ? 'FFD1FAE5' : pct >= 50 ? 'FFFEF3C7' : 'FFFEE2E2');
      const fg = isTotal ? 'FFFFFFFF' : (pct >= 100 ? 'FF065F46' : pct >= 50 ? 'FF92400E' : 'FF991B1B');
      row.eachCell((cell, colNum) => {
        if (cell.value === null || cell.value === undefined) return;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font = { name: isTotal ? 'Arial' : 'Calibri', size: isTotal ? 11 : 10, bold: isTotal, color: { argb: fg } };
        cell.alignment = { ...cell.alignment, vertical: 'middle', horizontal: colNum === 1 ? 'left' : (colNum === 7 ? 'left' : 'center'), indent: colNum === 1 ? 1 : 0 };
        cell.border = {
          top:    { style: 'hair', color: { argb: isTotal ? 'FF1E293B' : 'FFE2E8F0' } },
          bottom: { style: isTotal ? 'medium' : 'hair', color: { argb: isTotal ? 'FF1E293B' : 'FFE2E8F0' } },
        };
      });
      row.height = isTotal ? 26 : 22;
    });

    // ── HOJA 3: ÍNDICE DE CATEGORÍAS (hipervínculos) ─────────────────────
    const indexSheet = workbook.addWorksheet('Índice', { properties: { tabColor: { argb: 'FFEA580C' } } });
    indexSheet.getColumn(1).width = 4;
    indexSheet.getColumn(2).width = 32;
    indexSheet.getColumn(3).width = 14;
    indexSheet.getColumn(4).width = 14;
    indexSheet.getColumn(5).width = 16;

    indexSheet.mergeCells('B2:E2');
    indexSheet.getCell('B2').value = '🗂  Índice de categorías';
    indexSheet.getCell('B2').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    indexSheet.getCell('B2').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    indexSheet.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A73E8' } };
    indexSheet.getRow(2).height = 36;

    const idxHeader = indexSheet.addRow([null, 'Categoría', 'Total', 'Avance', 'Ir a hoja →']);
    idxHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    idxHeader.eachCell((cell) => {
      if (cell.col < 2) return;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    idxHeader.height = 22;

    summaryRows.filter(r => r.category !== 'TOTAL GENERAL').forEach((r) => {
      const sheetName = r.category.length > 31 ? r.category.substring(0, 31) : r.category;
      const row = indexSheet.addRow([null, r.category, r.total, `${r._pct}%`, 'Ver detalle →']);
      const cellName = row.getCell(2);
      cellName.font = { color: { argb: 'FF1A73E8' }, underline: true, size: 10 };
      cellName.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cellName.hyperlink = { tooltip: `Ir a hoja "${sheetName}"`, target: `'${sheetName}'!A1` };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      const linkCell = row.getCell(5);
      linkCell.font = { color: { argb: 'FF1A73E8' }, bold: true, size: 10 };
      linkCell.alignment = { vertical: 'middle', horizontal: 'center' };
      linkCell.hyperlink = { tooltip: `Ir a hoja "${sheetName}"`, target: `'${sheetName}'!A1` };
      row.height = 20;
      // Zebra
      const isAlt = (row.number % 2 === 0);
      if (isAlt) {
        row.eachCell((cell) => {
          if (cell.col < 2) return;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }
    });

    // ── HOJAS DE DETALLE: una por categoría (Bloque 1) ──────────────────
    for (const [cat, prods] of bloque1Cats) {
      const sheetName = cat.length > 31 ? cat.substring(0, 31) : cat;
      const sheet = workbook.addWorksheet(sheetName, { properties: { tabColor: { argb: 'FF8B5CF6' } } });
      sheet.columns = DETAIL_COLUMNS;
      sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to:   { row: 1, column: DETAIL_COLUMNS.length },
      };

      // Header de la tabla
      const headerRow = sheet.getRow(1);
      headerRow.values = DETAIL_COLUMNS.map(c => c.header);
      headerRow.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A73E8' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 30;
      headerRow.eachCell(cell => {
        cell.border = {
          top:    { style: 'medium', color: { argb: 'FF1E40AF' } },
          bottom: { style: 'medium', color: { argb: 'FF1E40AF' } },
        };
      });

      // Agrupar por PA
      const paGroups = {};
      prods.forEach(p => {
        const pa = p.principio_activo || '(sin PA)';
        if (!paGroups[pa]) paGroups[pa] = [];
        paGroups[pa].push(p);
      });

      const sortedPA = Object.keys(paGroups).sort();
      for (const pa of sortedPA) {
        const items = paGroups[pa].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
        addGroupHeader(sheet, pa, items.length);
        for (const p of items) {
          const estado = p.estado || 'pendiente';
          const fecha = p.fecha_optimizacion
            ? new Date(p.fecha_optimizacion).toISOString().split('T')[0]
            : '';
          const row = sheet.addRow({
            principio_activo: pa,
            sku: p.sku,
            fullName: p.fullName,
            estado: estado,
            title_optimizado: p.title_optimizado || '',
            meta_description_optimizado: p.meta_description_optimizado || '',
            presentacion_optimizada: p.presentacion_optimizada || '',
            registro_isp: p.registro_isp || '',
            link_laboratorio: p.link_laboratorio || '',
            keywords_ocultos: p.keywords_ocultos || '',
            bullets_atributos: p.bullets_atributos || '',
            stock_total: p.stock_total || 0,
            prescriptionType: p.prescriptionType || '',
            fecha_optimizacion: fecha,
            descripcion_intranet: buildIntranetDescription(p),
          });
          applyRowStyle(row, estado);

          // Hyperlink de SKU a la tienda
          const skuCell = row.getCell('sku');
          if (p.url && skuCell) {
            skuCell.font = { ...skuCell.font, color: { argb: 'FF1A73E8' }, underline: true };
            skuCell.hyperlink = { tooltip: `Abrir ${p.fullName} en la tienda`, target: p.url };
          }
          // Hyperlink de link_laboratorio
          const linkCell = row.getCell('link_laboratorio');
          if (p.link_laboratorio && linkCell && String(p.link_laboratorio).startsWith('http')) {
            linkCell.font = { ...linkCell.font, color: { argb: 'FF1A73E8' }, underline: true };
            linkCell.hyperlink = { tooltip: 'Sitio del laboratorio', target: p.link_laboratorio };
          }
        }
      }

      // Print layout
      sheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
        printTitlesRow: '1:1',
      };
      // Number format para stock
      sheet.getColumn('stock_total').numFmt = '#,##0';
    }

    // ── Enviar archivo ─────────────────────────────────────────────────
    const filename = req.query.share === 'true'
      ? 'farmaloop-catalogo-seo.xlsx'
      : `farmaloop-catalogo-seo-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/import/excel - Importar Excel corregido ─────────────────────
app.post('/api/import/excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envi\u00F3 ning\u00FAn archivo' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const results = { updated: 0, errors: 0, feedback: [], details: [] };
    const FIELD_MAP = {
      'Title SEO': 'title_optimizado',
      'Meta Description': 'meta_description_optimizado',
      'Presentaci\u00F3n': 'presentacion_optimizada',
      'Keywords Ocultos': 'keywords_ocultos',
      'Bullets Atributos': 'bullets_atributos',
      'Registro ISP': 'registro_isp',
      'Link Laboratorio': 'link_laboratorio',
      'Estado SEO': 'estado',
      'Descripci\u00F3n Intranet': 'descripcion_intranet',
    };
    const FEEDBACK_COL = 'Feedback / Observaciones';

    // Recorrer todas las hojas (menos Resumen)
    workbook.eachSheet((sheet) => {
      const sheetName = sheet.name;
      if (sheetName === 'Resumen') return;

      // Leer header para mapear columnas
      const headerRow = sheet.getRow(1);
      const colMap = {};
      headerRow.eachCell((cell, colNumber) => {
        const header = String(cell.value || '');
        if (FIELD_MAP[header]) colMap[FIELD_MAP[header]] = colNumber;
        if (header === FEEDBACK_COL) colMap.feedback = colNumber;
      });

      if (!colMap.sku) {
        // Buscar SKU en alguna columna que lo tenga
        headerRow.eachCell((cell, colNumber) => {
          if (String(cell.value || '').toUpperCase() === 'SKU' || String(cell.value || '') === 'SKU') {
            colMap.sku = colNumber;
          }
        });
      }

      if (!colMap.sku) {
        results.details.push({ sheet: sheetName, error: 'No se encontr\u00F3 columna SKU' });
        return;
      }

      // Leer filas de datos (desde fila 2)
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const sku = String(row.getCell(colMap.sku).value || '').trim();
        if (!sku) return;

        // Buscar feedback si existe
        let feedback = '';
        if (colMap.feedback) {
          feedback = String(row.getCell(colMap.feedback).value || '').trim();
        }

        const update = {};
        let needsUpdate = false;

        for (const [field, colIdx] of Object.entries(colMap)) {
          if (field === 'sku' || field === 'feedback') continue;
          const val = row.getCell(colIdx).value;
          if (val !== undefined && val !== null && val !== '') {
            update[field] = String(val);
            needsUpdate = true;
          }
        }

        if (feedback) {
          results.feedback.push({ sku, sheet: sheetName, feedback });
        }

        if (needsUpdate) {
          // Buscar producto por SKU
          query('SELECT id FROM products WHERE sku = ?', [sku])
            .then((rows) => {
              if (rows.length > 0) {
                update.estado = update.estado || 'pendiente';
                return query(`UPDATE products SET ${Object.keys(update).map(f => `${f} = ?`).join(', ')} WHERE id = ?`, [...Object.values(update), rows[0].id]);
              }
            })
            .then(() => {
              results.updated++;
              results.details.push({ sheet: sheetName, sku, status: 'OK' });
            })
            .catch((err) => {
              results.errors++;
              results.details.push({ sheet: sheetName, sku, error: err.message });
            });
        }
      });
    });

    // Esperar a que todas las promesas terminen
    setTimeout(() => {
      res.json({
        message: `Importaci\u00F3n completada: ${results.updated} actualizados, ${results.errors} errores`,
        feedback: results.feedback.length > 0 ? results.feedback : undefined,
        stats: { updated: results.updated, errors: results.errors, feedback_count: results.feedback.length },
      });
    }, 500);
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Serve frontend ──────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Init ────────────────────────────────────────────────────────────────────
async function init() {
  // Esperar a que MariaDB esté lista
  const maxRetries = 30;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      pool = mysql.createPool(DB_CONFIG);
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();

      // Verificar que la tabla existe
      const [tables] = await pool.execute(
        "SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'products'",
        [DB_CONFIG.database]
      );
      const tableExists = tables[0].cnt > 0;

      // Contar productos
      const [count] = await pool.execute('SELECT COUNT(*) as total FROM products');
      console.log(`  ✅ Conectado a MariaDB: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
      console.log(`  📦 Tabla 'products': ${tableExists ? 'OK' : 'NO CREADA'}`);
      console.log(`  📊 Productos en DB: ${count.total}`);

      if (!tableExists || count.total === 0) {
        console.log(`  ⚠️  La tabla está vacía. Ejecutá: npm run import`);
      }

      // Migración: crear tabla config si no existe
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS config (
          key_name VARCHAR(50) PRIMARY KEY,
          value TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.execute(`
        INSERT IGNORE INTO config (key_name, value) VALUES
          ('meta_visitas', '150000'),
          ('visitas_actuales', '50000'),
          ('inicio_proyecto', '2026-05-25'),
          ('fee_mensual', '980000'),
          ('sprint_actual', '1')
      `);
      console.log(`  ⚙️  Config: OK`);

      // Migración: cambiar meta_description_optimizado a TEXT si es VARCHAR
      try {
        await pool.execute(
          "ALTER TABLE products MODIFY COLUMN meta_description_optimizado TEXT"
        );
        console.log(`  📝 meta_description_optimizado → TEXT (OK)`);
      } catch (mErr) {
        // Si ya es TEXT, el ALTER falla silenciosamente o no hace nada
        console.log(`  📝 meta_description_optimizado: ya TEXT o ignorado`);
      }

      // Migración: crear tabla best_sellers si no existe
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS best_sellers (
          sku        VARCHAR(50) PRIMARY KEY,
          views      INT DEFAULT 0,
          cart_adds  INT DEFAULT 0,
          purchases  INT DEFAULT 0,
          revenue    DECIMAL(15,2) DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log(`  📊 best_sellers: OK (${DB_CONFIG.database})`);

      return;
    } catch (err) {
      if (i < maxRetries) {
        process.stdout.write(`  ⏳ Esperando MariaDB (intento ${i}/${maxRetries})...\r`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        console.error(`\n  ❌ No se pudo conectar a MariaDB después de ${maxRetries} intentos`);
        console.error(`  Error: ${err.message}`);
        process.exit(1);
      }
    }
  }
}

init().then(() => {
  app.listen(PORT, () => {
    console.log(`  🚀 Catálogo CRUD Farmaloop corriendo en:`);
    console.log(`  📍 http://localhost:${PORT}\n`);
  });
});
