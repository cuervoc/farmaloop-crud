const mysql = require('mysql2/promise');

const DB_CONFIG = { host: 'db', port: 3306, user: 'seo_user', password: 'seo_pass_2026', database: 'farmaloop_seo' };

function extractFirstDose(name) {
  const patterns = [
    /(\d+[.,]?\d*)\s*mg\s*\/\s*ml/gi,
    /(\d+[.,]?\d*)\s*mg\b/gi,
    /(\d+[.,]?\d*)\s*%/g,
  ];
  for (const re of patterns) {
    const m = re.exec(name);
    if (m) {
      const val = parseFloat(m[1].replace(',', '.'));
      const raw = m[0];
      if (!isNaN(val) && val > 0) return { val, raw };
    }
  }
  return null;
}

function fixBulletConcentracion(bullets, newMg) {
  const lines = bullets.split('\n');
  const fixed = lines.map(line => {
    if (/concentrac/i.test(line)) {
      return line.replace(/:\s*[\d,.]+\s*(mg|%|g|mcg|UI|ml)(\/ml)?/i, `: ${newMg}`);
    }
    return line;
  });
  return fixed.join('\n');
}

async function main() {
  const pool = mysql.createPool(DB_CONFIG);
  const manual = [];

  // Fix pattern 1: "5 mg" should be correct value from name
  const [r1] = await pool.execute(`
    SELECT id, sku, fullName, bullets_atributos
    FROM products
    WHERE subCategory IN ('Control de Peso','Diabetes','Colesterol','Salud Mental','Anticonceptivos y Hormonas','Fertilidad','Hipertensión','Sistema Digestivo','Huesos y Articulaciones','Bienestar Sexual','Sistema Inmune','Omega 3','Probióticos')
      AND bullets_atributos LIKE '%Concentrac%'
  `);

  let fixed = 0;
  let skipped = 0;

  for (const p of r1) {
    const dose = extractFirstDose(p.fullName);
    if (!dose) { skipped++; continue; }

    const bullets = p.bullets_atributos || '';
    const concLine = bullets.split('\n').find(l => /concentrac/i.test(l));
    if (!concLine) continue;

    const match = concLine.match(/:\s*([\d,.]+)\s*(mg|%|g|mcg|UI|ml)(\/ml)?/i);
    if (!match) continue;

    const bulletVal = parseFloat(match[1].replace(',', '.'));
    const bulletUnit = match[2];
    if (isNaN(bulletVal)) continue;

    if (Math.abs(dose.val - bulletVal) < 0.15) continue; // already correct

    const newConc = dose.raw.trim();
    const newBullets = fixBulletConcentracion(bullets, newConc);

    await pool.execute('UPDATE products SET bullets_atributos = ? WHERE id = ?', [newBullets, p.id]);
    fixed++;
    console.log(`FIXED ${p.sku}: "${match[0].trim()}" → "${newConc}" | ${p.fullName.substring(0, 50)}`);
  }

  console.log(`\n✅ ${fixed} productos corregidos | ${skipped} sin dosis detectable en nombre`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
