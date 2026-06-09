/**
 * push-optimized.js
 * 
 * Lee un archivo JSON con productos optimizados y los sube al CRUD
 * con estado = 'revisar' (para que QA los revise antes de marcar como 'optimizado').
 *
 * Uso:
 *   node scripts/push-optimized.js <archivo.json>
 *
 * Formato esperado del JSON (array de objetos):
 *   [
 *     {
 *       "sku": "140222",
 *       "title_optimizado": "Ozempic 2 mg | ...",
 *       "meta_description_optimizado": "...",
 *       "link_laboratorio": "https://...",
 *       "principio_activo": "semaglutida",
 *       "presentacion_optimizada": "...",
 *       "keywords_ocultos": "...",
 *       "bullets_atributos": "...",
 *       "registro_isp": "B-2774/19",
 *       "descripcion_intranet": "..."
 *     },
 *     ...
 *   ]
 *
 * Cada objeto debe tener al menos 'sku' y 'title_optimizado'.
 * Los productos se buscan por SKU en la DB y se actualizan.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3001';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Uso: node scripts/push-optimized.js <archivo.json>');
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);
  if (!fs.existsSync(filePath)) {
    console.error(`Archivo no encontrado: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  let products;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      products = parsed;
    } else if (parsed.productos && Array.isArray(parsed.productos)) {
      products = parsed.productos;
    } else {
      products = [parsed];
    }
  } catch (e) {
    console.error('Error parseando JSON:', e.message);
    process.exit(1);
  }

  console.log(`📦 ${products.length} producto(s) para subir\n`);

  let ok = 0;
  let fail = 0;

  for (const p of products) {
    if (!p.sku) {
      console.warn('  ⚠️  Saltando producto sin SKU');
      fail++;
      continue;
    }

    // Buscar producto por SKU
    const [id, name] = await findProductBySku(p.sku);
    if (!id) {
      console.warn(`  ⚠️  SKU ${p.sku} no encontrado en la DB — saltando`);
      fail++;
      continue;
    }

    // Armar payload SEO
    const seoFields = [
      'title_optimizado', 'meta_description_optimizado', 'link_laboratorio',
      'principio_activo', 'presentacion_optimizada', 'keywords_ocultos',
      'bullets_atributos', 'registro_isp', 'descripcion_intranet',
    ];

    const payload = { estado: 'revisar' };
    seoFields.forEach(f => {
      if (p[f] !== undefined && p[f] !== null && p[f] !== '') {
        payload[f] = String(p[f]);
      }
    });

    if (!payload.title_optimizado) {
      console.warn(`  ⚠️  SKU ${p.sku} (${name}) no tiene title_optimizado — saltando`);
      fail++;
      continue;
    }

    const success = await updateProduct(id, payload);
    if (success) {
      console.log(`  ✅ SKU ${p.sku} — ${name || '—'} → subido como "revisar"`);
      ok++;
    } else {
      console.error(`  ❌ SKU ${p.sku} — error en la actualización`);
      fail++;
    }
  }

  console.log(`\n📊 Resultado: ${ok} OK, ${fail} fallos`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findProductBySku(sku) {
  return new Promise((resolve, reject) => {
    http.get(`${API_BASE}/api/products?search=${encodeURIComponent(sku)}&limit=5`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const products = parsed.products || [];
          const match = products.find(p => String(p.sku) === String(sku));
          resolve(match ? [match.id, match.fullName] : [null, null]);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function updateProduct(id, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request(`${API_BASE}/api/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve(res.statusCode === 200);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
