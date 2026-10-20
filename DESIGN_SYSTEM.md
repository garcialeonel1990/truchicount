# TruchiCount Hybrid — foundation implementada

## Tokens

La foundation vive en `styles.css` bajo el namespace `--tc-*`. Los aliases legacy siguen disponibles para no alterar las pantallas fuera de esta fase.

- Color: `--tc-brand`, `--tc-brand-accent`, `--tc-brand-soft`, `--tc-page`, `--tc-surface`, `--tc-surface-muted`, `--tc-ink`, `--tc-ink-muted`, `--tc-border`, `--tc-danger`.
- Espacio: `--tc-space-1` a `--tc-space-7` = 4/8/12/16/20/24/32 px.
- Ergonomía: `--tc-control-h: 50px`, `--tc-touch-min: 44px`, `--tc-page-gutter: 16px`.
- Forma: controles 14 px, tarjetas 20 px; se evita mezclar radios arbitrarios en el flujo nuevo.
- Safe area: `--tc-safe-bottom` se suma al footer del formulario.

## Componentes visuales usados en Nuevo gasto

- Header de sheet: altura de contenido controlada, cierre con target de 44 px.
- Campo: label persistente, control de 50 px, foco visible y wrapping seguro.
- `expense-title-row`: título + selector de categoría con una alineación única.
- Monto: input tabular y moneda alineados en grid adaptable.
- Pagador/fecha: controles con la misma altura y radio.
- Multipagador: tarjeta secundaria, importes alineados y nombres envolventes.
- Participantes: lista compacta, target táctil y selección con checkbox visible.
- Footer: CTA de 52 px, fondo propio y safe area; el body reserva su altura.

## Responsive

- 320–359 px: fecha en una columna y moneda reducida a 88 px.
- 360–639 px: fecha en dos columnas cuando entra; el body conserva scroll nativo.
- 640 px o más: gutters de 24 px y selector de categoría de 50 px.
- El focus de inputs desplaza el control a una región visible del contenedor mediante `scrollIntoView`.

## Decisiones

Se mantuvo el HTML/JS existente y se conservaron IDs, nombres de campos y eventos. La nueva capa está acotada a `#expenseModal` para evitar extender la Fase 2 a pantallas no solicitadas.

