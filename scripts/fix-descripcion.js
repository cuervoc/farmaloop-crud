const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: 'db',
  port: 3306,
  user: 'seo_user',
  password: 'seo_pass_2026',
  database: 'farmaloop_seo',
};

function buildIntranetDescription(p) {
  const lab = p.laboratorio || '';
  const pres = p.presentacion_optimizada || '';
  const titulo = p.title_optimizado || '';
  const bullets = p.bullets_atributos || '';
  const isp = p.registro_isp || '';

  const nombre = titulo.split('|')[0].trim() || pres || 'Producto';

  const bulletsFormatted = bullets
    .split('\n')
    .filter(b => b.trim())
    .map(b => {
      const trimmed = b.trim();
      return trimmed.startsWith('-') ? trimmed : `- ${trimmed}`;
    })
    .join('\n');

  const descripcion = [
    `${nombre}${lab ? ' - ' + lab : ''}`,
    `Compra online en Farmaloop y recibe con despacho a domicilio.`,
    `Revisa precio, stock y disponibilidad actualizada antes de comprar.`,
    `Venta sujeta a receta médica cuando aplique. Uso responsable según indicación profesional.`,
    ``,
  ];

  if (bulletsFormatted) {
    descripcion.push(`${bulletsFormatted}`);
    descripcion.push('');
  }

  if (isp) {
    descripcion.push(`Registro ISP: ${isp}`);
    descripcion.push('');
  }

  descripcion.push(`Condición de almacenado:`);
  descripcion.push(`Mantener en lugar fresco y seco, protegido de la luz. Evitar temperaturas extremas. Mantener fuera del alcance de los niños.`);
  descripcion.push('');
  descripcion.push(`Indicaciones de embarazo y lactancia:`);
  descripcion.push(`Uso solo bajo indicación médica. Si estás embarazada, planeas estarlo o en período de lactancia, consulta a tu médico antes de usar.`);

  return descripcion.join('\n');
}

async function main() {
  const pool = mysql.createPool(DB_CONFIG);

  const [rows] = await pool.execute(
    "SELECT * FROM products WHERE descripcion_intranet LIKE '%Descripción, características%'"
  );
  console.log(`Encontrados: ${rows.length} productos con formato viejo`);

  let updated = 0;
  for (const p of rows) {
    const nueva = buildIntranetDescription(p);
    await pool.execute(
      'UPDATE products SET descripcion_intranet = ? WHERE id = ?',
      [nueva, p.id]
    );
    updated++;
    if (updated % 50 === 0) console.log(`  ${updated}/${rows.length}...`);
  }

  console.log(`✅ ${updated} productos actualizados`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
