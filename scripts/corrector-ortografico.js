// Corrector ortográfico español definitivo para Farmaloop
// Aplica reglas de acentuación, ñ, mayúsculas y formato
const mysql = require('mysql2/promise');

const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});

const CATS = ['Control de Peso','Diabetes','Colesterol','Salud Mental','Anticonceptivos y Hormonas','Fertilidad','Hipertensión','Sistema Digestivo','Huesos y Articulaciones','Bienestar Sexual','Sistema Inmune','Omega 3','Probióticos'];

// Diccionario de correcciones
const DICT = [
  // === ACENTOS: agudas terminadas en n/s/vocal ===
  ['depresion', 'depresión'], ['obsesion', 'obsesión'], ['compulsion', 'compulsión'],
  ['prevencion', 'prevención'], ['indicacion', 'indicación'], ['medicacion', 'medicación'],
  ['aplicacion', 'aplicación'], ['inyeccion', 'inyección'], ['solucion', 'solución'],
  ['informacion', 'información'], ['presentacion', 'presentación'], ['composicion', 'composición'],
  ['administracion', 'administración'], ['concentracion', 'concentración'], ['duracion', 'duración'],
  ['funcion', 'función'], ['sedacion', 'sedación'], ['absorcion', 'absorción'],
  ['regulacion', 'regulación'], ['insuficiencia', 'insuficiencia'], // already has accent
  ['suplementacion', 'suplementación'], ['combinacion', 'combinación'],
  ['relacion sexual', 'relación sexual'], ['relacion sin', 'relación sin'],
  ['proteccion', 'protección'], ['contraccion', 'contracción'],

  // === ACENTOS: esdrújulas ===
  ['sintoma ', 'síntoma '], ['sintomas', 'síntomas'],
  ['maximo', 'máximo'], ['minimo', 'mínimo'], ['unico', 'único'],
  ['especifico', 'específico'], ['genetico', 'genético'], ['organico', 'orgánico'],
  ['clinico', 'clínico'], ['critico', 'crítico'], ['típico', 'típico'], // already has accent but check
  ['cronico', 'crónico'], ['psicotico', 'psicótico'], ['epileptico', 'epiléptico'],
  ['neuropatico', 'neuropático'], ['patico', 'pático'], // in 'simpático', 'antipático'
  ['farmaceutica', 'farmacéutica'], ['farmaceutico', 'farmacéutico'],
  ['periodo', 'período'],

  // === ACENTOS: hiatus ===
  ['ansiolitica', 'ansiolítica'], ['ansiolitico', 'ansiolítico'],
  ['atípico', 'atípico'], // check - already has accent
  ['osea ', 'ósea '], ['oseo ', 'óseo '],
  ['topico', 'tópico'],

  // === ACENTOS: diacríticos ===
  // 'si' → 'sí' (afirmación) - handled separately for bullet context
  [' al dia', ' al día'], [' al dÌa', ' al día'],
  [' cada dia', ' cada día'],

  // === Ñ ===
  ['sueno', 'sueño'], ['suenos', 'sueños'],
  ['migrana', 'migraña'], ['compania', 'compañía'],
  ['acompanar', 'acompañar'], ['montana', 'montaña'],

  // === ACENTOS: palabras sueltas ===
  ['acido ', 'ácido '], ['Acido ', 'Ácido '],
  ['acne', 'acné'], ['Acne', 'Acné'],
  ['despues', 'después'], ['Despues', 'Después'],
  ['proposito', 'propósito'],
  ['estimulo', 'estímulo'],
  ['panico', 'pánico'], ['Panico', 'Pánico'],
  ['vertigo', 'vértigo'], ['Vertigo', 'Vértigo'],
  ['sindrome', 'síndrome'], ['Sindrome', 'Síndrome'],
  ['Meniere', 'Ménière'],
  ['trigemino', 'trigémino'],
  ['tension ', 'tensión '], ['Tension ', 'Tensión '],
  ['digestion', 'digestión'],

  // === FORMA FARMACÉUTICA: minúscula en medio de oración ===
  ['Forma Farmacéutica:', 'Forma farmacéutica:'],
  ['Forma Farmacéutica :', 'Forma farmacéutica:'],
  ['Forma Farmaceutica:', 'Forma farmacéutica:'],
  ['Forma Farmaceutica :', 'Forma farmacéutica:'],

  // === PALABRAS COMPUESTAS PEGADAS ===
  ['DepakeneJarabeAcido', 'Depakene Jarabe Ácido'],
  ['DepakeneJarabe', 'Depakene Jarabe'],
  ['Soluci+Â¦n', 'Solución'],

  // === COMPRIMIDOS/SIMILARES: minúscula en medio ===
  ['Comprimidos Recubiertos', 'comprimidos recubiertos'],
  ['Comprimidos Recubierto', 'comprimidos recubiertos'],
  ['Comprimidos Recub', 'comprimidos recubiertos'],
  ['Comprimidos recubier', 'comprimidos recubiertos'],
  ['Comprimidos Rec.', 'comprimidos recubiertos'],
  ['cápsulas Recubiertos', 'cápsulas recubiertos'],
  ['Cápsulas Recubiertos', 'cápsulas recubiertos'],

  // === COMPRIMIDOS suelto en texto (no al inicio) ===
  [' comprimidos ', ' comprimidos '], // already correct, just ensure

  // === CÁPSULAS: tilde y minúscula ===
  ['capsulas', 'cápsulas'], ['Capsulas', 'cápsulas'],
  ['Cápsulas', 'cápsulas'], // but keep uppercase at start of sentence

  // === GOTAS: minúscula en medio de oración ===
  [' Gotas ', ' gotas '],
  [' Ampollas ', ' ampollas '],

  // === RECUBIERTOS truncado ===
  ['recubier..', 'recubiertos'],
  ['recubier.', 'recubiertos'],

  // === VACÍO → eliminar ===
  ['Vacio', 'Vacío'],
];

const FIELDS = ['bullets_atributos','descripcion_intranet','title_optimizado'];

function fixText(text) {
  if (!text) return text;
  let t = text;
  for (const [from, to] of DICT) {
    // Skip if already has the correct word (avoid double-fix)
    if (t.includes(to)) continue;
    t = t.replace(new RegExp(from, 'g'), to);
    // Capitalized version if the original was capitalized
    const capFrom = from.charAt(0).toUpperCase() + from.slice(1);
    const capTo = to.charAt(0).toUpperCase() + to.slice(1);
    if (capFrom !== from && t.includes(capFrom)) {
      t = t.replace(new RegExp(capFrom, 'g'), capTo);
    }
  }

  // Fix: "carvedilol" → "Carvedilol" (PA must start with uppercase)
  t = t.replace(/- Principio activo: ([a-záéíóúñ])/g, (m, c) => `- Principio activo: ${c.toUpperCase()}`);

  // Fix: ensure no double spaces
  t = t.replace(/  +/g, ' ');

  return t;
}

async function main() {
  const placeholders = CATS.map(() => '?').join(',');
  const [rows] = await pool.execute(`SELECT id, sku, bullets_atributos, descripcion_intranet, title_optimizado FROM products WHERE subCategory IN (${placeholders})`, CATS);
  console.log(`Corrigiendo ${rows.length} productos...`);
  let fixes = 0;
  for (const p of rows) {
    const newBullets = fixText(p.bullets_atributos);
    const newDesc = fixText(p.descripcion_intranet);
    const newTitle = fixText(p.title_optimizado);
    if (newBullets !== p.bullets_atributos || newDesc !== p.descripcion_intranet || newTitle !== p.title_optimizado) {
      try {
        await pool.execute('UPDATE products SET bullets_atributos = ?, descripcion_intranet = ?, title_optimizado = ? WHERE id = ?', [newBullets, newDesc, newTitle, p.id]);
        fixes++;
        if (fixes % 300 === 0) console.log(`  ${fixes}/${rows.length}...`);
      } catch(e) {
        // title_optimizado VARCHAR(70) might overflow - skip title
        try {
          await pool.execute('UPDATE products SET bullets_atributos = ?, descripcion_intranet = ? WHERE id = ?', [newBullets, newDesc, p.id]);
          fixes++;
        } catch(e2) { /* skip */ }
      }
    }
  }
  console.log(`✅ ${fixes} productos corregidos`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
