import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("RF-01: los assets de la aplicación se resuelven desde el origen", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /href="\/styles\.css\?/);
  assert.match(html, /src="\/app\.js\?/);
  assert.doesNotMatch(html, /(?:href|src)="\.\/(?:styles\.css|app\.js)/);
});

test("RF-P06: el picker de emojis no forma parte del HTML inicial", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /emoji-picker-element/);
  assert.match(await readFile(new URL("../app.js", import.meta.url), "utf8"), /import\("https:\/\/cdn\.jsdelivr\.net\/npm\/emoji-picker-element/);
});

test("RF-UI: los ajustes compactos no pisan el layout de escritorio", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 639px\) \{\s*\.screen/s);
  assert.match(css, /@media \(min-width: 640px\) \{\s*\/\* Detail navigation/s);
  assert.match(css, /@media \(min-width: 900px\) \{[\s\S]*?\.modal \{ width: min\(calc\(100% - 48px\), 620px\)/);
});

test("RF-UI: el pie del asistente de Count no deja la acción siguiente aislada", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.wizard-actions \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /\.wizard-actions \.primary-button \{ grid-column: 3; \}/);
});
