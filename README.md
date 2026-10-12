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

OCR, fotos, reparto manual y exportación no forman parte de esta V1.

## Estructura

- index.html y styles.css: interfaz mobile-first.
- app.js: navegación y formularios.
- firebase.js: autenticación e inicialización de Firebase.
- data-store.js: operaciones Firestore y listeners en tiempo real.
- money.js: parseo, formato y reparto exacto en centavos.
- balances.js: cálculo puro de balances y simplificación de deudas.
- firestore.rules: reglas de acceso, administración, drafts, membresías e invitaciones.

## Acceso y administración

El administrador se identifica por su UID de Firebase Authentication, definido en `ADMIN_UID` dentro de `data-store.js` y en `isAdmin()` dentro de `firestore.rules`.

- Una cuenta nueva crea su perfil con `accessStatus: "pending"`.
- Sólo un usuario aprobado puede usar Counts, categorías, comercios e invitaciones.
- El administrador gestiona pendientes, aprobados y bloqueados desde Ajustes → Administración.
- La aprobación global no reemplaza la membresía: cada Count sigue requiriendo una invitación o membresía propia.

## Configurar y desplegar

1. En Firebase Authentication, habilitá el proveedor Google y autorizá el dominio de Hosting.
2. Instalá dependencias de desarrollo (Node 20 o superior):

    npm install

3. Ejecutá las pruebas antes de cualquier despliegue:

    npm run test:all

   `test:all` ejecuta las pruebas puras y las pruebas de permisos contra el
   Firestore Emulator. El Emulator requiere Java JDK 11 o superior y descarga
   sus binarios localmente la primera vez.
4. Publicá reglas, índices y Hosting sólo a través del comando que exige una
   suite exitosa antes de desplegar:

    npm run deploy:checked

Las reglas son parte de la implementación: sin desplegarlas, las operaciones de Counts y gastos no tendrán el modelo de permisos de V1.

Hosting excluye reglas, índices, pruebas y archivos de desarrollo; sólo se
publican los recursos de la aplicación.

## Reparación V1 (septiembre de 2026)

La primera entrega de la reparación cubre correcciones verificables en el cliente:

- rutas absolutas para CSS y JavaScript al abrir `/j/{token}`;
- parseo monetario estricto, sin limpiar texto, signos ni formatos ambiguos;
- balances globales separados de las acciones de la persona actual, con estados de carga y error;
- escape defensivo de categorías existentes y validación de emojis nuevos;
- bloqueo del listado global de invitaciones en Firestore Rules.

Las pruebas puras se ejecutan con Node 20 o superior:

    npm test

Las 22 pruebas de invitaciones y permisos requieren el Emulator:

    npm run test:emulator

Las mutaciones críticas del cliente se revalidan dentro de transacciones: una
liquidación debe coincidir con la sugerencia del ledger actual y el archivado o
la baja de un integrante se decide sobre el mismo snapshot. Las Rules validan
autoría, moneda, montos y estructura. Firestore Rules no puede sumar un mapa
de repartos ni inspeccionar todos sus participantes; antes de habilitar
escrituras desde clientes no confiables hace falta mover esas mutaciones a una
función privilegiada y probarla en Emulator.

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
