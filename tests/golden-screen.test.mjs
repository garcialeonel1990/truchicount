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
  const golden = css.match(/\/\* Golden Screen v1[\s\S]*/)?.[0] || "";
  assert.ok(golden, "existe el bloque de implementación Golden Screen");
  assert.match(golden, /#detailScreen \.count-context-header/);
  assert.match(golden, /#detailScreen \.expense-card[\s\S]*?min-height: 80px/);
  assert.match(golden, /#detailScreen \.add-expense-button[\s\S]*?var\(--tc-safe-bottom\)/);
  assert.doesNotMatch(golden, /backdrop-filter\s*:/);
  assert.doesNotMatch(golden, /setTimeout\s*\(/);
});
