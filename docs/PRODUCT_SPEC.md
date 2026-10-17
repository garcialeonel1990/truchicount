# Especificación de producto

## Comportamiento vigente

- Acceso Google con estados pendiente, aprobado y bloqueado.
- Counts múltiples con draft, nombre único normalizado, moneda principal y archivo restaurable.
- Integrantes registrados y manuales; los movimientos históricos conservan `memberId`.
- Gastos con un pagador, participantes seleccionables y reparto igualitario exacto.
- Balances, sugerencias de pago, liquidaciones, resumen por categoría y exportación CSV.
- Categorías globales con emoji y comercios recordados.

## Reglas obligatorias

- Un Count necesita al menos dos integrantes activos al activarse. El cliente lo controla, pero la garantía autoritativa queda pendiente del backend.
- La moneda principal es explícita e inmutable luego de la activación.
- Un gasto usa enteros en unidad mínima, tiene monto positivo, un pagador, al menos un participante y shares cuya suma coincide con el total.
- El remanente de centavos se asigna de forma determinista: primero al pagador si participa y luego por ID ordenado.
- Un integrante con saldo pendiente no puede quitarse; el historial se conserva mediante inactivación.
- Una liquidación debe coincidir exactamente con una sugerencia del ledger vigente.
- Un Count sólo puede archivarse con balance global cero y queda en solo lectura hasta restaurarlo.

## Estado de capacidades

| Capacidad | Estado |
|---|---|
| Auth, aprobación y Counts | Implementada; sin E2E real |
| Manuales e invitaciones | Implementada; cobertura Emulator |
| Split igualitario | Implementado y testeado |
| Split custom | Faltante |
| Moneda por Count | Implementada |
| Varias monedas dentro de un Count | No soportado |
| Settlements | Implementados en UI, pero la transacción Web requiere reparación y autorización servidor |
| Archivo/restauración | Implementado en UI, pero la transacción Web requiere reparación y autorización servidor |
| CSV | Implementado |
| Excel, método de pago, varios pagadores | Faltante/planificado |
| OCR y fotos | Fuera de V1 |

## Flujos no verificados

Login Google, aprobación admin y CRUD completo cross-account no tienen una prueba E2E con cuentas reales. Hasta ejecutarla deben tratarse como no verificados, aunque exista implementación y cobertura parcial.
