# Backlog ejecutable

| ID | Pri. | Tarea | Estado | Criterio de salida |
|---|---:|---|---|---|
| SEC-01 | P0 | Comandos privilegiados para ledger y membresía | En progreso | `createSettlementV2` implementada localmente; falta rollout cliente/Rules |
| SEC-02 | P0 | Tests Rules adversariales | Pendiente | Casos de corrupción fallan en Emulator |
| REL-01 | P0 | Gate unit + Emulator y deploy manual | Hecho | `test:all` bloquea deploy; environment production |
| REL-02 | P0 | Excluir artefactos internos de Hosting | Hecho | Logs/docs/manifests fuera del manifest |
| REL-03 | P0 | Publicar Rules/índices junto al release | Pendiente | Un release no deja drift entre UI y autorización |
| BUG-01 | P1 | Limpiar balances entre Counts | Implementado; falta E2E | Loading/error nunca conserva saldos previos |
| BUG-02 | P1 | Mínimo dos integrantes al activar | Parcial | Cliente rechaza un único activo; backend/Rules lo hace obligatorio |
| BUG-03 | P1 | Cambio de alias sin lectura prohibida | Parcial | Guardado no lee perfiles ajenos; falta sincronizar snapshot visible |
| BUG-04 | P1 | Quitar `transaction.get` sobre colecciones | Pendiente | Settlement, baja y archivo ejecutan sin API inválida y conservan atomicidad |
| UX-01 | P1 | Monedas: definir y aplicar preferencia | Pendiente | Copy, wizard y persistencia coinciden |
| UX-02 | P1 | Teclado/ARIA/contraste | En progreso | Auditoría automática y manual AA |
| QA-01 | P1 | E2E financiero feliz | Pendiente | Flujo principal estable en navegador |
| ARCH-01 | P2 | Stores por dominio | Pendiente | Módulos cohesionados sin cambio funcional |
| DATA-01 | P2 | Ledger materializado | Pendiente | Escala sin paginar la fuente de verdad |
| FEAT-01 | P2 | Split custom | Pendiente | Montos/porcentajes deterministas y testeados |
