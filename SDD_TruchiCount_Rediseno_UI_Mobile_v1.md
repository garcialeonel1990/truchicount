# SDD — TruchiCount: Rediseño UI/UX responsive y sistema de diseño

**Versión:** 1.0  
**Fecha:** 20/10/2026  
**Estado:** Propuesta para implementación guiada por Codex  
**Prioridad:** Alta  
**Alcance:** Interfaz de TruchiCount existente; mobile-first, con preservación de comportamiento.

## 1. Contexto y problema

TruchiCount ya cuenta con flujos funcionales de creación de Counts, gestión de integrantes, gastos, pagos compartidos, balances, resúmenes y perfil. Sin embargo, su presentación visual en iPhone tiene problemas transversales de escala, densidad, alineación, jerarquía, distribución y navegación en modales. El objetivo no es sustituir la lógica de negocio ni rehacer la aplicación desde cero, sino construir y aplicar un diseño coherente, atractivo y profesional.

**Referencias visuales entregadas:** IMG_8830.png a IMG_8838.png (9 capturas). Son evidencia de problemas, **no** diseños objetivo para reproducir exactamente.

### 1.1 Hallazgos observables

| Referencia | Vista | Hallazgo / impacto |
|---|---|---|
| 8830 | Home / Tus Counts | Header y controles grandes; card alta para dos líneas; CTA “Nuevo Count” aislada en área vacía; poco equilibrio vertical. |
| 8831 | Nuevo Count | Inputs/selectores y sección de participantes excesivamente altos; distancias entre bloques irregulares; CTA fijo desperdicia área y requiere asegurar scroll. |
| 8832 | Mi perfil | Modal muy alto para su contenido, avatar y botones sobredimensionados; falta equilibrio entre densidad y respiración visual. |
| 8833 | Balances | Cabecera del Count ocupa demasiado alto; tarjetas de cobro y balances pueden condensarse sin perder claridad; acciones poco uniformes. |
| 8834 | Gastos | Cabecera y tab bar grandes; tarjetas altas; CTA muy separado del contenido; importes requieren jerarquía sin desbordes. |
| 8835 | Resumen | Alineación comprimida de importes/porcentajes/chevrones por categoría; tipografía y agrupamiento necesitan revisión. |
| 8836 | Nuevo gasto (inicio) | Formulario demasiado espacioso; controles de moneda y pagador tienen geometrías inconsistentes; exceso de scroll para tareas frecuentes. |
| 8837 | Nuevo gasto (scroll) | El texto “Monto” aparece parcialmente oculto por el encabezado fijo al desplazarse: defecto de clipping/scroll/stacking que debe corregirse. |
| 8838 | Nuevo gasto (multipagador) | Multipagadores ocupan excesiva altura, con gran separación vertical y campos desproporcionados; CTA inferior requiere reservar espacio efectivo. |

> No deducir de capturas causas técnicas concretas sin inspeccionar DOM, CSS y componentes. Estos hallazgos describen síntomas visibles.

## 2. Objetivos

1. Crear una **única biblioteca de tokens y componentes visuales** para toda la app.
2. Reducir tamaños y espacios excesivos, mejorando densidad **sin sacrificar legibilidad ni accesibilidad**.
3. Dar una jerarquía clara a pantallas, tarjetas, formularios, valores monetarios y acciones.
4. Eliminar clipping, solapamientos, desbordes horizontales y saltos visuales.
5. Asegurar experiencia mobile-first coherente en Safari iOS y app web instalada/PWA, además de desktop.
6. Preservar todas las reglas de negocio y datos existentes: Firebase, permisos, integrantes manuales/registrados, pagos simples/múltiples, divisiones, monedas, balances, CSV, archivados, invitaciones, etc.
7. Proveer criterios verificables de aceptación visual y funcional.

## 3. No objetivos

- Reescribir backend, migrar Firestore, cambiar autenticación o modificar algoritmos de deudas.
- Alterar funcionalidades, eliminar campos o simplificar cálculos por motivos estéticos.
- Copiar ciegamente otra app o imponer un framework nuevo.
- Crear botones de aspecto funcional sin acción real.
- Introducir cambios de marca radicales antes de validar el sistema propuesto.

## 4. Restricciones y principios

- **Inspeccionar primero** estructura actual, rutas, CSS, componentes y comportamiento; identificar estilos globales, overrides y duplicación. No asumir framework.
- **Mobile first**: todas las pantallas responsive; layout y dimensión en CSS px lógicos (no en píxeles físicos de captura).
- Mantener color principal verde petróleo y acentos turquesa, refinados mediante tokens y contraste accesible.
- Usar sistema de espaciado base 4 px (preferir 8 px para la mayoría de separaciones); evitar tamaños ad hoc.
- Objetivos iniciales orientativos, ajustables tras prototipado y test real; no aplicar números indiscriminadamente a todos los elementos.
- Preferir scroll nativo, componentes semánticos, estados de foco, errores y teclado accesibles.
- Respetar safe areas, zoom de texto del sistema, `prefers-reduced-motion` y teclado virtual iOS.
- No asumir que los modelos comerciales de iPhone indican resoluciones CSS concretas: probar dimensiones reales del equipo y viewports de referencia.

## 5. Tokens de diseño propuestos (v1, revisables)

| Token | Valor orientativo | Uso |
|---|---:|---|
| `--space-1` a `--space-8` | 4, 8, 12, 16, 20, 24, 32, 40 px | Espaciado |
| `--page-gutter` | 16–20 px | Margen horizontal mobile |
| `--section-gap` | 24–32 px | Separación entre secciones |
| `--card-padding` | 16–20 px | Interior tarjetas |
| `--control-height` | 48–52 px | Inputs/selectores/botones principales |
| `--touch-target-min` | 44 px | Zona táctil mínima iOS; buscar 48 cuando sea posible |
| `--radius-control` | 12–16 px | Campos y botones |
| `--radius-card` | 18–24 px | Tarjetas |
| `--radius-pill` | 999 px | Pills/segmentados cuando corresponda |
| `--font-body` | 15–16 px | Texto corriente |
| `--font-label` | 13–14 px | Etiquetas/metadata, con contraste suficiente |
| `--font-section` | 20–24 px | Título de sección |
| `--font-screen` | 28–32 px | Título principal |
| `--font-money` | 20–28 px | Cifras relevantes, adaptable al contexto |
| `--shadow-card` | Muy sutil | Elevación sólo donde aporta jerarquía |

**Reglas:** máximo 2 familias de radios por jerarquía; sombras discretas; tokens de color semánticos (`surface`, `surface-muted`, `text-primary`, `text-secondary`, `brand`, `positive`, `negative`, `border`, `focus`) con contraste WCAG AA como objetivo. No depender solo del color para indicar saldos o selección. Soportar `font-size` accesible; preferir `rem`, `clamp()` y tipografía fluida donde aporte.

## 6. Arquitectura UI propuesta

### 6.1 Componentes reutilizables

- `PageShell` / `PageHeader`: encabezado consistente, posición y altura controladas.
- `ModalShell` / `Sheet`: encabezado, body scrolleable, footer opcional sticky, safe areas y manejo de teclado.
- `PrimaryButton`, `SecondaryButton`, `IconButton`, `DangerButton`: estados hover/active/focus/disabled/loading.
- `TextField`, `CurrencyInput`, `DateField`, `SelectField`, `Checkbox`, `SegmentedControl`.
- `CountCard`, `ExpenseRow`, `MemberRow`, `BalanceRow`, `SummaryCategoryRow`.
- `Avatar`, `Badge`, `EmptyState`, `InlineError`, `ConfirmDialog`.
- `Amount`: formato monetario consistente, reducción tipográfica segura y wrapping controlado.

Aprovechar componentes existentes cuando existan; refactorizar progresivamente. Unificar clases/tokens y eliminar overrides contradictorios **solo cuando se compruebe que no tienen consumidores**.

### 6.2 Reglas de layout

- Jerarquía vertical: navegación → título/subtítulo → navegación contextual → contenido → acción principal.
- Una misma alineación izquierda para encabezados, secciones y tarjetas.
- Botones principales pegados al footer solo en flujos de formulario; en listados usar CTA flotante/inline según contenido y disponibilidad de pantalla.
- Footer sticky dentro del área correspondiente, con fondo propio y padding inferior `env(safe-area-inset-bottom)`; body con espacio reservado igual al footer para evitar tapar campos.
- Modales: `max-height` basada en viewport dinámico (`dvh` con fallback); scroll **solo del body** donde sea viable; prevenir scroll chaining y movimiento del fondo.
- En inputs focalizados, asegurar desplazamiento hasta una región visible por encima del teclado; no utilizar alturas rígidas que oculten contenido.
- Texto largo (Count, integrantes, emails, importes): truncar solo cuando el contenido completo sea accesible; de otro modo envolver/redistribuir.
- No introducir desbordamiento horizontal a 320 px de ancho ni en resoluciones habituales.

## 7. Requerimientos por pantalla

### 7.1 Home — Tus Counts (8830)

- Reducir altura de header, tamaño relativo de acciones y espaciado superior.
- Mejorar jerarquía saludo / título; evitar repetición visual innecesaria.
- Compactar segmento Activos/Archivados y CountCard sin perder un objetivo táctil de 44 px.
- Ubicar “Nuevo Count” de forma intencional (CTA claramente descubrible, sin parecer flotando arbitrariamente a mitad de espacio vacío), y definir comportamiento con 0, 1 y muchos Counts.
- Validar scroll y bottom safe area.

### 7.2 Nuevo Count (8831)

- Organizar en secciones compactas: nombre + icono, moneda, participantes.
- Alinear icono y nombre; selector de icono con affordance clara.
- Usar campos y filas de alturas normalizadas.
- Participantes: autoidentificación «Vos», agregar manual sin que parezca un campo permanentemente gigante; mantener invitación por enlace posterior.
- Footer “Crear Count” visible sin superponerse al último campo y sensible al teclado.
- Contemplar errores de nombre, participantes duplicados, estado enviando y confirmación de éxito sin alterar la lógica actual.

### 7.3 Mi perfil (8832)

- Modal de tamaño proporcional al contenido, con altura máxima y scroll si aumenta el texto.
- Reducir tamaño del avatar y separaciones excesivas; mostrar nombre y correo con lectura cómoda.
- Campo de nombre claro; CTA Guardar diferenciado de acción destructiva Cerrar sesión.
- Confirmar que cierre, teclado y focus trap funcionen sin scroll de fondo.

### 7.4 Detalle del Count — cabecera y navegación (8833–8835)

- Crear un header compacto **compartido** entre Gastos, Balances y Resumen; que el cambio de tab no provoque saltos de altura.
- Ajustar tamaño de icono, título, integrantes y moneda; permitir nombres largos.
- Normalizar botón volver, compartir y menú.
- SegmentedControl táctil de una sola línea sin achicar texto al punto de hacerlo ilegible; contemplar anchos pequeños.

### 7.5 Gastos (8834)

- Resumir «Vos pagaste» y «Total del Count» mediante dos bloques compactos alineados; priorizar cifras.
- Filas de gastos densas y legibles: categoría, nombre, pagadores, monto; soporte multi-pagador sin cortar texto crítico.
- CTA agregar gasto accesible sin cubrir registros al final del listado.
- Estados con muchos gastos y sin gastos, incluyendo fecha y agrupación.

### 7.6 Balances (8833)

- Compactar tarjetas “Reclamale a...” y balance individual.
- Jerarquizar acreedor/deudor, importe y acción; evitar ambigüedad entre saldo positivo/negativo usando texto + símbolo + color.
- Probar 1, 3 y 10+ participantes, nombres largos, balances cero, saldos grandes y pagos pendientes múltiples.
- Conservar acciones de registrar/confirmar saldo y todos los cálculos actuales.

### 7.7 Resumen (8835)

- Compactar resumen global y total; mantener botón Exportar CSV sin que compita con el título.
- Rediseñar filas de categorías con dos niveles: título/cantidad y monto/porcentaje, chevron separado con área táctil suficiente.
- En pantallas estrechas, mover el porcentaje a otra línea cuando haga falta en vez de comprimir cifra y flecha.
- Expandido de categorías: desglose por participante, pagos, participación y saldo, sin overflow.
- Validar 0, 1 y muchas categorías e importes extensos.

### 7.8 Nuevo gasto (8836–8838): **máxima prioridad**

- Establecer orden claro: título, categoría, monto+moneda, pagador(es), fecha, división, campos opcionales y guardar.
- Reducir distancias entre controles; mantener etiquetas persistentemente legibles.
- Unificar estilo de dropdowns pagador, moneda, fecha y categoría.
- Multipagador: campos compactos por participante, importes alineados; sumar indicador del total asignado/restante cuando aplique, sin alterar validación matemática.
- División: participantes seleccionables en filas compactas; mantener modos igual/personalizado existentes. No suprimir funciones ocultas en capturas.
- Corregir **clipping de “Monto” al hacer scroll**. Inspeccionar sticky header, padding, scroll container, position, z-index, transform y overflow.
- Botón Guardar gasto fijo/pegajoso solo cuando el body conserve espacio suficiente; comportamiento correcto con teclado virtual, paisaje y contenido largo.
- Al alternar “Pagaron varias personas”, no perder silenciosamente valores ingresados ni dejar referencias inconsistentes; preservar reglas de pago y validaciones.

## 8. Responsive y accesibilidad

### Matriz mínima de validación

- 320 × 568 CSS px: estrés de espacio.
- 375 × 667 y 375 × 812 CSS px: teléfonos compactos.
- 390 × 844 CSS px: referencia iPhone reciente.
- 393 × 852 / dimensiones reales obtenidas del dispositivo iOS del proyecto.
- 430 × 932 CSS px: teléfono grande.
- 768 × 1024 CSS px: tablet.
- 1280 × 800 CSS px o más: desktop.
- Safari iOS real: vertical, horizontal, navegador con barras visibles/ocultas y PWA instalada cuando aplique.
- iPhone 14 y iPhone 25 Pro **si existen/disponibles en el entorno de prueba**; registrar resolución CSS y versión real, sin inventarlas.

### Accesibilidad

- Objetivo táctil mínimo 44 × 44 CSS px para controles interactivos.
- Etiquetas asociadas a inputs, accesibilidad de iconos y `aria-expanded` / estado seleccionado.
- Contraste objetivo WCAG AA (4.5:1 texto normal, 3:1 texto grande y componentes cuando aplique).
- Soportar 200% zoom de texto sin imposibilidad de completar los flujos; verificar VoiceOver/tabulador/foco.
- Mostrar errores junto al campo y anunciar estados relevantes; no ocultar mensajes tras CTA.

## 9. Plan de ejecución obligatorio para Codex

**Fase 0 — Inventario y baseline (sin cambios de UI).** Leer repositorio actual, AGENTS.md aplicables, identificar stack, pantallas, componentes, CSS global, estilos duplicados y pruebas. Capturar baseline por viewport. Elaborar tabla `pantalla → componente → problema → estilos responsables → prioridad` y registrar potenciales riesgos de regresión. No inventar archivos ni rutas.

**Fase 1 — Sistema de diseño.** Proponer tokens, escala tipográfica, radios, sombras, breakpoints y especificación corta de componentes. Crear hoja de estilos/tokens según arquitectura real. Construir o refactorizar componentes base con cambios acotados; mantener compatibilidad.

**Fase 2 — Corregir formularios y modales.** Implementar primero Nuevo gasto, luego Nuevo Count y Mi perfil. Priorizar clipping, footers, scroll, teclado y alturas. Revisar inputs, selects, listas seleccionables y multipagadores.

**Fase 3 — Pantallas de consulta.** Home, cabecera común del Count, Gastos, Balances y Resumen. Ajustar densidad, tabs, cards, importes, listas y estados vacíos.

**Fase 4 — QA visual y funcional.** Capturas before/after para cada vista y viewport, pruebas con teclado abierto, formularios largos y datos extremos. Ejecutar linter/build/tests existentes, sumar regresiones focalizadas si infraestructura lo permite.

**Fase 5 — Limpieza y entrega.** Remover solo CSS duplicado u obsoleto demostrado, documentar tokens, revisar diferencias y preparar cambios claros en commits/PRs por fase.

**Condición:** No abrir frentes paralelos de rediseño que generen divergencias. Respetar la política de agentes vigente en AGENTS.md del repositorio. No despliegues a producción ni modificaciones destructivas sin aprobación explícita.

## 10. Criterios de aceptación

Un PR o fase no se considera aprobado hasta demostrar:

- [ ] Ningún texto, campo, botón o monto queda cortado involuntariamente.
- [ ] Sin scroll horizontal en los viewports definidos.
- [ ] Header, body y footer de todos los modales mantienen áreas de interacción y scroll claras.
- [ ] Botones fijos no cubren el último campo ni mensajes de error, con/sin teclado.
- [ ] Tamaños de botones/inputs/cards/avatares coherentes entre pantallas, documentados con tokens.
- [ ] Tab Gastos/Balances/Resumen no mueve el encabezado o la navegación de forma inesperada.
- [ ] Montos de 1 a 9+ dígitos y nombres largos se muestran sin superposición.
- [ ] Estado seleccionado/deshabilitado/error/foco visible y accesible.
- [ ] Flujos funcionales de creación y edición de Count/gasto, multipagadores, participantes manuales, balance y CSV siguen funcionando.
- [ ] Capturas comparativas antes/después disponibles por pantalla prioritaria en mobile.
- [ ] Build y pruebas existentes pasan (o se documenta exactamente qué no pudo ejecutarse).
- [ ] No hay cambios injustificados en esquema Firestore, cálculos, autorización ni lógica de negocio.

## 11. Escenarios de regresión imprescindibles

1. Count vacío y Count con muchos gastos; múltiples Counts y archivados.
2. Crear Count con usuario y participantes manuales; usar moneda distinta de ARS.
3. Gasto de un pagador dividido entre 1, 3 y 10 integrantes.
4. Gasto de múltiples pagadores cuyos importes suman el total y caso inválido.
5. División igual/personalizada; agregar/quitar un participante donde lo permita la lógica.
6. Nombres extensos, cantidades grandes, decimales, valores cero y mensajes de error.
7. Cambiar tabs, abrir/cerrar menús y modales, desplazar con teclado abierto, tocar Guardar.
8. Ver y registrar saldos, expandir categorías, exportar CSV, abrir perfil/cerrar sesión.
9. Red lenta, estado loading, error y reintento, sin doble guardado.

## 12. Entregables

1. `UI_AUDIT.md`: inventario de problemas con prioridad y ubicación real en código.
2. `DESIGN_SYSTEM.md`: tokens, componentes, estados y reglas responsive, incluyendo decisiones justificadas.
3. Implementación incremental con tests y screenshots de referencia.
4. `UI_QA_REPORT.md`: matriz de viewports × pantallas × casos, issues remanentes y evidencias.
5. Resumen de archivos cambiados, regresiones evitadas, riesgos y pasos manuales para verificar.

## 13. Prompt de ejecución para Codex

> Trabajá sobre el repositorio TruchiCount existente. Leé primero todos los AGENTS.md aplicables y el SDD `SDD_TruchiCount_Rediseno_UI_Mobile_v1.md`. Auditá el código y contrastá las nueve capturas IMG_8830.png a IMG_8838.png con sus pantallas reales. El objetivo es aplicar un rediseño mobile-first profesional y consistente, corrigiendo escala, espacios, jerarquía, componentes y modales sin cambiar lógica de negocio ni base de datos. **Empezá por Fase 0 (auditoría y baseline), documentá hallazgos específicos con archivos/líneas; luego proponé un design system y plan de cambios para validación antes de aplicar cambios masivos.** Si ya está aprobado el sistema de diseño, implementá por fases comenzando con “Nuevo gasto”, generá screenshots comparativos y ejecutá tests/build al concluir cada fase. No inventes rutas ni componentes; no elimines funcionalidades; no despliegues a producción sin autorización. Mantené el trabajo dentro de la política de ejecución de agentes existente.

## 14. Decisiones pendientes de diseño

Antes de cerrar implementación, confirmar visualmente una dirección estética entre: (A) sobria/fintech compacta, (B) amigable y moderna con más color, o (C) híbrida. **Propuesta inicial:** C, conservando la identidad verde/turquesa y emojis pero con proporciones refinadas y densidad controlada. Validar primero Nuevo gasto y Detalle del Count en móvil antes de desplegar el mismo lenguaje al resto.
