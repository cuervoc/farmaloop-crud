/**
 * sync-sergio-csv.js
 * 
 * Sincroniza datos frescos desde el CSV de Sergio al CRUD.
 * Actualiza: laboratorio, composicion, precio_actual, precio_referencia, stock, tipo_receta
 * 
 * Uso:
 *   node scripts/sync-sergio-csv.js "../contexto/sergio/products_expert_export-ONLY-ACTIVE.csv"
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

function parseCSV(filePath) {
  const txt = fs.readFileSync(filePath, 'utf-8');
  const lines = txt.split('\n').filter(l => l.trim().length > 0);
  const headers = parseLine(lines[0]);

  return lines.slice(1).map(l => {
    const vals = parseLine(l);
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = (vals[i] || '').trim());
    return obj;
  });
}

function parseLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; continue; }
    if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += line[i];
  }
  result.push(current.trim());
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Uso: node scripts/sync-sergio-csv.js <ruta-al-csv>');
    process.exit(1);
  }

  const csvPath = path.resolve(args[0]);
  if (!fs.existsSync(csvPath)) {
    console.error('Archivo no encontrado:', csvPath);
    process.exit(1);
  }

  console.log('Leyendo CSV...');
  const rows = parseCSV(csvPath);
  console.log(`  ${rows.length} registros en el CSV`);

  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'seo_user',
    password: 'seo_pass_2026',
    database: 'farmaloop_seo',
    charset: 'utf8mb4',   // ← FIX: evitar mojibake al escribir
  });

  // Mapeo de campos CSV → DB
  const fieldMap = {
    laboratorio: 'laboratorio',
    composicion: 'composicion',
    precio_actual: 'precio_actual',
    precio_referencia: 'precio_referencia',
    stock_actual: 'stock_total',
    tipo_receta: 'prescriptionType',
    presentacion: 'presentation',
  };

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const row of rows) {
    const sku = row.sku;
    if (!sku) continue;

    try {
      // Check if SKU exists in our DB
      const [existing] = await conn.execute(
        'SELECT id FROM products WHERE sku = ?', [sku]
      );

      if (existing.length === 0) {
        notFound++;
        continue;
      }

      // Build SET clause
      const sets = [];
      const params = [];
      for (const [csvField, dbField] of Object.entries(fieldMap)) {
        let val = row[csvField];
        if (val !== undefined && val !== null && val !== '') {
          // Parse numeric fields
          if (dbField === 'precio_actual' || dbField === 'precio_referencia') {
            const num = parseFloat(val.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(num) && num > 0) {
              sets.push(`${dbField} = ?`);
              params.push(num);
            }
          } else if (dbField === 'stock_total') {
            const num = parseInt(val);
            if (!isNaN(num)) {
              sets.push(`${dbField} = ?`);
              params.push(num);
            }
          } else {
            sets.push(`${dbField} = ?`);
            params.push(val);
          }
        }
      }

      if (sets.length === 0) continue;

      params.push(sku);
      await conn.execute(
        `UPDATE products SET ${sets.join(', ')} WHERE sku = ?`,
        params
      );
      updated++;
    } catch (e) {
      errors++;
      if (errors <= 5) console.error(`  Error SKU ${sku}: ${e.message}`);
    }

    if (updated % 500 === 0) {
      console.log(`  Procesados ${updated}...`);
    }
  }

  console.log(`\n=== Resultados ===`);
  console.log(`  Actualizados: ${updated}`);
  console.log(`  No encontrados en DB: ${notFound}`);
  console.log(`  Errores: ${errors}`);

  await conn.end();
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
