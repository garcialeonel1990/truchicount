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

test("RF-UI: el sistema visual define todos los tokens teal usados", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /--teal-100:\s*#[0-9a-f]{6}/i);
  assert.match(css, /--teal-600:\s*#[0-9a-f]{6}/i);
  assert.match(css, /--color-primary:\s*var\(--teal-700\)/);
  assert.match(css, /\.danger-button\s*\{[\s\S]*?background:\s*var\(--coral-700\)/);
});

test("RF-Balances: limpia la lista anterior antes de estados loading o error", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const render = app.match(/function renderBalances\(\)[\s\S]*?function moneySummary/)?.[0] || "";
  assert.match(render, /const list = \$\("#balanceList"\); list\.replaceChildren\(\)/);
  assert.ok(render.indexOf("list.replaceChildren()") < render.indexOf('presentation.state === "loading"'));
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

test("RF-Perfil: cambiar el alias no intenta leer perfiles privados ajenos", async () => {
  const store = await readFile(new URL("../data-store.js", import.meta.url), "utf8");
  const settings = store.match(/export async function updateUserSettings[\s\S]*?export async function saveInitialUserAlias/)?.[0] || "";
  assert.match(settings, /normalizeMemberAlias\(item\.aliasSnapshot\)/);
  assert.doesNotMatch(settings, /getDoc\(doc\(db, "users", userId\)\)/);
});

test("RF-Count: la finalización no usa lecturas de colección incompatibles con Transaction.get", async () => {
  const store = await readFile(new URL("../data-store.js", import.meta.url), "utf8");
  const finalize = store.match(/export async function finalizeCountDraft[\s\S]*?export async function clearCurrentDraft/)?.[0] || "";
  assert.match(finalize, /hasMinimumActiveMembers\(members\)/);
  assert.doesNotMatch(finalize, /transaction\.get\(membersRef\)/);
});
