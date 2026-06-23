const mysql = require('mysql2/promise');
const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});
const DICT = require('./dict-ortografia.json');

const CATS = ['Control de Peso','Diabetes','Colesterol','Salud Mental','Anticonceptivos y Hormonas','Fertilidad','Hipertensión','Sistema Digestivo','Huesos y Articulaciones','Bienestar Sexual','Sistema Inmune','Omega 3','Probióticos'];
const PH = CATS.map(() => '?').join(',');

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
  return t;
}

(async () => {
  // Paso 1: Corregir bullets y titles
  const [rows] = await pool.execute(`SELECT * FROM products WHERE subCategory IN (${PH})`, CATS);
  let fixes = 0;
  for(const p of rows) {
    const nb = fixText(p.bullets_atributos);
    const nt = fixText(p.title_optimizado);
    if (nb !== p.bullets_atributos || nt !== p.title_optimizado) {
      try { await pool.execute('UPDATE products SET bullets_atributos = ?, title_optimizado = ? WHERE id = ?', [nb, nt, p.id]); fixes++; }
      catch { try { await pool.execute('UPDATE products SET bullets_atributos = ? WHERE id = ?', [nb, p.id]); fixes++; } catch(e) {} }
    }
  }
  console.log('Corrector previo:', fixes, 'productos');

  // Paso 2: Regenerar descripciones desde datos corregidos
  const [rows2] = await pool.execute(`SELECT * FROM products WHERE subCategory IN (${PH})`, CATS);
  console.log('Regenerando', rows2.length, 'descripciones...');
  let ok = 0;
  for(const p of rows2) {
    const lab = p.laboratorio || '';
    const titulo = fixText(p.title_optimizado || '');
    const bullets = fixText(p.bullets_atributos || '');
    const isp = p.registro_isp || '';
    const nombre = titulo.split('|')[0].trim() || p.presentacion_optimizada || 'Producto';
    const bf = bullets.split('\n').filter(b=>b.trim()).map(b=>{const t=b.trim();return t.startsWith('-')?t:'- '+t}).join('\n');
    let d = [nombre+(lab?' - '+lab:''),'Compra online en Farmaloop y recibe con despacho a domicilio.','Revisa precio, stock y disponibilidad actualizada antes de comprar.','Venta sujeta a receta médica cuando aplique. Uso responsable según indicación profesional.',''];
    if(bf) { d.push(bf); d.push(''); }
    if(isp) { d.push('Registro ISP: '+isp); d.push(''); }
    d.push('Condición de almacenado:','Mantener en lugar fresco y seco, protegido de la luz. Evitar temperaturas extremas. Mantener fuera del alcance de los niños.','','Indicaciones de embarazo y lactancia:','Uso solo bajo indicación médica. Si estás embarazada, planeas estarlo o en período de lactancia, consulta a tu médico antes de usar.');
    let desc = d.join('\n');
    desc = fixText(desc); // Último corrector
    await pool.execute('UPDATE products SET descripcion_intranet = ? WHERE id = ?', [desc, p.id]);
    ok++;
    if(ok % 300 === 0) console.log('  '+ok+'/'+rows2.length+'...');
  }
  console.log('Listo:', ok);
  await pool.end();
})();
