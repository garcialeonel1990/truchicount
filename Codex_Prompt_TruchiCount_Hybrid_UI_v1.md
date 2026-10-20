# Prompt para Codex — TruchiCount Hybrid UI v1.0

Trabajá en el repositorio **TruchiCount existente**, sin rehacer la aplicación desde cero. El usuario ha aprobado expresamente la dirección **C: Hybrid UI**, una estética compacta y profesional de fintech con personalidad amigable, verde petróleo/turquesa y uso selectivo de emojis.

## Instrucciones iniciales obligatorias

1. Leé primero los `AGENTS.md` aplicables (raíz y subdirectorios). **Respetá la política actual de un único agente principal; no crees subagentes automáticamente.** No modifiques esa política como parte del rediseño.
2. Leé estos documentos, si están presentes en la raíz o en la ruta suministrada:
   - `SDD_TruchiCount_Rediseno_UI_Mobile_v1.md`
   - `TruchiCount_Hybrid_Design_System_v1.md`
3. Inspeccioná el stack y el código actuales: rutas, vistas, componentes, estilos, clases compartidas, modales, listeners, tests, build, PWA y despliegue. No inventes rutas ni nombres de archivos.
4. Tomá las capturas `IMG_8830.png` a `IMG_8838.png` como ejemplos de fallas visibles, **no como referencia estética para copiar**. Si las imágenes no están en tu entorno, decilo en el informe y basate en el diagnóstico detallado de los SDD.

## Objetivo no negociable

Aplicar un **sistema visual uniforme mobile-first** a toda TruchiCount: tamaños coherentes, espacios regulares, alineación, jerarquía tipográfica, tarjetas compactas, controles ergonómicos, modal/sheet confiable y responsive real en Safari iOS/PWA. **Preservar totalmente** la funcionalidad, Firebase Auth/Firestore, autorizaciones, modelos de datos, cálculos financieros, divisiones, multi-pagadores, integrantes manuales, invitaciones, monedas, balances, archivados y CSV.

## Dirección visual aprobada

- Base: `#0F766E` (marca); acento `#14B8A6` sólo donde tenga suficiente contraste; fondo `#F7F9FC`; superficie `#FFFFFF`; texto `#101828`; secundario `#64748B`; borde `#DFE5EC`.
- Espaciado 4/8/12/16/20/24/32 px; gutter mobile 16–20 px; controles generalmente 48–52 px; CTA 50–52 px; cards radio 18–20 px, padding 16 px; títulos pantalla 28–30 px y secciones 18–20 px.
- Targets táctiles >=44×44 CSS px; contraste WCAG AA como objetivo; tipografía responsive. **Estas cifras son guías**, no reglas ciegas que causen cortes.
- Aspecto amigable mediante avatares, emojis y acentos, pero sin elementos gigantes ni espacios vacíos arbitrarios.

## Plan de trabajo y control de alcance

### Etapa 0: auditoría, sin tocar lógica

- Generá `UI_AUDIT.md` con una tabla: vista, defecto visible, archivo/componente/selector responsable, prioridad, corrección planeada y riesgo.
- Identificá CSS duplicado, tamaños en px rígidos, modales con overflow/sticky, distintos estilos para controles iguales y diferencias de densidad.
- Registrá las herramientas que de verdad existen para screenshots y pruebas. No digas que probaste iPhone real si sólo usaste emulación.

### Etapa 1: foundation visual

- Creá o adaptá tokens de estilo y componentes reutilizables **sin duplicar** otro design system existente.
- Unificá botones, campos, selects, labels, tabs, cards y modales conservando APIs y comportamiento.
- Documentá las decisiones en `DESIGN_SYSTEM.md`.

### Etapa 2: primer hito funcional + visual, Nuevo gasto

Este es el foco prioritario y **el primer hito a entregar antes de extender el rediseño al resto**.

- Corregí el clipping del label «Monto» al hacer scroll.
- Reorganiza visualmente título, categoría, monto, moneda, pagador, fecha, multipagadores, división, opcionales y Guardar.
- Compactá los controles y los campos de aporte individual; normalizá alturas y radios.
- Corregí el scroll interno, encabezado/CTA sticky, safe area y teclado iOS para que ningún contenido quede oculto.
- Conservá todos los modos de división, los importes por pagador, las validaciones de sumas y los estados de error. No transformes la lógica financiera para conseguir un layout más fácil.
- Verificá estado inicial, scroll hasta el final, teclado abierto, 1 y 3+ pagadores, campos largos, importes extensos, modo división personalizado y casos inválidos.
- Producí evidencia antes/después si hay herramienta de browser/screenshot disponible.

### Etapas siguientes (sólo después de completar y reportar el primer hito)

3. Nuevo Count y Perfil.
4. Cabecera compartida del Count; Gastos, Balances y Resumen.
5. Home, estados vacíos, QA transversal y limpieza de estilos comprobados como obsoletos.

No intentes cambiar toda la UI de una sola vez. Presentá un informe claro al terminar cada fase para que el usuario pueda validar la dirección.

## Pruebas y reglas de entrega

- Probar viewports de 320, 375, 390/393, 430 y 768 CSS px de ancho, más desktop, con alturas representativas. Prioridad Safari iOS/PWA en dispositivos reales si disponibles.
- No permitir scroll horizontal, clipping, botones superpuestos ni campos inaccesibles con teclado.
- Verificar targets >=44 px, texto zoom, foco, errores y contraste.
- Ejecutar lint/build/tests existentes. Si no hay tests, crear sólo pruebas focalizadas que aporten valor y encajen con el stack.
- Crear `UI_QA_REPORT.md` con resultados concretos y limitaciones reales.
- No crear nuevos frameworks, no alterar schema Firestore, no cambiar reglas de seguridad ni implementar funciones no pedidas.
- No modificar secretos, credenciales ni datos reales de usuarios; usar entorno de prueba cuando se necesiten escrituras.
- No hacer deploy a producción sin aprobación explícita.

## Resultado exigido del primer hito

Entregá: (1) archivos modificados, (2) before/after o una explicación honesta de por qué no hubo capturas, (3) test/build realizados y resultados, (4) defectos corregidos con evidencia, (5) riesgos, (6) propuesta precisa para la siguiente pantalla. **No afirmes que algo está verificado si no lo ejecutaste.**

**Empezá ahora** leyendo `AGENTS.md` y auditando el código. Implementá foundation mínima y completá sólo el primer hito «Nuevo gasto». Luego detenete y reportá para revisión visual antes de continuar con otras pantallas.
