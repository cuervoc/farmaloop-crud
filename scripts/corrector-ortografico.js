// Corrector ortográfico español definitivo para Farmaloop
const mysql = require('mysql2/promise');
const DICT = require('./dict-ortografia.json');

const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});
const CATS = ['Control de Peso','Diabetes','Colesterol','Salud Mental','Anticonceptivos y Hormonas','Fertilidad','Hipertensión','Sistema Digestivo','Huesos y Articulaciones','Bienestar Sexual','Sistema Inmune','Omega 3','Probióticos'];

function fixText(text) {
  if (!text) return text;
  let t = text;
  for (const [from, to] of DICT) {
    if (from.startsWith(' ') || from.endsWith(' ')) {
      t = t.split(from).join(to);
    } else if (/^[a-záéíóúñ]/i.test(from)) {
      t = t.replace(new RegExp('\\b' + from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), (m) => m.toLowerCase() === from ? to : to.charAt(0).toUpperCase() + to.slice(1));
    } else {
      t = t.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
    }
    const capFrom = from.charAt(0).toUpperCase() + from.slice(1);
    const capTo = to.charAt(0).toUpperCase() + to.slice(1);
    if (capFrom !== from && /^[a-záéíóúñ]/i.test(from)) {
      t = t.replace(new RegExp('\\b' + capFrom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), capTo);
    }
  }
  t = t.replace(/- Principio activo: ([a-záéíóúñ])/g, (m, c) => `- Principio activo: ${c.toUpperCase()}`);
  t = t.replace(/  +/g, ' ');
  t = t.replace(/(- [^:\n]+: )([a-záéíóúñ])/gm, (m, prefix, letter) => prefix + letter.toUpperCase());
  return t;
}

async function main() {
  const placeholders = CATS.map(() => '?').join(',');
  const [rows] = await pool.execute(`SELECT id, bullets_atributos, descripcion_intranet, title_optimizado FROM products WHERE subCategory IN (${placeholders})`, CATS);
  console.log(`Corrigiendo ${rows.length} productos...`);
  let fixes = 0;
  for (const p of rows) {
    const nb = fixText(p.bullets_atributos);
    const nd = fixText(p.descripcion_intranet);
    const nt = fixText(p.title_optimizado);
    if (nb !== p.bullets_atributos || nd !== p.descripcion_intranet || nt !== p.title_optimizado) {
      try {
        await pool.execute('UPDATE products SET bullets_atributos = ?, descripcion_intranet = ?, title_optimizado = ? WHERE id = ?', [nb, nd, nt, p.id]);
        fixes++;
        if (fixes % 300 === 0) console.log('  '+fixes+'/'+rows.length+'...');
      } catch(e) {
        try { await pool.execute('UPDATE products SET bullets_atributos = ?, descripcion_intranet = ? WHERE id = ?', [nb, nd, p.id]); fixes++; } catch(e2) {}
      }
    }
  }
  console.log('✅ '+fixes+' corregidos');
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
