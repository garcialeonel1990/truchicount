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

test("Golden Screen: la hoja nueva cubre el detalle sin efectos de composición", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.count-context-header\s*\{/);
  assert.match(css, /\.expense-card\s*\{[\s\S]*?min-height:\s*80px/);
  assert.match(css, /\.add-expense-button\s*\{[\s\S]*?min-height:\s*var\(--control-h\)/);
  assert.doesNotMatch(css, /backdrop-filter\s*:/);
  assert.doesNotMatch(css, /setTimeout\s*\(/);
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
  assert.match(block('.add-expense-button'), /min-height: var\(--control-h\)/);
  assert.match(block('.count-context-header'), /grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(block('.detail-actions'), /grid-column: 2/);
  assert.match(block('.detail-actions'), /justify-self: end/);
  assert.match(block('.count-context-header > .back-button'), /background: transparent/);
  assert.match(css, /\.home-tab, \.tab, \.admin-tab \{[^}]*min-height: var\(--target\)/);
});
