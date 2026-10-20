# Truchicount Agents

Estos agentes son prompts de trabajo para repartir tareas de la app sin perder coherencia.
Cada agente debe leer primero `README.md`, `index.html`, `styles.css` y `app.js` antes de proponer o tocar codigo.

## Agentes

- `ui-mobile.md`: pantallas, estados visuales, responsive y experiencia estilo app mobile.
- `ui-web.md`: version web/desktop, layout mas amplio, navegacion y usabilidad general.
- `split-logic.md`: calculos de division, balances, deuda sugerida y casos borde.
- `firebase-data.md`: modelo de datos, Firestore, auth, storage y reglas.
- `qa-product.md`: pruebas manuales, bugs, validacion de flujos y checklist de release.

## Como usarlos

Copiar el contenido del agente correspondiente como instruccion inicial para una tarea nueva,
o mencionarlo cuando se quiera delegar una parte puntual del trabajo.

Ejemplos:

- "Usa el agente UI Mobile para pulir el modal de Add Expense."
- "Usa el agente UI Web para adaptar la home a escritorio."
- "Usa Split Logic para agregar division manual por porcentajes."
- "Usa Firebase Data para conectar Firestore sin romper el prototipo local."
- "Usa QA Product para revisar que crear proyecto y cargar gasto funcione completo."
