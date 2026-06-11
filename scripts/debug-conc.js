const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});
  const [r1] = await pool.execute(`SELECT COUNT(*) as c FROM products WHERE bullets_atributos IS NOT NULL AND bullets_atributos != ''`);
  console.log('Total with bullets:', r1[0].c);
  const [r2] = await pool.execute(`SELECT COUNT(*) as c FROM products WHERE bullets_atributos LIKE '%Concentrac%'`);
  console.log('With Concentrac:', r2[0].c);
  const [r3] = await pool.execute(`SELECT sku, bullets_atributos FROM products WHERE bullets_atributos LIKE '%Concentrac%' LIMIT 1`);
  if (r3[0]) {
    console.log('Sample SKU:', r3[0].sku);
    console.log('Bullets:', JSON.stringify(r3[0].bullets_atributos).substring(0, 200));
    const lines = r3[0].bullets_atributos.split('\n');
    console.log('Lines count:', lines.length);
    const c = lines.find(l => /concentrac/i.test(l));
    console.log('Conc line:', c);
  }
  await pool.end();
})();
