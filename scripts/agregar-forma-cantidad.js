const mysql = require('mysql2/promise');
const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});

const CATS = ['Control de Peso','Diabetes','Colesterol','Salud Mental','Anticonceptivos y Hormonas','Fertilidad','Hipertensión','Sistema Digestivo','Huesos y Articulaciones','Bienestar Sexual','Sistema Inmune','Omega 3','Probióticos'];
const PH = CATS.map(() => '?').join(',');

function extractForma(name) {
  const patterns = [
    /\b(Comprimidos?)\b.*(Recubiertos?)?/i,
    /(Comprimidos?\s*(Recubiertos?|Dispersables|Bucodispersables|de Liberaci[oó]n Prolongada)?)/i,
    /\b(C[áa]psulas?)\b.*(Blandas?)?/i,
    /(C[áa]psulas?\s*(de Liberaci[oó]n Prolongada|Blandas)?)/i,
    /(Soluci[oó]n\s*(Inyectable|Oral|Gotas)?)/i,
    /(Jarabe)/i,
    /(Gotas(\s*Orales)?)/i,
    /(Gel(\s*(T[óo]pico|Crema)?)?)/i,
    /(Ampollas?)/i,
    /(Dispositivo\s*Prellenado)/i,
    /(Jeringa\s*Prellenada)/i,
    /(Parches?\s*Transd[ée]rmicos?)/i,
    /(Sobre)/i,
    /(Sistema\s*Intrauterino)/i,
    /(Grageas)/i,
    /(Tabletas)/i,
    /(Polvo)/i,
    /(Crema)/i,
    /(Shampoo)/i,
    /(Colutorio)/i,
    /(Loci[oó]n)/i,
    /(Spray)/i,
    /([ÓO]vulos)/i,
    /(Supositorios?)/i,
  ];
  for (const re of patterns) {
    const m = name.match(re);
    if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  }
  return null;
}

function extractCantidad(name) {
  // "x 30 Comprimidos"
  let m = name.match(/x\s*(\d+)\s*(Comprimidos?|C[áa]psulas?|Ampollas?|Sobres?|Tabletas|Grageas|Parches?|Supositorios?|[ÓO]vulos|ml|g|gr|mL|gramos)\b/i);
  if (m) {
    const unit = m[2] ? m[2].toLowerCase() : 'unidades';
    return `x ${m[1]} ${unit}`;
  }
  // "30 Comprimidos" (sin x)
  m = name.match(/(\d+)\s*(Comprimidos?|C[áa]psulas?|Tabletas|Parches?)\s*(Recubiertos?|Dispersables|Prolongados?)?\s*$/i);
  if (m && parseInt(m[1]) <= 200) {
    return `x ${m[1]} ${m[2].toLowerCase()}`;
  }
  // Solo número de ml
  m = name.match(/(\d+)\s*ml\b/i);
  if (m) return `x ${m[1]} ml`;
  // "1 Dispositivo"
  m = name.match(/(\d+)\s*(Dispositivo|Jeringa|Frasco)\s*(Prellenado)?/i);
  if (m) return `x ${m[1]} ${m[2].toLowerCase()}`;
  return null;
}

function addBullet(bullets, label, value) {
  const lines = bullets.split('\n');
  const prefix = label.toLowerCase();
  // Check if this field already exists
  if (lines.some(l => l.replace(/- /,'').toLowerCase().startsWith(prefix.toLowerCase()))) return bullets;
  // Add before "- Requiere receta" or "- Laboratorio" or at the end
  let pos = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Laboratorio') || lines[i].includes('laboratorio')) { pos = i; break; }
  }
  if (pos === lines.length) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Requiere receta') || lines[i].includes('Receta m')) { pos = i + 1; break; }
    }
  }
  lines.splice(pos, 0, `- ${label}: ${value}`);
  return lines.join('\n');
}

async function main() {
  const [rows] = await pool.execute(`SELECT id, sku, fullName, bullets_atributos FROM products WHERE subCategory IN (${PH}) AND bullets_atributos IS NOT NULL AND bullets_atributos != ''`, CATS);
  console.log(`Procesando ${rows.length} productos...`);
  let fixes = 0;
  for (const p of rows) {
    const forma = extractForma(p.fullName);
    const cantidad = extractCantidad(p.fullName);
    let bullets = p.bullets_atributos;
    let changed = false;
    if (forma) {
      const newB = addBullet(bullets, 'Forma farmacéutica', forma);
      if (newB !== bullets) { bullets = newB; changed = true; }
    }
    if (cantidad) {
      const newB = addBullet(bullets, 'Cantidad', cantidad);
      if (newB !== bullets) { bullets = newB; changed = true; }
    }
    if (changed) {
      await pool.execute('UPDATE products SET bullets_atributos = ? WHERE id = ?', [bullets, p.id]);
      fixes++;
      if (fixes % 300 === 0) console.log(`  ${fixes}/${rows.length}...`);
    }
  }
  console.log(`✅ ${fixes} productos actualizados con Forma/Cantidad`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
