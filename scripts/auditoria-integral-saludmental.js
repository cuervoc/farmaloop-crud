const mysql = require('mysql2/promise');
const fs = require('fs');

const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});

const checkMojibake = [
  { pattern: '+¡a', replace: 'ía', label: 'mojibake: +¡a → ía' },
  { pattern: '+¡',  replace: 'í',  label: 'mojibake: +¡ → í' },
  { pattern: '+í',  replace: 'á',  label: 'mojibake: +í → á' },
  { pattern: '+ü',  replace: 'Á',  label: 'mojibake: +ü → Á' },
  { pattern: '+é',  replace: 'é',  label: 'mojibake: +é → é' },
  { pattern: '+ó',  replace: 'ó',  label: 'mojibake: +ó → ó' },
  { pattern: '+ú',  replace: 'ú',  label: 'mojibake: +ú → ú' },
  { pattern: 'Ã©',  replace: 'é',  label: 'mojibake: Ã© → é' },
  { pattern: 'Ã¡',  replace: 'á',  label: 'mojibake: Ã¡ → á' },
  { pattern: 'Ã³',  replace: 'ó',  label: 'mojibake: Ã³ → ó' },
  { pattern: 'Ã±',  replace: 'ñ',  label: 'mojibake: Ã± → ñ' },
  { pattern: 'Ãº',  replace: 'ú',  label: 'mojibake: Ãº → ú' },
  { pattern: 'â', replace: "'",  label: 'mojibake: â → \'' },
  { pattern: 'â', replace: '"',  label: 'mojibake: â → "' },
  { pattern: 'â', replace: '"',  label: 'mojibake: â → "' },
];

const SEO_FIELDS = ['title_optimizado','meta_description_optimizado','presentacion_optimizada','bullets_atributos','descripcion_intranet','keywords_ocultos','link_laboratorio'];

function extractField(line, prefix) {
  const m = line.match(new RegExp(`-\\s*${prefix}\\s*:\\s*(.+)`, 'i'));
  return m ? m[1].trim() : null;
}

async function main() {
  const [rows] = await pool.execute(
    `SELECT * FROM products WHERE subCategory = 'Salud Mental' ORDER BY fullName`
  );
  console.log(`Auditando ${rows.length} productos de Salud Mental...\n`);

  let fixes = { mojibake: 0, bullets: 0, descripcion: 0 };
  let issues = [];
  let fixedRows = [];

  for (const p of rows) {
    const prods = { sku: p.sku, name: p.fullName, warnings: [] };

    const bullets = p.bullets_atributos || '';
    const lines = bullets.split('\n').filter(l => l.trim());

    // 1. MOJIBAKE CHECK
    for (const fix of checkMojibake) {
      let hasInAny = false;
      for (const f of SEO_FIELDS) {
        if ((p[f] || '').includes(fix.pattern)) hasInAny = true;
      }
      if (hasInAny) {
        prods.warnings.push(fix.label);
        // Auto-fix all fields
        for (const f of SEO_FIELDS) {
          if ((p[f] || '').includes(fix.pattern)) {
            const nuevo = (p[f] || '').replaceAll(fix.pattern, fix.replace);
            await pool.execute(`UPDATE products SET ${f} = ? WHERE id = ?`, [nuevo, p.id]);
          }
        }
        fixes.mojibake++;
      }
    }

    // 2. BULLETS FIELDS CHECK
    const fields = [
      { key: 'Principio activo', label: 'Principio activo' },
      { key: 'Concentrac', label: 'Concentración' },
      { key: 'Indicac', label: 'Indicación' },
      { key: 'Via de administrac', label: 'Vía de administración' },
      { key: 'Requiere receta', label: 'Receta médica' },
      { key: 'Laboratorio', label: 'Laboratorio' },
    ];

    for (const f of fields) {
      const found = lines.some(l => new RegExp(`-\\s*${f.key}`, 'i').test(l));
      if (!found) {
        prods.warnings.push(`Falta campo en bullets: ${f.label}`);
      }
    }

    // 3. PRINCIPIO ACTIVO validation
    const paLine = lines.find(l => /principio\s*activo/i.test(l));
    if (paLine) {
      const paVal = extractField(paLine, 'Principio Activo') || extractField(paLine, 'Principio activo');
      if (paVal && paVal.length < 3) prods.warnings.push(`Principio activo muy corto: "${paVal}"`);
      if (paVal && paVal.toLowerCase() === p.fullName?.toLowerCase().substring(0, paVal.length))
        prods.warnings.push(`Principio activo es igual al nombre del producto`);
    }

    // 4. CONCENTRATION CHECK
    const concLine = lines.find(l => /concentrac/i.test(l));
    if (concLine) {
      const m = concLine.match(/:\s*([\d,.]+)\s*(mg|%|mcg|ml)/i);
      if (m) {
        const bulletVal = parseFloat(m[1].replace(',', '.'));
        const nameMatch = p.fullName?.match(/(\d+[.,]?\d*)\s*(mg|%|mcg)/);
        if (nameMatch) {
          const nameVal = parseFloat(nameMatch[1].replace(',', '.'));
          if (Math.abs(bulletVal - nameVal) > 0.15) {
            prods.warnings.push(`Concentración: bullet=${bulletVal}${m[2]}, nombre=${nameVal}${nameMatch[2]}`);
          }
        }
      }
    }

    // 5. LABORATORIO CHECK
    const labLine = lines.find(l => /laboratorio/i.test(l));
    if (labLine) {
      const labVal = extractField(labLine, 'Laboratorio');
      if (!labVal || labVal === 'No especificado' || labVal === 'Sin información' || labVal === 'Sin información disponible')
        prods.warnings.push('Laboratorio vacío o "No especificado"');
    }

    // 6. CATEGORIA in bullets
    const catLine = lines.find(l => /categoria/i.test(l));
    if (catLine) {
      const catVal = extractField(catLine, 'Categoria') || extractField(catLine, 'Categoría');
      if (catVal && catVal.toLowerCase().replace(/\s/g,'') !== 'saludmental')
        prods.warnings.push(`Categoría en bullet no es Salud Mental: "${catVal}"`);
    }

    // 7. GENERIC INDICACION check (many products sharing same generic text)
    const indLine = lines.find(l => /indicac/i.test(l));
    if (indLine) {
      const indVal = extractField(indLine, 'Indicacion') || extractField(indLine, 'Indicación');
      const veryGeneric = ['trastornos de salud mental', 'bienestar emocional y salud mental', 'salud mental'];
      if (indVal && veryGeneric.some(g => indVal.toLowerCase().replace(/\s/g,'') === g.replace(/\s/g,'')))
        prods.warnings.push(`Indicación genérica: "${indVal.substring(0, 60)}"`);
    }

    // 8. DOUBLE SPACES / STRANGE CHARS
    for (const f of SEO_FIELDS) {
      const val = p[f] || '';
      if (val.includes('  ') && !val.includes('   '))
        prods.warnings.push(`Doble espacio en ${f}`);
    }

    if (prods.warnings.length > 0) {
      issues.push(prods);
      console.log(`⚠️  ${p.sku} | ${p.fullName.substring(0, 55)}`);
      prods.warnings.forEach(w => console.log(`   ${w}`));
    }
  }

  // Write report
  let csv = 'SKU;Producto;Categoria;Problemas\n';
  for (const i of issues) {
    csv += `${i.sku};"${i.name}";Salud Mental;"${i.warnings.join(' | ')}"\n`;
  }
  fs.writeFileSync('/app/data/auditoria-salud-mental.csv', csv, 'utf8');

  console.log(`\n========================================`);
  console.log(`RESULTADO FINAL`);
  console.log(`========================================`);
  console.log(`Total productos: ${rows.length}`);
  console.log(`Productos con issues: ${issues.length}`);
  console.log(`Mojibake corregidos: ${fixes.mojibake}`);
  console.log(`OK (sin problemas): ${rows.length - issues.length}`);
  console.log(`Reporte: data/auditoria-salud-mental.csv`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
