# P0 — Ciclo de vida del diálogo de gastos

## Causa y corrección

El cierre manual ejecutaba `blur()` sobre el elemento enfocado antes de llamar a `HTMLDialogElement.close()`. Eso anulaba el mecanismo nativo de restauración del foco del diálogo y podía dejar el foco en un estado inconsistente al retirar la capa modal (especialmente en Safari/iOS). La limpieza de menús y de los controles auxiliares, además, solo se ejecutaba dentro del helper; cierres nativos o directos no pasaban por esa limpieza.

La corrección elimina el `blur()` previo y hace que la limpieza sea atendida por el evento `close` de ambos diálogos de gastos. Los botones, Escape/cancel y cierres directos/nativos mantienen un solo backdrop: el del `<dialog>` nativo. No se añadieron timers, overlays ni reglas visuales de ocultamiento.

## Alcance y validación

- Añadida prueba de regresión del contrato del ciclo de cierre y del backdrop nativo: `tests/expense-dialog-lifecycle.test.mjs`.
- Ejecutar `npm test` para la suite unitaria completa.
- Validación interactiva y captura visual en navegador: pendiente; este entorno no tiene Chromium/Chrome instalado ni una sesión de navegador conectada. Por ello no se declara comprobada visualmente la secuencia de X, volver, Escape, back, cinco ciclos repetidos y guardado posterior.
