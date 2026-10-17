# Estrategia de pruebas

## Capas

1. **Unitarias:** dinero, balances, integridad, resumen, CSV y paridad del ledger servidor. Deben ser rápidas y deterministas.
2. **Firestore Emulator:** autorización, concurrencia e invariantes cross-document.
3. **E2E navegador:** sesión simulada/local, wizard, gasto, balances, settlement, archivo y errores.
4. **A11y/visual:** teclado y axe; capturas 390/768/1200 para pantallas críticas.
5. **Release smoke:** HTML/assets, `/j/{token}`, headers cache y versión desplegada.

## Comandos actuales

```sh
npm test
npm run test:emulator
npm run test:all
```

Baseline actual: 31 pruebas unitarias/estáticas (29 cliente/configuración + 2 ledger servidor) y 37 pruebas Emulator (30 Rules/invitaciones + 6 settlement servidor + 1 smoke callable). El Emulator requiere Java y puertos locales libres.

## Cobertura prioritaria faltante

- Gastos y shares hostiles.
- Settlements inventados, duplicados o stale.
- Archivo con deuda y Member/Membership no atómicos.
- Wizard/finalización concurrente y CRUD completo de gastos.
- Cambio de alias en Count compartido.
- UI loading/error al cambiar de Count.
- Accesibilidad de tabs, filas y diálogos.

Una tarea no se marca completada si su prueba relevante no corrió; los checks estáticos y unitarios de este ciclo dejan los cambios de UI/Firestore como implementados pero no verificados end-to-end.
