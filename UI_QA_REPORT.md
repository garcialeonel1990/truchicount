# TruchiCount — QA Fase 1/2

Fecha: 20/10/2026

## Ejecutado

| Validación | Resultado |
|---|---|
| `npm test` | Pendiente de ejecutar en esta entrega |
| Lint | No existe script de lint en `package.json` |
| Build | No existe script de build en `package.json`; la app es estática y usa módulos ES |
| Capturas before/after | No generadas: no hay herramienta de browser/screenshot disponible en el entorno actual |
| iPhone 14 / iPhone 15 Pro real | No verificado: no hay dispositivo Safari conectado |

## Cobertura estática implementada

- Formulario de nuevo gasto: scroll interno, `scroll-padding`, footer con safe area y espacio reservado.
- Focus de inputs/selects/textareas: desplazamiento al control dentro del formulario.
- 320 px: fecha a una columna y moneda compacta.
- 360–639 px: fecha en dos columnas cuando el viewport lo permite.
- 640 px+: gutters y composición de categoría adaptados.
- Nombres largos: wrapping en participantes y pagadores múltiples.
- Sin cambios en lógica financiera ni contratos de persistencia.

## Limitaciones pendientes

La validación visual final debe ejecutarse con Safari iOS/PWA, teclado abierto, zoom de texto y datos extremos. También falta producir evidencia comparativa antes/después y ejecutar la suite completa en el entorno con dependencias instaladas.

