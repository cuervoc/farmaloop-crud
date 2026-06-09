/**
 * fix-mojibake.js v2
 * Corrige double-encoding UTF-8 en campos SEO de la DB.
 *
 * Usa CHAR(byte1, byte2, ...) de MariaDB con bytes individuales.
 */

const mysql = require('mysql2/promise');

// ── Mapa: [bytes_from, bytes_to] ─────────────────────────────────────────
// Cada entrada: primer array = bytes del mojibake, segundo array = bytes correctos
const REPLACEMENTS = [
  // ── Minúsculas acentuadas ──
  { from: [0xC3,0x83,0xC2,0xA1], to: [0xC3,0xA1] },  // Ã¡ → á
  { from: [0xC3,0x83,0xC2,0xA9], to: [0xC3,0xA9] },  // Ã© → é
  { from: [0xC3,0x83,0xC2,0xAD], to: [0xC3,0xAD] },  // Ã­ → í
  { from: [0xC3,0x83,0xC2,0xB3], to: [0xC3,0xB3] },  // Ã³ → ó
  { from: [0xC3,0x83,0xC2,0xBA], to: [0xC3,0xBA] },  // Ãº → ú
  { from: [0xC3,0x83,0xC2,0xB1], to: [0xC3,0xB1] },  // Ã± → ñ
  { from: [0xC3,0x83,0xC2,0xBC], to: [0xC3,0xBC] },  // Ã¼ → ü

  // ── Mayúsculas acentuadas ──
  { from: [0xC3,0x83,0xC2,0x81], to: [0xC3,0x81] },  // Á
  { from: [0xC3,0x83,0xC2,0x89], to: [0xC3,0x89] },  // É
  { from: [0xC3,0x83,0xC2,0x8D], to: [0xC3,0x8D] },  // Í
  { from: [0xC3,0x83,0xC2,0x93], to: [0xC3,0x93] },  // Ó
  { from: [0xC3,0x83,0xC2,0x9A], to: [0xC3,0x9A] },  // Ú
  { from: [0xC3,0x83,0xC2,0x91], to: [0xC3,0x91] },  // Ñ

  // ── Símbolos de puntuación ──
  { from: [0xC3,0x82,0xC2,0xBF], to: [0xC2,0xBF] },  // Â¿ → ¿
  { from: [0xC3,0x82,0xC2,0xA1], to: [0xC2,0xA1] },  // Â¡ → ¡
  { from: [0xC3,0x82,0xC2,0xB0], to: [0xC2,0xB0] },  // Â° → °
  { from: [0xC3,0x82,0xC2,0xB7], to: [0xC2,0xB7] },  // Â· → ·
  { from: [0xC3,0x82,0xC2,0xAE], to: [0xC2,0xAE] },  // Â® → ®
  { from: [0xC3,0x82,0xC2,0xA9], to: [0xC2,0xA9] },  // Â© → ©
  { from: [0xC3,0x82,0xC2,0xA2], to: [0xC2,0xA2] },  // Â¢ → ¢
  { from: [0xC3,0x83,0xC2,0xA6], to: [0xC3,0xA6] },  // Ã¦ → æ

  // ── Bullet • y otros 3-byte ──
  { from: [0xC3,0xA2,0xE2,0x82,0xAC,0xC2,0xA2], to: [0xE2,0x80,0xA2] }, // â€¢ → •
  { from: [0xC3,0xA2,0xE2,0x82,0xAC,0xE2,0x80,0x9C], to: [0xE2,0x80,0x93] }, // â€œ → –
  { from: [0xC3,0xA2,0xE2,0x82,0xAC,0xE2,0x80,0x9D], to: [0xE2,0x80,0x94] }, // â€  → —
];

const FIELDS = [
  'title_optimizado',
  'meta_description_optimizado',
  'keywords_ocultos',
  'bullets_atributos',
  'descripcion_intranet',
  'presentacion_optimizada',
  'link_laboratorio',
];

/** Convierte array de bytes a SQL: CHAR(0xC3,0xA2,...) */
function toCharSql(bytes) {
  return 'CHAR(' + bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')) + ')';
}

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'seo_user',
    password: 'seo_pass_2026',
    database: 'farmaloop_seo',
    charset: 'utf8mb4',
  });

  console.log('✓ Conectado a la DB');

  // Contar antes (usando LIKE BINARY para evitar collation accent-insensitive)
  const [countRows] = await conn.execute(
    `SELECT COUNT(*) AS cnt FROM products WHERE
       descripcion_intranet LIKE BINARY CONCAT('%', CHAR(0xC3,0x83,0xC2,0xB3), '%')`
  );
  console.log(`Productos con 'Ã³' antes: ${countRows[0].cnt}`);

  // Procesar cada campo
  for (const field of FIELDS) {
    console.log(`\nProcesando: ${field}`);
    let expr = `\`${field}\``;
    for (const r of REPLACEMENTS) {
      expr = `REPLACE(${expr}, ${toCharSql(r.from)}, ${toCharSql(r.to)})`;
    }
    // WHERE detecta si hay ALGÚN patrón de mojibabe (byte C3 seguido de 83)
    const sql = `UPDATE products SET \`${field}\` = ${expr}
                 WHERE \`${field}\` LIKE BINARY CONCAT('%', CHAR(0xC3,0x83), '%')
                    OR \`${field}\` LIKE BINARY CONCAT('%', CHAR(0xC3,0x82), '%')
                    OR \`${field}\` LIKE BINARY CONCAT('%', CHAR(0xC3,0xA2), '%')`;
    try {
      const [result] = await conn.execute(sql);
      console.log(`  ✓ ${result.affectedRows} filas`);
    } catch (err) {
      console.error(`  ✗ ${err.message.substring(0, 200)}`);
    }
  }

  // Verificar después con LIKE BINARY
  const checks = [
    ['Ã³', 0xC3,0x83,0xC2,0xB3],
    ['Ã¡', 0xC3,0x83,0xC2,0xA1],
    ['â€¢', 0xC3,0xA2,0xE2,0x82,0xAC,0xC2,0xA2],
  ];
  console.log(`\n═══ VERIFICACIÓN FINAL (LIKE BINARY) ═══`);
  for (const [label, ...bytes] of checks) {
    const [rows] = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM products WHERE
         title_optimizado LIKE BINARY CONCAT('%', CHAR(${bytes.map(b => '0x' + b.toString(16).toUpperCase()).join(',')}), '%')
         OR descripcion_intranet LIKE BINARY CONCAT('%', CHAR(${bytes.map(b => '0x' + b.toString(16).toUpperCase()).join(',')}), '%')
         OR bullets_atributos LIKE BINARY CONCAT('%', CHAR(${bytes.map(b => '0x' + b.toString(16).toUpperCase()).join(',')}), '%')`
    );
    console.log(`  ${label}: ${rows[0].cnt} productos`);
  }

  await conn.end();
  console.log('\nListo.');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
