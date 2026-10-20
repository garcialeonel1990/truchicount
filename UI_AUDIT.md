# TruchiCount — auditoría UI Fase 0

Fecha: 20/10/2026

## Arquitectura relevada

- Frontend vanilla: `index.html` contiene las vistas, formularios y diálogos.
- `app-main.js` controla estado, renderizado y eventos. La persistencia y los cálculos están en módulos separados.
- `styles.css` es la hoja global; no hay framework ni biblioteca de componentes visuales.
- El flujo de nuevo gasto usa el diálogo `#expenseModal`, un header fijo del shell, un body con scroll interno y un footer separado.
- Las capturas `IMG_8830.png` a `IMG_8838.png` no están disponibles en el repositorio inspeccionado; el análisis se contrastó con el SDD y el DOM/CSS real.

## Hallazgos y alcance de esta fase

| Vista | Defecto observado en código | Ubicación | Prioridad | Corrección aplicada / planeada | Riesgo |
|---|---|---|---|---|---|
| Nuevo gasto | Cascada de estilos con varias geometrías: controles de 48, 52, 54 y 56 px; radios de 10, 22 y 24 px | `styles.css:627-652`, `styles.css:1745-1785`, overrides móviles | P0 | Tokens `--tc-*` y geometría final específica del formulario | Bajo: conserva clases e IDs |
| Nuevo gasto | Categoría renderizada como botón suelto entre campos, sin agrupación visual con el título | `index.html:83-85` | P0 | `expense-title-row` con campo y selector de categoría | Bajo |
| Nuevo gasto | Formulario vertical demasiado espaciado y filas de participantes altas | `styles.css:1746-1779` | P0 | Espaciado base 4/8/12/16, filas de 50 px y controles de 50 px | Bajo |
| Nuevo gasto | Footer sticky necesita reservar espacio real para que no tape el último error o participante | `styles.css:1541-1554` | P0 | Padding inferior del body con espacio del footer + safe area | Medio: requiere prueba en Safari iOS real |
| Nuevo gasto | Scroll/foco sensible al teclado y al contenedor interno | `styles.css:1541-1548`, `app-main.js:1207` | P0 | `scroll-padding` y `focusin` con `scrollIntoView` | Medio: visual viewport real no disponible en este entorno |
| Nuevo gasto | Multipagadores visualmente sobredimensionados | `styles.css:1094-1098`, `styles.css:1780-1781` | P0 | Tarjeta compacta, input de 44 px, columnas adaptables | Bajo |
| Nuevo gasto | Riesgo de overflow por nombres largos y montos | `app-main.js:912-918`, estilos de filas | P0 | `overflow-wrap:anywhere`, columnas `minmax(0, ...)` | Bajo |
| Modales compartidos | Base con scroll en el card completo; no se modifica aún fuera del flujo prioritario | `styles.css:965-976` | P1 | Siguiente fase: `ModalShell` visual compartido | Medio |
| Resto de pantallas | Duplicación de overrides y densidades distintas | `styles.css:1322+`, `styles.css:1686+` | P1/P2 | Fuera de alcance de este hito; no se cambian todavía | Bajo |

## Contratos preservados

No se modificaron Firebase Auth, Firestore, reglas, modelos, contratos de `saveExpense`, cálculos, validaciones, participantes manuales/registrados, multipagadores ni divisiones.

