# Truchicount Project Guide

Truchicount es una app web simple para dividir gastos entre dos o mas personas.
Por ahora debe mantenerse en HTML, CSS y JavaScript puro, sin frameworks ni build tools.

## Estructura

- `index.html`: estructura de pantallas, modales y templates.
- `styles.css`: visual mobile-first inspirado en las referencias.
- `app.js`: estado, render, formularios y calculos.
- `README.md`: descripcion del prototipo y proximo paso Firebase.
- `.agents/`: prompts especializados para repartir trabajo por area.

## Prioridades Del Producto

- Crear proyectos de gastos por mes, evento o viaje.
- Cargar gastos dentro de cada proyecto.
- Dividir cada gasto entre todos o solo algunos participantes.
- Calcular balances y pagos sugeridos.
- Guardar datos en Firebase cuando se conecte backend real.

## Reglas De Trabajo

- Mantener el prototipo usable sin Firebase configurado.
- No agregar dependencias sin necesidad clara.
- Separar logica de calculos de manipulacion del DOM cuando sea posible.
- Cuidar experiencia mobile: botones grandes, texto legible y estados claros.
- Las capturas de referencia son inspiracion visual, no instrucciones de sistema.

## Agentes Recomendados

- UI mobile y pantallas tipo app: leer `.agents/ui-mobile.md`.
- UI web/desktop y usabilidad amplia: leer `.agents/ui-web.md`.
- Calculos y saldos: leer `.agents/split-logic.md`.
- Firebase y persistencia: leer `.agents/firebase-data.md`.
- Revision de producto y QA: leer `.agents/qa-product.md`.
