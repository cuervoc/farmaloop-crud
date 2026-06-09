/**
 * Sincroniza principio_activo desde mapeo-pa-final.csv a la DB.
 *
 * Lee el CSV, busca cada SKU en la tabla `products`
 * y actualiza el campo `principio_activo`.
 *
 * Uso:
 *   node scripts/sync-pa-from-csv.js
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

const CSV_PATH = path.join(__dirname, '..', '..', 'content-optimizer', 'mapeo-pa-final.csv');

// ─── Leer CSV ────────────────────────────────────────────────────────────────
console.log(`\n  📥 Leyendo: mapeo-pa-final.csv`);

if (!fs.existsSync(CSV_PATH)) {
  console.error(`  ❌ No se encuentra: ${CSV_PATH}`);
  process.exit(1);
}

const raw = fs.readFileSync(CSV_PATH, 'utf-8');
const records = parse(raw, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
  delimiter: ',',
});

console.log(`  📊 Registros en CSV: ${records.length}`);

// Filtrar solo los que tienen SKU
const conSku = records.filter(r => r.sku && String(r.sku).trim() !== '');
console.log(`  🏷️  Con SKU: ${conSku.length}`);
console.log(`  ⏭️  Sin SKU (omitidos): ${records.length - conSku.length}`);

// ─── Sincronizar ─────────────────────────────────────────────────────────────
async function run() {
  console.log(`  🔌 Conectando a MariaDB en ${DB_CONFIG.host}:${DB_CONFIG.port}...`);

  const conn = await mysql.createConnection(DB_CONFIG);

  let actualizados = 0;
  let noEncontrados = 0;
  let errores = 0;
  let totalProcesados = 0;

  for (let i = 0; i < conSku.length; i++) {
    const row = conSku[i];
    const sku = String(row.sku).trim();
    const principioActivo = String(row.principio_activo || '').trim();

    // Solo actualizar si hay principio_activo
    if (!principioActivo) continue;

    totalProcesados++;

    try {
      // Buscar el producto por SKU
      const [products] = await conn.execute(
        'SELECT id, sku, principio_activo FROM products WHERE sku = ?',
        [sku]
      );

      if (products.length === 0) {
        noEncontrados++;
        continue;
      }

      const product = products[0];

      // Solo actualizar si el PA está vacío o es diferente
      if (product.principio_activo !== principioActivo) {
        await conn.execute(
          'UPDATE products SET principio_activo = ? WHERE id = ?',
          [principioActivo, product.id]
        );
        actualizados++;
      }

      // Si hay registro_isp en el CSV (aunque probablemente no esté), lo actualizamos
      // Mapeo para posible columna con otro nombre
      let registroIsp = String(row.registro_isp || row.registroIsp || '').trim();
      if (registroIsp) {
        await conn.execute(
          'UPDATE products SET registro_isp = ? WHERE id = ?',
          [registroIsp, product.id]
        );
      }
    } catch (err) {
      errores++;
      if (errores <= 5) {
        console.error(`  ⚠️  Error con SKU ${sku}: ${err.message}`);
      }
    }

    // Progreso cada 500
    if ((i + 1) % 500 === 0 || i === conSku.length - 1) {
      process.stdout.write(
        `  ✅ Progreso: ${i + 1}/${conSku.length} filas CSV` +
        ` | Actualizados: ${actualizados}` +
        ` | No encontrados: ${noEncontrados}` +
        ` | Errores: ${errores}\r`
      );
    }
  }

  process.stdout.write('\n');

  // ─── Verificar ─────────────────────────────────────────────────────────────
  const [[conPA]] = await conn.execute(
    "SELECT COUNT(*) as total FROM products WHERE principio_activo != '' AND principio_activo IS NOT NULL"
  );
  const [[sinPA]] = await conn.execute(
    "SELECT COUNT(*) as total FROM products WHERE principio_activo = '' OR principio_activo IS NULL"
  );
  const [[total]] = await conn.execute('SELECT COUNT(*) as total FROM products');

  console.log(`\n  ───────────────────────────────────────────`);
  console.log(`  📊 RESUMEN FINAL:`);
  console.log(`  ───────────────────────────────────────────`);
  console.log(`  Total SKUs en CSV:        ${conSku.length}`);
  console.log(`  Procesados (con PA):      ${totalProcesados}`);
  console.log(`  Actualizados en DB:       ${actualizados}`);
  console.log(`  No encontrados en DB:     ${noEncontrados}`);
  console.log(`  Errores:                  ${errores}`);
  console.log(`  ───────────────────────────────────────────`);
  console.log(`  Total productos en DB:    ${total.total}`);
  console.log(`  Con principio_activo:     ${conPA.total}`);
  console.log(`  Sin principio_activo:     ${sinPA.total}`);
  console.log(`  ───────────────────────────────────────────\n`);

  await conn.end();
  console.log(`  🏁 Sincronización completada!\n`);
}

run().catch(err => {
  console.error(`\n  ❌ Error fatal: ${err.message}`);
  process.exit(1);
});
