import { completeRedirectSignIn, signInWithGoogle, signOutUser, updateDisplayName, watchAuth } from "./firebase.js";
import { archiveCount, createCategory, createCount, createInvite, createSettlement, ensureDefaultCategories, ensureUser, joinInvite, saveExpense, softDeleteCategory, softDeleteExpense, unarchiveCount, updateCategory, updateUserSettings, watchCategories, watchCount, watchCounts, watchExpenses, watchMembers, watchMerchants, watchSettlements, watchUser } from "./data-store.js";
import { calculateNetBalances, simplifyDebts, actionsForUser } from "./balances.js";
import { CURRENCIES, DEFAULT_CURRENCY, formatMoney, formatMoneyPlain, parseMoney } from "./money.js";

const $ = (s) => document.querySelector(s);
const state = { user: null, profile: null, counts: [], count: null, members: [], expenses: [], settlements: [], categories: [], merchants: [], editing: null, categoryEditing: null, categoryEmoji: "🧾", selectedExpense: null, selectedSettlement: null, homeTab: "active", toastTimer: null };
const unsubscribers = { app: [], detail: [] };
const filters = { search: "", category: "", payer: "", participant: "", from: "", to: "" };
const dialogs = ["countModal", "categoryModal", "expenseModal", "expenseDetailModal", "settlementModal", "inviteModal", "accountModal", "countActionsModal", "archiveConfirmModal", "unarchiveConfirmModal"].reduce((all, id) => Object.assign(all, { [id]: $("#" + id) }), {});

function on(el, event, fn) { el && el.addEventListener(event, fn); }
function stop(group) { unsubscribers[group].forEach((fn) => fn && fn()); unsubscribers[group] = []; }
function watch(group, fn) { unsubscribers[group].push(fn); }
function esc(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function dateFrom(value) { return value && value.toDate ? value.toDate() : value ? new Date(value) : null; }
function dateISO(value) { const date = dateFrom(value); return date ? date.toISOString().slice(0, 10) : ""; }
function prettyDate(value) { const date = dateFrom(value); return date ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "Sin fecha"; }
function nameOf(uid) { return state.members.find((member) => member.uid === uid)?.displayNameSnapshot || "Integrante"; }
function activeExpenses() { return state.expenses.filter((expense) => expense.status === "active"); }
function activeCategories() { return state.categories.filter((category) => category.status === "active"); }
function categoryFor(id) { return state.categories.find((category) => category.id === id); }
function categoryDisplay(categoryId, fallbackName = "") {
  const category = categoryFor(categoryId);
  return { name: category?.name || fallbackName || "Sin categoría", emoji: category?.emoji || icon(fallbackName) };
}
function categoryEmoji(category) { return category?.emoji || icon(category?.name); }
function balances() { return calculateNetBalances(state.members, state.expenses, state.settlements); }
function isReadOnly() { return state.count?.status === "archived"; }
function pendingCurrencies(balance = balances()) { return [...new Set(Object.values(balance).flatMap((byCurrency) => Object.entries(byCurrency).filter(([, amount]) => amount !== 0).map(([currency]) => currency)))].sort(); }
function setBusy(button, busy, label, busyLabel = "Guardando…") { button.disabled = busy; button.textContent = busy ? busyLabel : label; }
function error(el, exception, fallback) { console.error(exception); el.textContent = exception?.message || fallback; el.hidden = false; }
function icon(category) { const name = String(category).toLocaleLowerCase("es"); if (name.includes("super") || name.includes("comida")) return "🛒"; if (name.includes("salida")) return "🍔"; if (name.includes("trans")) return "🚕"; if (name.includes("serv")) return "💡"; if (name.includes("verd")) return "🥬"; if (name.includes("apo") || name.includes("masc")) return "🐶"; return "🧾"; }
function showToast(message) { const toast = $("#toast"); clearTimeout(state.toastTimer); toast.textContent = message; toast.hidden = false; state.toastTimer = setTimeout(() => { toast.hidden = true; }, 2800); }

completeRedirectSignIn().catch((exception) => error($("#authError"), exception, "No se pudo completar el inicio de sesión."));
watchAuth(async (user) => {
  stop("app"); stop("detail");
  state.user = user; state.profile = null; state.counts = []; state.count = null; state.homeTab = "active";
  $("#loginScreen").hidden = Boolean(user); $("#appShell").hidden = !user;
  if (!user) return;
  try {
    await ensureUser(user);
    await ensureDefaultCategories(user);
    startAppWatches();
    const token = inviteToken();
    if (token) await acceptInvite(token);
    showScreen(state.count ? "detail" : "home");
  } catch (exception) { error($("#authError"), exception, "No pudimos preparar tu cuenta."); }
});

function startAppWatches() {
  watch("app", watchUser(state.user.uid, (profile) => { state.profile = profile; renderHeader(); renderSettings(); }, console.error));
  watch("app", watchCategories((items) => { state.categories = items; renderSettings(); if (state.count) renderDetail(); }, console.error));
  watch("app", watchMerchants((items) => { state.merchants = items; renderMerchantOptions(); }, console.error));
  watch("app", watchCounts(state.user.uid, (items) => { state.counts = items; renderHome(); }, console.error));
}
function inviteToken() {
  const queryToken = new URLSearchParams(location.search).get("join");
  const parts = location.pathname.split("/").filter(Boolean);
  return queryToken || (parts.length === 2 && parts[0] === "j" ? parts[1] : null);
}
async function acceptInvite(token) {
  try {
    const id = await joinInvite(token, state.user);
    history.replaceState({}, "", "/");
    openCount(id);
  } catch (exception) {
    history.replaceState({}, "", "/");
    error($("#authError"), exception, "No pudimos usar esta invitación.");
  }
}
function renderHeader() {
  const name = state.profile?.displayName || state.user?.displayName || state.user?.email || "Usuario";
  $("#welcomeText").textContent = "Hola, " + name.split(" ")[0];
  $("#accountButton").textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map((piece) => piece[0]).join("").toUpperCase();
}
function showScreen(name) {
  $("#homeScreen").hidden = name !== "home";
  $("#detailScreen").hidden = name !== "detail";
  $("#settingsScreen").hidden = name !== "settings";
  if (name === "home") { stop("detail"); state.count = null; renderHome(); }
  if (name === "settings") renderSettings();
}

function renderHome() {
  if (!state.user) return;
  renderHeader();
  document.querySelectorAll("[data-count-tab]").forEach((button) => button.classList.toggle("is-selected", button.dataset.countTab === state.homeTab));
  $("#newCountButton").hidden = state.homeTab === "archived";
  const list = $("#countList"); list.replaceChildren();
  const counts = state.counts.filter((count) => (count.status || "active") === state.homeTab);
  if (!counts.length) {
    list.innerHTML = state.homeTab === "archived"
      ? '<section class="empty-state"><strong>No tenés Counts archivados todavía.</strong><span>Cuando termines de usar un Count y su balance esté en cero, vas a poder archivarlo.</span></section>'
      : '<section class="empty-state"><strong>Todavía no tenés ningún Count.</strong><span>Creá uno para empezar a dividir gastos.</span><button class="primary-button" id="emptyCreateButton" type="button">Crear Count</button></section>';
    on($("#emptyCreateButton"), "click", openCountModal);
    return;
  }
  counts.forEach((count) => {
    const card = document.createElement("button");
    card.type = "button"; card.className = "project-card";
    card.innerHTML = '<span><strong>' + esc(count.name) + '</strong><small>' + (count.status === "archived" ? '<span class="archive-badge">Archivado</span>' : "Count compartido") + '</small></span><span class="chevron">›</span>';
    on(card, "click", () => openCount(count.id)); list.append(card);
  });
}

function openCount(id) {
  stop("detail");
  state.count = state.counts.find((count) => count.id === id) || { id: id, name: "Cargando…" };
  state.members = []; state.expenses = []; state.settlements = [];
  watch("detail", watchCount(id, (count) => { state.count = count; renderDetail(); }, detailError));
  watch("detail", watchMembers(id, (members) => { state.members = members.sort((a, b) => a.displayNameSnapshot.localeCompare(b.displayNameSnapshot, "es")); renderDetail(); }, detailError));
  watch("detail", watchExpenses(id, (items) => { state.expenses = items; renderDetail(); }, detailError));
  watch("detail", watchSettlements(id, (items) => { state.settlements = items; renderDetail(); }, detailError));
  showScreen("detail");
}
function detailError(exception) { console.error(exception); $("#expenseList").innerHTML = '<section class="empty-state"><strong>No pudimos cargar este Count.</strong><span>Revisá tu conexión e intentá de nuevo.</span></section>'; }
function renderDetail() {
  if (!state.count) return;
  $("#countTitle").textContent = state.count.name;
  $("#memberSummary").textContent = state.members.length ? state.members.length + (state.members.length === 1 ? " integrante · " : " integrantes · ") + state.members.map((member) => member.displayNameSnapshot).join(", ") : "Cargando integrantes…";
  const archived = isReadOnly();
  $("#shareButton").hidden = archived;
  $("#addExpenseButton").hidden = archived;
  $("#archiveSummary").hidden = !archived;
  $("#archiveMetadata").textContent = archived ? "Archivado el " + prettyDate(state.count.lastArchivedAt) + " por " + (state.count.lastArchivedByNameSnapshot || "un integrante") : "";
  fillFilters(); renderExpenses(); renderBalances();
}

function totals(items) { return items.reduce((all, item) => Object.assign(all, { [item.currency]: (all[item.currency] || 0) + item.amountMinor }), {}); }
function moneyGroups(items) { const values = Object.entries(totals(items)); return values.length ? values.map(([currency, amount]) => formatMoney(amount, currency)).join(" · ") : formatMoney(0); }
function expenseMatches(expense) {
  const words = (expense.title + " " + (expense.merchantNameSnapshot || "")).toLocaleLowerCase("es");
  return (!filters.search || words.includes(filters.search.toLocaleLowerCase("es"))) &&
    (!filters.category || expense.categoryId === filters.category) &&
    (!filters.payer || expense.payerUid === filters.payer) &&
    (!filters.participant || expense.participantUids.includes(filters.participant)) &&
    (!filters.from || dateISO(expense.expenseDate) >= filters.from) &&
    (!filters.to || dateISO(expense.expenseDate) <= filters.to);
}
function renderExpenses() {
  const all = activeExpenses();
  $("#totalCards").innerHTML = '<article><span>Vos pagaste</span><strong>' + moneyGroups(all.filter((item) => item.payerUid === state.user.uid)) + '</strong></article><article><span>Total del Count</span><strong>' + moneyGroups(all) + "</strong></article>";
  const list = $("#expenseList"); list.replaceChildren();
  const items = all.filter(expenseMatches).sort((a, b) => dateISO(b.expenseDate).localeCompare(dateISO(a.expenseDate)));
  if (!items.length) {
    list.innerHTML = all.length ? '<section class="empty-state"><strong>No hay gastos con esos filtros.</strong><span>Probá cambiar o limpiar los filtros.</span></section>' : '<section class="empty-state"><strong>Todavía no hay gastos.</strong><span>Agregá el primer gasto compartido.</span></section>';
    return;
  }
  items.forEach((expense) => {
    const category = categoryDisplay(expense.categoryId, expense.categoryNameSnapshot);
    const card = document.createElement("button"); card.className = "expense-card"; card.type = "button";
    card.innerHTML = '<span class="expense-icon">' + category.emoji + '</span><span class="expense-copy"><strong>' + esc(expense.title) + '</strong><small>' + esc(category.name) + " · " + prettyDate(expense.expenseDate) + '</small><small>Pagó ' + esc(expense.payerNameSnapshot) + " · " + expense.participantUids.length + ' participantes</small></span><span class="expense-amount">' + formatMoney(expense.amountMinor, expense.currency) + "</span>";
    on(card, "click", () => openExpenseDetail(expense)); list.append(card);
  });
}

function renderBalances() {
  const computed = balances();
  const suggestions = simplifyDebts(computed);
  const actions = $("#balanceActions"); actions.replaceChildren();
  const mine = actionsForUser(suggestions, state.user.uid);
  if (!mine.length) {
    actions.innerHTML = '<section class="settled-state"><strong>Todo saldado 🎉</strong><span>Nadie le debe nada a nadie.</span></section>';
    if (!isReadOnly()) actions.insertAdjacentHTML("beforeend", '<p class="archive-ready">Este Count ya se puede archivar.</p>');
  }
  else {
    const title = document.createElement("h2"); title.className = "section-title"; title.textContent = "Qué tenés que hacer"; actions.append(title);
    mine.forEach((suggestion) => {
      const pays = suggestion.fromUid === state.user.uid;
      const other = nameOf(pays ? suggestion.toUid : suggestion.fromUid);
      const card = document.createElement("button"); card.type = "button"; card.className = "settlement-card";
      card.innerHTML = '<span class="settlement-icon">' + (pays ? "↗" : "↙") + '</span><span><strong>' + (pays ? "Pagale a " : "Reclamale a ") + esc(other) + '</strong><small>' + formatMoney(suggestion.amountMinor, suggestion.currency) + '</small></span><span class="chevron">›</span>';
      if (!isReadOnly()) on(card, "click", () => openSettlementModal(suggestion)); else card.disabled = true;
      actions.append(card);
    });
  }
  const list = $("#balanceList"); list.replaceChildren();
  state.members.forEach((member) => {
    const values = Object.entries(computed[member.uid] || {});
    const amounts = values.length ? values.map(([currency, amount]) => '<span class="' + (amount > 0 ? "positive" : amount < 0 ? "negative" : "") + '">' + (amount > 0 ? "+" : amount < 0 ? "−" : "") + formatMoney(Math.abs(amount), currency) + "</span>").join("") : "<span>" + formatMoney(0) + "</span>";
    const card = document.createElement("article"); card.className = "balance-card";
    card.innerHTML = '<span class="balance-avatar">' + esc(member.displayNameSnapshot.slice(0, 1).toUpperCase()) + '</span><span><strong>' + esc(member.displayNameSnapshot) + '</strong><small>' + (member.uid === state.user.uid ? "Vos" : "Integrante") + '</small></span><span class="balance-amount">' + amounts + "</span>";
    list.append(card);
  });
}

function putOptions(select, items, selected, empty) {
  if (!select) return;
  select.replaceChildren(); if (empty !== undefined) select.add(new Option(empty, ""));
  items.forEach((item) => select.add(new Option(item.name, item.id, false, item.id === selected)));
}
function fillFilters() {
  putOptions($("#filterCategory"), activeCategories().map((item) => ({ id: item.id, name: categoryEmoji(item) + " " + item.name })), filters.category, "Todas");
  const members = state.members.map((item) => ({ id: item.uid, name: item.displayNameSnapshot }));
  putOptions($("#filterPayer"), members, filters.payer, "Cualquiera"); putOptions($("#filterParticipant"), members, filters.participant, "Cualquiera");
}
function renderSettings() {
  if (!state.user) return;
  const enabled = state.profile?.enabledCurrencies || [DEFAULT_CURRENCY];
  const currencies = $("#currencyList"); currencies.replaceChildren();
  Object.values(CURRENCIES).forEach((currency) => {
    const row = document.createElement("label"); row.className = "settings-row";
    row.innerHTML = '<span>' + currency.symbol + '</span><span><strong>' + currency.code + '</strong><small>' + currency.name + '</small></span><input type="checkbox" ' + (enabled.includes(currency.code) ? "checked" : "") + (currency.code === DEFAULT_CURRENCY ? " disabled" : "") + " />";
    on(row.querySelector("input"), "change", async (event) => { const next = new Set(enabled); event.target.checked ? next.add(currency.code) : next.delete(currency.code); try { await updateUserSettings(state.user.uid, { enabledCurrencies: [...next] }); } catch (exception) { console.error(exception); } });
    currencies.append(row);
  });
  const categories = $("#categoryList"); categories.replaceChildren();
  const active = activeCategories();
  if (!active.length) {
    categories.innerHTML = '<div class="empty-category-row">No hay categorías activas.</div>';
    return;
  }
  active.forEach((category) => {
    const row = document.createElement("article"); row.className = "settings-row category-row";
    row.innerHTML = '<span>' + categoryEmoji(category) + '</span><span><strong>' + esc(category.name) + '</strong></span><span class="category-actions"><button class="category-icon-button" type="button" aria-label="Editar categoría">✎</button><button class="category-icon-button category-delete-button" type="button" aria-label="Eliminar categoría">×</button></span>';
    const buttons = row.querySelectorAll("button");
    on(buttons[0], "click", () => openCategoryModal(category));
    on(buttons[1], "click", () => deleteCategory(category));
    categories.append(row);
  });
}

function openCategoryModal(category = null) {
  state.categoryEditing = category;
  state.categoryEmoji = categoryEmoji(category) || "🧾";
  $("#categoryForm").reset();
  $("#categoryModalTitle").textContent = category ? "Editar categoría" : "Nueva categoría";
  $("#categoryEmojiPreview").textContent = state.categoryEmoji;
  $("#categoryForm").elements.name.value = category?.name || "";
  $("#categoryError").hidden = true;
  $("#categoryError").textContent = "";
  dialogs.categoryModal.showModal();
  $("#categoryForm").elements.name.focus();
}

function closeEmojiPicker() {
  document.querySelector(".emoji-picker-popover")?.remove();
}

function openEmojiPicker() {
  closeEmojiPicker();
  const popover = document.createElement("div");
  popover.className = "emoji-picker-popover";
  const picker = document.createElement("emoji-picker");
  picker.addEventListener("emoji-click", (event) => {
    state.categoryEmoji = event.detail?.unicode || event.detail?.emoji?.unicode || event.detail?.emoji || "🧾";
    $("#categoryEmojiPreview").textContent = state.categoryEmoji;
    closeEmojiPicker();
  });
  popover.append(picker);
  document.body.append(popover);
}

async function deleteCategory(category) {
  const message = "¿Seguro que querés eliminar " + categoryEmoji(category) + " " + category.name + "?\n\nYa no va a aparecer para nuevos gastos. Los gastos existentes seguirán asociados.";
  if (!confirm(message)) return;
  try {
    await softDeleteCategory({ category, actor: state.user });
    showToast("✓ Categoría eliminada");
  } catch (exception) {
    console.error(exception);
    showToast("No pudimos eliminar la categoría.");
  }
}

function openCountModal() {
  $("#countForm").reset(); $("#countError").hidden = true;
  const enabled = state.profile?.enabledCurrencies || [DEFAULT_CURRENCY];
  putOptions($("#countCurrency"), enabled.map((code) => ({ id: code, name: code + " · " + CURRENCIES[code].name })), state.profile?.defaultCurrency || DEFAULT_CURRENCY);
  dialogs.countModal.showModal();
}
function openExpenseModal(expense) {
  if (isReadOnly()) return;
  if (!state.members.length || !activeCategories().length) return;
  state.editing = expense || null; $("#expenseForm").reset(); $("#expenseError").hidden = true;
  $("#expenseModalTitle").textContent = expense ? "Editar gasto" : "Nuevo gasto";
  const enabled = state.profile?.enabledCurrencies || [DEFAULT_CURRENCY];
  putOptions($("#expenseCurrency"), enabled.map((code) => ({ id: code, name: code })), expense?.currency || DEFAULT_CURRENCY);
  const categories = activeCategories();
  putOptions($("#expenseCategory"), categories.map((item) => ({ id: item.id, name: categoryEmoji(item) + " " + item.name })), expense?.categoryId || categories[0].id);
  putOptions($("#expensePayer"), state.members.map((item) => ({ id: item.uid, name: item.displayNameSnapshot })), expense?.payerUid || state.user.uid);
  const checks = $("#participantChecks"); checks.replaceChildren();
  state.members.forEach((member) => {
    const selected = expense ? expense.participantUids.includes(member.uid) : true;
    const row = document.createElement("label"); row.className = "participant-row";
    row.innerHTML = '<input type="checkbox" name="participant" value="' + member.uid + '" ' + (selected ? "checked" : "") + '/><span>' + esc(member.displayNameSnapshot) + '</span><span class="checkmark">✓</span>';
    checks.append(row);
  });
  const form = $("#expenseForm");
  form.elements.title.value = expense?.title || ""; form.elements.merchant.value = expense?.merchantNameSnapshot || "";
  form.elements.amount.value = expense ? formatMoneyPlain(expense.amountMinor) : ""; form.elements.expenseDate.value = expense ? dateISO(expense.expenseDate) : new Date().toISOString().slice(0, 10); form.elements.notes.value = expense?.notes || "";
  renderMerchantOptions(); updateSplitPreview(); dialogs.expenseModal.showModal();
}
function renderMerchantOptions() { const list = $("#merchantOptions"); if (!list) return; list.replaceChildren(); state.merchants.slice(0, 50).forEach((merchant) => list.append(new Option(merchant.name))); }
function updateSplitPreview() { const selected = document.querySelectorAll("[name='participant']:checked").length; const minor = parseMoney($("#expenseForm").elements.amount.value); $("#splitPreview").textContent = selected ? formatMoney(minor ? Math.floor(minor / selected) : 0, $("#expenseCurrency").value) + " cada uno" : "Elegí al menos una persona"; }
function openExpenseDetail(expense) {
  state.selectedExpense = expense;
  const participants = expense.participantUids.map(nameOf).map(esc).join(", ");
  const category = categoryDisplay(expense.categoryId, expense.categoryNameSnapshot);
  $("#expenseDetailContent").innerHTML = '<p class="eyebrow">' + category.emoji + " " + esc(category.name) + '</p><h2>' + esc(expense.title) + '</h2><p class="expense-detail-amount">' + formatMoney(expense.amountMinor, expense.currency) + '</p><dl class="details-list"><div><dt>Comercio</dt><dd>' + esc(expense.merchantNameSnapshot || "—") + '</dd></div><div><dt>Pagó</dt><dd>' + esc(expense.payerNameSnapshot) + '</dd></div><div><dt>Fecha</dt><dd>' + prettyDate(expense.expenseDate) + '</dd></div><div><dt>Dividido entre</dt><dd>' + participants + "</dd></div>" + (expense.notes ? "<div><dt>Notas</dt><dd>" + esc(expense.notes) + "</dd></div>" : "") + "</dl>";
  $("#editExpenseButton").hidden = isReadOnly();
  $("#deleteExpenseButton").hidden = isReadOnly();
  dialogs.expenseDetailModal.showModal();
}
function openSettlementModal(suggestion) {
  if (isReadOnly()) return;
  state.selectedSettlement = suggestion;
  $("#settlementContent").innerHTML = '<p class="eyebrow">Liquidación</p><h2>' + esc(nameOf(suggestion.fromUid)) + " le paga a " + esc(nameOf(suggestion.toUid)) + '</h2><p class="expense-detail-amount">' + formatMoney(suggestion.amountMinor, suggestion.currency) + '</p><p class="section-copy">Esto registra un pago real y actualiza los balances.</p>';
  $("#confirmSettlementButton").textContent = state.user.uid === suggestion.fromUid ? "Marcar como pagado" : "Marcar como saldado"; dialogs.settlementModal.showModal();
}
async function openInviteModal() {
  if (isReadOnly()) { showToast("Este Count está archivado y no acepta nuevos miembros."); return; }
  $("#inviteLink").value = ""; $("#inviteStatus").hidden = true; dialogs.inviteModal.showModal();
  try { const token = await createInvite(state.count.id, state.user); const url = new URL(location.href); url.pathname = "/j/" + token; url.search = ""; url.hash = ""; $("#inviteLink").value = url.toString(); } catch (exception) { error($("#inviteStatus"), exception, "No pudimos crear el link."); }
}

function openCountActions() {
  if (!state.count) return;
  const archived = isReadOnly();
  const pending = pendingCurrencies();
  $("#archiveCountAction").hidden = archived;
  $("#unarchiveCountAction").hidden = !archived;
  $("#archiveCountAction").disabled = !archived && pending.length > 0;
  $("#archiveAvailability").hidden = archived || pending.length === 0;
  $("#archiveAvailability").textContent = pending.length === 1
    ? "No se puede archivar porque todavía hay saldo pendiente en " + pending[0] + "."
    : "No se puede archivar porque todavía hay saldos pendientes.";
  dialogs.countActionsModal.showModal();
}

function openArchiveConfirmation() {
  $("#archiveConfirmTitle").textContent = "¿Seguro que querés archivar “" + (state.count?.name || "este Count") + "”?";
  $("#archiveConfirmError").hidden = true;
  dialogs.countActionsModal.close();
  dialogs.archiveConfirmModal.showModal();
}

function openUnarchiveConfirmation() {
  $("#unarchiveConfirmTitle").textContent = "¿Desarchivar “" + (state.count?.name || "este Count") + "” y volver a habilitar modificaciones?";
  $("#unarchiveConfirmError").hidden = true;
  dialogs.countActionsModal.close();
  dialogs.unarchiveConfirmModal.showModal();
}

on($("#googleLoginButton"), "click", async () => { $("#authError").hidden = true; const button = $("#googleLoginButton"); setBusy(button, true, "Continuar con Google"); try { await signInWithGoogle(); } catch (exception) { error($("#authError"), exception, "No se pudo iniciar sesión."); setBusy(button, false, "Continuar con Google"); } });
on($("#homeButton"), "click", () => showScreen("home")); on($("#backButton"), "click", () => showScreen("home")); on($("#settingsButton"), "click", () => showScreen("settings")); on($("#settingsBackButton"), "click", () => showScreen("home")); on($("#newCountButton"), "click", openCountModal); on($("#addExpenseButton"), "click", () => openExpenseModal()); on($("#shareButton"), "click", openInviteModal); on($("#countActionsButton"), "click", openCountActions);
on($("#newCategoryButton"), "click", () => openCategoryModal());
on($("#emojiPickerButton"), "click", openEmojiPicker);
on($("#accountButton"), "click", () => { $("#accountName").value = state.profile?.displayName || state.user?.displayName || ""; $("#accountEmail").textContent = state.user.email || ""; $("#accountError").hidden = true; dialogs.accountModal.showModal(); });
document.querySelectorAll("[data-close]").forEach((button) => on(button, "click", () => dialogs[button.dataset.close].close()));
document.querySelectorAll("[data-tab]").forEach((button) => on(button, "click", () => { document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("is-selected", item === button)); document.querySelectorAll(".tab-panel").forEach((item) => item.classList.toggle("is-active", item.id === button.dataset.tab + "Panel")); }));
document.querySelectorAll("[data-count-tab]").forEach((button) => on(button, "click", () => { state.homeTab = button.dataset.countTab; renderHome(); }));
on($("#filterToggle"), "click", () => { $("#filterPanel").hidden = !$("#filterPanel").hidden; });
const filterMap = { filterSearch: "search", filterCategory: "category", filterPayer: "payer", filterParticipant: "participant", filterFrom: "from", filterTo: "to" };
Object.entries(filterMap).forEach(([id, key]) => on($("#" + id), "input", (event) => { filters[key] = event.target.value; renderExpenses(); }));
on($("#clearFilters"), "click", () => { Object.keys(filters).forEach((key) => filters[key] = ""); Object.keys(filterMap).forEach((id) => { $("#" + id).value = ""; }); renderExpenses(); });
on($("#expenseForm"), "input", updateSplitPreview); on($("#expenseForm"), "change", updateSplitPreview);

on($("#countForm"), "submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; const button = event.submitter; const name = form.elements.name.value.trim(); if (!name) return;
  $("#countError").hidden = true; setBusy(button, true, "Crear Count");
  try { const id = await createCount({ name, user: state.user, defaultCurrency: form.elements.currency.value }); dialogs.countModal.close(); openCount(id); } catch (exception) { error($("#countError"), exception, "No pudimos crear el Count."); } finally { setBusy(button, false, "Crear Count"); }
});
on($("#categoryForm"), "submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget; const button = $("#saveCategoryButton"); const isEditing = Boolean(state.categoryEditing);
  $("#categoryError").hidden = true;
  setBusy(button, true, "Guardar");
  try {
    if (isEditing) {
      await updateCategory({ category: state.categoryEditing, name: form.elements.name.value, emoji: state.categoryEmoji, actor: state.user });
      showToast("✓ Categoría actualizada");
    } else {
      const result = await createCategory({ name: form.elements.name.value, emoji: state.categoryEmoji }, state.user);
      showToast(result.reactivated ? "✓ Categoría reactivada" : "✓ Categoría creada");
    }
    closeEmojiPicker(); dialogs.categoryModal.close();
  } catch (exception) {
    error($("#categoryError"), exception, "No pudimos guardar la categoría. Intentá nuevamente.");
  } finally { setBusy(button, false, "Guardar"); }
});
on($("#expenseForm"), "submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; const participants = [...form.querySelectorAll("[name='participant']:checked")].map((input) => input.value); const amountMinor = parseMoney(form.elements.amount.value); const button = $("#saveExpenseButton"); $("#expenseError").hidden = true;
  if (!participants.length || amountMinor <= 0) { $("#expenseError").textContent = participants.length ? "El monto tiene que ser mayor a cero." : "Elegí al menos una persona."; $("#expenseError").hidden = false; return; }
  setBusy(button, true, state.editing ? "Guardar cambios" : "Guardar gasto");
  try {
    await saveExpense({ countId: state.count.id, form: { title: form.elements.title.value, merchantName: form.elements.merchant.value, amountMinor, currency: form.elements.currency.value, expenseDate: form.elements.expenseDate.value, categoryId: form.elements.category.value, payerUid: form.elements.payer.value, participantUids: participants, notes: form.elements.notes.value }, members: state.members, categories: state.categories, actor: state.user, expenseId: state.editing?.id, before: state.editing });
    dialogs.expenseModal.close();
  } catch (exception) { error($("#expenseError"), exception, "No pudimos guardar el gasto. Revisá tu conexión e intentá nuevamente."); } finally { setBusy(button, false, state.editing ? "Guardar cambios" : "Guardar gasto"); }
});
on($("#editExpenseButton"), "click", () => { dialogs.expenseDetailModal.close(); openExpenseModal(state.selectedExpense); });
on($("#deleteExpenseButton"), "click", async () => {
  const expense = state.selectedExpense; if (!expense || !confirm("¿Seguro que querés eliminar este gasto?\n\n" + expense.title + "\n" + formatMoney(expense.amountMinor, expense.currency) + "\n\nEsta acción modificará los balances.")) return;
  const button = $("#deleteExpenseButton"); setBusy(button, true, "Eliminar"); try { await softDeleteExpense({ countId: state.count.id, expense, actor: state.user }); dialogs.expenseDetailModal.close(); } catch (exception) { alert("No pudimos eliminar el gasto."); console.error(exception); } finally { setBusy(button, false, "Eliminar"); }
});
on($("#confirmSettlementButton"), "click", async () => {
  const button = $("#confirmSettlementButton"); setBusy(button, true, "Marcar como pagado"); try { await createSettlement({ countId: state.count.id, suggestion: state.selectedSettlement, members: state.members, actor: state.user }); dialogs.settlementModal.close(); } catch (exception) { alert("No pudimos registrar el pago."); console.error(exception); } finally { setBusy(button, false, "Marcar como pagado"); }
});
on($("#archiveCountAction"), "click", () => { if (!$("#archiveCountAction").disabled) openArchiveConfirmation(); });
on($("#unarchiveCountAction"), "click", openUnarchiveConfirmation);
on($("#confirmArchiveButton"), "click", async () => {
  const button = $("#confirmArchiveButton");
  $("#archiveConfirmError").hidden = true;
  setBusy(button, true, "Archivar", "Archivando…");
  try {
    await archiveCount({ countId: state.count.id, actor: state.user });
    dialogs.archiveConfirmModal.close();
    state.homeTab = "archived";
    showScreen("home");
    showToast("✓ Count archivado");
  } catch (exception) {
    error($("#archiveConfirmError"), exception, "No pudimos archivar el Count. Intentá nuevamente.");
  } finally { setBusy(button, false, "Archivar"); }
});
on($("#confirmUnarchiveButton"), "click", async () => {
  const button = $("#confirmUnarchiveButton");
  $("#unarchiveConfirmError").hidden = true;
  setBusy(button, true, "Desarchivar", "Desarchivando…");
  try {
    await unarchiveCount({ countId: state.count.id, actor: state.user });
    dialogs.unarchiveConfirmModal.close();
    state.homeTab = "active";
    showScreen("home");
    showToast("✓ Count desarchivado");
  } catch (exception) {
    error($("#unarchiveConfirmError"), exception, "No pudimos desarchivar el Count. Intentá nuevamente.");
  } finally { setBusy(button, false, "Desarchivar"); }
});
on($("#copyInviteButton"), "click", async () => { try { await navigator.clipboard.writeText($("#inviteLink").value); $("#inviteStatus").textContent = "Link copiado."; $("#inviteStatus").hidden = false; } catch { $("#inviteStatus").textContent = "Copialo manualmente desde el campo."; $("#inviteStatus").hidden = false; } });
on($("#shareInviteButton"), "click", async () => { const url = $("#inviteLink").value; if (navigator.share) { try { await navigator.share({ title: state.count?.name || "TruchiCount", text: "Sumate a mi Count en TruchiCount", url }); } catch {} } else { await navigator.clipboard.writeText(url); $("#inviteStatus").textContent = "Link copiado."; $("#inviteStatus").hidden = false; } });
on($("#accountForm"), "submit", async (event) => { event.preventDefault(); const name = $("#accountName").value.trim(); const button = event.submitter; if (!name) return; $("#accountError").hidden = true; setBusy(button, true, "Guardar"); try { await updateDisplayName(name); await updateUserSettings(state.user.uid, { displayName: name }); dialogs.accountModal.close(); } catch (exception) { error($("#accountError"), exception, "No pudimos guardar el nombre."); } finally { setBusy(button, false, "Guardar"); } });
on($("#logoutButton"), "click", async () => { if (confirm("¿Querés cerrar sesión?")) await signOutUser(); });
