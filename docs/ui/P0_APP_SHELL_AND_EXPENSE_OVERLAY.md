# P0 — Shell móvil y overlay de gastos

## Causas encontradas

- En móvil, Detalle ocultaba `.app-header`, quitándolo de la fila de navegación, y sustituía su safe area con `padding-top` propio más una capa fija `::before`. Home/Ajustes conservaban el header compartido. Esto hacía que cada pantalla tuviera una referencia vertical y una geometría de sistema distintas, y dejaba una capa fija extra en el flujo de repintado de Safari.
- El overlay de gasto es el backdrop nativo de `<dialog>` (`dialog::backdrop`); no existe un segundo backdrop CSS. Su limpieza de estado está en el evento nativo `close`. La corrección anterior también eliminó el `blur()` antes de cerrar, que impedía la restauración nativa del foco.

## Cambios

- Se conserva un único `.app-header` compartido por Home, Detalle y Ajustes. Tiene una altura de contenido única (64 px) más una única safe area superior. El contenido contextual de cada pantalla arranca debajo.
- Se eliminan el ocultamiento del header de Detalle, su suma duplicada de safe area y el pseudo-elemento fijo de safe area. No se añaden márgenes negativos ni overrides acumulativos.
- Se agregan aserciones de regresión sobre la topología del shell y su safe area al test de iOS.

## Verificación

- La suite `npm test` debe pasar (ejecutada durante esta tarea; ver resumen final).
- Safari iOS real, rectángulos comparativos, ciclos interactivos x5 y captura comparativa: no disponibles desde este entorno (no hay navegador ni dispositivo conectado). La igualdad de geometría queda cubierta estructuralmente en CSS/tests, pero la medición visual en iPhone queda pendiente y no se declara aprobada.
