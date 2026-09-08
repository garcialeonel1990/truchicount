import { completeRedirectSignIn, signInWithGoogle, signOutUser, watchAuth } from "./firebase.js";
import { ADMIN_UID, archiveCount, clearCurrentDraft, correctMemberLink, createCategory, createDraftManualMember, createInvite, createManualMember, createSettlement, ensureDefaultCategories, ensureUser, finalizeCountDraft, getDraftMembers, joinInvite, removeCountMember, removeDraftManualMember, saveDraftCurrency, saveDraftName, saveExpense, softDeleteCategory, softDeleteExpense, startCountDraft, unarchiveCount, updateCategory, updateCountPrimaryCurrency, updateDraftManualMember, updateManualMember, updateUserAccess, updateUserSettings, watchAccessUsers, watchCategories, watchCount, watchCounts, watchExpenses, watchMembers, watchMerchants, watchSettlements, watchUser } from "./data-store.js";
import { calculateNetBalances, simplifyDebts, balanceCurrencies, balancePresentation } from "./balances.js";
import { CURRENCIES, DEFAULT_CURRENCY, formatMoney, formatMoneyPlain, tryParseMoney } from "./money.js";

const $ = (s) => document.querySelector(s);
const state = { user: null, profile: null, accessStarted: false, adminTab: "pending", accessUsers: [], adminUser: null, inviteIdentity: null, memberCorrection: null, draft: null, draftMembers: [], draftStep: 1, draftEditing: null, memberProfiles: {}, counts: [], count: null, members: [], expenses: [], settlements: [], detailLoading: { count: false, members: false, expenses: false, settlements: false, failed: false }, categories: [], merchants: [], editing: null, memberEditing: null, categoryEditing: null, categoryEmoji: "🧾", selectedExpense: null, selectedSettlement: null, homeTab: "active", toastTimer: null };
const unsubscribers = { access: [], app: [], admin: [], detail: [], profiles: [] };
const dialogs = ["countModal", "draftMemberModal", "categoryModal", "expenseModal", "expenseDetailModal", "settlementModal", "inviteModal", "inviteIdentityModal", "memberModal", "memberChoiceModal", "memberActionModal", "memberCorrectionModal", "manualMemberModal", "adminUserModal", "accountModal", "countActionsModal", "primaryCurrencyModal", "archiveConfirmModal", "unarchiveConfirmModal"].reduce((all, id) => Object.assign(all, { [id]: $("#" + id) }), {});

function on(el, event, fn) { el && el.addEventListener(event, fn); }
function stop(group) { unsubscribers[group].forEach((fn) => fn && fn()); unsubscribers[group] = []; }
function watch(group, fn) { unsubscribers[group].push(fn); }
function esc(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function dateFrom(value) { return value && value.toDate ? value.toDate() : value ? new Date(value) : null; }
function dateISO(value) { const date = dateFrom(value); return date ? date.toISOString().slice(0, 10) : ""; }
function prettyDate(value) { const date = dateFrom(value); return date ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "Sin fecha"; }
function memberName(member) { const profile = state.memberProfiles[member?.userId]; return member?.type === "manual" ? member.alias : profile?.alias || profile?.googleDisplayName || profile?.displayName || member?.aliasSnapshot || "Integrante"; }
function nameOf(memberId) { return memberName(state.members.find((member) => member.id === memberId)); }
function activeMembers() { return state.members.filter((member) => member.active); }
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
function isAdmin() { return state.user?.uid === ADMIN_UID; }
function canManageMembers() { return activeMembers().some((member) => member.type === "registered" && member.userId === state.user?.uid); }
function pendingCurrencies(balance = balances()) { return [...new Set(Object.values(balance).flatMap((byCurrency) => Object.entries(byCurrency).filter(([, amount]) => amount !== 0).map(([currency]) => currency)))].sort(); }
function setBusy(button, busy, label, busyLabel = "Guardando…") { button.disabled = busy; button.textContent = busy ? busyLabel : label; }
function error(el, exception, fallback) { console.error(exception); el.textContent = exception?.message || fallback; el.hidden = false; }
function icon(category) { const name = String(category).toLocaleLowerCase("es"); if (name.includes("super") || name.includes("comida")) return "🛒"; if (name.includes("salida")) return "🍔"; if (name.includes("trans")) return "🚕"; if (name.includes("serv")) return "💡"; if (name.includes("verd")) return "🥬"; if (name.includes("apo") || name.includes("masc")) return "🐶"; return "🧾"; }
function showToast(message) { const toast = $("#toast"); clearTimeout(state.toastTimer); toast.textContent = message; toast.hidden = false; state.toastTimer = setTimeout(() => { toast.hidden = true; }, 2800); }

completeRedirectSignIn().catch((exception) => error($("#authError"), exception, "No se pudo completar el inicio de sesión."));
watchAuth(async (user) => {
  stop("access"); stop("app"); stop("admin"); stop("detail"); stop("profiles");
  state.user = user; state.profile = null; state.accessStarted = false; state.counts = []; state.count = null; state.homeTab = "active";
  $("#loginScreen").hidden = Boolean(user); $("#pendingAccessScreen").hidden = true; $("#blockedAccessScreen").hidden = true; $("#appShell").hidden = true;
  const token = inviteToken(); if (token) savePendingInvite(token);
  if (!user) return;
  try {
    await ensureUser(user);
    watch("access", watchUser(user.uid, handleAccessProfile, (exception) => error($("#authError"), exception, "No pudimos verificar tu acceso.")));
  } catch (exception) { error($("#authError"), exception, "No pudimos preparar tu cuenta."); }
});

function handleAccessProfile(profile) {
  state.profile = profile;
  const status = profile?.accessStatus || "pending";
  const approved = status === "approved" || isAdmin();
  $("#loginScreen").hidden = true;
  $("#pendingAccessScreen").hidden = approved || status === "blocked";
  $("#blockedAccessScreen").hidden = approved || status !== "blocked";
  $("#appShell").hidden = !approved;
  if (!approved) {
    stop("app"); stop("admin"); stop("detail"); stop("profiles"); state.accessStarted = false;
    return;
  }
  if (state.accessStarted) { renderHeader(); renderSettings(); return; }
  state.accessStarted = true;
  ensureDefaultCategories(state.user).catch(console.error);
  clearCurrentDraft(state.user).catch(console.error);
  startAppWatches();
  const token = pendingInviteToken();
  if (token) acceptInvite(token);
  else showScreen("home");
}

function startAppWatches() {
  watch("app", watchCategories((items) => { state.categories = items; renderSettings(); if (state.count) renderDetail(); }, console.error));
  watch("app", watchMerchants((items) => { state.merchants = items; renderMerchantOptions(); }, console.error));
  watch("app", watchCounts(state.user.uid, (items) => { state.counts = items; renderHome(); }, console.error));
  if (isAdmin()) watch("admin", watchAccessUsers((users) => { state.accessUsers = users; renderSettings(); }, console.error));
}
function inviteToken() {
  const queryToken = new URLSearchParams(location.search).get("join");
  const parts = location.pathname.split("/").filter(Boolean);
  return queryToken || (parts.length === 2 && parts[0] === "j" ? parts[1] : null);
}
async function acceptInvite(token) {
  try {
    const result = await joinInvite(token, state.user);
    if (result.requiresIdentityChoice) { openInviteIdentityChoice(token, result); return; }
    history.replaceState({}, "", "/"); clearPendingInvite();
    if (result.alreadyMember) showToast("Ya sos integrante de este Count.");
    openCount(result.countId);
  } catch (exception) {
    history.replaceState({}, "", "/");
    error($("#authError"), exception, "No pudimos usar esta invitación.");
    showScreen("home");
    showToast(exception?.message || "No pudimos usar esta invitación.");
  }
}
function openInviteIdentityChoice(token, result) {
  state.inviteIdentity = { token, countId: result.countId, candidates: result.candidates };
  const list = $("#inviteCandidateList"); list.replaceChildren();
  result.candidates.forEach((candidate) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "member-row member-row-action";
    button.innerHTML = '<span class="member-avatar">' + esc(candidate.alias.slice(0, 1).toUpperCase()) + '</span><span><strong>' + esc(candidate.alias) + '</strong></span><span class="chevron">›</span>';
    on(button, "click", () => chooseInviteIdentity(candidate)); list.append(button);
  });
  $("#inviteIdentityError").hidden = true; dialogs.inviteIdentityModal.showModal();
}
async function chooseInviteIdentity(candidate = null) {
  const identity = state.inviteIdentity; if (!identity) return;
  if (candidate && !confirm("¿Sos " + candidate.alias + "?\n\nEste perfil se va a vincular de forma permanente con tu cuenta de TruchiCount y conservará todo su historial.")) return;
  $("#inviteIdentityError").hidden = true;
  try {
    const result = await joinInvite(identity.token, state.user, { manualMemberId: candidate?.memberId ?? null });
    history.replaceState({}, "", "/"); clearPendingInvite(); dialogs.inviteIdentityModal.close(); state.inviteIdentity = null;
    if (result.linkedManual) showToast("Perfil vinculado correctamente. Tus movimientos anteriores se conservaron.");
    openCount(result.countId);
  } catch (exception) { error($("#inviteIdentityError"), exception, "No pudimos vincular el perfil."); }
}
function savePendingInvite(token) { try { sessionStorage.setItem("truchicountPendingInvite", token); } catch {} }
function pendingInviteToken() { try { return sessionStorage.getItem("truchicountPendingInvite"); } catch { return null; } }
function clearPendingInvite() { try { sessionStorage.removeItem("truchicountPendingInvite"); } catch {} }
function renderHeader() {
  const name = state.profile?.alias || state.profile?.googleDisplayName || state.profile?.displayName || state.user?.displayName || state.user?.email || "Usuario";
  $("#welcomeText").textContent = "Hola, " + name.split(" ")[0];
  $("#accountButton").textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map((piece) => piece[0]).join("").toUpperCase();
}
function showScreen(name) {
  $("#homeScreen").hidden = name !== "home";
  $("#detailScreen").hidden = name !== "detail";
  $("#settingsScreen").hidden = name !== "settings";
  if (name === "home") { stop("detail"); stop("profiles"); state.count = null; renderHome(); }
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
  stop("detail"); stop("profiles"); state.memberProfiles = {};
  state.count = state.counts.find((count) => count.id === id) || { id: id, name: "Cargando…" };
  state.members = []; state.expenses = []; state.settlements = [];
  state.detailLoading = { count: false, members: false, expenses: false, settlements: false, failed: false };
  watch("detail", watchCount(id, (count) => { state.count = count; state.detailLoading.count = true; renderDetail(); }, detailError));
  watch("detail", watchMembers(id, (members) => {
    state.members = members;
    state.detailLoading.members = true;
    refreshMemberProfiles();
    renderDetail();
    // The member manager may remain open underneath the manual-member form.
    // Keep it synchronized with the same live data as the Count detail.
    if (dialogs.memberModal.open) renderMemberList();
  }, detailError));
  watch("detail", watchExpenses(id, (items) => { state.expenses = items; state.detailLoading.expenses = true; renderDetail(); }, detailError));
  watch("detail", watchSettlements(id, (items) => { state.settlements = items; state.detailLoading.settlements = true; renderDetail(); }, detailError));
  showScreen("detail");
}
function refreshMemberProfiles() {
  stop("profiles");
  const profiles = {};
  state.members.filter((member) => member.type === "registered" && member.userId).forEach((member) => {
    watch("profiles", watchUser(member.userId, (profile) => { state.memberProfiles[member.userId] = profile || {}; renderDetail(); }, detailError));
    profiles[member.userId] = state.memberProfiles[member.userId] || {};
  });
  state.memberProfiles = profiles;
}
function detailError(exception) {
  console.error(exception);
  state.detailLoading.failed = true;
  $("#expenseList").innerHTML = '<section class="empty-state"><strong>No pudimos cargar este Count.</strong><span>Revisá tu conexión e intentá de nuevo.</span></section>';
  renderBalances();
}
function renderDetail() {
  if (!state.count) return;
  $("#countTitle").textContent = state.count.name;
  const members = activeMembers();
  $("#memberSummary").textContent = members.length ? members.length + (members.length === 1 ? " integrante · " : " integrantes · ") + members.map(memberName).join(", ") : "Cargando integrantes…";
  const archived = isReadOnly();
  $("#shareButton").hidden = archived;
  $("#addExpenseButton").hidden = archived;
  $("#archiveSummary").hidden = !archived;
  $("#archiveMetadata").textContent = archived ? "Archivado el " + prettyDate(state.count.lastArchivedAt) + " por " + (state.count.lastArchivedByNameSnapshot || "un integrante") : "";
  renderExpenses(); renderBalances();
}

function totals(items) { return items.reduce((all, item) => Object.assign(all, { [item.currency]: (all[item.currency] || 0) + item.amountMinor }), {}); }
function moneyGroups(items) { const values = Object.entries(totals(items)); return values.length ? values.map(([currency, amount]) => formatMoney(amount, currency)).join(" · ") : formatMoney(0); }
function renderExpenses() {
  const all = activeExpenses();
  const myMemberId = activeMembers().find((member) => member.type === "registered" && member.userId === state.user?.uid)?.id;
  $("#totalCards").innerHTML = '<article><span>Vos pagaste</span><strong>' + moneyGroups(all.filter((item) => item.payerMemberId === myMemberId)) + '</strong></article><article><span>Total del Count</span><strong>' + moneyGroups(all) + "</strong></article>";
  const list = $("#expenseList"); list.replaceChildren();
  const items = all.sort((a, b) => dateISO(b.expenseDate).localeCompare(dateISO(a.expenseDate)));
  if (!items.length) {
    list.innerHTML = '<section class="empty-state"><strong>Todavía no hay gastos.</strong><span>Agregá el primer gasto compartido.</span></section>';
    return;
  }
  items.forEach((expense) => {
    const category = categoryDisplay(expense.categoryId, expense.categoryNameSnapshot);
    const card = document.createElement("button"); card.className = "expense-card"; card.type = "button";
    card.innerHTML = '<span class="expense-icon">' + esc(category.emoji) + '</span><span class="expense-copy"><strong>' + esc(expense.title) + '</strong><small>' + esc(category.name) + " · " + prettyDate(expense.expenseDate) + '</small><small>Pagó ' + esc(nameOf(expense.payerMemberId)) + " · " + expense.participantMemberIds.length + ' participantes</small></span><span class="expense-amount">' + formatMoney(expense.amountMinor, expense.currency) + "</span>";
    on(card, "click", () => openExpenseDetail(expense)); list.append(card);
  });
}

function renderBalances() {
  const actions = $("#balanceActions"); actions.replaceChildren();
  const myMemberId = activeMembers().find((member) => member.type === "registered" && member.userId === state.user?.uid)?.id;
  const ready = ["count", "members", "expenses", "settlements"].every((key) => state.detailLoading[key]);
  const computed = balances();
  const presentation = balancePresentation({ suggestions: simplifyDebts(computed), memberId: myMemberId, ready, failed: state.detailLoading.failed });
  if (presentation.state === "loading") {
    actions.innerHTML = '<section class="settled-state"><strong>Cargando balances…</strong><span>Estamos verificando gastos y pagos.</span></section>';
    return;
  }
  if (presentation.state === "error") {
    actions.innerHTML = '<section class="settled-state"><strong>No pudimos verificar los balances.</strong><span>Revisá tu conexión antes de registrar cambios.</span></section>';
    return;
  }
  if (presentation.state === "settled") {
    actions.innerHTML = '<section class="settled-state"><strong>Todo saldado 🎉</strong><span>Nadie le debe nada a nadie.</span></section>';
    if (!isReadOnly()) actions.insertAdjacentHTML("beforeend", '<p class="archive-ready">Este Count ya se puede archivar.</p>');
  } else {
    if (presentation.state === "up-to-date") {
      actions.innerHTML = '<section class="settled-state"><strong>Vos estás al día</strong><span>Hay pagos pendientes entre otros integrantes.</span></section>';
    }
    const title = document.createElement("h2"); title.className = "section-title"; title.textContent = presentation.state === "actionable" ? "Pagos pendientes" : "Pagos pendientes del Count"; actions.append(title);
    presentation.suggestions.forEach((suggestion) => {
      const pays = suggestion.fromMemberId === myMemberId;
      const receives = suggestion.toMemberId === myMemberId;
      const label = pays ? "Pagale a " + nameOf(suggestion.toMemberId) : receives ? "Reclamale a " + nameOf(suggestion.fromMemberId) : nameOf(suggestion.fromMemberId) + " le paga a " + nameOf(suggestion.toMemberId);
      const card = document.createElement("button"); card.type = "button"; card.className = "settlement-card";
      card.innerHTML = '<span class="settlement-icon">' + (pays ? "↗" : receives ? "↙" : "↔") + '</span><span><strong>' + esc(label) + '</strong><small>' + formatMoney(suggestion.amountMinor, suggestion.currency) + '</small></span><span class="chevron">›</span>';
      if (!isReadOnly()) on(card, "click", () => openSettlementModal(suggestion)); else card.disabled = true;
      actions.append(card);
    });
  }
  const list = $("#balanceList"); list.replaceChildren();
  const currencies = balanceCurrencies(computed, state.count?.primaryCurrency || state.count?.defaultCurrency || DEFAULT_CURRENCY);
  activeMembers().forEach((member) => {
    const values = computed[member.id] || {};
    const amounts = currencies.map((currency) => {
      const amount = values[currency] || 0;
      return '<span class="' + (amount > 0 ? "positive" : amount < 0 ? "negative" : "") + '">' + (amount > 0 ? "+" : amount < 0 ? "−" : "") + formatMoney(Math.abs(amount), currency) + "</span>";
    }).join("");
    const card = document.createElement("article"); card.className = "balance-card";
    const name = memberName(member);
    card.innerHTML = '<span class="balance-avatar">' + esc(name.slice(0, 1).toUpperCase()) + '</span><span><strong>' + esc(name) + '</strong><small>' + (member.userId === state.user.uid ? "Vos" : "Integrante") + '</small></span><span class="balance-amount">' + amounts + "</span>";
    list.append(card);
  });
}

function putOptions(select, items, selected, empty) {
  if (!select) return;
  select.replaceChildren(); if (empty !== undefined) select.add(new Option(empty, ""));
  items.forEach((item) => select.add(new Option(item.name, item.id, false, item.id === selected)));
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
  } else active.forEach((category) => {
      const row = document.createElement("article"); row.className = "settings-row category-row";
      row.innerHTML = '<span>' + esc(categoryEmoji(category)) + '</span><span><strong>' + esc(category.name) + '</strong></span><span class="category-actions"><button class="category-icon-button" type="button" aria-label="Editar categoría">✎</button><button class="category-icon-button category-delete-button" type="button" aria-label="Eliminar categoría">×</button></span>';
      const buttons = row.querySelectorAll("button");
      on(buttons[0], "click", () => openCategoryModal(category));
      on(buttons[1], "click", () => deleteCategory(category));
      categories.append(row);
    });
  renderAdmin();
}

function renderAdmin() {
  const section = $("#adminSection");
  section.hidden = !isAdmin();
  if (!isAdmin()) return;
  const pending = state.accessUsers.filter((user) => user.accessStatus === "pending");
  $("#adminPendingBadge").hidden = pending.length === 0;
  document.querySelectorAll("[data-admin-tab]").forEach((button) => button.classList.toggle("is-selected", button.dataset.adminTab === state.adminTab));
  const list = $("#adminUserList"); list.replaceChildren();
  const users = state.accessUsers.filter((user) => user.accessStatus === state.adminTab).sort((a, b) => String(a.googleDisplayName || a.email).localeCompare(String(b.googleDisplayName || b.email), "es"));
  if (!users.length) { list.innerHTML = '<div class="empty-category-row">No hay usuarios en esta sección.</div>'; return; }
  users.forEach((user) => {
    const row = document.createElement("button"); row.type = "button"; row.className = "settings-row admin-user-row";
    const status = user.accessStatus === "pending" ? "Pendiente" : user.accessStatus === "blocked" ? "Bloqueado" : "Activo";
    row.innerHTML = '<span class="member-avatar">' + esc((user.googleDisplayName || user.email || "U").slice(0, 1).toUpperCase()) + '</span><span><strong>' + esc(user.googleDisplayName || "Sin nombre") + '</strong><small>' + esc(user.email || "") + '</small></span><span class="status-tag ' + (user.accessStatus === "blocked" ? "is-blocked" : "") + '">' + status + '</span>';
    on(row, "click", () => openAdminUser(user)); list.append(row);
  });
}

function openAdminUser(user) {
  state.adminUser = user;
  $("#adminUserName").textContent = user.googleDisplayName || "Sin nombre";
  $("#adminUserEmail").textContent = user.email || "Sin email";
  $("#adminUserDetails").innerHTML = '<div><dt>UID</dt><dd>' + esc(user.uid) + '</dd></div><div><dt>Solicitado</dt><dd>' + prettyDate(user.requestedAt) + '</dd></div><div><dt>Último intento</dt><dd>' + prettyDate(user.lastLoginAttemptAt || user.lastLoginAt) + '</dd></div><div><dt>Estado</dt><dd>' + esc(user.accessStatus || "pending") + '</dd></div>';
  $("#adminUserError").hidden = true;
  const actions = $("#adminUserActions"); actions.replaceChildren();
  if (user.uid !== ADMIN_UID) {
    if (user.accessStatus === "pending") {
      const reject = document.createElement("button"); reject.type = "button"; reject.className = "danger-button"; reject.textContent = "Rechazar"; on(reject, "click", () => changeUserAccess("blocked", reject)); actions.append(reject);
      const approve = document.createElement("button"); approve.type = "button"; approve.className = "primary-button"; approve.textContent = "Aprobar"; on(approve, "click", () => changeUserAccess("approved", approve)); actions.append(approve);
    } else if (user.accessStatus === "approved") {
      const block = document.createElement("button"); block.type = "button"; block.className = "danger-button"; block.textContent = "Bloquear"; on(block, "click", () => changeUserAccess("blocked", block)); actions.append(block);
    } else {
      const approve = document.createElement("button"); approve.type = "button"; approve.className = "primary-button"; approve.textContent = "Volver a aprobar"; on(approve, "click", () => changeUserAccess("approved", approve)); actions.append(approve);
    }
  }
  dialogs.adminUserModal.showModal();
}

async function changeUserAccess(status, button) {
  const user = state.adminUser; if (!user) return;
  if (status === "blocked" && !confirm("¿Bloquear a " + (user.googleDisplayName || user.email) + "?\n\nEsta cuenta no podrá acceder a TruchiCount hasta que la vuelvas a aprobar.")) return;
  const label = button.textContent;
  $("#adminUserError").hidden = true; setBusy(button, true, label);
  try { await updateUserAccess({ target: user, status, actor: state.user }); dialogs.adminUserModal.close(); }
  catch (exception) { error($("#adminUserError"), exception, "No pudimos actualizar el acceso."); setBusy(button, false, label); }
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

function draftMemberName(member) {
  return member.type === "manual" ? member.alias : state.profile?.alias || state.profile?.googleDisplayName || state.user?.displayName || state.user?.email || "Vos";
}
function draftInviteUrl() {
  const url = new URL(location.href); url.pathname = "/j/" + state.draft.draftInviteToken; url.search = ""; url.hash = ""; return url.toString();
}
function renderCurrencyChoices(container, name, selected) {
  container.replaceChildren();
  Object.values(CURRENCIES).forEach((currency) => {
    const row = document.createElement("label"); row.className = "currency-choice";
    row.innerHTML = '<input type="radio" name="' + name + '" value="' + currency.code + '" ' + (currency.code === selected ? "checked" : "") + ' /><span><strong>' + currency.code + '</strong><small>' + esc(currency.name) + '</small></span>';
    container.append(row);
  });
}
function renderDraftMembers() {
  const list = $("#draftMemberList"); list.replaceChildren();
  state.draftMembers.filter((member) => member.active).forEach((member) => {
    const row = document.createElement("article"); row.className = "member-row";
    const name = draftMemberName(member);
    row.innerHTML = '<span class="member-avatar">' + esc(name.slice(0, 1).toUpperCase()) + '</span><span><strong>' + esc(name) + '</strong><small>' + (member.type === "manual" ? "Manual" : "Creador") + '</small></span>';
    if (member.type === "manual") {
      const actions = document.createElement("span"); actions.className = "draft-member-actions";
      const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Editar"; on(edit, "click", () => openDraftMemberModal(member));
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "draft-remove-button"; remove.textContent = "Quitar"; on(remove, "click", () => removeDraftMember(member));
      actions.append(edit, remove); row.append(actions);
    } else row.insertAdjacentHTML("beforeend", '<span class="status-tag">Creador</span>');
    list.append(row);
  });
}
function renderCountWizard() {
  if (!state.draft) return;
  const step = state.draftStep;
  $("#countStepLabel").textContent = "Paso " + step + " de 4";
  document.querySelectorAll("[data-wizard-step]").forEach((item) => item.classList.toggle("is-active", Number(item.dataset.wizardStep) <= step));
  document.querySelectorAll("[data-wizard-panel]").forEach((panel) => { panel.hidden = Number(panel.dataset.wizardPanel) !== step; });
  $("#countBackButton").hidden = step === 1;
  $("#countNextButton").hidden = step === 4;
  $("#countCreateButton").hidden = step !== 4;
  if (step === 1) $("#countName").value = state.draft.name || "";
  if (step === 2) { renderDraftMembers(); $("#draftInviteLink").value = draftInviteUrl(); $("#draftInviteStatus").hidden = true; }
  if (step === 3) renderCurrencyChoices($("#draftCurrencyChoices"), "draftCurrency", state.draft.primaryCurrency || state.profile?.defaultCurrency || DEFAULT_CURRENCY);
  if (step === 4) {
    $("#countConfirmSummary").innerHTML = '<div><dt>Nombre</dt><dd>' + esc(state.draft.name) + '</dd></div><div><dt>Participantes</dt><dd>' + state.draftMembers.filter((member) => member.active).map(draftMemberName).map(esc).join(", ") + '</dd></div><div><dt>Moneda principal</dt><dd>' + esc(state.draft.primaryCurrency || "—") + '</dd></div>';
    $("#countConfirmInvite").value = draftInviteUrl();
  }
}
async function refreshDraftMembers() { state.draftMembers = await getDraftMembers(state.draft.id); renderCountWizard(); }
async function openCountModal() {
  if (!state.user) return;
  const trigger = $("#newCountButton"); if (trigger) trigger.disabled = true;
  try {
    state.draft = await startCountDraft({ user: state.user });
    state.draft.primaryCurrency = state.profile?.defaultCurrency || DEFAULT_CURRENCY;
    state.draftMembers = await getDraftMembers(state.draft.id);
    state.draftStep = 1; $("#countError").hidden = true; renderCountWizard(); dialogs.countModal.showModal();
  } catch (exception) { console.error(exception); showToast("No pudimos iniciar el nuevo Count."); }
  finally { if (trigger) trigger.disabled = false; }
}
async function advanceCountWizard() {
  if (!state.draft) return;
  $("#countError").hidden = true;
  try {
    if (state.draftStep === 1) Object.assign(state.draft, await saveDraftName({ countId: state.draft.id, name: $("#countName").value, actor: state.user, existingCounts: state.counts }));
    if (state.draftStep === 3) {
      const currency = document.querySelector("[name='draftCurrency']:checked")?.value;
      await saveDraftCurrency({ countId: state.draft.id, currency, actor: state.user }); state.draft.primaryCurrency = currency;
    }
    state.draftStep += 1; renderCountWizard();
  } catch (exception) { error($("#countError"), exception, "Revisá los datos para continuar."); }
}
function backCountWizard() { if (state.draft && state.draftStep > 1) { state.draftStep -= 1; $("#countError").hidden = true; renderCountWizard(); } }
async function copyDraftInvite(input, status) {
  try { await navigator.clipboard.writeText(input.value); if (status) { status.textContent = "Link copiado."; status.hidden = false; } }
  catch { if (status) { status.textContent = "Copialo manualmente desde el campo."; status.hidden = false; } }
}
function openDraftMemberModal(member = null) {
  state.draftEditing = member; const form = $("#draftMemberForm"); form.reset();
  $("#draftMemberTitle").textContent = member ? "Editar alias" : "Agregar integrante";
  form.elements.alias.value = member?.alias || ""; $("#draftMemberError").hidden = true; dialogs.draftMemberModal.showModal();
}
async function removeDraftMember(member) {
  try { await removeDraftManualMember({ countId: state.draft.id, member, actor: state.user }); await refreshDraftMembers(); }
  catch (exception) { error($("#countError"), exception, "No pudimos quitar el integrante."); }
}
async function cancelCountWizard() {
  if (state.draft && state.user) {
    try { await clearCurrentDraft(state.user, { includeRecent: true }); }
    catch (exception) { console.error(exception); showToast("No pudimos limpiar el borrador."); return; }
  }
  state.draft = null; state.draftMembers = []; dialogs.countModal.close();
}
async function finalizeCountWizard() {
  if (!state.draft) return;
  const button = $("#countCreateButton"); $("#countError").hidden = true; setBusy(button, true, "Crear Count", "Creando Count…");
  try {
    const id = await finalizeCountDraft({ countId: state.draft.id, actor: state.user });
    state.draft = null; state.draftMembers = []; dialogs.countModal.close(); openCount(id);
  } catch (exception) { error($("#countError"), exception, "No pudimos crear el Count. Intentá nuevamente."); }
  finally { setBusy(button, false, "Crear Count"); }
}
function openExpenseModal(expense) {
  if (isReadOnly()) return;
  if (!activeMembers().length || !activeCategories().length) return;
  state.editing = expense || null; $("#expenseForm").reset(); $("#expenseError").hidden = true;
  $("#expenseModalTitle").textContent = expense ? "Editar gasto" : "Nuevo gasto";
  const primaryCurrency = state.count?.primaryCurrency || state.count?.defaultCurrency || DEFAULT_CURRENCY;
  const enabled = [...new Set([...(state.profile?.enabledCurrencies || [DEFAULT_CURRENCY]), primaryCurrency])];
  putOptions($("#expenseCurrency"), enabled.map((code) => ({ id: code, name: code })), expense?.currency || primaryCurrency);
  const categories = activeCategories();
  putOptions($("#expenseCategory"), categories.map((item) => ({ id: item.id, name: categoryEmoji(item) + " " + item.name })), expense?.categoryId || categories[0].id);
  const members = activeMembers();
  const myMemberId = members.find((member) => member.type === "registered" && member.userId === state.user?.uid)?.id;
  putOptions($("#expensePayer"), members.map((item) => ({ id: item.id, name: memberName(item) })), expense?.payerMemberId || myMemberId);
  const checks = $("#participantChecks"); checks.replaceChildren();
  members.forEach((member) => {
    const selected = expense ? expense.participantMemberIds.includes(member.id) : true;
    const row = document.createElement("label"); row.className = "participant-row";
    row.innerHTML = '<input type="checkbox" name="participant" value="' + member.id + '" ' + (selected ? "checked" : "") + '/><span>' + esc(memberName(member)) + '</span><span class="checkmark">✓</span>';
    checks.append(row);
  });
  const form = $("#expenseForm");
  form.elements.title.value = expense?.title || ""; form.elements.merchant.value = expense?.merchantNameSnapshot || "";
  form.elements.amount.value = expense ? formatMoneyPlain(expense.amountMinor) : ""; form.elements.expenseDate.value = expense ? dateISO(expense.expenseDate) : new Date().toISOString().slice(0, 10); form.elements.notes.value = expense?.notes || "";
  renderMerchantOptions(); updateSplitPreview(); dialogs.expenseModal.showModal();
}
function renderMerchantOptions() { const list = $("#merchantOptions"); if (!list) return; list.replaceChildren(); state.merchants.slice(0, 50).forEach((merchant) => list.append(new Option(merchant.name))); }
function updateSplitPreview() {
  const selected = document.querySelectorAll("[name='participant']:checked").length;
  const parsed = tryParseMoney($("#expenseForm").elements.amount.value);
  if (!selected) $("#splitPreview").textContent = "Elegí al menos una persona";
  else if (!parsed.ok) $("#splitPreview").textContent = "Ingresá un monto válido";
  else $("#splitPreview").textContent = formatMoney(Math.floor(parsed.value / selected), $("#expenseCurrency").value) + (parsed.value % selected ? " cada uno · se reparte 1 centavo de diferencia" : " cada uno");
}
function openExpenseDetail(expense) {
  state.selectedExpense = expense;
  const participants = expense.participantMemberIds.map(nameOf).map(esc).join(", ");
  const category = categoryDisplay(expense.categoryId, expense.categoryNameSnapshot);
  $("#expenseDetailContent").innerHTML = '<p class="eyebrow">' + esc(category.emoji) + " " + esc(category.name) + '</p><h2>' + esc(expense.title) + '</h2><p class="expense-detail-amount">' + formatMoney(expense.amountMinor, expense.currency) + '</p><dl class="details-list"><div><dt>Comercio</dt><dd>' + esc(expense.merchantNameSnapshot || "—") + '</dd></div><div><dt>Pagó</dt><dd>' + esc(nameOf(expense.payerMemberId)) + '</dd></div><div><dt>Fecha</dt><dd>' + prettyDate(expense.expenseDate) + '</dd></div><div><dt>Dividido entre</dt><dd>' + participants + "</dd></div>" + (expense.notes ? "<div><dt>Notas</dt><dd>" + esc(expense.notes) + "</dd></div>" : "") + "</dl>";
  $("#editExpenseButton").hidden = isReadOnly();
  $("#deleteExpenseButton").hidden = isReadOnly();
  dialogs.expenseDetailModal.showModal();
}
function openSettlementModal(suggestion) {
  if (isReadOnly()) return;
  state.selectedSettlement = suggestion;
  $("#settlementContent").innerHTML = '<p class="eyebrow">Liquidación</p><h2>' + esc(nameOf(suggestion.fromMemberId)) + " le paga a " + esc(nameOf(suggestion.toMemberId)) + '</h2><p class="expense-detail-amount">' + formatMoney(suggestion.amountMinor, suggestion.currency) + '</p><p class="section-copy">Esto registra un pago real y actualiza los balances.</p>';
  const myMemberId = activeMembers().find((member) => member.type === "registered" && member.userId === state.user?.uid)?.id;
  $("#confirmSettlementButton").textContent = myMemberId === suggestion.fromMemberId ? "Marcar como pagado" : "Marcar como saldado"; dialogs.settlementModal.showModal();
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
  const manageMembersAction = $("#manageMembersAction");
  if (manageMembersAction) manageMembersAction.hidden = archived;
  const changeCurrency = $("#changePrimaryCurrencyAction");
  if (changeCurrency) {
    const locked = Boolean(state.count?.hasMovements) || state.expenses.length > 0 || state.settlements.length > 0;
    changeCurrency.hidden = archived;
    changeCurrency.disabled = locked;
    changeCurrency.title = locked ? "La moneda principal queda fija después del primer movimiento." : "";
  }
  $("#archiveCountAction").hidden = archived;
  $("#unarchiveCountAction").hidden = !archived;
  $("#archiveCountAction").disabled = !archived && pending.length > 0;
  $("#archiveAvailability").hidden = archived || pending.length === 0;
  $("#archiveAvailability").textContent = pending.length === 1
    ? "No se puede archivar porque todavía hay saldo pendiente en " + pending[0] + "."
    : "No se puede archivar porque todavía hay saldos pendientes.";
  dialogs.countActionsModal.showModal();
}

function openPrimaryCurrencyModal() {
  if (!state.count || state.count.hasMovements || state.expenses.length || state.settlements.length) return;
  renderCurrencyChoices($("#primaryCurrencyChoices"), "primaryCurrency", state.count.primaryCurrency || state.count.defaultCurrency || DEFAULT_CURRENCY);
  $("#primaryCurrencyError").hidden = true; dialogs.primaryCurrencyModal.showModal();
}

function memberRoleLabel(member) {
  if (member.type === "manual") return "Manual";
  return member.role === "owner" ? "Owner" : "Integrante";
}

function renderMemberList() {
  const list = $("#memberList");
  list.replaceChildren();
  const members = activeMembers();
  if (!members.length) {
    list.innerHTML = '<div class="empty-category-row">Todavía no hay integrantes activos.</div>';
    return;
  }
  members.forEach((member) => {
    const row = document.createElement("article");
    row.className = "member-row member-row-action";
    const name = memberName(member);
    row.innerHTML = '<span class="member-avatar">' + esc(name.slice(0, 1).toUpperCase()) + '</span><span><strong>' + esc(name) + '</strong><small>' + memberRoleLabel(member) + '</small></span><span class="chevron">›</span>';
    on(row, "click", () => openMemberActions(member));
    list.append(row);
  });
}

function openMemberModal() {
  dialogs.countActionsModal.close();
  $("#memberError").hidden = true;
  renderMemberList();
  $("#memberAddButton").disabled = isReadOnly();
  dialogs.memberModal.showModal();
}

function memberRemovalReason(member) {
  if (isReadOnly()) return "Este Count está archivado.";
  if (!canManageMembers()) return "No tenés permisos para modificar integrantes.";
  if (Object.values(balances()[member.id] || {}).some((amount) => amount !== 0)) return "Este integrante debe tener saldo $0 en todas las monedas para poder quitarlo.";
  if (member.type === "registered" && activeMembers().filter((item) => item.type === "registered").length < 2) return "No podés quitar al último usuario registrado del Count porque nadie podría administrarlo.";
  return "";
}

function openMemberActions(member) {
  state.memberEditing = member;
  $("#memberActionTitle").textContent = memberName(member);
  $("#editManualMemberAction").hidden = member.type !== "manual" || isReadOnly() || !canManageMembers();
  $("#correctMemberLinkAction").hidden = !isAdmin() || member.type !== "registered" || isReadOnly();
  const remove = $("#removeMemberAction");
  const reason = memberRemovalReason(member);
  remove.disabled = Boolean(reason);
  $("#memberActionReason").textContent = reason;
  $("#memberActionReason").hidden = !reason;
  dialogs.memberActionModal.showModal();
}

function openMemberCorrection(member) {
  if (!isAdmin() || member?.type !== "registered" || isReadOnly()) return;
  state.memberCorrection = member;
  const list = $("#memberCorrectionList"); list.replaceChildren();
  activeMembers().filter((item) => item.type === "manual" && item.userId == null).forEach((candidate) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "member-row member-row-action";
    const name = memberName(candidate);
    button.innerHTML = '<span class="member-avatar">' + esc(name.slice(0, 1).toUpperCase()) + '</span><span><strong>' + esc(name) + '</strong></span><span class="chevron">›</span>';
    on(button, "click", () => confirmMemberCorrection(candidate)); list.append(button);
  });
  $("#memberCorrectionError").hidden = true;
  dialogs.memberActionModal.close(); dialogs.memberCorrectionModal.showModal();
}

async function confirmMemberCorrection(target = null) {
  const source = state.memberCorrection; if (!source || !state.count) return;
  if (!confirm("¿Corregir esta vinculación?\n\nEsta acción cambiará qué integrante representa esta cuenta dentro del Count. Los movimientos históricos de cada integrante se conservarán.")) return;
  $("#memberCorrectionError").hidden = true;
  try {
    await correctMemberLink({ countId: state.count.id, member: source, targetManualId: target?.id || null, actor: state.user });
    dialogs.memberCorrectionModal.close(); dialogs.memberModal.close(); state.memberCorrection = null;
    showToast("✓ Vinculación corregida");
  } catch (exception) { error($("#memberCorrectionError"), exception, "No pudimos corregir la vinculación."); }
}

function openManualMemberModal(member = null) {
  state.memberEditing = member;
  $("#manualMemberForm").reset();
  $("#manualMemberTitle").textContent = member ? "Editar alias" : "Agregar integrante";
  $("#manualMemberForm").elements.alias.value = member?.alias || "";
  $("#manualMemberError").hidden = true;
  dialogs.manualMemberModal.showModal();
  $("#manualMemberForm").elements.alias.focus();
}

async function removeMember(member, button) {
  if (!confirm("¿Quitar a " + memberName(member) + " del Count?\n\nSi tiene movimientos históricos, se conservarán.")) return;
  $("#memberActionReason").hidden = true;
  setBusy(button, true, "Quitar integrante");
  try {
    await removeCountMember({ countId: state.count.id, member, actor: state.user });
    dialogs.memberActionModal.close(); dialogs.memberModal.close();
    showToast("✓ Integrante quitado");
  } catch (exception) {
    error($("#memberActionReason"), exception, "No pudimos quitar al integrante.");
    setBusy(button, false, "Quitar integrante");
  }
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
on($("#retryAccessButton"), "click", async () => { if (!state.user) return; try { await ensureUser(state.user); } catch (exception) { console.error(exception); } });
on($("#pendingLogoutButton"), "click", () => signOutUser()); on($("#blockedLogoutButton"), "click", () => signOutUser());
on($("#homeButton"), "click", () => showScreen("home")); on($("#backButton"), "click", () => showScreen("home")); on($("#settingsButton"), "click", () => showScreen("settings")); on($("#settingsBackButton"), "click", () => showScreen("home")); on($("#newCountButton"), "click", openCountModal); on($("#addExpenseButton"), "click", () => openExpenseModal()); on($("#shareButton"), "click", openInviteModal); on($("#countActionsButton"), "click", openCountActions); on($("#manageMembersAction"), "click", openMemberModal);
on($("#countCloseButton"), "click", cancelCountWizard); on($("#countCancelButton"), "click", cancelCountWizard); on($("#countBackButton"), "click", backCountWizard); on($("#countNextButton"), "click", advanceCountWizard); on($("#countCreateButton"), "click", finalizeCountWizard);
on($("#draftAddMemberButton"), "click", () => openDraftMemberModal()); on($("#copyDraftInviteButton"), "click", () => copyDraftInvite($("#draftInviteLink"), $("#draftInviteStatus"))); on($("#copyConfirmInviteButton"), "click", () => copyDraftInvite($("#countConfirmInvite")));
on($("#inviteNoneButton"), "click", () => chooseInviteIdentity());
on($("#changePrimaryCurrencyAction"), "click", () => { dialogs.countActionsModal.close(); openPrimaryCurrencyModal(); });
on($("#memberAddButton"), "click", () => dialogs.memberChoiceModal.showModal());
on($("#inviteMemberChoice"), "click", () => { dialogs.memberChoiceModal.close(); dialogs.memberModal.close(); openInviteModal(); });
on($("#manualMemberChoice"), "click", () => { dialogs.memberChoiceModal.close(); openManualMemberModal(); });
on($("#editManualMemberAction"), "click", () => { dialogs.memberActionModal.close(); openManualMemberModal(state.memberEditing); });
on($("#correctMemberLinkAction"), "click", () => openMemberCorrection(state.memberEditing));
on($("#memberCorrectionNone"), "click", () => confirmMemberCorrection());
on($("#removeMemberAction"), "click", () => removeMember(state.memberEditing, $("#removeMemberAction")));
on($("#newCategoryButton"), "click", () => openCategoryModal());
on($("#emojiPickerButton"), "click", openEmojiPicker);
on($("#accountButton"), "click", () => { $("#accountName").value = state.profile?.alias || state.profile?.googleDisplayName || state.profile?.displayName || state.user?.displayName || ""; $("#accountEmail").textContent = state.user.email || ""; $("#accountError").hidden = true; dialogs.accountModal.showModal(); });
document.querySelectorAll("[data-close]").forEach((button) => on(button, "click", () => dialogs[button.dataset.close].close()));
document.querySelectorAll("[data-tab]").forEach((button) => on(button, "click", () => { document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("is-selected", item === button)); document.querySelectorAll(".tab-panel").forEach((item) => item.classList.toggle("is-active", item.id === button.dataset.tab + "Panel")); }));
document.querySelectorAll("[data-count-tab]").forEach((button) => on(button, "click", () => { state.homeTab = button.dataset.countTab; renderHome(); }));
document.querySelectorAll("[data-admin-tab]").forEach((button) => on(button, "click", () => { state.adminTab = button.dataset.adminTab; renderAdmin(); }));
on($("#expenseForm"), "input", updateSplitPreview); on($("#expenseForm"), "change", updateSplitPreview);

on($("#draftMemberForm"), "submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; const button = event.submitter; const member = state.draftEditing;
  $("#draftMemberError").hidden = true; setBusy(button, true, member ? "Guardar" : "Agregar");
  try {
    if (member) await updateDraftManualMember({ countId: state.draft.id, member, alias: form.elements.alias.value, actor: state.user });
    else await createDraftManualMember({ countId: state.draft.id, alias: form.elements.alias.value, actor: state.user });
    dialogs.draftMemberModal.close(); await refreshDraftMembers();
  } catch (exception) { error($("#draftMemberError"), exception, "No pudimos guardar el integrante."); }
  finally { setBusy(button, false, member ? "Guardar" : "Agregar"); }
});
on($("#primaryCurrencyForm"), "submit", async (event) => {
  event.preventDefault(); const button = event.submitter; const currency = document.querySelector("[name='primaryCurrency']:checked")?.value;
  $("#primaryCurrencyError").hidden = true; setBusy(button, true, "Guardar");
  try { await updateCountPrimaryCurrency({ countId: state.count.id, currency, actor: state.user }); dialogs.primaryCurrencyModal.close(); showToast("✓ Moneda principal actualizada"); }
  catch (exception) { error($("#primaryCurrencyError"), exception, "No pudimos cambiar la moneda principal."); }
  finally { setBusy(button, false, "Guardar"); }
});
on(dialogs.countModal, "cancel", (event) => { event.preventDefault(); cancelCountWizard(); });
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
  event.preventDefault(); const form = event.currentTarget; const participants = [...form.querySelectorAll("[name='participant']:checked")].map((input) => input.value); const parsedAmount = tryParseMoney(form.elements.amount.value); const amountMinor = parsedAmount.value; const button = $("#saveExpenseButton"); $("#expenseError").hidden = true;
  if (!participants.length || !parsedAmount.ok || amountMinor <= 0) { $("#expenseError").textContent = !participants.length ? "Elegí al menos una persona." : parsedAmount.error?.message || "El monto tiene que ser mayor a cero."; $("#expenseError").hidden = false; return; }
  setBusy(button, true, state.editing ? "Guardar cambios" : "Guardar gasto");
  try {
    await saveExpense({ countId: state.count.id, form: { title: form.elements.title.value, merchantName: form.elements.merchant.value, amountMinor, currency: form.elements.currency.value, expenseDate: form.elements.expenseDate.value, categoryId: form.elements.category.value, payerMemberId: form.elements.payer.value, participantMemberIds: participants, notes: form.elements.notes.value }, members: state.members, categories: state.categories, actor: state.user, expenseId: state.editing?.id, before: state.editing });
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
on($("#manualMemberForm"), "submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget; const button = event.submitter; const member = state.memberEditing;
  $("#manualMemberError").hidden = true;
  setBusy(button, true, member ? "Guardar" : "Agregar");
  try {
    if (member) {
      await updateManualMember({ countId: state.count.id, member, alias: form.elements.alias.value, actor: state.user });
      showToast("✓ Alias actualizado");
    } else {
      const result = await createManualMember({ countId: state.count.id, alias: form.elements.alias.value, actor: state.user });
      showToast(result.reactivated ? "✓ " + form.elements.alias.value.trim() + " fue reactivada." : "✓ Integrante manual agregado");
    }
    dialogs.manualMemberModal.close();
  } catch (exception) { error($("#manualMemberError"), exception, "No pudimos guardar el integrante."); }
  finally { setBusy(button, false, member ? "Guardar" : "Agregar"); }
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
on($("#accountForm"), "submit", async (event) => { event.preventDefault(); const name = $("#accountName").value.trim(); const button = event.submitter; if (!name) return; $("#accountError").hidden = true; setBusy(button, true, "Guardar"); try { await updateUserSettings(state.user.uid, { alias: name }); dialogs.accountModal.close(); } catch (exception) { error($("#accountError"), exception, "No pudimos guardar el alias."); } finally { setBusy(button, false, "Guardar"); } });
on($("#logoutButton"), "click", async () => { if (confirm("¿Querés cerrar sesión?")) await signOutUser(); });
