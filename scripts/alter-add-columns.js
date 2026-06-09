/**
 * alter-add-columns.js
 * Agrega columnas faltantes (laboratorio, precio_actual, precio_referencia)
 * a la tabla products.
 */
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'seo_user',
    password: 'seo_pass_2026',
    database: 'farmaloop_seo',
  });

  const cols = [
    'laboratorio VARCHAR(300) DEFAULT \'\'',
    'precio_actual DECIMAL(12,2) DEFAULT NULL',
    'precio_referencia DECIMAL(12,2) DEFAULT NULL',
  ];

  for (const col of cols) {
    try {
      await conn.execute('ALTER TABLE products ADD COLUMN ' + col);
      console.log('Agregada:', col.split(' ')[0]);
    } catch (e) {
      if (e.errno === 1060) {
        console.log('Ya existe:', col.split(' ')[0]);
      } else {
        console.error('Error:', e.message);
      }
    }
  }

  console.log('OK');
  await conn.end();
}

main().catch(console.error);
