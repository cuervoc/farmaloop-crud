const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: 'db',
  port: 3306,
  user: 'seo_user',
  password: 'seo_pass_2026',
  database: 'farmaloop_seo',
};

const BLOQUE1 = [
  'Control de Peso','Diabetes','Colesterol','Salud Mental',
  'Anticonceptivos y Hormonas','Fertilidad','Hipertensión',
  'Sistema Digestivo','Huesos y Articulaciones','Bienestar Sexual',
  'Sistema Inmune','Omega 3','Probióticos',
];

function extractMg(name) {
  const matches = [];
  const patterns = [
    /(\d+[.,]?\d*)\s*mg\s*\/\s*ml/gi,
    /(\d+[.,]?\d*)\s*mg\b/gi,
    /(\d+[.,]?\d*)\s*%\b/g,
    /(\d+[.,]?\d*)\s*g\b/gi,
    /(\d+[.,]?\d*)\s*UI\b/gi,
    /(\d+[.,]?\d*)\s*mcg\b/gi,
    /(\d+[.,]?\d*)\s*ml\b/gi,
  ];
  const seen = new Set();
  for (const re of patterns) {
    let m;
    while ((m = re.exec(name)) !== null) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(val) && val > 0 && !seen.has(`${val}-${re.source}`)) {
        seen.add(`${val}-${re.source}`);
        matches.push({ value: val });
      }
    }
  }
  return matches;
}

function normalizeNum(s) { return parseFloat(String(s).replace(',', '.')); }

async function main() {
  const pool = mysql.createPool(DB_CONFIG);
  const [rows] = await pool.execute(
    `SELECT id, sku, fullName, title_optimizado, presentacion_optimizada, bullets_atributos, subCategory
     FROM products
     WHERE subCategory IN ('Control de Peso','Diabetes','Colesterol','Salud Mental','Anticonceptivos y Hormonas','Fertilidad','Hipertensión','Sistema Digestivo','Huesos y Articulaciones','Bienestar Sexual','Sistema Inmune','Omega 3','Probióticos')
       AND bullets_atributos IS NOT NULL AND bullets_atributos != ''
       AND bullets_atributos LIKE '%Concentrac%'`
  );
  console.log('Productos encontrados:', rows.length);

  const issues = [];
  let checked = 0;

  for (const p of rows) {
    const name = p.fullName || '';
    const bullets = p.bullets_atributos || '';

    const lines = bullets.split('\n');
    const concLine = lines.find(l => /concentrac/i.test(l));
    if (!concLine) continue;

    checked++;
    const match = concLine.match(/:\s*([\d,.]+\s*(?:mg|%|g|UI|mcg|ml)(?:\/\s*ml)?)/i);
    if (!match) { console.log('  NO MATCH:', p.sku, concLine.trim()); continue; }

    const bulletVal = normalizeNum(match[1]);
    if (isNaN(bulletVal) || bulletVal <= 0) { console.log('  NaN:', p.sku, match[1]); continue; }

    const nameMgs = extractMg(name);

    if (nameMgs.length === 0) { console.log('  NO NAME CONC:', p.sku, name); continue; }

    let matched = false;
    for (const nm of nameMgs) {
      if (Math.abs(nm.value - bulletVal) < 0.15) { matched = true; break; }
    }

    if (!matched) {
      const nameConcs = nameMgs.map(m => `${m.value}${m.unit}`).join(', ');
      issues.push({
        sku: p.sku,
        name: name.substring(0, 80),
        categoria: p.subCategory,
        name_concs: nameConcs || '(ninguna)',
        bullet_concentracion: concLine.trim().substring(0, 80),
        bulletVal,
      });
    }
  }

  console.log(`Auditados: ${checked} productos con Concentracion en bullets`);
  console.log(`Errores encontrados: ${issues.length}`);
  console.log('');

  for (const i of issues) {
    console.log(`❌ ${i.sku} | ${i.categoria} | ${i.name}`);
    console.log(`   Nombre: ${i.name_concs}`);
    console.log(`   Bullet: ${i.bullet_concentracion}`);
    console.log('');
  }

  if (issues.length > 0) {
    console.log(`\n--- SQL para fix (preliminar) ---`);
    for (const i of issues) {
      console.log(`-- ${i.sku}: ${i.name}`);
    }
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
