import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Golden Screen: Gastos conserva contratos de tabs, paneles y CTA", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const detail = html.match(/<section class="screen" id="detailScreen"[\s\S]*?<\/section>\s*<section class="screen" id="settingsScreen"/)?.[0] || "";
  assert.ok(detail, "existe el detalle de Count");
  for (const [tab, panel] of [["expensesTab", "expensesPanel"], ["balancesTab", "balancesPanel"], ["summaryTab", "summaryPanel"]]) {
    assert.match(detail, new RegExp(`id="${tab}"[^>]*aria-controls="${panel}"`));
    assert.match(detail, new RegExp(`id="${panel}"[^>]*aria-labelledby="${tab}"`));
  }
  assert.match(detail, /id="expenseList"/);
  assert.match(detail, /id="addExpenseButton"/);
});

test("Golden Screen: la fuente de verdad visual está acotada al detalle", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const golden = css.match(/\/\* Golden Screen v1[\s\S]*?\/\* End Golden Screen v1 \*\//)?.[0] || "";
  assert.ok(golden, "existe el bloque de implementación Golden Screen");
  assert.match(golden, /#detailScreen \.count-context-header/);
  assert.match(golden, /#detailScreen \.expense-card[\s\S]*?min-height: 80px/);
  assert.match(golden, /#detailScreen \.add-expense-button[\s\S]*?var\(--tc-safe-bottom\)/);
  assert.doesNotMatch(golden, /backdrop-filter\s*:/);
  assert.doesNotMatch(golden, /setTimeout\s*\(/);
});

test("Golden Screen: no reaparecen los conflictos de header y CTA de la captura", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const block = (selector) => {
    const start = css.indexOf(selector + " {");
    assert.ok(start >= 0, selector);
    return css.slice(start, css.indexOf("}", start));
  };
  // The screenshot regression combined right:gutter with translateX(50%).
  // Inspect every CTA rule, including :active and later legacy media queries.
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (rule[1].includes('.add-expense-button')) assert.doesNotMatch(rule[2], /translate(?:X)?\(50%/);
  }
  assert.match(block('#detailScreen .add-expense-button'), /transform: none/);
  assert.match(block('#detailScreen .add-expense-button:active'), /transform: none/);
  // Explicit placement prevents the old three-column/two-column combination.
  assert.match(block('#detailScreen .count-context-header'), /grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(block('#detailScreen .detail-actions'), /grid-column: 2/);
  assert.match(block('#detailScreen .detail-actions'), /justify-self: end/);
  assert.match(block('#detailScreen .count-context-header > .back-button'), /background: transparent/);
  assert.match(block('#detailScreen .tab'), /min-height: var\(--golden-target\)/);
});
