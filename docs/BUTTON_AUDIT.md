# Auditoría del sistema de botones

Fecha: 2026-10-17

## Inventario previo

La auditoría cubrió los botones declarados en `index.html` y los controles creados desde `app-main.js`. Los valores son los estilos efectivos definidos antes de la normalización; el ancho es fluido salvo donde se indica.

| Pantalla / contexto | Control | Tipo | Alto previo | Font | Padding horizontal | Radius | Problema detectado |
|---|---|---|---:|---:|---:|---:|---|
| Login y acceso | Continuar, reintentar, cerrar sesión | Primary / secondary | 48 px | 15 px | 18 px | 12 px | Sin tamaños reutilizables explícitos; disabled por opacidad |
| Home | Nuevo Count | Primary compacto | 44 px | 13 px | 13–14 px | 12 px | Valores duplicados en media query |
| Home | Activos / Archivados | Tab | 38 px aprox. | 14 px | Fluido | 8 px | Sin `role=tab` ni estado ARIA |
| Detalle | Volver | Tertiary | 44 px | 13–25 px | 6 px | 0 | Flecha y texto dimensionados por reglas separadas |
| Detalle | Invitar / menú | Icon | 40 × 44 px mobile | 19 px | 0 | 10 px | Touch target horizontal menor a 44 px |
| Detalle | Agregar gasto | Primary / FAB | 52 px | 15 px | 18 px | Pill | Altura propia distinta del CTA large |
| Resumen | Exportar CSV | Secondary small | 42 px | 13 px | 12 px | 12 px | Altura arbitraria |
| Ajustes | Nueva categoría | Secondary small | 40 px | 13 px | 12 px | 12 px | Touch target menor a 44 px |
| Ajustes | Editar / eliminar categoría | Icon | 40 × 40 px | 20 px | 0 | Circular | Touch target menor a 44 px |
| Administración | Tabs | Chip | 38 px | 13 px | 11 px | Pill | Touch target menor a 44 px |
| Formularios | Guardar / continuar | Primary | 48 px | 15 px | 18 px | 12 px | La base y el CTA no estaban diferenciados por token |
| Modales | Cancelar / confirmar | Secondary / primary | 48 px | 15 px | 18 px | 12 px | Todos heredaban el tamaño grande, incluso acciones normales |
| Modales | Cerrar | Icon | 40 × 40 px desktop; 44 px mobile | 27 px | 0 | Circular | Desktop menor a 44 px y sin nombre accesible |
| Integrantes | Editar / quitar borrador | Tertiary | 34 px | 12 px | 9 px | 8 px | Área táctil insuficiente |
| Integrantes | Quitar integrante | Danger small | 38 px | 13 px | 11 px | 8 px | Área táctil insuficiente |
| Categorías | Eliminar / cancelar / guardar | Tertiary / secondary / primary | 44–48 px | 13–15 px | 8–18 px | Mixto | Tres acciones comprimidas en una fila a 360–393 px |
| Cards y listas | Count, gasto, pago, integrante | Row action | 54–104 px | Contextual | Contextual | 12–18 px | Una fila de integrante era `article` clickeable y no operable con teclado |

## Sistema normalizado

- Tamaños: `sm` 36 px, `md` 44 px y `lg` 48 px.
- Padding: 12, 16 y 18 px.
- Tipografía: 13, 14 y 15 px; peso 700 como base.
- Variantes existentes consolidadas: primary, secondary, danger, tertiary/text e icon.
- Radio normal: 12 px; small 8 px; pill mediante token dedicado.
- Separación icono/texto: 8 px, o 6 px en small.
- Icon buttons: 44 × 44 px con iconografía visual independiente del touch target.
- Grupos de acciones: gap de 12 px y columnas de igual ancho; las tres acciones de categoría pasan a dos columnas en mobile.
- Loading: el control conserva su ancho y expone `aria-busy` mientras cambia la etiqueta.
- Disabled: colores legibles y estables, sin depender de opacidad extrema.

## Cobertura

Se revisaron Login, estados de acceso, Home/Counts, Count detalle, Gastos, Balance, Resumen, Ajustes, Categorías, Administración, wizard de Count, formularios de gasto y categoría, integrantes, invitaciones, liquidaciones, archivo/desarchivo, perfil y nickname, además de empty/error/loading states.

Los breakpoints continúan siendo generales (`639px`, `640px`, `900px`); no se agregaron reglas específicas para modelos de iPhone.
