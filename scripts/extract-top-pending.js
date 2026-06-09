/**
 * extract-top-pending.js
 * Exporta los top productos pendientes con data completa para el content-optimizer.
 * Uso: node scripts/extract-top-pending.js [limite] [minCompras]
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const LIMITE = parseInt(process.argv[2]) || 50;
const MIN_COMPRAS = parseInt(process.argv[3]) || 1;

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3307'),
  user: process.env.DB_USER || 'seo_user',
  password: process.env.DB_PASSWORD || 'seo_pass_2026',
  database: process.env.DB_NAME || 'farmaloop_seo',
  charset: 'utf8mb4',
};

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);

  const [rows] = await conn.execute(`
    SELECT
      b.sku,
      b.purchases,
      b.views,
      b.revenue,
      p.id,
      p.fullName,
      p.subCategory,
      p.principio_activo,
      p.url,
      p.composicion,
      p.presentation,
      p.stock_total,
      p.requiresPrescription
    FROM best_sellers b
    LEFT JOIN products p ON b.sku = p.sku
    WHERE (p.estado IS NULL OR p.estado = 'pendiente')
      AND b.purchases >= ?
    ORDER BY b.purchases DESC, b.views DESC
    LIMIT ?
  `, [MIN_COMPRAS, LIMITE]);

  console.log(`\n  📦 Top ${rows.length} pendientes exportados\n`);

  // Mostrar resumen
  rows.forEach((r, i) => {
    const idx = String(i + 1).padStart(3);
    console.log(`  ${idx}. [${r.purchases} comp] SKU ${r.sku} - ${(r.fullName || '?').substring(0, 65)}`);
    console.log(`      PA: ${r.principio_activo || '-'} | Cat: ${r.subCategory || '-'}`);
  });

  // Guardar JSON
  const outputPath = path.resolve(__dirname, '..', '..', 'content-optimizer', `top-pendientes-batch-1.json`);
  fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2), 'utf-8');
  console.log(`\n  💾 Guardado en: content-optimizer/top-pendientes-batch-1.json\n`);

  await conn.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
