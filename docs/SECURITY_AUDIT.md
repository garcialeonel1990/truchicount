# Auditoría de seguridad

Fecha: 17 de octubre de 2026. Alcance: código y Firestore Emulator; no se leyó ni modificó información de producción.

## Riesgos P0

1. **Gastos adulterables:** Rules no demuestra que los shares sean enteros válidos, sumen el monto o apunten a integrantes del Count.
2. **Liquidaciones arbitrarias:** un miembro puede escribir un pago positivo sin probar que corresponde a la sugerencia vigente.
3. **Archivado evadible:** Rules permite la transición y un snapshot provisto por el cliente sin verificar saldo cero.
4. **Bajas inconsistentes:** Member y Membership pueden quedar desincronizados; las invariantes de saldo y último registrado viven sólo en el cliente.

Mitigación requerida: comandos privilegiados con Admin SDK y transacciones para gastos, settlements, archivo y membresía; luego negar las escrituras directas correspondientes en Rules. No se deben cerrar esas rutas antes de disponer del reemplazo porque rompería la aplicación.

## Riesgos P1/P2

- La baja de miembros y el archivo intentan `transaction.get` sobre queries/colecciones, API no soportada por el SDK Web; esos flujos no tienen test funcional y deben considerarse defectuosos.
- Categorías y comercios globales son modificables por cualquier usuario aprobado con contratos débiles.
- `auditLogs` escrito desde clientes no es evidencia de seguridad confiable.
- Invitaciones no tienen expiración, revocación operativa ni máximo de usos.
- Cualquier aprobado puede leer un Member si conoce la ruta exacta.
- Navegador y tests usan majors diferentes del SDK Firebase.
- No hay App Check ni límites sistemáticos de longitudes/timestamps.

## Correcciones de este ciclo

- `createSettlementV2`, el cliente y las Rules nuevas están desplegados. El flujo autenticado y el bloqueo de escrituras directas se probaron en emuladores; falta verificar una liquidación real en producción. Las pestañas con versiones anteriores deben recargarse.
- CI ejecuta unitarios y Rules antes de aceptar cambios.
- El deploy de Hosting dejó de ejecutarse automáticamente en cada push a `main`; ahora es manual, depende de la suite completa y usa el environment `production`.
- Hosting excluye documentación interna, manifests npm y logs `*-debug.log`.
- La edición de alias dejó de intentar leer perfiles privados ajenos; sincronizar el alias visible en los Members sigue pendiente.

## Pruebas pendientes

Agregar casos Emulator adversariales para shares inválidos, IDs ajenos, settlement inventado/duplicado, archivo con deuda, bajas no atómicas, mutación global de catálogos, auditoría falsificada y replay/expiración de invitaciones.
