# Arquitectura verificada

Estado relevado el 17 de octubre de 2026 sobre la rama `codex/audit-hardening`.

## Vista general

TruchiCount es una SPA sin build step. `index.html` define pantallas y diálogos, `styles.css` contiene el sistema visual responsive y `app.js` coordina sesión, navegación, listeners, render y formularios.

```text
index.html + styles.css
          |
        app.js
       /   |   \
 balances money summary
       \   |   /
       data-store.js ---- invite-join.js
             |
       firebase.js / Firestore

firestore.rules + firestore.indexes.json
tests/*.mjs + tests/integration/*.mjs
functions/ (backend privilegiado en migración)
```

## Límites actuales

- `money.js`: parseo, formato y reparto exacto en unidad mínima.
- `balances.js`: ledger puro y sugerencias deterministas.
- `integrity.js`: invariantes puras compartidas por mutaciones críticas.
- `summary.js`: resumen por categoría/persona y CSV.
- `invite-join.js`: decisión transaccional de ingreso por invitación.
- `data-store.js`: acceso Firestore y operaciones por dominio; todavía concentra demasiadas responsabilidades.
- `app.js`: estado y presentación; todavía mezcla render, navegación y controladores.
- `functions/`: comandos privilegiados. `createSettlementV2` está implementada y se mantiene desconectada del cliente hasta completar el rollout coordinado.

## Modelo Firestore

```text
users/{uid}
counts/{countId}
  members/{memberId}
  expenses/{expenseId}
  settlements/{settlementId}
memberships/{countId_uid}
invites/{token}
countNames/{normalizedName}
categories/{categoryId}
merchants/{merchantId}
auditLogs/{auditId}
```

`memberId` identifica a la persona dentro del Count y no debe confundirse con el UID de Auth. Gastos y liquidaciones conservan esos IDs históricos. El dinero se guarda como enteros (`amountMinor`).

## Restricción arquitectónica crítica

El navegador no es una frontera de confianza. Varias invariantes financieras se revalidan hoy en transacciones cliente, pero Rules no puede recomputar el ledger ni sumar mapas arbitrarios. Las mutaciones de gastos, liquidaciones, archivo y membresía deben migrar a una capa privilegiada antes de considerar seguro el sistema frente a clientes modificados.

## Dirección de evolución

1. Introducir comandos privilegiados por dominio manteniendo listeners directos para lectura.
2. Separar `data-store.js` en users, counts, ledger, members y catalog.
3. Separar `app.js` en estado/sesión, navegación, vistas y controladores.
4. Materializar un resumen de ledger verificado por servidor antes de paginar historiales.
5. Mantener módulos ES nativos; no se justifica un framework en esta etapa.
