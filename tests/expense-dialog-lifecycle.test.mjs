import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app-main.js", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

test("expense dialog cleanup is attached to native close and cancel is routed through close()", () => {
  assert.match(app, /on\(dialog, "close", cleanupExpenseDialog\)/);
  assert.match(app, /on\(dialog, "cancel", \(event\) => \{ event\.preventDefault\(\); closeExpenseDialog\(dialog\); \}\)/);
  assert.match(app, /function closeExpenseDialog\(dialog\) \{[\s\S]*?if \(!dialog\?\.open\) return;[\s\S]*?dialog\.close\(\);/);
  const closeHelper = app.match(/function closeExpenseDialog\(dialog\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.doesNotMatch(closeHelper, /activeElement.*blur/);
});

test("expense dialog uses the native backdrop and does not force display while closed", () => {
  assert.match(css, /\.modal::backdrop\s*\{\s*background:/);
  assert.doesNotMatch(css, /#expenseModal\s*\{[^}]*::backdrop/);
  assert.match(css, /#expenseModal\[open\]\s*\{\s*display:\s*block;\s*\}/);
  assert.doesNotMatch(css, /#expenseModal:not\(\[open\]\)[^{]*\{[^}]*display:\s*(?:block|flex|grid)/);
});

test("the global header and its shell do not apply blur or compositing effects", () => {
  const shell = css.match(/\.app-shell\s*\{([^}]*)\}/)?.[1] || "";
  const header = css.match(/\.app-header\s*\{([^}]*)\}/)?.[1] || "";
  assert.ok(shell, "app-shell rule exists");
  assert.ok(header, "app-header rule exists");
  for (const declarations of [shell, header]) {
    assert.doesNotMatch(declarations, /(?:backdrop-)?filter\s*:/);
    assert.doesNotMatch(declarations, /opacity\s*:/);
    assert.doesNotMatch(declarations, /transform\s*:/);
  }
  assert.match(header, /background:\s*var\(--color-header\)/);
});
