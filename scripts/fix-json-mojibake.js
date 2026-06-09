/**
 * fix-json-mojibake.js
 * 
 * Repara mojibake en los archivos JSON de output del content-optimizer.
 * Reutiliza la misma lógica que fix-mojibake.js (hasMojibake, fixString).
 * 
 * Uso:
 *   node scripts/fix-json-mojibake.js
 */

const fs = require('fs');
const path = require('path');

// ─── Lógica de reparación (misma que fix-mojibake.js) ───────────────────────

function hasMojibake(str) {
  if (!str || typeof str !== 'string') return false;
  for (let i = 0; i < str.length - 1; i++) {
    const c1 = str.charCodeAt(i);
    const c2 = str.charCodeAt(i + 1);
    if ((c1 === 0xC3 || c1 === 0xC2) && (c2 >= 0x80 && c2 <= 0xBF)) return true;
    if (c1 >= 0xC2 && c1 <= 0xEF && c2 >= 0x80 && c2 <= 0xBF) return true;
  }
  return false;
}

function countMojibakePairs(str) {
  if (!str) return 0;
  let count = 0;
  for (let i = 0; i < str.length - 1; i++) {
    const c1 = str.charCodeAt(i);
    const c2 = str.charCodeAt(i + 1);
    if ((c1 === 0xC3 || c1 === 0xC2) && (c2 >= 0x80 && c2 <= 0xBF)) count++;
  }
  return count;
}

function latin1Encode(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0xFF) {
      bytes[i] = code;
    } else if (code === 0x20AC) {
      bytes[i] = 0x80;
    } else {
      return null;
    }
  }
  return bytes;
}

function fixString(str) {
  if (!str || typeof str !== 'string') return null;
  if (!hasMojibake(str)) return null;
  try {
    const latin1Bytes = latin1Encode(str);
    if (!latin1Bytes) return null;
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const fixed = decoder.decode(latin1Bytes);
    if (!hasMojibake(fixed) && fixed !== str) {
      const before = countMojibakePairs(str);
      const after = countMojibakePairs(fixed);
      if (after < before) return fixed;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ─── Recorrer objetos recursivamente reparando strings ──────────────────────

function deepFix(obj, path_ = '') {
  let fixed = 0;
  if (typeof obj === 'string') {
    const repaired = fixString(obj);
    if (repaired) {
      console.log(`  🔧 ${path_}`);
      console.log(`     ANTES:   ${obj.substring(0, 80)}`);
      console.log(`     DESPUÉS: ${repaired.substring(0, 80)}`);
      return [repaired, 1];
    }
    return [obj, 0];
  }
  if (Array.isArray(obj)) {
    let totalFixed = 0;
    for (let i = 0; i < obj.length; i++) {
      const [newVal, f] = deepFix(obj[i], `${path_}[${i}]`);
      obj[i] = newVal;
      totalFixed += f;
    }
    return [obj, totalFixed];
  }
  if (obj && typeof obj === 'object') {
    let totalFixed = 0;
    for (const key of Object.keys(obj)) {
      const [newVal, f] = deepFix(obj[key], `${path_}.${key}`);
      obj[key] = newVal;
      totalFixed += f;
    }
    return [obj, totalFixed];
  }
  return [obj, 0];
}

// ─── Main ────────────────────────────────────────────────────────────────────

const JSON_DIR = path.join(__dirname, '..', '..', '..', 'content-optimizer');
const FILES = [
  'output-colesterol-restante.json',
  'output-metformina.json',
  'output-diabetes-pequenos.json',
];

console.log('JSON_DIR:', JSON_DIR);
console.log('__dirname:', __dirname);
let totalFixed = 0;

for (const file of FILES) {
  const filePath = path.join(JSON_DIR, file);
  console.log('Buscando:', filePath, '→', fs.existsSync(filePath));
  if (!fs.existsSync(filePath)) {
    console.log(`❌ No encontrado: ${file}`);
    continue;
  }
  
  console.log(`\n📋 ${file}:`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  let data = JSON.parse(raw);
  
  const [fixedData, fixedCount] = deepFix(data);
  
  if (fixedCount > 0) {
    fs.writeFileSync(filePath, JSON.stringify(fixedData, null, 2), 'utf-8');
    console.log(`  ✅ ${fixedCount} strings reparados en ${file}`);
    totalFixed += fixedCount;
  } else {
    console.log(`  ✅ Sin mojibake`);
  }
}

console.log(`\n📊 Total: ${totalFixed} strings reparados en archivos JSON`);
