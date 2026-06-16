# Setup en Mac — Farmaloop CRUD

## Para OpenCode: instrucciones de importación de datos

### 1. Si el dump.sql NO está en el repo (archivo vacío o no existe)
Pedile al usuario que genere el dump en su PC Windows:
```bash
docker exec farmaloop-db mariadb-dump -u seo_user -pseo_pass_2026 --no-create-info --skip-dump-date farmaloop_seo > dump.sql
```
Y que haga commit + push.

### 2. Importar los datos al MariaDB del Mac
```bash
docker exec -i farmaloop-db mariadb -u seo_user -pseo_pass_2026 farmaloop_seo < dump.sql
```

### 3. Verificar que los datos cargaron
```bash
docker exec farmaloop-db mariadb -u seo_user -pseo_pass_2026 farmaloop_seo -e "SELECT COUNT(*) FROM products;"
```
Debería mostrar ~4954 productos.

### 4. Regenerar descripciones (por si las dudas)
```bash
docker exec farmaloop-crud node scripts/regen-todas.js
```

### 5. Verificar que el CRUD funciona
Abrir http://localhost:3001 y confirmar que carga productos.

---

## Notas
- El CRUD usa Node.js + MariaDB en Docker (docker-compose up)
- Puerto: 3001 (CRUD) | 3307 (MariaDB mapeado)
- DB: farmaloop_seo / user: seo_user / pass: seo_pass_2026
- El archivo `dump.sql` contiene solo los datos (INSERTs), no el schema (las tablas las crea `scripts/schema.sql`)
- Si hay mojibake o problemas de encoding, correr: `docker exec farmaloop-crud node scripts/fix-mojibake.js`
