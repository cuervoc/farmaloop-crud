-- Fix: Acentos en bullets de Bloque 1
-- Reemplazar palabras sin acento por versiones con acento español correcto

USE farmaloop_seo;

UPDATE products SET bullets_atributos = REPLACE(bullets_atributos, '- Indicacion:', '- Indicación:')
WHERE bullets_atributos LIKE BINARY '%- Indicacion:%';

UPDATE products SET bullets_atributos = REPLACE(bullets_atributos, '- Concentracion:', '- Concentración:')
WHERE bullets_atributos LIKE BINARY '%- Concentracion:%';

UPDATE products SET bullets_atributos = REPLACE(bullets_atributos, '- Via de administracion:', '- Vía de administración:')
WHERE bullets_atributos LIKE BINARY '%- Via de administracion:%';

UPDATE products SET bullets_atributos = REPLACE(bullets_atributos, '- Categoria:', '- Categoría:')
WHERE bullets_atributos LIKE BINARY '%- Categoria:%';

UPDATE products SET bullets_atributos = REPLACE(bullets_atributos, 'sueno', 'sueño')
WHERE bullets_atributos LIKE BINARY '%sueno%';
