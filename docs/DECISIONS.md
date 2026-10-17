# Decisiones de arquitectura

## ADR-001 — Sin framework ni build tool

Se mantienen HTML, CSS y módulos JavaScript nativos. La complejidad actual no justifica una migración y los módulos puros existentes permiten mejorar por extracción incremental.

## ADR-002 — Dinero entero y ledger derivado

Los importes se guardan en unidad mínima entera. Los balances se derivan del historial activo de gastos y settlements; no se modifican silenciosamente registros financieros anteriores.

## ADR-003 — `memberId` separado del UID

La identidad de un Count es estable e histórica. Un manual puede convertirse en registrado conservando `memberId`; el UID sólo representa autenticación.

## ADR-004 — Lectura directa, comandos privilegiados

Decisión propuesta y prioritaria: conservar listeners Firestore directos para lectura y mover mutaciones con invariantes financieras/cross-document a un backend privilegiado. Rules negará la escritura directa cuando la migración esté completa.

La primera implementación es `createSettlementV2`, callable v2 sobre Node 22. Usa un UUID como ID idempotente y vuelve a calcular el ledger dentro de una transacción Admin SDK. Se despliega antes de cambiar el cliente y cerrar Rules.

## ADR-005 — Releases explícitos

Producción no se despliega automáticamente por un push. El workflow actual despliega sólo Hosting, es manual, requiere suite completa y environment `production`. Aún falta integrar Rules/índices en un release Firebase completo y controlado.

## ADR-006 — El modo local sigue siendo un requisito abierto

No se abandonó el requisito de operar sin Firebase configurado. El repositorio actual no tiene adapter local; se registra como deuda y cualquier implementación futura debe conservar el contrato de datos y los cálculos financieros.
