# TruchiCount — implementación Golden Screen v1

Fecha: 2026-10-20  
Checkout: `/Users/leonelgarcia/Documents/ChatGPT/truchicont/truchicount`  
Branch: `main`

## Alcance

Se implementó exclusivamente `Detalle del Count → Gastos` (`#detailScreen`, con foco en `#expensesPanel`). Header y tabs son compartidos con Balances y Resumen; sus contenidos internos no se modificaron. Tampoco se modificaron Nuevo gasto, Nuevo Count, picker de emojis, Firebase, Functions, reglas, cálculos, modelos ni persistencia.

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

Se reutilizan `--tc-space-1..4`, `--tc-page-gutter`, `--tc-touch-min`, `--tc-border`, `--tc-ink` y `--tc-safe-bottom`. Los radios locales del piloto son `--golden-radius-control: 12px` y `--golden-radius-card: 16px`; no reemplazan tokens globales.

## Verificación

- Baseline previo a cambios: `npm test` pasó con 73 pruebas del proyecto y 9 unitarias de Functions.
- `npm test`: PASÓ, 75 pruebas del proyecto y 9 unitarias de Functions, 0 fallos.
- `npm run test:all`: la fase `npm test` pasó; la fase de emuladores no pudo iniciar porque este entorno restringe abrir puertos locales (`listen EPERM` en 4400, 9099, 8080 y puertos auxiliares). No es un fallo de una prueba de aplicación.
- La entrega inicial no generó screenshots ni medidas renderizadas. Corrección de la afirmación original: sí hay Chrome y Safari instalados. En la revisión posterior se solicitó ejecutar Chrome headless con perfil temporal y servidor local; el permiso fue rechazado antes de iniciar. No se obtuvieron nuevas capturas ni medidas de 320, 375, 390, 393, 402 o 430 CSS px.
- No se declara validación visual de overflow, safe area, foco, contraste renderizado, zoom 200% ni targets medidos con `getBoundingClientRect()`.

## UI-01 y regresiones investigadas

UI-01 no se corrigió ni se declaró resuelto: la especificación exige reproducción y causalidad técnica. Se mantuvo intacto el ciclo de vida del `<dialog id="expenseModal">`, incluyendo sus rutas de cierre y `closeExpenseDialog()`.

La revisión estática confirma que la implementación no toca `app-main.js`, no altera payloads, ordenamiento, filtros, swipe tabs, navegación back, estados de carga/error/vacío, archivado ni acciones del gasto.

## Pendientes para revisión visual humana

- Capturar antes/después en los viewports de la matriz del SDD, con 0, 1, 3 y 10+ gastos, nombres largos, participantes múltiples, montos extremos y Count archivado.
- Comprobar en navegador los targets, foco, contraste, `scrollWidth/clientWidth`, CTA sobre el último ítem y safe area.
- Reproducir UI-01 con cierre UI, cancel, back del navegador/gesto y retorno a Gastos.

La ejecución se detiene aquí para revisión visual. No se continúa con la migración interna de Balances, Resumen ni otros formularios.

## Corrección posterior a la captura del usuario

La captura aportada mostró una CTA recortada, acciones mal ubicadas y contraste insuficiente en Counts. La entrega inicial no estaba visualmente aprobada. La inspección de la cascada confirmó las siguientes causas; los valores de la tabla son declaraciones CSS, no mediciones renderizadas.

| Región | Antes / causa | Corrección |
| --- | --- | --- |
| CTA | `right: 16px` del piloto junto a `translateX(50%)` de una regla mobile posterior; también ocurría en `:active` | Anclajes laterales con gutters 16/12 px, ancho limitado, centrado con márgenes automáticos y sin transformación en ambos estados |
| Acciones | Grilla del piloto de tres columnas junto a ubicación heredada en columna 2 | Grilla explícita de dos columnas; back en 1 y acciones en 2, alineadas al extremo derecho; identidad en segunda fila completa |
| Header | Fondo navy dominante y cápsula blanca heredada con texto turquesa claro | Fondo del encabezado transparente sobre la pantalla clara, controles verde petróleo y título oscuro de 24–26 px; padding superior 8 px + safe area |
| Tabs | Botón de 38 px (`44 - 6`), aunque el contenedor alcanzaba el mínimo | Cada botón declara un mínimo de 44 px; foco opaco verde petróleo |
| Scroll Gastos | Padding inferior duplicado en pantalla y panel | Una reserva de 84 px + safe area en la pantalla, sin padding adicional del panel; CTA de 50 px y separación inferior de 16 px |

Se editaron las reglas del bloque existente y se eliminaron los overrides mobile tardíos del header y CTA que causaban la mezcla. El bloque termina con `End Golden Screen v1`; la prueba estática lo delimita y comprueba los conflictos conocidos. Los selectores con `#detailScreen` prevalecen sobre los selectores de clase legacy; los ajustes desktop permanecen dentro del mismo bloque. Consumidores: header/tabs compartidos y contenido de Gastos. No se agregaron reglas para el contenido interno de otros paneles ni para dialogs.

Validación de esta corrección:

- `npm test`: 76 pruebas del proyecto + 9 unitarias de Functions, todas pasan (85 en total).
- `git diff --check`: sin errores.
- Se agregó regresión estática para el desplazamiento de CTA (normal y activa), ubicación de acciones, fondo de back y altura mínima de tabs. No equivale a una prueba de geometría en navegador.
- La salida de emuladores compartida por el usuario informó 78/79 pruebas aprobadas y un fallo de concurrencia en `settlement-emulator.test.mjs:99`. No se reejecutó ni se corrigió esa suite en esta revisión CSS; `test:all` no se declara verde.
- Chrome no se ejecutó por rechazo de autorización. Capturas después, validación de los tres tabs, contenido largo, estados, último ítem, iOS/PWA, safe area y zoom siguen pendientes de comprobación renderizada. La nueva geometría queda propuesta para revisión visual.
- UI-01 continúa pendiente; no se alteraron overlays ni cierre de gastos.
