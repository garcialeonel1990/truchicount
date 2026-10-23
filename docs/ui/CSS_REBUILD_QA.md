# QA — Reconstrucción CSS de TruchiCount

Fecha: 2026-10-23

## Alcance

- `styles.css` reemplazado por una hoja mobile-first de fuente única.
- Tokens semánticos, controles táctiles, listas, estados, diálogos nativos y popovers cubiertos.
- Tests estáticos actualizados para validar invariantes del SDD.

## Verificación ejecutada

```text
npm test
81 tests de aplicación: OK
9 tests unitarios de functions: OK
```

También se verificó estáticamente que no quedan aliases legacy (`--tc-*`, `--field-*`, `--button-*`, `--teal-*`, `--navy-*`), `backdrop-filter` ni marcadores de hotfix/override. La única excepción `!important` es la requerida por `[hidden]`.

## Pendiente

La validación real de Safari/PWA iOS sigue pendiente. Chrome con datos locales no sustituye la prueba en el dispositivo ni reproduce el teclado virtual o las safe areas reales.

## Corrección posterior de Resumen, cierres y contratos de layout

Se corrigieron los siguientes problemas encontrados al contrastar la hoja con el DOM real:

- La grilla de categoría estaba aplicada a `<details>` en lugar de su `<summary>`; ahora mantiene el comportamiento nativo y presenta por separado categoría, total, porcentaje y detalle por persona.
- Las X y el cierre de perfil se estiraban en toda la fila. Ahora quedan a la derecha, conservan al menos 44 × 44 px y comparten la fila con el encabezado.
- El formulario de gasto no definía sus tres zonas en el elemento que contiene header/body/footer. Ahora solo el body se desplaza y el botón Guardar permanece accesible.
- Se retiró el bloqueo global del body. El shell mantiene su propia altura y la pantalla su scroll.
- Se corrigieron las dos columnas reales de los pagadores múltiples, el tilde de participantes desmarcados, los selectores de saldo positivo/negativo, la tipografía de totales y los campos de fecha junto a nombres largos.
- El CTA Agregar gasto queda visible con listas largas y reserva espacio al final; importes grandes y nombres largos fluyen sin salir del viewport.
- Se recuperaron estilos faltantes de participantes, edición de integrantes, categoría/emoji y notas; los campos nativos usan 16 px para evitar el autozoom habitual de iOS.

### Evidencia de navegador

Script: `tests/ui-layout.browser.mjs`. Requiere Playwright y Chrome; se ejecuta con `node tests/ui-layout.browser.mjs`. Si Playwright está instalado fuera del proyecto, se puede indicar su módulo con `TRUCHICOUNT_PLAYWRIGHT_PATH`.

- Navegador: Chrome 156, headless, viewport vertical, zoom predeterminado, datos locales sin Firebase.
- Anchos: 320, 375, 390, 393, 402, 430, 640 y 900 px; altura normal 844 px y reducida 420 px.
- Fixtures: 20 gastos, nombres de 80 caracteres, montos grandes, notas largas y varios pagadores. Se usa el HTML real y las funciones reales de render de resumen, gastos, pagadores y detalle, además de los handlers reales `data-close` y del ciclo de cierre de gasto. El asistente de Count usa un cierre nativo de prueba; no se prueba la creación o cancelación de borradores en Firebase.
- Resultado final: **728 comprobaciones, 0 fallos**. Incluye expansión y cierre de categorías con teclado, geometría y cierre de diálogos, overflow, CTA visible, tilde de participante y estabilidad del footer al desplazar el body.
- Comparación inicial contra el CSS de `HEAD`: 232 fallos en 712 comprobaciones, antes de ampliar las verificaciones finales.
- Capturas before/after a 375 y 430 px en `/tmp/truchicount-css-qa/`: Resumen, cierre de categoría y formulario de gasto. Se inspeccionaron visualmente las capturas finales.
- `npm test`: 81 tests de app y 9 unitarios de Functions aprobados. `git diff --check`: aprobado.

El script prepara fixtures y no ejecuta autenticación, guardado de gastos ni cambios de datos remotos. La altura reducida prueba adaptación de layout, no un teclado virtual real.
