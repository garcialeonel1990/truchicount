# Roadmap

## P0 — Integridad y seguridad

- Diseñar e implementar una capa privilegiada transaccional para mutaciones financieras y membresía.
- Validar `createSettlementV2` en Emulator y completar su rollout Function → cliente → Rules.
- Bloquear escrituras directas sólo después de migrar el cliente.
- Agregar pruebas Emulator adversariales y estrategia de migración/rollback.
- Alinear despliegue de Hosting, Rules e índices para evitar drift.

## P1 — Correctitud y estabilidad

- Reparar las lecturas de colecciones dentro de transacciones Web en settlement, baja y archivo sin debilitar atomicidad.
- Completar E2E Count → gasto → balance → settlement → archivo.
- Resolver semántica de Ajustes > Monedas.
- Corregir accesibilidad de filas, tabs y diálogos.
- Agregar smoke postdeploy para `/`, assets, headers y `/j/{token}`.
- Sincronizar de forma autorizada el contrato de alias visible por Count.

## P2 — Mantenibilidad

- Separar stores por dominio y controladores de UI.
- Alinear versiones Firebase navegador/tests.
- Diseñar resumen de ledger materializado.
- Hacer atómica o explícitamente eventual la actualización de comercios.
- Definir adapter local si se mantiene el requisito de funcionamiento sin Firebase.

## P3/P4 — Experiencia y expansión

- Regresión visual y a11y en 390/768/1200.
- Layout desktop de dos paneles y mejores estados offline.
- Split custom, método de pago, Excel y varios pagadores, en ese orden y después del P0.
