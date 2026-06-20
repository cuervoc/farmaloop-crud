const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({host:'db',port:3306,user:'seo_user',password:'seo_pass_2026',database:'farmaloop_seo'});

  const fixes = {
    '105255': { // Cordiax 80 mg x 40 Comprimidos
      pa: 'Telmisartán', conc: '80 mg', ind: 'Hipertensión arterial (antagonista ARA II)',
      via: 'Oral', receta: 'Sí', forma: 'Comprimidos', cant: 'x 40 comprimidos'
    },
    '16966': { // Xarelto 20 mg x 28 Comprimidos
      pa: 'Rivaroxabán', conc: '20 mg', ind: 'Prevención de trombosis y ACV en fibrilación auricular',
      via: 'Oral', receta: 'Sí (receta retenida)', forma: 'Comprimidos', cant: 'x 28 comprimidos', lab: 'Bayer'
    },
    '118983': { // Exforge 320 mg/5 mg x 28 Comprimidos
      pa: 'Valsartán + Amlodipino', conc: '320 mg / 5 mg', ind: 'Hipertensión arterial (terapia combinada)',
      via: 'Oral', receta: 'Sí', forma: 'Comprimidos', cant: 'x 28 comprimidos', lab: 'Novartis'
    },
    '120664': { // Hepta 4000 UI x Jeringa Prellenada
      pa: 'Epoetina alfa', conc: '4000 UI', ind: 'Anemia asociada a insuficiencia renal crónica',
      via: 'Subcutánea o intravenosa', receta: 'Sí', forma: 'Jeringa prellenada'
    },
    '140278': { // Nurox 60 mg/0,6 ml x 2 Jeringas Prellenadas
      pa: 'Enoxaparina sódica', conc: '60 mg / 0,6 ml', ind: 'Prevención y tratamiento de trombosis venosa profunda',
      via: 'Subcutánea', receta: 'Sí', forma: 'Jeringa prellenada', cant: 'x 2 jeringas'
    },
    '91027': { // Colchicina 0.5 mg x 40 Comprimidos
      pa: 'Colchicina', conc: '0,5 mg', ind: 'Crisis aguda de gota (antiinflamatorio no hormonal)',
      via: 'Oral', receta: 'Sí', forma: 'Comprimidos', cant: 'x 40 comprimidos'
    },
    '91418': { // Carvedilol 6,25 mg x 30 Comprimidos
      pa: 'Carvedilol', conc: '6,25 mg', ind: 'Hipertensión arterial e insuficiencia cardíaca (betabloqueante)',
      via: 'Oral', receta: 'Sí', forma: 'Comprimidos', cant: 'x 30 comprimidos'
    },
    '150951': { // Nurox 40 mg x 2 Jeringas
      pa: 'Enoxaparina sódica', conc: '40 mg', ind: 'Prevención de trombosis venosa (anticoagulante)',
      via: 'Subcutánea', receta: 'Sí (receta retenida)', forma: 'Jeringa prellenada', cant: 'x 2 jeringas'
    },
    '139033': { // Valax D 160 mg/25 mg x 30 Comprimidos
      pa: 'Valsartán + Hidroclorotiazida', conc: '160 mg / 25 mg', ind: 'Hipertensión arterial (terapia combinada)',
      via: 'Oral', receta: 'Sí', forma: 'Comprimidos', cant: 'x 30 comprimidos'
    },
  };

  for (const [sku, f] of Object.entries(fixes)) {
    const bullets = [
      `- Principio activo: ${f.pa}`,
      `- Concentración: ${f.conc}`,
      `- Indicación: ${f.ind}`,
      `- Vía de administración: ${f.via}`,
      `- Requiere receta médica: ${f.receta}`,
    ];
    if (f.forma) bullets.push(`- Forma farmacéutica: ${f.forma}`);
    if (f.cant) bullets.push(`- Cantidad: ${f.cant}`);
    if (f.lab) bullets.push(`- Laboratorio: ${f.lab}`);

    await pool.execute('UPDATE products SET bullets_atributos = ? WHERE sku = ?', [bullets.join('\n'), sku]);
    console.log('FIXED:', sku);
  }
  await pool.end();
})();
