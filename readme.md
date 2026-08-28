# Truchicount

Primer prototipo web para registrar gastos compartidos entre dos o mas personas.

## Que incluye

- Home con proyectos de gastos, llamados `truchicounts`.
- Vista de proyecto con tabs de gastos, balances y fotos.
- Alta de proyectos con participantes.
- Alta de gastos con pagador, fecha, categoria, moneda y personas seleccionadas para dividir.
- Calculo de balances y deuda sugerida entre participantes.
- Persistencia local con `localStorage` para poder probar sin backend.

## Proximo paso Firebase

La app ya separa los datos en una estructura compatible con Firestore:

```txt
projects/{projectId}
  name
  emoji
  archived
  members[]

projects/{projectId}/expenses/{expenseId}
  title
  category
  amount
  currency
  paidBy
  date
  splitWith[]
```

Cuando se agregue Firebase conviene reemplazar las llamadas de `loadState` y `saveState`
por un pequeno modulo `data-store.js` con funciones como:

- `watchProjects(userId, callback)`
- `createProject(project)`
- `watchExpenses(projectId, callback)`
- `createExpense(projectId, expense)`

## Probar

Abrir `index.html` en el navegador. No hace falta servidor para esta version.
