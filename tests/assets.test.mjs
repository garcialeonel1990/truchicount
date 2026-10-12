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
  assert.match(css, /@media \(max-width: 639px\) \{[\s\S]*?\.wizard-actions \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}[\s\S]*?\.wizard-actions \.primary-button \{ grid-column: 1 \/ -1; \}/);
});

test("RF-Resumen: cada Count ofrece resumen y exportación CSV", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /data-tab="summary"[^>]*>Resumen/);
  assert.match(html, /id="exportSummaryButton"/);
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /function exportCountCsv\(\)/);
  assert.match(app, /on\(\$\("#exportSummaryButton"\), "click", exportCountCsv\)/);
});

test("RF-Perfil: el alias propio se muestra antes del nombre histórico del integrante", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /member\?\.userId === state\.user\?\.uid \? state\.profile/);
  assert.match(app, /profile\?\.alias \|\| member\?\.aliasSnapshot/);
});

test("RF-Perfil: quien entra elige su nickname antes de aceptar una invitación", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(html, /id="nicknameModal"/);
  assert.match(html, /id="nicknameForm"/);
  assert.match(app, /if \(!String\(profile\.alias \|\| ""\)\.trim\(\)\)/);
  assert.match(app, /saveInitialUserAlias\(state\.user\.uid, name\)/);
  assert.match(app, /joinInvite\(token, state\.user, \{ profileAlias: state\.profile\?\.alias \}\)/);
});

test("RF-Admin: puede eliminar un acceso sin historial para reiniciar su solicitud", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const store = await readFile(new URL("../data-store.js", import.meta.url), "utf8");
  assert.match(app, /textContent = "Eliminar usuario"/);
  assert.match(store, /export async function deleteUserAccess/);
  assert.match(store, /No podés eliminar este usuario porque tiene historial/);
});
