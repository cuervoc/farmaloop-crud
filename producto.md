# Plantilla Oficial — Descripción Intranet Farmaloop

> Fuente de verdad autorizada. Cualquier desviación requiere aprobación explícita y actualización de este documento.

---

## Formato

```
[Producto] - [Laboratorio]
Compra online en Farmaloop y recibe con despacho a domicilio.
Revisa precio, stock y disponibilidad actualizada antes de comprar.
Venta sujeta a receta médica cuando aplique. Uso responsable según indicación profesional.

- [Atributo 1]
- [Atributo 2]
- [Atributo 3]

Registro ISP: [F-XXXXX/XX]

Condición de almacenado:
Mantener en lugar fresco y seco, protegido de la luz. Evitar temperaturas extremas. Mantener fuera del alcance de los niños.

Indicaciones de embarazo y lactancia:
Uso solo bajo indicación médica. Si estás embarazada, planeas estarlo o en período de lactancia, consulta a tu médico antes de usar.
```

---

## Ejemplo real — Atorvastatina 10 mg (SKU 15461)

```
Atorvastatina 10mg x 30 Comprimidos - Atorvastatina - ASCEND LABORATORIES SPA
Compra online en Farmaloop y recibe con despacho a domicilio.
Revisa precio, stock y disponibilidad actualizada antes de comprar.
Venta sujeta a receta médica cuando aplique. Uso responsable según indicación profesional.

- Principio activo: Atorvastatina 10 mg
- Indicación: Reducción de colesterol LDL y prevención cardiovascular
- Vía de administración: Oral
- Requiere receta médica: Sí (Receta Simple)
- Laboratorio: ASCEND LABORATORIES SPA
- Forma farmacéutica: Comprimidos

Registro ISP: Consultar en ISP Chile

Condición de almacenado:
Mantener en lugar fresco y seco, protegido de la luz. Evitar temperaturas extremas. Mantener fuera del alcance de los niños.

Indicaciones de embarazo y lactancia:
Uso solo bajo indicación médica. Si estás embarazada, planeas estarlo o en período de lactancia, consulta a tu médico antes de usar.
```

---

## Ejemplo con registro ISP concreto — Saxenda (SKU 119235)

```
Saxenda Recombinante Liraglutida - Liraglutida - NOVO NORDISK FARMACEUTICA LTDA.
Compra online en Farmaloop y recibe con despacho a domicilio.
Revisa precio, stock y disponibilidad actualizada antes de comprar.
Venta sujeta a receta médica cuando aplique. Uso responsable según indicación profesional.

- Principio Activo: Liraglutida
- Concentración: 6 mg
- Forma Farmacéutica: Solución Inyectable
- Indicación: Diabetes tipo 2 y control de peso
- Vía de Administración: Subcutánea
- ¿Requiere receta médica?: Sí

Registro ISP: F-25678/21

Condición de almacenado:
Mantener en lugar fresco y seco, protegido de la luz. Evitar temperaturas extremas. Mantener fuera del alcance de los niños.

Indicaciones de embarazo y lactancia:
Uso solo bajo indicación médica. Si estás embarazada, planeas estarlo o en período de lactancia, consulta a tu médico antes de usar.
```

---

## Reglas por sección

### Línea 1 — Encabezado
```
[Producto] - [Laboratorio]
```
- **Producto:** extraído automáticamente del `title_optimizado` (parte antes del `|`)
- **Laboratorio:** del campo `laboratorio`. Si está vacío, se omite el `-`.
- ❌ No escribir `Descripción:` ni `Descripción, características y dónde comprar...`

### Líneas 2–4 — Mensaje transaccional
Texto fijo, igual para todos los productos. No se modifica.

### Bullets (atributos)
- Se extraen automáticamente del campo `bullets_atributos`
- Cada línea se convierte en un bullet con guión (`-`)
- Si ya tiene guión al inicio de la línea, se deja como está
- El contenido es generado por el content-optimizer, no se edita manualmente

### Registro ISP
```
Registro ISP: [valor]
```
- Solo aparece si el campo `registro_isp` tiene valor
- Si está vacío o es `NULL`, esta sección entera se omite
- Formato: `F-XXXXX/XX` (consultar fuente oficial)

### Almacenado y embarazo
- Texto fijo al final, igual para todos los productos
- Aparece siempre

---

## ❌ Prohibido explícitamente

| No hacer | Por qué |
|----------|---------|
| Agregar `Descripción:` como encabezado | No va en el formato |
| Escribir `Descripción, características y dónde comprar en Chile` | Reemplazado por formato limpio |
| Frases como `¿Quieres comprar...?` | No va en el formato actual |
| Inventar secciones nuevas sin actualizar este documento | Rompe la consistencia |

---

## Fuente en código

La descripción se genera automáticamente desde `server.js` → `buildIntranetDescription()`.

Si se modifica la plantilla, actualizar:
1. Este documento (`producto.md`)
2. La función `buildIntranetDescription()` en `server.js`
3. El script `scripts/fix-descripcion.js` para regenerar productos existentes
