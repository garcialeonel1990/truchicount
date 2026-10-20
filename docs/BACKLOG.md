# Backlog ejecutable

| ID | Pri. | Tarea | Estado | Criterio de salida |
|---|---:|---|---|---|
| SEC-01 | P0 | Comandos privilegiados para ledger y membresía | Hecho en código; pendiente deploy/verificación | `countCommandV1` migra gastos, archivado y bajas; falta ejecutar Emulator y despliegue |
| SEC-02 | P0 | Tests Rules adversariales | En progreso | Escrituras directas bloqueadas en Rules; falta ejecutar suite adversarial en Emulator |
| REL-01 | P0 | Gate unit + Emulator y deploy manual | Hecho | `test:all` bloquea deploy; environment production |
| REL-02 | P0 | Excluir artefactos internos de Hosting | Hecho | Logs/docs/manifests fuera del manifest |
| REL-03 | P0 | Publicar Rules/índices junto al release | Pendiente | Un release no deja drift entre UI y autorización |
| BUG-01 | P1 | Limpiar balances entre Counts | Implementado; falta E2E | Loading/error nunca conserva saldos previos |
| BUG-02 | P1 | Permitir Counts personales | Implementado | El creador activo puede registrar gastos sin agregar otra persona |
| BUG-03 | P1 | Cambio de alias sin lectura prohibida | Parcial | Guardado no lee perfiles ajenos; falta sincronizar snapshot visible |
| BUG-04 | P1 | Quitar `transaction.get` sobre colecciones | Hecho en código; pendiente E2E | Baja y archivo usan `countCommandV1`; falta validar en Emulator |
| UX-01 | P1 | Catálogo ampliado de monedas y preferencia por usuario | Hecho en código; pendiente deploy | 155 monedas, catálogo compartido, búsqueda y wizard filtrado |
| UX-03 | P1 | Formulario de gasto y compartir estilo Tricount | En progreso | Calculadora, menú y WhatsApp incorporados; QR descartado (UX-04); falta QA visual y E2E |
| UX-04 | P0 | Eliminar QR falso de la invitación | Hecho | Sin vendor/, sin botón ni panel QR; regresión en assets.test.mjs |
| UX-01 | P1 | Monedas: definir y aplicar preferencia | Pendiente | Copy, wizard y persistencia coinciden |
| UX-02 | P1 | Teclado/ARIA/contraste | En progreso | Auditoría automática y manual AA |
| QA-01 | P1 | E2E financiero feliz | Pendiente | Flujo principal estable en navegador |
| ARCH-01 | P2 | Stores por dominio | Pendiente | Módulos cohesionados sin cambio funcional |
| DATA-01 | P2 | Ledger materializado | Pendiente | Escala sin paginar la fuente de verdad |
| FEAT-01 | P2 | Split custom | Pendiente | Montos/porcentajes deterministas y testeados |
