/**
 * Importa los CSVs del catálogo Farmaloop a MariaDB.
 *
 * Uso:
 *   node scripts/import-csv.js              ← products_export_all.csv
 *   node scripts/import-csv.js --stock      ← solo con stock
 *   node scripts/import-csv.js --2000       ← primeros 2000
 *   node scripts/import-csv.js --file ruta  ← archivo específico
 *
 * Los CSV deben estar en: seo-segunda-etapa/contexto/
 */

const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const { parse } = require('csv-parse/sync');

// ─── Config ──────────────────────────────────────────────────────────────────
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3307'),
  user: process.env.DB_USER || 'seo_user',
  password: process.env.DB_PASSWORD || 'seo_pass_2026',
  database: process.env.DB_NAME || 'farmaloop_seo',
  charset: 'utf8mb4',
};

const CONTEXTO_DIR = path.join(__dirname, '..', '..', 'contexto');
const DEFAULT_FILE = 'products_export_all.csv';

const FILE_MAP = {
  '--stock': 'products_export_all_stock.csv',
  '--2000': 'products_export_2000.csv',
  '--all': 'products_export_all.csv',
};

// ─── Parse args ──────────────────────────────────────────────────────────────
let csvFile = DEFAULT_FILE;
const args = process.argv.slice(2);

if (args.length > 0) {
  if (FILE_MAP[args[0]]) {
    csvFile = FILE_MAP[args[0]];
  } else if (args[0] === '--file' && args[1]) {
    csvFile = args[1];
  } else {
    console.error(`❌ Argumento desconocido: ${args[0]}`);
    console.error('   Opciones: --stock, --2000, --all, --file ruta');
    process.exit(1);
  }
}

const csvPath = path.join(CONTEXTO_DIR, csvFile);
if (!fs.existsSync(csvPath)) {
  console.error(`❌ No se encuentra: ${csvPath}`);
  process.exit(1);
}

// ─── Leer CSV ────────────────────────────────────────────────────────────────
console.log(`\n  📥 Leyendo: ${csvFile}`);
const raw = fs.readFileSync(csvPath, 'utf-8');
const records = parse(raw, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
  delimiter: ',',
});
console.log(`  📊 Registros: ${records.length}`);

// ─── Insertar ────────────────────────────────────────────────────────────────
async function run() {
  console.log(`  🔌 Conectando a MariaDB en ${DB_CONFIG.host}:${DB_CONFIG.port}...`);

  const conn = await mysql.createConnection(DB_CONFIG);

  // Vaciar tabla
  console.log('  🧹 Limpiando tabla products...');
  await conn.execute('TRUNCATE TABLE products');

  // Preparar inserción por lotes
  const batchSize = 500;
  let total = 0;
  let errors = 0;

  const insertSQL = `
    INSERT INTO products (
      sku, url, fullName, category, subCategory,
      stock_total, price_min_activo, price_max_activo, currency,
      requiresPrescription, prescriptionType, pharmaceuticalForm,
      presentation, quantityPerPresentation, ean,
      bioequivalent, cooled, composicion, aliasBusqueda, tags,
      priority, temporaryCategories
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const values = [];

    for (const row of batch) {
      try {
        values.push([
          String(row.sku || '').trim(),
          String(row.url || '').trim(),
          String(row.fullName || row.fullname || '').trim().substring(0, 500),
          String(row.category || '').trim(),
          String(row.subCategory || row.subcategory || '').trim(),
          parseInt(row.stock_total || '0', 10) || 0,
          parseFloat(row.price_min_activo) || null,
          parseFloat(row.price_max_activo) || null,
          String(row.currency || 'CLP').trim(),
          row.requiresPrescription === 'true' || row.requiresPrescription === '1' ? 1 : 0,
          String(row.prescriptionType || row.prescriptiontype || '').trim(),
          String(row.pharmaceuticalForm || row.pharmaceuticalform || '').trim(),
          String(row.presentation || '').trim(),
          parseInt(row.quantityPerPresentation || '1', 10) || 1,
          String(row.ean || '').trim(),
          row.bioequivalent === 'true' || row.bioequivalent === '1' ? 1 : 0,
          row.cooled === 'true' || row.cooled === '1' ? 1 : 0,
          String(row.composicion || row.composición || '').trim(),
          String(row.aliasBusqueda || row.aliasbusqueda || '').trim(),
          String(row.tags || '').trim(),
          parseInt(row.priority || '0', 10) || 0,
          String(row.temporaryCategories || row.temporarycategories || '').trim(),
        ]);
      } catch (err) {
        errors++;
      }
    }

    if (values.length > 0) {
      // Batch insert usando múltiples VALUES
      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
      const flatValues = values.flat();
      const sql = `${insertSQL} ${placeholders}`;

      // MariaDB has a max_allowed_packet limit, so we may need to split further
      // Split into chunks of 100 rows max for safety
      const chunkSize = 100;
      for (let j = 0; j < values.length; j += chunkSize) {
        const chunk = values.slice(j, j + chunkSize);
        const chunkPlaceholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        const chunkFlat = chunk.flat();

        try {
          await conn.execute(`${insertSQL} ${chunkPlaceholders}`, chunkFlat);
        } catch (err) {
          // Fallback: insertar uno por uno
          process.stdout.write(`  ⚠️ Error en lote, insertando individualmente...\r`);
          for (const rowVals of chunk) {
            try {
              await conn.execute(insertSQL, rowVals);
            } catch (rErr) {
              errors++;
            }
          }
        }
      }

      total += values.length;
      process.stdout.write(`  ✅ Progreso: ${total}/${records.length} productos (${errors} errores)\r`);
    }
  }

  process.stdout.write('\n');

  // Verificar
  const [count] = await conn.execute('SELECT COUNT(*) as total FROM products');
  const [cats] = await conn.execute(
    'SELECT subCategory, COUNT(*) as cnt FROM products WHERE subCategory != "" GROUP BY subCategory ORDER BY cnt DESC LIMIT 10'
  );

  console.log(`\n  ✅ Importación completada:`);
  console.log(`     Total insertados: ${count.total}`);
  console.log(`     Errores: ${errors}`);
  console.log(`\n  📋 Top categorías:`);
  cats.forEach(c => console.log(`     ${c.subCategory.padEnd(35)} ${c.cnt}`));

  await conn.end();
  console.log(`\n  🏁 Listo!\n`);
}

run().catch(err => {
  console.error(`\n  ❌ Error fatal: ${err.message}`);
  process.exit(1);
});
