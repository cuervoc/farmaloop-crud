-- ============================================================
-- Limpieza de title_optimizado (causa raíz) y descripcion_intranet
-- NOTA: title_optimizado es VARCHAR(70) - usar reemplazos que no excedan
-- ============================================================

-- 1. Fix recubiertostososs en titles (18 chars -> 11 chars, ahorra 7)
UPDATE products SET title_optimizado = REPLACE(title_optimizado, 'recubiertostososs', 'recubiertos')
WHERE title_optimizado LIKE '%recubiertostososs%';
SELECT CONCAT('title recubiertostososs: ', ROW_COUNT()) AS resultado;

UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'recubiertostososs', 'recubiertos')
WHERE descripcion_intranet LIKE '%recubiertostososs%';
SELECT CONCAT('desc recubiertostososs: ', ROW_COUNT()) AS resultado;

-- 2. Fix "Comp Rec" en titles -> "Comp. Recubiertos" (no expandir completamente para no exceder 70)
UPDATE products SET title_optimizado = REPLACE(title_optimizado, 'Comp Recubiertos', 'Comp. Recubiertos')
WHERE title_optimizado LIKE '%Comp Recubiertos%';
SELECT CONCAT('title Comp Recubiertos->Comp.: ', ROW_COUNT()) AS resultado;

UPDATE products SET title_optimizado = REPLACE(title_optimizado, 'Comp Recub', 'Comp. Recub.')
WHERE title_optimizado LIKE '%Comp Recub%' AND title_optimizado NOT LIKE '%Comp Recubiertos%';
SELECT CONCAT('title Comp Recub->Comp.: ', ROW_COUNT()) AS resultado;

UPDATE products SET title_optimizado = REPLACE(title_optimizado, 'Comp Rec', 'Comp. Rec.')
WHERE title_optimizado LIKE '%Comp Rec%' AND title_optimizado NOT LIKE '%Comp Recub%' AND title_optimizado NOT LIKE '%Comp. Rec.%';
SELECT CONCAT('title Comp Rec->Comp.: ', ROW_COUNT()) AS resultado;

-- 3. Fix "Comprimido Recub" (singular) en titles
UPDATE products SET title_optimizado = REPLACE(title_optimizado, 'Comprimido Recub', 'Comp. Recub.')
WHERE title_optimizado LIKE '%Comprimido Recub%';
SELECT CONCAT('title Comprimido Recub: ', ROW_COUNT()) AS resultado;

-- 4. Fix "Comp. Rec." en titles (ya tiene punto, solo reemplazar texto completo)
UPDATE products SET title_optimizado = REPLACE(title_optimizado, 'Comp. Rec.', 'Comp. Recub.')
WHERE title_optimizado LIKE '%Comp. Rec.%' AND title_optimizado NOT LIKE '%Comp. Recub.%';
SELECT CONCAT('title Comp. Rec.->Comp. Recub.: ', ROW_COUNT()) AS resultado;

-- 5. Fix descripcion_intranet tambien para "Comp Rec" patterns
UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'Comp Recubiertos', 'Comprimidos Recubiertos')
WHERE descripcion_intranet LIKE '%Comp Recubiertos%';
SELECT CONCAT('desc Comp Recubiertos: ', ROW_COUNT()) AS resultado;

UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'Comp Recub', 'Comprimidos Recubiertos')
WHERE descripcion_intranet LIKE '%Comp Recub%' AND descripcion_intranet NOT LIKE '%Comp Recubiertos%';
SELECT CONCAT('desc Comp Recub(no os): ', ROW_COUNT()) AS resultado;

UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'Comp Rec', 'Comprimidos Recubiertos')
WHERE descripcion_intranet LIKE '%Comp Rec%' AND descripcion_intranet NOT LIKE '%Comp Recub%' AND descripcion_intranet NOT LIKE '%Comp. Rec.%';
SELECT CONCAT('desc Comp Rec(standalone): ', ROW_COUNT()) AS resultado;

UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'Comprimido Recub', 'comprimidos recubiertos')
WHERE descripcion_intranet LIKE '%Comprimido Recub%';
SELECT CONCAT('desc Comprimido Recub: ', ROW_COUNT()) AS resultado;

-- 6. Fix "Acido " sin tilde en titles
UPDATE products SET title_optimizado = REPLACE(title_optimizado, 'Acido ', 'Ácido ')
WHERE title_optimizado LIKE '%Acido %';
SELECT CONCAT('title Acido: ', ROW_COUNT()) AS resultado;

UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'Acido ', 'Ácido ')
WHERE descripcion_intranet LIKE '%Acido %' AND descripcion_intranet NOT LIKE '%Ácido%';
SELECT CONCAT('desc Acido: ', ROW_COUNT()) AS resultado;

-- 7. Fix "Capsulas" sin tilde
UPDATE products SET title_optimizado = REPLACE(title_optimizado, 'Capsulas', 'Cápsulas')
WHERE title_optimizado LIKE '%Capsulas%' COLLATE utf8mb4_bin;
SELECT CONCAT('title Capsulas: ', ROW_COUNT()) AS resultado;

SELECT '=== LIMPIEZA COMPLETADA ===' AS resultado;
