const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});
  const [rows] = await pool.execute(`SELECT id, sku, fullName, bullets_atributos, laboratorio FROM products WHERE subCategory = 'Hipertensión' AND bullets_atributos NOT LIKE '%Laboratorio:%' AND bullets_atributos IS NOT NULL AND laboratorio IS NOT NULL AND laboratorio != ''`);
  let ok = 0;
  for(const p of rows) {
    const newB = p.bullets_atributos + '\n- Laboratorio: ' + p.laboratorio;
    await pool.execute('UPDATE products SET bullets_atributos = ? WHERE id = ?', [newB, p.id]);
    ok++;
  }
  console.log('Labs agregados:', ok);
  await pool.end();
})();
