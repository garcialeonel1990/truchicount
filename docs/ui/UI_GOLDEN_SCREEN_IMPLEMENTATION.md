# TruchiCount — implementación Golden Screen v1

Fecha: 2026-10-20  
Checkout: `/Users/leonelgarcia/Documents/ChatGPT/truchicont/truchicount`  
Branch: `main`

## Alcance

Se implementó exclusivamente `Detalle del Count → Gastos` (`#detailScreen`, con foco en `#expensesPanel`). No se modificaron Balances, Resumen, Nuevo gasto, Nuevo Count, picker de emojis, Firebase, Functions, reglas, cálculos, modelos ni persistencia.

## Cambios reales

- `index.html`: se completó la asociación semántica de las tres tabs con `aria-controls`, `role="tabpanel"` y `aria-labelledby`; se conservaron IDs, `data-tab`, orden y listeners existentes.
- `styles.css`: se agregó un bloque acotado `Golden Screen v1` para el detalle, usando aliases de tokens `--tc-*` y roles locales de espacio, target, radio y gutter.
- Header contextual: emoji integrado al bloque del Count, título adaptable a nombres largos, subtítulo contextual y acciones con targets mínimos de 44 px.
- Tabs: contenedor estable, altura de interacción mínima de 44 px y posición compartida entre Gastos, Balances y Resumen.
- KPIs: alineación común, contraste sobrio, cifras tabulares y wrapping para montos largos.
- Gastos: filas con altura natural objetivo de 80 px en contenido normal, radio 16 px, icono compacto, pagador legible y monto separado con wrapping controlado.
- CTA: altura objetivo de 50 px, posición segura respecto de `safe-area-inset-bottom` y padding adicional en el panel para que el último gasto siga siendo accesible.
- `tests/golden-screen.test.mjs`: regresión estática para contratos de tabs/paneles/CTA y aislamiento del bloque visual.

## Valores aplicados

Se reutilizan `--tc-space-1..4`, `--tc-page-gutter`, `--tc-touch-min`, `--tc-radius-control`, `--tc-border`, `--tc-ink` y `--tc-safe-bottom`. El piloto agrega únicamente `--golden-radius-card: 16px`; no reemplaza tokens globales.

## Verificación

- Baseline previo a cambios: `npm test` pasó con 73 pruebas del proyecto y 9 unitarias de Functions.
- `npm test`: PASÓ, 75 pruebas del proyecto y 9 unitarias de Functions, 0 fallos.
- `npm run test:all`: la fase `npm test` pasó; la fase de emuladores no pudo iniciar porque este entorno restringe abrir puertos locales (`listen EPERM` en 4400, 9099, 8080 y puertos auxiliares). No es un fallo de una prueba de aplicación.
- No hay navegador, Playwright, Puppeteer, Chromium, dispositivo iOS ni capturador disponible en este entorno. Por eso no se generaron screenshots, bounding boxes ni medidas renderizadas de 320, 375, 390, 393, 402 o 430 CSS px.
- No se declara validación visual de overflow, safe area, foco, contraste renderizado, zoom 200% ni targets medidos con `getBoundingClientRect()`.

## UI-01 y regresiones investigadas

UI-01 no se corrigió ni se declaró resuelto: la especificación exige reproducción y causalidad técnica. Se mantuvo intacto el ciclo de vida del `<dialog id="expenseModal">`, incluyendo sus rutas de cierre y `closeExpenseDialog()`.

La revisión estática confirma que la implementación no toca `app-main.js`, no altera payloads, ordenamiento, filtros, swipe tabs, navegación back, estados de carga/error/vacío, archivado ni acciones del gasto.

## Pendientes para revisión visual humana

- Capturar antes/después en los viewports de la matriz del SDD, con 0, 1, 3 y 10+ gastos, nombres largos, participantes múltiples, montos extremos y Count archivado.
- Comprobar en navegador los targets, foco, contraste, `scrollWidth/clientWidth`, CTA sobre el último ítem y safe area.
- Reproducir UI-01 con cierre UI, cancel, back del navegador/gesto y retorno a Gastos.

La ejecución se detiene aquí para revisión visual. No se continúa con la migración interna de Balances, Resumen ni otros formularios.
