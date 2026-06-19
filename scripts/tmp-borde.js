const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});
  const skus = ['53413','108118','140805','53873','120852'];
  for(const sku of skus) {
    const [rows] = await pool.execute('SELECT id, fullName, bullets_atributos FROM products WHERE sku = ?', [sku]);
    const p = rows[0];
    let qty = null;
    let m = p.fullName.match(/x\s*(\d+)\s*(Unidades|comp\.?|Comp\.?|Cap\.?|Tabletas)/i);
    if(m) qty = `x ${m[1]} ${m[2].toLowerCase().replace('.','')}`;
    m = p.fullName.match(/(\d+)\s*x\s*(\d+)\s*$/);
    if(m) qty = `x ${m[2]} comprimidos`;
    m = p.fullName.match(/(\d+)\s*(Cap|Caps?)\b/i);
    if(m && parseInt(m[1]) <= 200 && !p.bullets_atributos.includes('Cantidad')) qty = `x ${m[1]} cápsulas`;
    if(qty) {
      const newB = p.bullets_atributos + '\n- Cantidad: ' + qty;
      await pool.execute('UPDATE products SET bullets_atributos = ? WHERE id = ?', [newB, p.id]);
      console.log('FIXED:', sku, '→', qty);
    } else {
      console.log('SKIP:', sku, p.fullName.substring(0,50));
    }
  }
  await pool.execute(`UPDATE product_flags f JOIN products p ON f.product_id = p.id SET f.resolved = 1 WHERE f.resolved = 0 AND p.bullets_atributos LIKE '%Cantidad:%'`);
  console.log('Flags resueltos');
  await pool.end();
})();
