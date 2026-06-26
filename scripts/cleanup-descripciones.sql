-- ============================================================
-- Script de limpieza de descripciones corruptas
-- ============================================================

-- 1. Fix recubiertostososs corruption (169 productos)
UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'recubiertostososs', 'recubiertos')
WHERE descripcion_intranet LIKE '%recubiertostososs%';
SELECT CONCAT('recubiertostososs -> recubiertos: ', ROW_COUNT(), ' filas') AS resultado;

UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'recubiertososs', 'recubiertos')
WHERE descripcion_intranet LIKE '%recubiertososs%';
SELECT CONCAT('recubiertososs -> recubiertos: ', ROW_COUNT(), ' filas') AS resultado;

-- 2. Fix Comp. Rec. abbreviation (34 productos)
UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'Comp. Rec.', 'comprimidos recubiertos')
WHERE descripcion_intranet LIKE '%Comp. Rec.%';
SELECT CONCAT('Comp. Rec. -> comprimidos recubiertos: ', ROW_COUNT(), ' filas') AS resultado;

UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'Comp Rec', 'Comprimidos Recubiertos')
WHERE descripcion_intranet LIKE '%Comp Rec%' AND descripcion_intranet NOT LIKE '%Comp. Rec.%';
SELECT CONCAT('Comp Rec -> Comprimidos Recubiertos: ', ROW_COUNT(), ' filas') AS resultado;

UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'Comp Recub', 'Comprimidos Recubiertos')
WHERE descripcion_intranet LIKE '%Comp Recub%';
SELECT CONCAT('Comp Recub -> Comprimidos Recubiertos: ', ROW_COUNT(), ' filas') AS resultado;

UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'Comprimido Recub', 'comprimidos recubiertos')
WHERE descripcion_intranet LIKE '%Comprimido Recub%';
SELECT CONCAT('Comprimido Recub -> comprimidos recubiertos: ', ROW_COUNT(), ' filas') AS resultado;

-- 3. Fix standalone "recubierto" without "s"
UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'comprimido recubierto ', 'comprimidos recubiertos ')
WHERE descripcion_intranet LIKE '%comprimido recubierto %';
SELECT CONCAT('comprimido recubierto -> comprimidos recubiertos: ', ROW_COUNT(), ' filas') AS resultado;

-- 4. Fix "Acido" sin tilde
UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'Acido ', 'Ácido ')
WHERE descripcion_intranet LIKE '%Acido %';
SELECT CONCAT('Acido -> Ácido: ', ROW_COUNT(), ' filas') AS resultado;

-- 5. Fix "Capsulas" sin tilde en bullets
UPDATE products SET descripcion_intranet = REPLACE(descripcion_intranet, 'Capsulas', 'Cápsulas')
WHERE descripcion_intranet LIKE '%Capsulas%';
SELECT CONCAT('Capsulas -> Cápsulas: ', ROW_COUNT(), ' filas') AS resultado;

SELECT '=== LIMPIEZA COMPLETADA ===' AS resultado;
