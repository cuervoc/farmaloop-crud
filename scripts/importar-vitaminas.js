// Importar vitaminas/suplementos desde CSV de Sergio
// Lee CSV, INSERT/UPDATE en DB, genera descripciones deterministas
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});

// Mapeo de tipo_receta → requiresPrescription
function parseReceta(tipo) {
  if (!tipo) return 0;
  const t = tipo.toLowerCase();
  if (t.includes('receta') || t.includes('retenida')) return 1;
  return 0;
}

// Inferir forma farmacéutica desde la presentación
function inferirForma(pres) {
  if (!pres) return null;
  const p = pres.toLowerCase();
  if (p.includes('comprimido') || p.includes('tableta')) return 'Comprimidos';
  if (p.includes('cápsula') || p.includes('capsula') || p.includes('cáps')) return 'Cápsulas';
  if (p.includes('sobre')) return 'Sobre';
  if (p.includes('ampolla') || p.includes('inyectable') || p.includes('jeringa')) return 'Solución Inyectable';
  if (p.includes('gota') || p.includes('solución oral') || p.includes('jarabe')) return 'Solución Oral';
  if (p.includes('caramelo')) return 'Unidad';
  return null;
}

// Extraer cantidad del fullName
function extraerCantidad(name) {
  if (!name) return null;
  const m = name.match(/x\s*(\d+)\s*(comprimidos?|c[áa]psulas?|tabletas?|sobres?|ampollas?|g|ml|gr?|dosis|unidades?)?/i);
  if (m) {
    const unit = m[2] ? m[2].toLowerCase() : 'unidades';
    return `${m[1]} ${unit}`;
  }
  return null;
}

// Extraer concentración del fullName
function extraerConcentracion(name) {
  if (!name) return null;
  const m = name.match(/(\d+[.,]?\d*\s*(mg|mcg|g|ml|ui|%)[^m])/i);
  if (m) return m[1].trim();
  return null;
}

// Template determinista de descripción (sin LLM, cero errores)
function buildDescripcion(row) {
  const nombre = row.fullName || 'Producto';
  const lab = row.laboratorio || '';
  const pa = row.principio_activo || nombre.split(' -')[0].trim() || 'No especificado';
  const forma = inferirForma(row.presentacion) || 'Comprimidos';
  const cant = extraerCantidad(nombre) || '';
  const conc = extraerConcentracion(nombre) || '';
  const receta = parseReceta(row.tipo_receta) ? 'Sí' : 'No';
  const comp = row.composicion || '';

  const bullets = [
    `- Principio activo: ${pa}`,
    `- Vía de administración: Oral`,
    `- Requiere receta médica: ${receta}`,
    `- Forma farmacéutica: ${forma}`,
  ];
  if (cant) bullets.splice(3, 0, `- Cantidad: ${cant}`);
  if (conc) bullets.splice(1, 0, `- Concentración: ${conc}`);
  if (comp) bullets.splice(2, 0, `- Composición: ${comp}`);
  bullets.push(`- Laboratorio: ${lab}`);

  return [
    `${nombre}${lab ? ' - ' + lab : ''}`,
    `Compra online en Farmaloop y recibe con despacho a domicilio.`,
    `Revisa precio, stock y disponibilidad actualizada antes de comprar.`,
    ``,
    bullets.join('\n'),
    ``,
    `Condición de almacenado:`,
    `Mantener en lugar fresco y seco, protegido de la luz. Evitar temperaturas extremas. Mantener fuera del alcance de los niños.`,
    ``,
    `Indicaciones de embarazo y lactancia:`,
    `Uso solo bajo indicación médica. Si estás embarazada, planeas estarlo o en período de lactancia, consulta a tu médico antes de usar.`,
  ].join('\n');
}

// Mapeo de subcategoria en CSV → subcategoría en nuestra DB
function mapSubcat(s) {
  if (!s) return 'Suplementos';
  const map = {
    'Vitaminas y Minerales': 'Vitaminas y Minerales',
    'Vitaminas': 'Vitaminas',
    'Suplementos': 'Suplementos',
  };
  return map[s] || 'Suplementos';
}

async function main() {
  // Leer CSV
  const csvPath = path.join(__dirname, 'import-vitaminas.csv');

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  // Remove BOM if present
  const clean = csvContent.charCodeAt(0) === 0xFEFF ? csvContent.slice(1) : csvContent;
  const records = csv.parse(clean, { columns: true, skip_empty_lines: true });
  console.log('CSV leído:', records.length, 'productos');

  let inserted = 0, updated = 0, errors = 0, processed = 0;

  for (const row of records) {
    const sku = (row.sku || '').trim();
    if (!sku) continue;

    const subCat = mapSubcat(row.subcategoria);
    const lab = row.laboratorio || '';
    const pa = row.principio_activo || '';
    const formaInferida = inferirForma(row.presentacion) || '';
    const url = row.url || '';

    try {
      processed++;

      // Check if SKU exists
      const [exist] = await pool.execute('SELECT id FROM products WHERE sku = ?', [sku]);

      if (exist.length > 0) {
        // UPDATE existing
        await pool.execute(
          `UPDATE products SET subCategory = ?, laboratorio = ?, principio_activo = ?,
           url = ?, pharmaceuticalForm = ?, presentacion_optimizada = ?,
           stock_total = ?
           WHERE sku = ?`,
          [subCat, lab, pa, url, formaInferida, row.presentacion || '', parseInt(row.stock_actual) || 0, sku]
        );
        updated++;
      } else {
        // INSERT new
        await pool.execute(
          `INSERT INTO products (sku, fullName, url, subCategory, laboratorio, principio_activo,
           pharmaceuticalForm, presentacion_optimizada, stock_total, estado, estado_intranet)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', 'pendiente')`,
          [sku, row.fullName || '', url, subCat, lab, pa,
           formaInferida, row.presentacion || '', parseInt(row.stock_actual) || 0]
        );
        inserted++;
      }
    } catch (err) {
      errors++;
      process.stderr.write(`  Error ${sku}: ${err.message}\n`);
    }

    if (processed % 100 === 0) console.log(`  ${processed}/${records.length}...`);
  }

  console.log(`\n✅ Insertados: ${inserted} | Actualizados: ${updated} | Errores: ${errors}`);

  // Regenerar descripciones para los 658 productos
  console.log('\nGenerando descripciones deterministas...');
  const cats = ['Vitaminas y Minerales', 'Vitaminas', 'Suplementos'];
  const ph = cats.map(() => '?').join(',');
  const [rows] = await pool.execute(`SELECT * FROM products WHERE subCategory IN (${ph})`, cats);
  let descOk = 0;
  for (const p of rows) {
    const row = {
      sku: p.sku,
      fullName: p.fullName,
      laboratorio: p.laboratorio,
      principio_activo: p.principio_activo,
      presentacion: p.presentacion_optimizada,
      tipo_receta: p.tipo_receta || '',
      composicion: '',
    };
    const desc = buildDescripcion(row);
    // Apply corrector
    const DICT = require('./dict-ortografia.json');
    let t = desc;
    for (const [from, to] of DICT) {
      if (/[^a-záéíóúñü]/i.test(from)) {
        t = t.split(from).join(to);
      } else {
        t = t.replace(new RegExp('\\b' + from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'),
          (m) => m.toLowerCase() === from.toLowerCase() ? to : to.charAt(0).toUpperCase() + to.slice(1));
      }
    }
    t = t.replace(/(- [^:\n]+: )([a-záéíóúñ])/gm, (m, prefix, letter) => prefix + letter.toUpperCase());
    t = t.replace(/  +/g, ' ');

    await pool.execute('UPDATE products SET descripcion_intranet = ? WHERE id = ?',
      [t, p.id]);
    descOk++;
  }
  console.log(`Descripciones generadas: ${descOk}`);

  await pool.end();
  console.log('✅ Importación completa');
}

main().catch(err => { console.error(err); process.exit(1); });
