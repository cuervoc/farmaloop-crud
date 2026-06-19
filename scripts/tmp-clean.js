const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});
  const [rows] = await pool.execute(`SELECT id, bullets_atributos FROM products WHERE bullets_atributos LIKE '%- Cantidad:%'`);
  let ok = 0;
  for(const r of rows) {
    const clean = r.bullets_atributos.replace(/\n- Cantidad:.*/g, '');
    await pool.execute('UPDATE products SET bullets_atributos = ? WHERE id = ?', [clean, r.id]);
    ok++;
  }
  console.log('Limpiadas:', ok);
  await pool.end();
})();
