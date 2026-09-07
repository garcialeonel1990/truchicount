# TruchiCount V1

Aplicación web para registrar gastos compartidos. Está hecha con HTML, CSS y JavaScript puro, y usa Firebase Authentication + Cloud Firestore como fuente de verdad.

## Qué incluye

- Inicio de sesión exclusivo con Google.
- Counts múltiples y membresías por usuario.
- Invitaciones por link corto: /j/{token}.
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
- firestore.rules: reglas de acceso por membership.

## Configurar y desplegar

1. En Firebase Authentication, habilitá el proveedor Google y autorizá el dominio de Hosting.
2. Instalá Firebase CLI si todavía no está disponible.
3. Publicá reglas y hosting:

    firebase deploy --only firestore:rules,hosting

Las reglas son parte de la implementación: sin desplegarlas, las operaciones de Counts y gastos no tendrán el modelo de permisos de V1.

## Validación manual

1. Entrá con Google y creá un Count.
2. Compartí el link de invitación con otra cuenta.
3. Cargá un gasto y verificá que el split suma exactamente el total.
4. Editá el gasto y luego eliminálo: debe desaparecer de la vista, no de Firestore.
5. Registrá una liquidación desde Balances y verificá que los saldos se recalculen por moneda.
