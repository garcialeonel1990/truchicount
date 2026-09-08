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
- Moneda principal por Count, usada como predeterminada para los gastos y bloqueada después del primer movimiento.
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
2. Instalá Firebase CLI si todavía no está disponible.
3. Publicá reglas y hosting:

    firebase deploy --only firestore:rules,hosting

Las reglas son parte de la implementación: sin desplegarlas, las operaciones de Counts y gastos no tendrán el modelo de permisos de V1.

## Validación manual

1. Entrá con una cuenta aprobada. Si es nueva, aprobala desde la cuenta administradora.
2. Creá un Count con el wizard: agregá manuales opcionales, elegí la moneda y confirmá.
3. Copiá el link durante el draft: debe informar que el Count todavía se está configurando. Después de activarlo, el mismo link debe funcionar.
4. Cargá un gasto y verificá que el split suma exactamente el total y usa la moneda principal por defecto.
5. Verificá que la moneda principal ya no se pueda cambiar tras el primer gasto o liquidación.
6. Editá el gasto y luego eliminálo: debe desaparecer de la vista, no de Firestore.
7. Registrá una liquidación desde Balances y verificá que los saldos se recalculen por moneda.
