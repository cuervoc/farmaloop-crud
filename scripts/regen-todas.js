const mysql = require('mysql2/promise');
const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});

const CATS = ['Control de Peso','Diabetes','Colesterol','Salud Mental','Anticonceptivos y Hormonas','Fertilidad','Hipertensión','Sistema Digestivo','Huesos y Articulaciones','Bienestar Sexual','Sistema Inmune','Omega 3','Probióticos'];
const PH = CATS.map(() => '?').join(',');

const DICT = [
  ['depresion','depresión'],['obsesion','obsesión'],['compulsion','compulsión'],
  ['prevencion','prevención'],['indicacion','indicación'],['medicacion','medicación'],
  ['aplicacion','aplicación'],['inyeccion','inyección'],['solucion','solución'],
  ['informacion','información'],['presentacion','presentación'],['composicion','composición'],
  ['administracion','administración'],['duracion','duración'],
  ['funcion','función'],['sedacion','sedación'],
  ['regulacion','regulación'],['suplementacion','suplementación'],['combinacion','combinación'],
  ['relacion sexual','relación sexual'],['proteccion','protección'],
  ['sintoma ','síntoma '],['sintomas','síntomas'],['maximo','máximo'],['minimo','mínimo'],['unico','único'],
  ['especifico','específico'],['genetico','genético'],['organico','orgánico'],
  ['clinico','clínico'],['cronico','crónico'],['psicotico','psicótico'],['epileptico','epiléptico'],
  ['neuropatico','neuropático'],['farmaceutica','farmacéutica'],['periodo','período'],
  ['ansiolitica','ansiolítica'],['topico','tópico'],['osea ','ósea '],
  [' al dia',' al día'],['sueno','sueño'],['migrana','migraña'],
  ['compania','compañía'],['acompanar','acompañar'],
  ['acido ','ácido '],['Acido ','Ácido '],['acne','acné'],['despues','después'],
  ['panico','pánico'],['vertigo','vértigo'],['sindrome','síndrome'],['Meniere','Ménière'],
  ['trigemino','trigémino'],['tension ','tensión '],['digestion','digestión'],
  ['Forma Farmaceutica:','Forma farmacéutica:'],
  ['Forma Farmacéutica:','Forma farmacéutica:'],
  ['Comprimidos Recubiertos','comprimidos recubiertos'],
  ['Comprimidos Recubierto','comprimidos recubiertos'],
  ['capsulas','cápsulas'],['Capsulas','cápsulas'],
  [' Gotas ',' gotas '],[' Ampollas ',' ampollas '],
  ['recubier..','recubiertos'],['recubier.','recubiertos'],
  ['DepakeneJarabeAcido','Depakene Jarabe Ácido'],
  ['Soluci+Â¦n','Solución'],
];

function fixText(text) {
  if (!text) return text;
  let t = text;
  for (const [from, to] of DICT) t = t.replace(new RegExp(from, 'g'), to);
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
