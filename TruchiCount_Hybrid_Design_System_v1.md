# TruchiCount — Hybrid Design System v1.0

**Fecha:** 2026-10-20  
**Decisión:** Dirección C — híbrida profesional + amigable  
**Documento base:** `SDD_TruchiCount_Rediseno_UI_Mobile_v1.md`  
**Estado:** propuesta aprobada en dirección; valores finales sujetos a comprobación en código y dispositivos reales.

## 1. Visión

TruchiCount debe sentirse como una app financiera de uso cotidiano: clara, confiable, rápida, compacta, cálida y sin aspecto corporativo frío. Conservar la identidad verde petróleo/turquesa, uso selectivo de emojis y experiencia de gastos compartidos. **No rediseñar la marca desde cero**, no modificar lógica de negocio.

### Cinco principios

1. **Densidad intencional:** cada bloque ocupa el espacio justo y necesario.
2. **Jerarquía financiera:** cifras, deudas y acciones importantes destacan, no todo a la vez.
3. **Consistencia:** todos los campos, botones, tarjetas, pestañas y modales siguen las mismas reglas.
4. **Tacto y accesibilidad:** interfaces compactas sin reducir la zona táctil ni el contraste.
5. **Mobile-first real:** scroll, teclado, viewport dinámico y safe areas de Safari iOS/PWA forman parte del diseño.

## 2. Paleta propuesta (CSS tokens, refinables según contraste real)

| Token | Valor inicial | Uso |
|---|---|---|
| `--tc-brand` | `#0F766E` | CTA, selección, enlaces activos |
| `--tc-brand-accent` | `#14B8A6` | acentos visuales puntuales |
| `--tc-brand-soft` | `#CCFBF1` | fondos de avatares y selección tenue |
| `--tc-page` | `#F7F9FC` | fondo general |
| `--tc-surface` | `#FFFFFF` | cards y modales |
| `--tc-surface-muted` | `#EEF2F6` | campos y agrupaciones secundarias |
| `--tc-ink` | `#101828` | encabezados, montos |
| `--tc-ink-muted` | `#64748B` | texto secundario |
| `--tc-border` | `#DFE5EC` | divisores y contornos |
| `--tc-danger` | `#DC3545` | pérdidas y acciones destructivas según contexto |
| `--tc-success` | `#0F766E` | saldos positivos con etiqueta textual |

**Nota:** el color `#14B8A6` es decorativo y no se debe usar indiscriminadamente como texto pequeño sobre blanco. Verificar contraste WCAG AA de todas las combinaciones implementadas. Mantener modo oscuro solo si ya existe y sin romperlo; no imponerlo como requisito de esta fase.

## 3. Escala dimensional inicial

| Categoría | Valores sugeridos |
|---|---|
| Escala de espacios | 4, 8, 12, 16, 20, 24, 32 px |
| Margen horizontal mobile | 16 px (hasta 20 px con espacio suficiente) |
| Separación de secciones | 24 px |
| Padding card | 16 px |
| Inputs/selects | 48–52 px mínimo visual |
| Botones principales | 50–52 px altura visual |
| Targets táctiles | mínimo 44×44 CSS px |
| Segmented control | 44–48 px altura |
| Avatar en lista | 36–40 px |
| Radio de input | 12–14 px |
| Radio de card | 18–20 px |
| Radio de modal | 20–24 px en extremos visibles |
| Título pantalla | 28–30 px; line-height 1.1–1.2 |
| Título de sección | 18–20 px |
| Body | 15–16 px |
| Label | 13–14 px, buen contraste |
| Metadatos | 13–14 px |
| Montos principales | 24–28 px (adaptable) |

No aplicar estos tamaños a la fuerza: contenido, viewport y Dynamic Type pueden exigir crecer o redistribuir. Evitar `height` rígidas para contenedores con texto multilineal.

## 4. Ejemplo de tokens CSS — orientación, no reemplazo directo

```css
:root {
  --tc-brand: #0f766e;
  --tc-brand-accent: #14b8a6;
  --tc-brand-soft: #ccfbf1;
  --tc-page: #f7f9fc;
  --tc-surface: #fff;
  --tc-surface-muted: #eef2f6;
  --tc-ink: #101828;
  --tc-ink-muted: #64748b;
  --tc-border: #dfe5ec;
  --tc-danger: #dc3545;
  --tc-space-1: 4px;
  --tc-space-2: 8px;
  --tc-space-3: 12px;
  --tc-space-4: 16px;
  --tc-space-5: 20px;
  --tc-space-6: 24px;
  --tc-space-7: 32px;
  --tc-control-h: 50px;
  --tc-touch-min: 44px;
  --tc-radius-control: 14px;
  --tc-radius-card: 20px;
  --tc-page-gutter: 16px;
}
```

Inspeccionar primero el diseño existente y adaptar a la convención, preprocesador y componentes vigentes; evitar crear una segunda fuente de verdad de estilos.

## 5. Contrato de componentes

- **Header de pantalla:** altura dependiente de contenido, títulos jerarquizados, navegación y acciones con targets 44 px.
- **Header de Count:** igual para Gastos, Balances y Resumen, sin desplazamiento del título al cambiar pestaña.
- **Tabs segmentados:** aspecto claro, mismo alto, ancho flexible, estados activos claros y accesibles.
- **Botones:** variantes primaria, secundaria, ghost y destructiva; estados hover, focus-visible, pressed, disabled y loading.
- **Campo de formulario:** label visible, mensaje de ayuda/error debajo, alto normalizado, sin placeholder como único label.
- **Moneda/fecha/pagador:** controles compartidos y alineados; no selectores de geometrías arbitrarias.
- **Tarjetas de gastos:** emoji/ícono, título, pagador(es), importe, sin altura extra innecesaria.
- **Filas de balance:** nombre, dirección del saldo expresada en texto + signo + color, importe y acción.
- **Categorías resumen:** monto y porcentaje tratados como unidad; chevron separado; permitir composición de dos filas en ancho estrecho.
- **Modal/Sheet:** encabezado y footer independientes del body scrolleable; respetar `100dvh`/fallback, safe area y teclado; prevenir clipping, scroll de fondo y solapamiento.

## 6. Prioridades por pantalla

**P0 — Nuevo gasto:** scroll y clipping de rótulo “Monto”; formulario excesivamente alto; multipagadores sobredimensionados; footer Guardar superpuesto; teclado iOS. Reducir altura y alinear sin alterar sumas ni validaciones.

**P1 — Nuevo Count y Perfil:** formularios compactos y modales proporcionados, sin recortar controles; área Guardar siempre accesible. Mantener usuario, invitados y manuales.

**P1 — Cabecera común del Count:** recortar aire vertical, compartir estructura y tabs entre Gastos, Balances y Resumen.

**P2 — Gastos, Balances y Resumen:** tarjetas y filas compactas, jerarquía de dinero, importes extensos sin overflow y desglose accesible.

**P2 — Home:** compactar header, tarjetas y tabs; usar acción “Nuevo Count” deliberada y visible tanto con cero como con muchos Counts.

## 7. Responsive, ergonomía y estados

Validar 320, 375, 390, 393 y 430 CSS px de ancho, tablets y desktop. En dispositivos reales registrar `window.innerWidth`, `window.innerHeight`, `visualViewport` si existe, Safari/PWA y nivel de zoom; no confundir nombre de modelo de teléfono con tamaño CSS. Cuidar `env(safe-area-inset-*)`, barras del navegador, teclado, orientación y desplazamiento al foco.

Probar especialmente 0/1/10+ ítems, nombres muy largos, correos largos, montos de 9+ cifras, importes negativos, participante múltiple, categorías expandidas, caracteres acentuados, mensajes de error, loading y contenido zoom 200%. Evitar que el botón Guardar cubra los últimos campos. Mantener al menos 44×44 CSS px de área táctil.

## 8. Reglas de implementación

- **Preservar** Firebase Auth, Firestore, reglas de permisos, invitaciones, gestión de integrantes, participantes manuales, monedas, divisiones, pagos múltiples, balances, exportación y archivo.
- Evitar refactor de negocio durante cambios UI; tests para flujos críticos.
- Reusar y consolidar componentes que ya existen; no añadir librerías/frameworks solo por estética.
- No usar emojis como único indicador semántico de una acción.
- No borrar estilos sin comprobar sus usos.
- Seguir los `AGENTS.md` vigentes: un agente principal, sin subagentes automáticos, sin exploraciones ajenas al pedido.
- No desplegar a producción sin aprobación.

## 9. Criterios de aceptación

1. No hay campos, textos o importes involuntariamente cortados ni overflow horizontal en la matriz de tamaños.
2. El formulario Nuevo gasto es usable al abrirlo, scrollear, abrir teclado y alternar multipagadores.
3. Los CTA no cubren inputs, mensajes o el último registro.
4. Tabs no desplazan verticalmente el header.
5. Los mismos componentes mantienen tamaños, radios, colores y estados uniformes.
6. Contraste, teclado, foco y targets cumplen objetivos de accesibilidad.
7. Las pruebas existentes y escenarios funcionales clave pasan.
8. Existen capturas **antes y después**, con viewport identificado, por pantalla prioritaria.

## 10. Entregables concretos

`UI_AUDIT.md`, `DESIGN_SYSTEM.md` integrado al código real, cambios incrementales, capturas de comparación, `UI_QA_REPORT.md`, tabla de tests corridos y resumen de archivos modificados. Primer hito: **solo pantalla Nuevo gasto completamente rediseñada y comprobada**, antes de extender a todas las vistas.
