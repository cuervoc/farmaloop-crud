/**
 * Verifica que el Excel exportado tenga la estructura correcta
 * (agrupación por PA, headers, colores)
 */
const http = require('http');
const ExcelJS = require('exceljs');
const path = require('path');

async function check() {
  console.log('Descargando Excel...');
  const resp = await new Promise((resolve, reject) => {
    http.get('http://localhost:3001/api/export/excel', (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
  console.log('  OK -', (resp.length / 1024).toFixed(0), 'KB');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(resp);

  console.log('\nHojas:', wb.worksheets.length);
  console.log('  Includes:', wb.worksheets.map(s => s.name).slice(0, 5).join(', '), '...');

  // --- Resumen ---
  const summary = wb.getWorksheet('Resumen');
  if (summary) {
    console.log('\n=== RESUMEN (primeras 3 filas) ===');
    for (let i = 1; i <= 3; i++) {
      const r = summary.getRow(i);
      console.log(
        `  Fila ${i}:`,
        `"${r.getCell(1).value}"`,
        `| "${r.getCell(2).value}"`,
        `| "${r.getCell(3).value}"`,
        `| "${r.getCell(5).value}"`,
        `| "${r.getCell(6).value}"`
      );
    }
  }

  // --- Control de Peso ---
  const cp = wb.getWorksheet('Control de Peso');
  if (cp) {
    console.log('\n=== CONTROL DE PESO ===');
    
    // Row 1: Header
    console.log('\n-- HEADER (fila 1) --');
    const h = cp.getRow(1);
    for (let c = 1; c <= 14; c++) {
      const val = h.getCell(c).value;
      console.log('  Col ' + c + ': "' + (val || '') + '"');
    }
    
    // Row 2: Group header
    console.log('\n-- GROUP HEADER (fila 2) --');
    const g = cp.getRow(2);
    console.log('  Cell 1: "' + (g.getCell(1).value || '') + '"');
    if (g.getCell(2).value) {
      console.log('  Cell 2: "' + g.getCell(2).value + '" (should be empty, merged)');
    }

    // Row 3: First product (semaglutida)
    console.log('\n-- PRIMER PRODUCTO (fila 3) --');
    const p1 = cp.getRow(3);
    for (let c = 1; c <= 7; c++) {
      const val = p1.getCell(c).value;
      console.log('  Col ' + c + ': "' + (val || '') + '"');
    }

    // Count: how many group headers vs products
    let groupHeaders = 0;
    let products = 0;
    cp.eachRow((row, i) => {
      if (i === 1) return; // skip header
      const cellVal = String(row.getCell(1).value || '');
      if (cellVal.includes('productos') || cellVal.includes('producto')) {
        groupHeaders++;
      } else if (cellVal) {
        products++;
      }
    });
    console.log('\n-- ESTRUCTURA --');
    console.log('  Group headers (PA separators):', groupHeaders);
    console.log('  Product rows:', products);
    console.log('  Total rows:', cp.rowCount);
  }

  console.log('\n✅ Verificación completada');
}

check().catch(e => console.error('ERROR:', e));
