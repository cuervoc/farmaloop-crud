const mysql = require('mysql2/promise');
const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});

const CATS = ['Control de Peso','Diabetes','Colesterol','Salud Mental','Anticonceptivos y Hormonas','Fertilidad','Hipertensión','Sistema Digestivo','Huesos y Articulaciones','Bienestar Sexual','Sistema Inmune','Omega 3','Probióticos'];
const PH = CATS.map(() => '?').join(',');

(async () => {
  const [rows] = await pool.execute(`SELECT * FROM products WHERE subCategory IN (${PH})`, CATS);
  console.log('Regenerando', rows.length, 'descripciones...');
  let ok = 0;
  for(const p of rows) {
    const lab = p.laboratorio || '';
    const titulo = p.title_optimizado || '';
    const bullets = p.bullets_atributos || '';
    const isp = p.registro_isp || '';
    const nombre = titulo.split('|')[0].trim() || p.presentacion_optimizada || 'Producto';
    const bf = bullets.split('\n').filter(b=>b.trim()).map(b=>{const t=b.trim();return t.startsWith('-')?t:'- '+t}).join('\n');
    const d = [nombre+(lab?' - '+lab:''),'Compra online en Farmaloop y recibe con despacho a domicilio.','Revisa precio, stock y disponibilidad actualizada antes de comprar.','Venta sujeta a receta médica cuando aplique. Uso responsable según indicación profesional.',''];
    if(bf) { d.push(bf); d.push(''); }
    if(isp) { d.push('Registro ISP: '+isp); d.push(''); }
    d.push('Condición de almacenado:');
    d.push('Mantener en lugar fresco y seco, protegido de la luz. Evitar temperaturas extremas. Mantener fuera del alcance de los niños.');
    d.push('');
    d.push('Indicaciones de embarazo y lactancia:');
    d.push('Uso solo bajo indicación médica. Si estás embarazada, planeas estarlo o en período de lactancia, consulta a tu médico antes de usar.');
    await pool.execute('UPDATE products SET descripcion_intranet = ? WHERE id = ?', [d.join('\n'), p.id]);
    ok++;
    if(ok % 300 === 0) console.log('  '+ok+'/'+rows.length+'...');
  }
  console.log('Listo:', ok);
  await pool.end();
})();
