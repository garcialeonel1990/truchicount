# Auditoría UI/UX

## Base actual

La interfaz es mobile-first, usa superficie clara con navegación navy y ya adapta Home a tres columnas en desktop. Hay estados vacíos para Counts, gastos, balances y resumen. Se conserva esta dirección visual; no se propone una reescritura.

## Hallazgos

- Corregido: la lista de balances anterior podía quedar visible mientras el nuevo Count cargaba o fallaba.
- Corregido: faltaban los tokens `--teal-100` y `--teal-600`; afectaban progreso, radios y badges.
- Corregido: botones primarios y de peligro ahora usan tonos con mejor contraste para texto blanco.
- Corregido: las filas interactivas de integrantes se renderizan como botones alcanzables por teclado.
- Pendiente: tablists necesitan `role="tab"`, `aria-selected`, `aria-controls`, panels asociados y navegación por flechas.
- Corregido: los botones de cierre `×` exponen el nombre accesible `Cerrar`.
- Pendiente: Ajustes > Monedas persiste una preferencia que no modifica el wizard ni el gasto; hay que definir su semántica o retirarla.

## Criterios de aceptación

- Viewports 390, 768 y 1200 px sin overflow ni acciones inaccesibles.
- Targets táctiles de al menos 44 px.
- Contraste AA para texto y controles.
- Nombres largos con wrapping o elipsis intencional.
- Loading/error/empty no muestran datos del contexto anterior.
- Todos los controles operables por teclado y con nombre accesible.

## Próxima iteración

Convertir filas interactivas a botones, completar patrón ARIA de tabs, añadir tests de accesibilidad y decidir la experiencia de monedas. El layout desktop de dos paneles es P3, no bloquea integridad ni flujos principales.
