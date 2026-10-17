# TruchiCount V1

Aplicación web para registrar gastos compartidos. Está hecha con HTML, CSS y JavaScript puro, y usa Firebase Authentication + Cloud Firestore como fuente de verdad.

## Qué incluye

- Inicio de sesión exclusivo con Google.
- Control de acceso global: las cuentas nuevas quedan pendientes hasta que el administrador las aprueba.
- Panel de Administración para aprobar, bloquear y reaprobar usuarios en tiempo real.
- Counts múltiples y membresías por usuario.
- Wizard de cuatro pasos para crear un Count: nombre, integrantes, moneda e invitación.
- Drafts temporales: permiten compartir la invitación antes de activar el Count y se limpian al cancelar o al vencer.
- Nombre de Count normalizado y único para los nuevos Counts, incluso si uno anterior está archivado.
- Integrantes registrados por invitación e integrantes manuales editables.
- Invitaciones por link corto: `/j/{token}`. Un link de draft no permite incorporarse hasta que el Count se active.
- Moneda principal por Count, elegida al crearlo, fija al activarlo y obligatoria para todos sus gastos.
- Gastos con un pagador, participantes seleccionables y reparto igualitario.
- Montos guardados como enteros en unidad mínima (amountMinor), nunca como floats.
- Categorías globales y comercios recordados.
- Edición, borrado lógico y auditoría de movimientos.
- Balance derivado por persona y por moneda, con sugerencias de pago.
- Registro de liquidaciones (settlements).
- Ajustes de monedas, categorías, perfil y cierre de sesión.

OCR, fotos y reparto manual no forman parte de esta V1. La exportación CSV del resumen sí está disponible; Excel queda planificado.

## Estructura

- index.html y styles.css: interfaz mobile-first.
- app.js: navegación y formularios.
- firebase.js: autenticación e inicialización de Firebase.
- data-store.js: operaciones Firestore y listeners en tiempo real.
- money.js: parseo, formato y reparto exacto en centavos.
- balances.js: cálculo puro de balances y simplificación de deudas.
- integrity.js: invariantes puras para archivo, bajas y liquidaciones.
- invite-join.js: flujo transaccional de invitaciones.
- summary.js: resumen por categoría/persona y exportación CSV.
- firestore.rules: reglas de acceso, administración, drafts, membresías e invitaciones.

## Acceso y administración

El administrador se identifica por su UID de Firebase Authentication, definido en `ADMIN_UID` dentro de `data-store.js` y en `isAdmin()` dentro de `firestore.rules`.

- Una cuenta nueva crea su perfil con `accessStatus: "pending"`.
- Sólo un usuario aprobado puede usar Counts, categorías, comercios e invitaciones.
- El administrador gestiona pendientes, aprobados y bloqueados desde Ajustes → Administración.
- La aprobación global no reemplaza la membresía: cada Count sigue requiriendo una invitación o membresía propia.

## Configurar y desplegar

1. En Firebase Authentication, habilitá el proveedor Google y autorizá el dominio de Hosting.
2. Instalá dependencias de desarrollo (Node 22 o superior), incluidas las Functions:

    npm install
    npm --prefix functions install

3. Ejecutá las pruebas antes de cualquier despliegue:

    npm run test:all

   `test:all` ejecuta las pruebas puras y las pruebas de permisos contra el
   Firestore Emulator. El Emulator requiere Java JDK 11 o superior y descarga
   sus binarios localmente la primera vez.
4. Para migrar liquidaciones, desplegá primero la función y luego el cliente
   mediante Hosting. Verificá el flujo autenticado en producción y la actualización
   de clientes antes de cerrar las escrituras directas con las nuevas Rules.
   Los pasos de Hosting y Rules son independientes y ejecutan la suite completa:

    npm run deploy:hosting:checked
    npm run deploy:rules:checked

No publiques las Rules nuevas antes del cliente: los clientes anteriores no
podrían registrar liquidaciones. Los índices y Functions se despliegan por
separado cuando corresponda.

Hosting excluye reglas, índices, pruebas y archivos de desarrollo; sólo se
publican los recursos de la aplicación.

## Reparación V1 (septiembre de 2026)

La primera entrega de la reparación cubre correcciones verificables en el cliente:

- rutas absolutas para CSS y JavaScript al abrir `/j/{token}`;
- parseo monetario estricto, sin limpiar texto, signos ni formatos ambiguos;
- balances globales separados de las acciones de la persona actual, con estados de carga y error;
- escape defensivo de categorías existentes y validación de emojis nuevos;
- bloqueo del listado global de invitaciones en Firestore Rules.

Las pruebas puras se ejecutan con Node 22 o superior:

    npm test

Las pruebas del Emulator cubren invitaciones, permisos y el backend de
liquidaciones, incluida una llamada autenticada:

    npm run test:emulator

La función de liquidación recalcula la sugerencia dentro de una transacción en
el servidor. El archivado y la baja de integrantes aún requieren migración:
las lecturas de colecciones dentro de transacciones del SDK Web no están
soportadas. Firestore Rules no puede validar la suma de los repartos; los gastos
también necesitan una futura migración al servidor.

Los balances se calculan siempre sobre el historial completo. No se debe
paginar gastos o liquidaciones en esta vista hasta contar con un resumen de
ledger materializado y verificado por servidor.

## Arranque optimizado

Home verifica primero Auth, el perfil vigente y las membresías. Categorías, comercios, usuarios de Administración y el selector de emojis se cargan sólo cuando la pantalla o acción los necesita. Los recursos públicos propios usan `Cache-Control: no-cache`: el navegador puede reutilizarlos tras una revalidación, sin servir una versión estable potencialmente incompatible.

Para registrar marcas locales de apertura, abrí la app con `?startupDebug=1`. Las métricas se escriben en la consola del navegador sin enviar información personal ni datos de Counts a un servicio externo.

## Validación manual

1. Entrá con una cuenta aprobada. Si es nueva, aprobala desde la cuenta administradora.
2. Creá un Count con el wizard: agregá manuales opcionales, elegí la moneda y confirmá.
3. Copiá el link durante el draft: debe informar que el Count todavía se está configurando. Después de activarlo, el mismo link debe funcionar.
4. Cargá un gasto y verificá que el split suma exactamente el total y usa la moneda principal por defecto.
5. Verificá que la moneda principal quede fija desde la activación del Count.
6. Editá el gasto y luego eliminálo: debe desaparecer de la vista, no de Firestore.
7. Registrá una liquidación desde Balances y verificá que los saldos se recalculen por moneda.
