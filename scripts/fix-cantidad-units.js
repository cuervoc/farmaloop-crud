const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});
  const [rows] = await pool.execute(`SELECT id, fullName, bullets_atributos FROM products WHERE bullets_atributos LIKE '%Cantidad: x%unidades%'`);
  let ok = 0;
  for(const p of rows) {
    let qty = null;
    const m1 = p.fullName.match(/x\s*(\d+)\s*(ml|g|Comprimidos?|C[áa]psulas?|Ampollas?|Sobres?|Tabletas|Parches?)/i);
    if(m1) qty = `x ${m1[1]} ${m1[2].toLowerCase()}`;
    if(/Dispositivo\s*Prellenado/i.test(p.fullName)) qty = `x 1 dispositivo prellenado`;
    if(/Frasco\s*x\s*(\d+)\s*ml/i.test(p.fullName)) {
      const m = p.fullName.match(/x\s*(\d+)\s*ml/i);
      if(m) qty = `x ${m[1]} ml`;
    }
    if(!qty) continue;
    const newB = p.bullets_atributos.replace(/- Cantidad: x \d+ unidades\n?/i, `- Cantidad: ${qty}\n`);
    await pool.execute('UPDATE products SET bullets_atributos = ? WHERE id = ?', [newB, p.id]);
    ok++;
  }
  console.log('Retocados:', ok);
  await pool.end();
})();
