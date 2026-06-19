const mysql = require('mysql2/promise');
const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});

const CATS = ['Control de Peso','Diabetes','Colesterol','Salud Mental','Anticonceptivos y Hormonas','Fertilidad','Hipertensión','Sistema Digestivo','Huesos y Articulaciones','Bienestar Sexual','Sistema Inmune','Omega 3','Probióticos'];
const PH = CATS.map(() => '?').join(',');

function fixFormat(text) {
  if (!text) return text;
  let t = text;
  // 1. "12.5 mg" → "12,5 mg" (decimal point in measurement)
  t = t.replace(/(\d+)\.(\d+)\s*(mg|mcg|ml|g|MBq|UI|%)\b/gi, '$1,$2 $3');
  // 2. "50mg" → "50 mg" (no space between number and unit) — lowercase only
  t = t.replace(/(\d+)mg\b/g, '$1 mg');
  t = t.replace(/(\d+)mcg\b/g, '$1 mcg');
  t = t.replace(/(\d+)ml\b/g, '$1 ml');
  t = t.replace(/(\d+)g\b/gi, '$1 g');
  // 3. Uppercase after the space: "Mg" → "mg" when preceded by number+space
  t = t.replace(/(\d+\s+)Mg\b/g, '$1mg');
  t = t.replace(/(\d+)MG\b/g, '$1 mg');
  // 4. "Xg" (grams) with number — add space
  t = t.replace(/(\d+)G\b/g, '$1 g');
  // 5. "12.5Mg" → "12,5 mg" (both issues combined)
  t = t.replace(/(\d+)\.(\d+)Mg\b/gi, '$1,$2 mg');
  // 6. "150Mg" → "150 mg" (uppercase + no space)
  t = t.replace(/(\d+)Mg\b/g, '$1 mg');
  return t;
}

async function main() {
  const [rows] = await pool.execute(`SELECT id, sku, bullets_atributos, descripcion_intranet FROM products WHERE subCategory IN (${PH})`, CATS);
  console.log(`Procesando ${rows.length} productos...`);
  let fixes = 0;
  for (const p of rows) {
    const newBullets = fixFormat(p.bullets_atributos);
    const newDesc = fixFormat(p.descripcion_intranet);
    const newTitle = fixFormat(p.title_optimizado);
    if (newBullets !== p.bullets_atributos || newDesc !== p.descripcion_intranet) {
      await pool.execute('UPDATE products SET bullets_atributos = ?, descripcion_intranet = ? WHERE id = ?', [newBullets, newDesc, p.id]);
      fixes++;
      if (fixes % 200 === 0) console.log(`  ${fixes}/${rows.length}...`);
    }
  }
  console.log(`✅ ${fixes} productos corregidos`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
