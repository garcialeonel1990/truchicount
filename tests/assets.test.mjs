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
  assert.match(await readFile(new URL("../app-main.js", import.meta.url), "utf8"), /import\("https:\/\/cdn\.jsdelivr\.net\/npm\/emoji-picker-element/);
});

test("RF-Auth: el login móvil no fuerza el redirect que genera loops en iOS", async () => {
  const firebase = await readFile(new URL("../firebase.js", import.meta.url), "utf8");
  const signIn = firebase.match(/export async function signInWithGoogle\(\)[\s\S]*?\n\}/)?.[0] || "";
  assert.match(signIn, /return await signInWithPopup\(auth, provider\)/);
  assert.match(signIn, /const canFallbackToRedirect = !isMobile/);
  assert.doesNotMatch(signIn, /if \(isMobileSignInContext\(\)\) return signInWithRedirect/);
});

test("RF-UI: los ajustes compactos no pisan el layout de escritorio", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 639px\) \{[\s\S]*?\.screen \{/);
  assert.match(css, /@media \(min-width: 640px\) \{[\s\S]*?\.screen \{/);
  assert.match(css, /@media \(min-width: 900px\) \{[\s\S]*?\.count-context-header/);
});

test("RF-UI: el sistema visual usa solamente tokens semánticos nuevos", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  for (const token of ["color-page", "color-surface", "color-header", "color-brand", "color-danger", "space-4", "gutter", "target", "control-h", "radius-control", "safe-bottom"]) {
    assert.match(css, new RegExp(`--${token}:`), `falta --${token}`);
  }
  assert.doesNotMatch(css, /--(?:tc-|field-|button-|teal-|navy-|gray-|coral-)/);
});

test("RF-UI: cerrar un modal no deja una capa de blur sobre la app en iOS", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /backdrop-filter\s*:/);
});

test("RF-UI: el formulario de gasto bloquea el arrastre del shell en móviles", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /#expenseModal\[open\]\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
  assert.match(css, /\.expense-form-body\s*\{[\s\S]*?overflow-y:\s*auto/);
  const baseBody = css.match(/body\s*\{([^}]*)\}/)?.[1] || "";
  assert.doesNotMatch(baseBody, /overflow:\s*hidden/);
});

test("RF-Categorías: las categorías cacheadas permiten abrir el formulario de gasto", async () => {
  const app = await readFile(new URL("../app-main.js", import.meta.url), "utf8");
  const loader = app.match(/function ensureCategories\(\)[\s\S]*?\n\}\nfunction ensureMerchants/)?.[0] || "";
  assert.match(loader, /if \(items\.length\) \{[\s\S]*?state\.categoriesReady = true;[\s\S]*?resolve\(state\.categories\)/);
});

test("RF-Admin: el cambio de acceso actualiza la lista sin cerrar sesión", async () => {
  const app = await readFile(new URL("../app-main.js", import.meta.url), "utf8");
  const change = app.match(/async function changeUserAccess\([\s\S]*?\n\}\n\nasync function removeUserAccess/)?.[0] || "";
  assert.match(change, /state\.accessUsers = state\.accessUsers\.map/);
  assert.match(change, /renderAdmin\(\)/);
});

test("RF-UI: el selector de emojis vive dentro del modal y libera el teclado", async () => {
  const app = await readFile(new URL("../app-main.js", import.meta.url), "utf8");
  const picker = app.match(/async function openEmojiPicker\([^)]*\)[\s\S]*?\n\}\n\nasync function deleteCategory/)?.[0] || "";
  assert.match(picker, /document\.activeElement\?\.blur/);
  assert.match(picker, /dialogs\.categoryModal\.append\(popover\)/);
  assert.doesNotMatch(picker, /document\.body\.append\(popover\)/);
});

test("RF-UI: monedas usa un listado y permite agregar una nueva sin checkboxes", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app-main.js", import.meta.url), "utf8");
  assert.match(html, /id="newCurrencyButton"/);
  assert.match(html, /id="currencyModal"/);
  assert.match(app, /enabledCodes\.forEach/);
  assert.match(html, /id="currencySearch"/);
  assert.doesNotMatch(app.match(/function renderCountForm\(\)[\s\S]*?\n\}/)?.[0] || "", /Object\.values\(CURRENCIES\)/);
  assert.match(app, /updateUserSettings\(state\.user\.uid, \{ enabledCurrencies: next \}\)/);
  assert.doesNotMatch(app.match(/function renderSettings\(\)[\s\S]*?\n\}\n\nfunction openCurrencyModal/)?.[0] || "", /type="checkbox"/);
});

test("UX-03: el formulario conserva contratos y controles Tricount", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const form = html.match(/<form[^>]+id="expenseForm"[\s\S]*?<\/form>/)?.[0] || "";
  for (const id of ["categoryButton", "payerButton", "currencyPill"]) assert.match(form, new RegExp(`id="${id}"`));
  for (const name of ["title", "amount", "payer", "category", "expenseDate", "merchant", "notes"]) assert.match(form, new RegExp(`name="${name}"`));
  assert.doesNotMatch(form, /Income|Transfer|Ingreso|Transferencia|capture=/);
  for (const id of ["whatsappInviteButton", "copyInviteButton", "shareInviteButton"]) assert.match(html, new RegExp(`id="${id}"`));
});

test("UX-04: la invitación no ofrece QR ni carga código de vendor", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app-main.js", import.meta.url), "utf8");
  const invite = html.match(/<dialog[^>]+id="inviteModal"[\s\S]*?<\/dialog>/)?.[0] || "";
  assert.ok(invite, "existe #inviteModal");
  assert.doesNotMatch(invite, /qrInviteButton|inviteQrPanel|inviteQr\b|inviteQrBackButton|código QR|<canvas/i);
  assert.doesNotMatch(app, /qrInviteButton|inviteQr|qrcode|vendor\//i);
  await assert.rejects(readFile(new URL("../vendor/qrcode-generator.mjs", import.meta.url)), { code: "ENOENT" });
  await assert.rejects(readFile(new URL("./qr-vendor.test.mjs", import.meta.url)), { code: "ENOENT" });
});

test("RF-UI: el encabezado de Ajustes no superpone Volver con el título", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.settings-topline\s*\{[\s\S]*?align-items:\s*center/);
  assert.match(css, /\.settings-topline, \.settings-panel-heading/);
});

test("RF-UI: Ajustes separa monedas, categorías y administración en paneles", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app-main.js", import.meta.url), "utf8");
  assert.match(html, /id="settingsHub"/);
  assert.match(html, /id="currenciesSettingsPanel"/);
  assert.match(html, /id="categoriesSettingsPanel"/);
  assert.match(html, /id="adminSettingsPanel"/);
  assert.match(app, /function showSettingsPanel\(panel\)/);
  assert.match(app, /data-settings-home/);
});

test("RF-UI: el sistema de botones comparte tamaños y targets táctiles", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app-main.js", import.meta.url), "utf8");
  assert.match(css, /--target:\s*44px/);
  assert.match(css, /--control-h:\s*48px/);
  assert.match(css, /\.icon-button, \.user-button[\s\S]*?min-width:\s*var\(--target\)[\s\S]*?min-height:\s*var\(--target\)/);
  assert.doesNotMatch(html, /class="close-button"(?![^>]*aria-label="Cerrar")/);
  assert.match(app, /const row = document\.createElement\("button"\);\s*row\.type = "button";\s*row\.className = "member-row member-row-action"/);
});

test("RF-UI: el CSS nuevo no reintroduce overlays, hotfixes ni aliases legacy", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /backdrop-filter\s*:/);
  const withoutAllowedHiddenRule = css.replace(/\[hidden\]\s*\{[^}]*!important[^}]*\}/g, "");
  assert.doesNotMatch(withoutAllowedHiddenRule, /!important/);
  assert.doesNotMatch(css, /hotfix|final override|legacy override/i);
});

test("RF-Balances: limpia la lista anterior antes de estados loading o error", async () => {
  const app = await readFile(new URL("../app-main.js", import.meta.url), "utf8");
  const render = app.match(/function renderBalances\(\)[\s\S]*?function moneySummary/)?.[0] || "";
  assert.match(render, /const list = \$\("#balanceList"\); list\.replaceChildren\(\)/);
  assert.ok(render.indexOf("list.replaceChildren()") < render.indexOf('presentation.state === "loading"'));
});

test("RF-Resumen: cada Count ofrece resumen y exportación CSV", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /data-tab="summary"[^>]*>Resumen/);
  assert.match(html, /id="exportSummaryButton"/);
  const app = await readFile(new URL("../app-main.js", import.meta.url), "utf8");
  assert.match(app, /function exportCountCsv\(\)/);
  assert.match(app, /on\(\$\("#exportSummaryButton"\), "click", exportCountCsv\)/);
});

test("RF-Perfil: el alias propio se muestra antes del nombre histórico del integrante", async () => {
  const app = await readFile(new URL("../app-main.js", import.meta.url), "utf8");
  assert.match(app, /member\?\.userId === state\.user\?\.uid \? state\.profile/);
  assert.match(app, /profile\?\.alias \|\| member\?\.aliasSnapshot/);
});

test("RF-Perfil: quien entra elige su nickname antes de aceptar una invitación", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app-main.js", import.meta.url), "utf8");
  assert.match(html, /id="nicknameModal"/);
  assert.match(html, /id="nicknameForm"/);
  assert.match(app, /if \(!String\(profile\.alias \|\| ""\)\.trim\(\)\)/);
  assert.match(app, /saveInitialUserAlias\(state\.user\.uid, name\)/);
  assert.match(app, /joinInvite\(token, state\.user, \{ profileAlias: state\.profile\?\.alias \}\)/);
});

test("RF-Admin: puede eliminar un acceso sin historial para reiniciar su solicitud", async () => {
  const app = await readFile(new URL("../app-main.js", import.meta.url), "utf8");
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
  assert.match(finalize, /if \(!owner\.exists\(\) \|\| !owner\.data\(\)\.active/);
  assert.doesNotMatch(finalize, /hasMinimumActiveMembers|Agregá al menos otra persona/);
  assert.doesNotMatch(finalize, /transaction\.get\(membersRef\)/);
});
