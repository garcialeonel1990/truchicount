import {
  completeRedirectSignIn,
  getProjectInvite,
  requestProjectAccess,
  reviewProjectAccess,
  saveProjectInvite,
  signInWithGoogle,
  signOutUser,
  updateUserProfile,
  watchAuth,
  watchProjectJoinRequests,
} from "./firebase-auth.js";

const storageKey = "truchicount:v1";

const defaultSettings = {
  categories: [
    { id: "groceries", name: "Groceries", emoji: "🛒" },
    { id: "restaurants-bars", name: "Restaurants & Bars", emoji: "🍔" },
    { id: "rent-charges", name: "Rent & Charges", emoji: "🏠" },
    { id: "pet", name: "Pet", emoji: "🐾" },
    { id: "transport", name: "Transport", emoji: "🚕" },
    { id: "other", name: "Other", emoji: "✋" },
  ],
  currencies: [
    { code: "ARS", name: "Argentine Peso", symbol: "$" },
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  ],
};

const exampleState = {
  currentUserId: "leo",
  activeProjectId: "depto-mayo-26",
  settings: cloneData(defaultSettings),
  projects: [
    {
      id: "depto-julio-26",
      name: "Depto - Julio '26",
      defaultCurrency: "ARS",
      archived: false,
      members: [
        { id: "leo", name: "Leo", isMe: true },
        { id: "aldu", name: "Aldu", isMe: false },
      ],
      expenses: [],
    },
    {
      id: "depto-junio-26",
      name: "Depto - Junio '26",
      defaultCurrency: "ARS",
      archived: false,
      members: [
        { id: "leo", name: "Leo", isMe: true },
        { id: "aldu", name: "Aldu", isMe: false },
      ],
      expenses: [],
    },
    {
      id: "depto-mayo-26",
      name: "Dpto - Mayo '26",
      defaultCurrency: "ARS",
      archived: false,
      members: [
        { id: "leo", name: "Leo", isMe: true },
        { id: "aldu", name: "Aldu", isMe: false },
      ],
      expenses: [
        {
          id: "e1",
          title: "Jumbo",
          category: "Groceries",
          amount: 21920.4,
          currency: "ARS",
          paidBy: "leo",
          date: "2026-05-30",
          splitWith: ["leo", "aldu"],
        },
        {
          id: "e2",
          title: "Pasto apo",
          category: "Other",
          amount: 52995,
          currency: "ARS",
          paidBy: "aldu",
          date: "2026-05-14",
          splitWith: ["leo", "aldu"],
        },
        {
          id: "e3",
          title: "Mc",
          category: "Restaurants & Bars",
          amount: 44600,
          currency: "ARS",
          paidBy: "aldu",
          date: "2026-05-01",
          splitWith: ["leo", "aldu"],
        },
      ],
    },
  ],
};

let state = loadState();
let activeTab = "expenses";
let detailReturnView = "home";
let authUser = null;
let pendingInvite = readInviteFromUrl();
let joinRequestUnsubscribers = [];
let unsubscribePendingAccess = null;
let activeJoinRequests = [];

const loginScreen = document.querySelector("#loginScreen");
const googleLoginButton = document.querySelector("#googleLoginButton");
const authError = document.querySelector("#authError");
const appShell = document.querySelector(".app-shell");
const homeScreen = document.querySelector("#homeScreen");
const detailScreen = document.querySelector("#detailScreen");
const settingsScreen = document.querySelector("#settingsScreen");
const archivedScreen = document.querySelector("#archivedScreen");
const projectList = document.querySelector("#projectList");
const archivedProjectList = document.querySelector("#archivedProjectList");
const expenseList = document.querySelector("#expenseList");
const balanceList = document.querySelector("#balanceList");
const settlementCard = document.querySelector("#settlementCard");
const categoryList = document.querySelector("#categoryList");
const currencyList = document.querySelector("#currencyList");
const projectModal = document.querySelector("#projectModal");
const projectSettingsModal = document.querySelector("#projectSettingsModal");
const expenseModal = document.querySelector("#expenseModal");
const projectForm = document.querySelector("#projectForm");
const projectSettingsForm = document.querySelector("#projectSettingsForm");
const accountModal = document.querySelector("#accountModal");
const accountForm = document.querySelector("#accountForm");
const accountName = document.querySelector("#accountName");
const accountEmail = document.querySelector("#accountEmail");
const accountError = document.querySelector("#accountError");
const inviteModal = document.querySelector("#inviteModal");
const inviteProjectTitle = document.querySelector("#inviteProjectTitle");
const inviteMemberOptions = document.querySelector("#inviteMemberOptions");
const inviteError = document.querySelector("#inviteError");
const pendingAccessModal = document.querySelector("#pendingAccessModal");
const pendingAccessText = document.querySelector("#pendingAccessText");
const expenseForm = document.querySelector("#expenseForm");
const categoryForm = document.querySelector("#categoryForm");
const currencyForm = document.querySelector("#currencyForm");
const paidBySelect = document.querySelector("#paidBySelect");
const splitMembers = document.querySelector("#splitMembers");
const splitError = document.querySelector("#splitError");
const scanReceiptButton = document.querySelector("#scanReceiptButton");
const receiptInput = document.querySelector("#receiptInput");
const scanStatus = document.querySelector("#scanStatus");
const projectParticipants = document.querySelector("#projectParticipants");
const projectError = document.querySelector("#projectError");
const editProjectParticipants = document.querySelector("#editProjectParticipants");
const projectSettingsError = document.querySelector("#projectSettingsError");
const projectCurrencySelect = document.querySelector("#projectCurrencySelect");
const editProjectCurrencySelect = document.querySelector("#editProjectCurrencySelect");
const expenseCurrencySelect = document.querySelector("#expenseCurrencySelect");
const categorySelect = document.querySelector("#categorySelect");
const addExpenseButton = document.querySelector("#addExpenseButton");
const detailStatus = document.querySelector("#detailStatus");
const accountButton = document.querySelector("#accountButton");
const signOutButton = document.querySelector("#signOutButton");
const copyInviteButton = document.querySelector("#copyInviteButton");
const whatsappInviteButton = document.querySelector("#whatsappInviteButton");
const inviteLinkStatus = document.querySelector("#inviteLinkStatus");
const accountApprovalSection = document.querySelector("#accountApprovalSection");
const approvalRequestList = document.querySelector("#approvalRequestList");
const approvalStatus = document.querySelector("#approvalStatus");
const pendingSignOutButton = document.querySelector("#pendingSignOutButton");

function on(element, eventName, handler) {
  if (!element) return;
  element.addEventListener(eventName, handler);
}

on(googleLoginButton, "click", handleGoogleLogin);
on(accountButton, "click", openAccountModal);
on(accountForm, "submit", handleProfileSave);
on(signOutButton, "click", handleSignOut);
on(pendingSignOutButton, "click", handleSignOut);
on(document.querySelector("#newProjectButton"), "click", openProjectModal);
on(document.querySelector("[data-close-project]"), "click", () => projectModal.close());
on(document.querySelector("[data-close-project-settings]"), "click", () => {
  projectSettingsModal.close();
});
on(document.querySelector("[data-close-account]"), "click", () => {
  stopJoinRequestWatch();
  accountModal.close();
});
on(document.querySelector("[data-close-expense]"), "click", () => expenseModal.close());
on(document.querySelector("#backButton"), "click", returnFromDetail);
on(document.querySelector("#settingsBackButton"), "click", showHome);
on(document.querySelector("#archivedBackButton"), "click", showHome);
on(addExpenseButton, "click", openExpenseModal);
on(document.querySelector("#menuButton"), "click", openProjectSettingsModal);
on(document.querySelector("#archiveProjectButton"), "click", toggleActiveProjectArchive);
on(copyInviteButton, "click", copyInviteLink);
on(whatsappInviteButton, "click", shareInviteByWhatsapp);
on(scanReceiptButton, "click", () => receiptInput?.click());
on(receiptInput, "change", handleReceiptImage);
on(document.querySelector("#addProjectParticipant"), "click", () => addParticipantRow());
on(document.querySelector("#addEditProjectParticipant"), "click", () => addEditParticipantRow());

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.view === "settings") showSettings();
    if (button.dataset.view === "archived") showArchived();
    if (button.dataset.view === "home") showHome();
  });
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    activeTab = button.dataset.tab;
    renderDetail();
  });
});

completeRedirectSignIn().catch(showAuthError);
watchAuth((user) => {
  authUser = user;
  renderAuthState();
});

projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(projectForm);
  const memberNames = getProjectParticipantNames();
  const usedMemberIds = [];
  const members = memberNames.map((name, index) => {
    const id = uniqueSettingId(slugify(name) || `member-${index + 1}`, usedMemberIds);
    usedMemberIds.push(id);
    return {
      id,
      name,
      isMe: index === 0,
    };
  });

  const project = {
    id: uniqueId(),
    name: data.get("name").trim(),
    defaultCurrency: data.get("currency"),
    archived: false,
    adminUid: authUser?.uid ?? "",
    memberLinks: {},
    members,
    expenses: [],
  };

  if (members.length < 2) {
    projectError.textContent = "Agrega al menos dos participantes.";
    projectError.hidden = false;
    return;
  }

  state.projects.unshift(project);
  state.currentUserId = members[0].id;
  linkCurrentUserToMember(project, members[0].id);
  state.activeProjectId = project.id;
  saveState();
  projectForm.reset();
  projectModal.close();
  showDetail(project.id);
});

projectSettingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const project = getActiveProject();
  const data = new FormData(projectSettingsForm);
  const members = getEditedMembers(project);

  if (members.length < 2) {
    projectSettingsError.textContent = "El truchicount necesita al menos dos participantes.";
    projectSettingsError.hidden = false;
    return;
  }

  project.defaultCurrency = data.get("currency");
  project.members = members;
  state.currentUserId = members.find((member) => member.isMe)?.id ?? members[0].id;

  saveState();
  projectSettingsModal.close();
  renderDetail();
});

categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(categoryForm);
  const name = data.get("name").trim();
  const emoji = data.get("emoji").trim() || "🧾";
  const id = uniqueSettingId(slugify(name), state.settings.categories.map((category) => category.id));

  state.settings.categories.push({ id, name, emoji });
  saveState();
  categoryForm.reset();
  renderSettings();
});

currencyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(currencyForm);
  const code = data.get("code").trim().toUpperCase();
  const name = data.get("name").trim();

  if (!code || state.settings.currencies.some((currency) => currency.code === code)) return;

  state.settings.currencies.push({ code, name, symbol: code });
  saveState();
  currencyForm.reset();
  renderSettings();
});

expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const project = getActiveProject();
  const data = new FormData(expenseForm);
  const amount = parseAmount(data.get("amount"));
  const splitMode = data.get("splitMode");
  const splitWith = [...expenseForm.querySelectorAll("[name='splitWith']:checked")].map((input) => input.value);
  const shares = buildSplitShares(amount, splitMode, splitWith);

  if (!validateSplit(amount, shares, splitMode)) return;

  project.expenses.push({
    id: uniqueId(),
    title: data.get("title").trim(),
    category: data.get("category"),
    amount,
    currency: data.get("currency"),
    paidBy: data.get("paidBy"),
    date: data.get("date"),
    merchant: data.get("merchant")?.trim() ?? "",
    paymentMethod: data.get("paymentMethod")?.trim() ?? "",
    notes: data.get("notes")?.trim() ?? "",
    source: data.get("source") || "manual",
    ocrText: data.get("source") === "ocr" ? data.get("ocrText") || "" : "",
    splitMode,
    splitWith: Object.keys(shares),
    shares,
  });

  saveState();
  expenseForm.reset();
  resetReceiptScan();
  expenseModal.close();
  renderDetail();
});

splitMembers.addEventListener("change", updateSplitPreview);
expenseForm.addEventListener("input", updateSplitPreview);

function loadState() {
  const persisted = localStorage.getItem(storageKey);
  if (!persisted) return normalizeState(cloneData(exampleState));

  try {
    return normalizeState(JSON.parse(persisted));
  } catch {
    return normalizeState(cloneData(exampleState));
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

async function handleGoogleLogin() {
  authError.hidden = true;
  googleLoginButton.disabled = true;

  try {
    await signInWithGoogle();
  } catch (error) {
    showAuthError(error);
  } finally {
    googleLoginButton.disabled = false;
  }
}

async function handleSignOut() {
  const wantsSignOut = confirm("¿Querés cerrar sesión?");
  if (!wantsSignOut) return;

  try {
    stopJoinRequestWatch();
    accountModal.close();
    await signOutUser();
  } catch (error) {
    showAuthError(error);
  }
}

async function handleProfileSave(event) {
  event.preventDefault();
  const displayName = accountName.value.trim();

  if (!displayName) {
    accountError.textContent = "Escribí un nombre.";
    accountError.hidden = false;
    return;
  }

  try {
    await updateUserProfile(displayName);
    authUser = { ...authUser, displayName };
    stopJoinRequestWatch();
    accountModal.close();
    renderAuthState();
  } catch (error) {
    accountError.textContent = error.message || "No se pudo guardar el nombre.";
    accountError.hidden = false;
  }
}

async function renderAuthState() {
  const isLoggedIn = Boolean(authUser);
  loginScreen.hidden = isLoggedIn;
  appShell.hidden = !isLoggedIn;

  if (!isLoggedIn) return;

  const name = authUser.displayName || authUser.email || "Usuario";
  accountButton.textContent = initialsFromName(name);
  accountButton.title = `Abrir cuenta de ${name}`;
  ensureLocalProjectAdmins();

  if (pendingInvite) {
    pendingInvite = await resolvePendingInvite(pendingInvite);
    if (!pendingInvite) return;
    openInviteModal(pendingInvite);
    return;
  }

  showHome();
}

function openAccountModal() {
  const name = authUser?.displayName || "";
  accountName.value = name;
  accountEmail.textContent = authUser?.email || "";
  accountError.hidden = true;
  accountError.textContent = "";
  approvalStatus.hidden = true;
  approvalStatus.textContent = "";
  watchAdminJoinRequests();
  accountModal.showModal();
  accountName.focus();
}

function showAuthError(error) {
  authError.textContent = readableAuthError(error);
  authError.hidden = false;
}

function readableAuthError(error) {
  if (!error) return "No se pudo iniciar sesión.";
  if (error.code === "auth/popup-closed-by-user") return "Se cerró la ventana de Google antes de terminar.";
  if (error.code === "auth/unauthorized-domain") return "Este dominio no está autorizado en Firebase Authentication.";
  return error.message || "No se pudo iniciar sesión.";
}

function readableFirestoreError(error) {
  if (!error) return "No se pudo conectar con Firebase.";
  if (error.code === "permission-denied") {
    return "Firebase no permitió esta acción. En la terminal corré: firebase deploy --only firestore:rules";
  }
  if (error.code === "unavailable") return "Firebase no está disponible ahora. Probá de nuevo en unos segundos.";
  return error.message || "No se pudo completar la acción en Firebase.";
}

async function copyInviteLink() {
  inviteLinkStatus.hidden = false;
  inviteLinkStatus.textContent = "Generando link corto...";

  try {
    const link = await createInviteLink(getActiveProject());
    await navigator.clipboard.writeText(link);
    inviteLinkStatus.textContent = "Link corto copiado. También podés mandarlo por WhatsApp.";
  } catch (error) {
    inviteLinkStatus.textContent = readableFirestoreError(error);
  }
}

async function shareInviteByWhatsapp() {
  inviteLinkStatus.hidden = false;
  inviteLinkStatus.textContent = "Preparando invitación...";

  try {
    const project = getActiveProject();
    const link = await createInviteLink(project);
    const text = `Te invito a ${project.name} en Truchicount: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    inviteLinkStatus.textContent = "Abrí WhatsApp con el link corto listo para enviar.";
  } catch (error) {
    inviteLinkStatus.textContent = readableFirestoreError(error);
  }
}

function openInviteModal(invite) {
  inviteProjectTitle.textContent = `${invite.name} · elegí qué integrante sos`;
  inviteMemberOptions.replaceChildren();
  inviteError.hidden = true;
  inviteError.textContent = "";

  invite.members.forEach((member) => {
    const button = document.createElement("button");
    button.className = "choice-button";
    button.type = "button";
    button.innerHTML = `
      <strong>${escapeHtml(member.name)}</strong>
      <span>${member.isMe ? "Creador del truchicount" : "Participante"}</span>
    `;
    button.addEventListener("click", () => requestInviteApproval(invite, member.id));
    inviteMemberOptions.append(button);
  });

  if (!inviteModal.open) inviteModal.showModal();
}

async function requestInviteApproval(invite, memberId) {
  const member = invite.members.find((item) => item.id === memberId);
  if (!member || !authUser) return;

  if (invite.adminUid === authUser.uid) {
    acceptInvite(invite, memberId);
    return;
  }

  inviteError.hidden = true;
  inviteError.textContent = "";

  try {
    await requestProjectAccess(invite.id, {
      uid: authUser.uid,
      email: authUser.email ?? "",
      displayName: authUser.displayName || authUser.email || "Usuario",
      memberId,
      memberName: member.name,
      projectName: invite.name,
      adminUid: invite.adminUid ?? "",
    });

    clearInviteFromUrl();
    pendingInvite = null;
    inviteModal.close();
    showPendingAccess(invite, memberId);
  } catch (error) {
    inviteError.textContent = readableFirestoreError(error);
    inviteError.hidden = false;
  }
}

function acceptInvite(invite, memberId) {
  const project = importInvitedProject(invite);
  linkCurrentUserToMember(project, memberId);
  state.currentUserId = memberId;
  state.activeProjectId = project.id;
  saveState();
  clearInviteFromUrl();
  pendingInvite = null;
  inviteModal.close();
  showDetail(project.id, "home");
}

function showPendingAccess(invite, memberId) {
  const member = invite.members.find((item) => item.id === memberId);
  pendingAccessText.textContent = `Tu solicitud para entrar como ${member?.name ?? "participante"} en ${invite.name} quedó pendiente.`;
  appShell.hidden = true;
  pendingAccessModal.showModal();
  watchPendingAccess(invite, memberId);
}

function watchPendingAccess(invite, memberId) {
  if (unsubscribePendingAccess) unsubscribePendingAccess();

  unsubscribePendingAccess = watchProjectJoinRequests(invite.id, (requests, error) => {
    if (error) return;
    const request = requests.find((item) => item.uid === authUser?.uid);
    if (!request) return;

    if (request.status === "approved") {
      unsubscribePendingAccess();
      unsubscribePendingAccess = null;
      pendingAccessModal.close();
      appShell.hidden = false;
      acceptInvite(invite, memberId);
    }

    if (request.status === "rejected") {
      pendingAccessText.textContent = "El admin rechazó tu solicitud de ingreso.";
    }
  });
}

function resetExampleData() {
  state = normalizeState(cloneData(exampleState));
  saveState();
  showHome();
}

function getActiveProject() {
  return state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0];
}

function renderHome() {
  projectList.replaceChildren();

  const activeProjects = state.projects.filter((project) => !project.archived);
  if (!activeProjects.length) {
    projectList.innerHTML = `<div class="empty-state"><strong>No hay truchicounts activos</strong><span>Creá uno nuevo o revisá Archivados.</span></div>`;
    return;
  }

  activeProjects.forEach((project) => {
    const template = document.querySelector("#projectTemplate").content.cloneNode(true);
    const card = template.querySelector(".project-card");
    card.querySelector("strong").textContent = project.name;
    card.querySelector("small").textContent = `${project.members.length} personas`;
    card.addEventListener("click", () => showDetail(project.id, "home"));
    projectList.append(card);
  });
}

function showHome() {
  archivedScreen.hidden = true;
  settingsScreen.hidden = true;
  detailScreen.hidden = true;
  homeScreen.hidden = false;
  setSelectedNav("home");
  renderHome();
}

function showSettings() {
  homeScreen.hidden = true;
  archivedScreen.hidden = true;
  detailScreen.hidden = true;
  settingsScreen.hidden = false;
  setSelectedNav("settings");
  renderSettings();
}

function showArchived() {
  homeScreen.hidden = true;
  settingsScreen.hidden = true;
  detailScreen.hidden = true;
  archivedScreen.hidden = false;
  setSelectedNav("archived");
  renderArchived();
}

function showDetail(projectId, returnView = "home") {
  state.activeProjectId = projectId;
  detailReturnView = returnView;
  saveState();
  archivedScreen.hidden = true;
  settingsScreen.hidden = true;
  homeScreen.hidden = true;
  detailScreen.hidden = false;
  setSelectedNav(null);
  renderDetail();
}

function renderArchived() {
  archivedProjectList.replaceChildren();
  const archivedProjects = state.projects.filter((project) => project.archived);

  if (!archivedProjects.length) {
    archivedProjectList.innerHTML = `<div class="empty-state"><strong>No hay archivados</strong><span>Los truchicounts archivados van a aparecer acá.</span></div>`;
    return;
  }

  archivedProjects.forEach((project) => {
    const card = document.createElement("article");
    card.className = "project-card archived-card";
    card.tabIndex = 0;
    card.innerHTML = `
      <span class="project-copy">
        <strong>${escapeHtml(project.name)}</strong>
        <small>${project.members.length} personas · archivado</small>
      </span>
      <button class="secondary-button small-action" type="button">Restaurar</button>
    `;
    card.addEventListener("click", () => showDetail(project.id, "archived"));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") showDetail(project.id, "archived");
    });
    card.querySelector("button").addEventListener("click", (event) => {
      event.stopPropagation();
      project.archived = false;
      saveState();
      renderArchived();
    });
    archivedProjectList.append(card);
  });
}

function returnFromDetail() {
  if (detailReturnView === "archived") {
    showArchived();
    return;
  }

  showHome();
}

function renderDetail() {
  const project = getActiveProject();
  state.currentUserId = currentUserMemberId(project);
  document.querySelector("#detailTitle").textContent = project.name;
  addExpenseButton.hidden = project.archived;
  detailStatus.hidden = !project.archived;

  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.tab === activeTab);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === `${activeTab}Panel`);
  });

  renderExpenses(project);
  renderBalances(project);
}

function renderExpenses(project) {
  const totals = calculateBalances(project);
  document.querySelector("#myExpenses").textContent = formatMoney(totalPaidBy(project, state.currentUserId));
  document.querySelector("#totalExpenses").textContent = formatMoney(totalExpense(project));
  expenseList.replaceChildren();

  const grouped = groupByDate(project.expenses);
  if (!project.expenses.length) {
    const helperText = project.archived ? "Este truchicount archivado no tiene gastos cargados." : "Agrega el primer gasto compartido.";
    expenseList.innerHTML = `<div class="empty-state"><strong>No hay gastos</strong><span>${helperText}</span></div>`;
    return;
  }

  Object.entries(grouped).forEach(([date, expenses]) => {
    const group = document.createElement("section");
    group.className = "date-group";
    group.innerHTML = `<h3>${formatDate(date)}</h3>`;

    expenses.forEach((expense) => {
      const template = document.querySelector("#expenseTemplate").content.cloneNode(true);
      template.querySelector(".expense-icon").textContent = categoryEmoji(expense.category);
      template.querySelector("strong").textContent = expense.title;
      template.querySelector("small").textContent = `Paid by ${memberLabel(project, expense.paidBy)}`;
      template.querySelector(".expense-amount").textContent = formatMoney(expense.amount, expense.currency);
      group.append(template);
    });

    expenseList.append(group);
  });

  return totals;
}

function renderBalances(project) {
  const { balances, settlements } = calculateBalances(project);
  const currentMemberId = currentUserMemberId(project);
  balanceList.replaceChildren();

  const currentSettlement = settlements.find((item) => item.from === currentMemberId || item.to === currentMemberId);
  if (currentSettlement) {
    const direction = currentSettlement.from === currentMemberId ? "owe" : "are owed";
    const otherId = currentSettlement.from === currentMemberId ? currentSettlement.to : currentSettlement.from;
    settlementCard.innerHTML = `
      <span class="settlement-icon">💸</span>
      <span>
        <strong>You ${direction} ${formatMoney(currentSettlement.amount)}</strong>
        <small>${direction === "owe" ? "To" : "From"} ${memberLabel(project, otherId).replace(" (me)", "")}</small>
      </span>
      <span class="chevron">›</span>
    `;
  } else {
    settlementCard.innerHTML = `
      <span class="settlement-icon">✅</span>
      <span>
        <strong>Todo saldado</strong>
        <small>No hay deudas pendientes</small>
      </span>
      <span class="chevron">›</span>
    `;
  }

  project.members.forEach((member) => {
    const amount = balances[member.id] ?? 0;
    const isCurrentMember = member.id === currentMemberId;
    const card = document.createElement("article");
    card.className = "balance-card";
    card.innerHTML = `
      <span class="balance-avatar">${isCurrentMember ? "◕" : member.name.slice(0, 1).toUpperCase()}</span>
      <span>
        <strong>${member.name}</strong>
        <small>${isCurrentMember ? "Me" : "Participant"}</small>
      </span>
      <span class="balance-amount ${amount >= 0 ? "positive" : "negative"}">${amount >= 0 ? "+" : "-"}${formatMoney(Math.abs(amount))}</span>
    `;
    balanceList.append(card);
  });
}

function openExpenseModal() {
  const project = getActiveProject();
  if (project.archived) return;
  resetReceiptScan();
  paidBySelect.replaceChildren();
  splitMembers.replaceChildren();
  fillCurrencySelect(expenseCurrencySelect, project.defaultCurrency ?? "ARS");
  fillCategorySelect(categorySelect);
  splitError.hidden = true;
  splitError.textContent = "";

  project.members.forEach((member) => {
    const option = document.createElement("option");
    option.value = member.id;
    option.textContent = memberLabel(project, member.id);
    option.selected = member.id === currentUserMemberId(project);
    paidBySelect.append(option);

    const row = document.createElement("label");
    row.className = "split-row";
    row.innerHTML = `
      <input type="checkbox" name="splitWith" value="${member.id}" checked />
      <span class="check">✓</span>
      <span>${memberLabel(project, member.id)}</span>
      <span class="split-value">$ 0,00</span>
      <input class="manual-share" name="manualShare-${member.id}" inputmode="decimal" placeholder="0,00" />
    `;
    row.querySelector(".manual-share").addEventListener("click", (event) => event.stopPropagation());
    splitMembers.append(row);
  });

  expenseForm.splitMode.value = "equal";
  expenseForm.date.value = new Date().toISOString().slice(0, 10);
  updateSplitPreview();
  expenseModal.showModal();
}

async function handleReceiptImage() {
  const file = receiptInput?.files?.[0];
  if (!file) return;

  scanReceiptButton.disabled = true;
  showScanStatus("Mejorando foto del ticket...");

  try {
    const image = await prepareReceiptImage(file);
    showScanStatus("Leyendo ticket...");
    const text = await readReceiptText(image);
    const detected = parseReceiptText(text);
    applyReceiptDetection(detected, text);
    showScanStatus(detected.hasUsefulData ? "Revisá los datos antes de guardar el gasto." : "No se pudieron leer todos los datos. Completá o corregí el formulario manualmente.");
  } catch (error) {
    showScanStatus("No pudimos leer el ticket. Podés cargar el gasto manualmente.", true);
  } finally {
    scanReceiptButton.disabled = false;
    receiptInput.value = "";
  }
}

async function readReceiptText(image) {
  await loadTesseract();
  const result = await window.Tesseract.recognize(image, "spa+eng", {
    tessedit_pageseg_mode: "6",
    tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚÜÑáéíóúüñ.,:/-$% ",
  });
  return result?.data?.text ?? "";
}

async function prepareReceiptImage(file) {
  const bitmap = await loadReceiptBitmap(file);
  const maxWidth = 1800;
  const scale = Math.min(2.2, Math.max(1, maxWidth / bitmap.width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = "grayscale(1) contrast(1.45) brightness(1.08)";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const threshold = otsuThreshold(data);

  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const value = gray > threshold ? 255 : 0;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

async function loadReceiptBitmap(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      return loadReceiptImageElement(file);
    }
  }

  return loadReceiptImageElement(file);
}

function loadReceiptImageElement(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo abrir la foto."));
    };
    image.src = url;
  });
}

function otsuThreshold(data) {
  const histogram = new Array(256).fill(0);
  let total = 0;

  for (let index = 0; index < data.length; index += 4) {
    const gray = Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
    histogram[gray] += 1;
    total += 1;
  }

  let sum = 0;
  histogram.forEach((count, value) => {
    sum += value * count;
  });

  let backgroundWeight = 0;
  let backgroundSum = 0;
  let maxVariance = 0;
  let threshold = 160;

  histogram.forEach((count, value) => {
    backgroundWeight += count;
    if (!backgroundWeight) return;

    const foregroundWeight = total - backgroundWeight;
    if (!foregroundWeight) return;

    backgroundSum += value * count;
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = value;
    }
  });

  return Math.min(210, Math.max(110, threshold));
}

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("No se pudo cargar OCR."));
    document.head.append(script);
  });
}

function parseReceiptText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const compactText = lines.join(" ");
  const merchant = detectReceiptMerchant(lines);
  const amount = detectReceiptAmount(lines);
  const date = detectReceiptDate(compactText);
  const category = detectReceiptCategory(compactText);
  const title = merchant ? `Compra en ${merchant}` : "Gasto escaneado de ticket";

  return {
    amount,
    category,
    date,
    merchant,
    title,
    hasUsefulData: Boolean(amount || date || merchant || category),
  };
}

function applyReceiptDetection(detected, text) {
  expenseForm.elements.source.value = "ocr";
  expenseForm.elements.ocrText.value = text.slice(0, 2000);

  if (detected.title) expenseForm.elements.title.value = detected.title;
  if (detected.merchant) expenseForm.elements.merchant.value = detected.merchant;
  if (detected.amount) expenseForm.elements.amount.value = formatPlainAmount(detected.amount);
  if (detected.date) expenseForm.elements.date.value = detected.date;
  if (detected.category) categorySelect.value = detected.category;
  if (!expenseForm.elements.notes.value) expenseForm.elements.notes.value = "Cargado desde foto de ticket.";

  updateSplitPreview();
}

function showScanStatus(message, isError = false) {
  if (!scanStatus) return;
  scanStatus.textContent = message;
  scanStatus.hidden = false;
  scanStatus.classList.toggle("is-error", isError);
}

function resetReceiptScan() {
  if (!expenseForm) return;
  if (receiptInput) receiptInput.value = "";
  if (scanReceiptButton) scanReceiptButton.disabled = false;
  if (scanStatus) {
    scanStatus.hidden = true;
    scanStatus.textContent = "";
    scanStatus.classList.remove("is-error");
  }
  if (expenseForm.elements.source) expenseForm.elements.source.value = "manual";
  if (expenseForm.elements.ocrText) expenseForm.elements.ocrText.value = "";
}

function detectReceiptMerchant(lines) {
  const ignored = /\b(cuit|iva|inicio|factura|ticket|consumidor|domicilio|ingresos|brutos|responsable|total)\b/i;
  const merchantLine = lines.find((line) => {
    const cleaned = line.replace(/[^a-zA-ZÀ-ÿ0-9 %&.-]/g, "").trim();
    return cleaned.length >= 3 && !ignored.test(cleaned) && !/\d{2}[/-]\d{2}[/-]\d{2,4}/.test(cleaned);
  });

  return merchantLine ? toTitleCase(merchantLine.replace(/\s+/g, " ").slice(0, 36)) : "";
}

function detectReceiptAmount(lines) {
  const amountCandidates = [];
  const priorityWords = /\b(total|importe|monto|pagar|saldo|efectivo|debito|credito)\b/i;
  const ignoredWords = /\b(cuit|fecha|hora|ticket|factura|cae|iibb|ingresos|brutos|dni|telefono|tel)\b/i;

  lines.forEach((line, index) => {
    if (ignoredWords.test(line) && !priorityWords.test(line)) return;

    const nearbyText = `${lines[index - 1] ?? ""} ${line} ${lines[index + 1] ?? ""}`;
    const values = extractMoneyValues(nearbyText);
    values.forEach((value) => {
      if (value < 1 || value > 10000000) return;
      amountCandidates.push({
        value,
        priority: priorityWords.test(nearbyText),
        lineIndex: index,
      });
    });
  });

  const prioritized = amountCandidates.filter((candidate) => candidate.priority);
  const candidates = prioritized.length ? prioritized : amountCandidates;
  return candidates
    .sort((a, b) => {
      if (a.priority !== b.priority) return Number(b.priority) - Number(a.priority);
      if (a.lineIndex !== b.lineIndex) return b.lineIndex - a.lineIndex;
      return b.value - a.value;
    })
    .at(0)?.value ?? 0;
}

function extractMoneyValues(text) {
  const matches = text.match(/(?:\$|ars)?\s*\d{1,3}(?:[.\s]\d{3})+(?:[,.]\d{2})?|(?:\$|ars)?\s*\d+[,.]\d{2}/gi) ?? [];
  return matches.map(parseReceiptAmountValue).filter((value) => value > 0);
}

function parseReceiptAmountValue(value) {
  const cleaned = String(value).replace(/[^\d,.-]/g, "").replace(/\s/g, "");
  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : ".";
  const thousandsSeparator = decimalSeparator === "," ? "." : ",";
  const normalized = cleaned.replaceAll(thousandsSeparator, "").replace(decimalSeparator, ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function detectReceiptDate(text) {
  const match = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/) || text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (!match) return "";

  if (match[0].includes("-") && match[1].length === 4) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }

  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function detectReceiptCategory(text) {
  const normalized = slugify(text);
  const keywordGroups = [
    { words: ["supermercado", "alimentos", "mercado", "coto", "carrefour", "dia", "jumbo", "disco"], names: ["groceries", "supermercado"] },
    { words: ["nafta", "combustible", "ypf", "shell", "axion", "sube", "taxi", "uber"], names: ["transport", "transporte"] },
    { words: ["farmacia", "medicamento", "perfumeria", "salud"], names: ["healthcare", "salud"] },
    { words: ["restaurant", "restaurante", "comida", "cafe", "bar", "mcdonald", "burger"], names: ["restaurants-bars", "comida"] },
    { words: ["ropa", "indumentaria", "calzado", "shopping"], names: ["shopping", "ropa"] },
  ];

  const group = keywordGroups.find((item) => item.words.some((word) => normalized.includes(word)));
  if (!group) return "";

  return findCategoryByNames(group.names);
}

function findCategoryByNames(names) {
  const normalizedNames = names.map(slugify);
  const category = state.settings.categories.find((item) => {
    const id = slugify(item.id);
    const name = slugify(item.name);
    return normalizedNames.includes(id) || normalizedNames.includes(name);
  });
  return category?.id ?? "";
}

function toTitleCase(value) {
  return String(value)
    .toLowerCase()
    .replace(/\b([a-záéíóúñü])/g, (match) => match.toUpperCase());
}

function openProjectModal() {
  projectForm.reset();
  projectParticipants.replaceChildren();
  projectError.hidden = true;
  projectError.textContent = "";
  fillCurrencySelect(projectCurrencySelect, "ARS");
  addParticipantRow("Leo", true);
  addParticipantRow("", false);
  projectModal.showModal();
  projectForm.querySelector("[name='name']").focus();
}

function addParticipantRow(name = "", isMe = false) {
  addParticipantInput(projectParticipants, { name, isMe });
}

function openProjectSettingsModal() {
  const project = getActiveProject();
  projectSettingsForm.reset();
  editProjectParticipants.replaceChildren();
  projectSettingsError.hidden = true;
  projectSettingsError.textContent = "";
  inviteLinkStatus.hidden = true;
  inviteLinkStatus.textContent = "";
  fillCurrencySelect(editProjectCurrencySelect, project.defaultCurrency ?? "ARS");
  document.querySelector("#archiveProjectButton").textContent = project.archived ? "Restaurar truchicount" : "Archivar truchicount";

  project.members.forEach((member) => {
    addEditParticipantRow(member.name, member.isMe, member.id, isMemberUsed(project, member.id));
  });

  projectSettingsModal.showModal();
}

function watchAdminJoinRequests() {
  stopJoinRequestWatch();
  activeJoinRequests = [];
  const adminProjects = state.projects.filter(isProjectAdmin);
  accountApprovalSection.hidden = false;

  if (!adminProjects.length) {
    approvalRequestList.innerHTML = `<div class="empty-row">No administrás ningún truchicount todavía.</div>`;
    return;
  }

  approvalRequestList.innerHTML = `<div class="empty-row">Buscando solicitudes...</div>`;

  adminProjects.forEach((project) => {
    const unsubscribe = watchProjectJoinRequests(project.id, (requests, error) => {
      if (error) {
        approvalRequestList.innerHTML = `<div class="empty-row">No se pudieron cargar las solicitudes.</div>`;
        approvalStatus.textContent = readableFirestoreError(error);
        approvalStatus.hidden = false;
        return;
      }

      activeJoinRequests = activeJoinRequests.filter((item) => item.project.id !== project.id);
      activeJoinRequests.push(...requests.map((request) => ({ project, request })));
      renderApprovalRequests();
    });
    joinRequestUnsubscribers.push(unsubscribe);
  });
}

function stopJoinRequestWatch() {
  joinRequestUnsubscribers.forEach((unsubscribe) => unsubscribe());
  joinRequestUnsubscribers = [];
  activeJoinRequests = [];
}

function renderApprovalRequests() {
  approvalRequestList.replaceChildren();
  const pendingRequests = activeJoinRequests.filter(({ request }) => request.status === "pending");

  if (!pendingRequests.length) {
    approvalRequestList.innerHTML = `<div class="empty-row">No hay solicitudes pendientes.</div>`;
    return;
  }

  pendingRequests.forEach(({ project, request }) => {
    const row = document.createElement("article");
    row.className = "request-row";
    row.innerHTML = `
      <span>
        <strong>${escapeHtml(request.displayName || request.email || "Invitado")}</strong>
        <small>${escapeHtml(project.name)} · quiere entrar como ${escapeHtml(request.memberName || "participante")}</small>
      </span>
      <span class="request-actions">
        <button class="secondary-button small-action" type="button" data-review="rejected">Rechazar</button>
        <button class="primary-button small-action" type="button" data-review="approved">Aceptar</button>
      </span>
    `;
    row.querySelectorAll("[data-review]").forEach((button) => {
      button.addEventListener("click", () => reviewJoinRequest(project, request, button.dataset.review));
    });
    approvalRequestList.append(row);
  });
}

async function reviewJoinRequest(project, request, status) {
  approvalStatus.hidden = true;
  approvalStatus.textContent = "";

  try {
    await reviewProjectAccess(project.id, request.uid, status);
    if (status === "approved") {
      project.memberLinks ??= {};
      project.memberLinks[request.uid] = request.memberId;
      saveState();
      approvalStatus.textContent = `${request.displayName || request.email || "Invitado"} ya puede entrar.`;
    } else {
      approvalStatus.textContent = "Solicitud rechazada.";
    }
    approvalStatus.hidden = false;
  } catch (error) {
    approvalStatus.textContent = readableFirestoreError(error);
    approvalStatus.hidden = false;
  }
}

function toggleActiveProjectArchive() {
  const project = getActiveProject();
  project.archived = !project.archived;
  saveState();
  projectSettingsModal.close();
  if (project.archived) showHome();
  else renderDetail();
}

function addEditParticipantRow(name = "", isMe = false, memberId = "", isLocked = false) {
  addParticipantInput(editProjectParticipants, { name, isMe, memberId, isLocked });
}

function addParticipantInput(container, { name = "", isMe = false, memberId = "", isLocked = false } = {}) {
  const row = document.createElement("label");
  row.className = "participant-row";
  row.dataset.memberId = memberId;
  row.classList.toggle("is-locked", isLocked);
  row.innerHTML = `
    <span>${isMe ? "◕" : "＋"}</span>
    <input name="participantName" placeholder="Participant Name" value="${escapeHtml(name)}" />
    ${isMe ? '<span class="me-badge">Me</span>' : '<button class="delete-button" type="button" aria-label="Quitar participante">×</button>'}
  `;

  const deleteButton = row.querySelector(".delete-button");
  if (deleteButton) {
    deleteButton.disabled = isLocked;
    deleteButton.title = isLocked ? "Tiene gastos cargados" : "";
    deleteButton.addEventListener("click", () => {
      if (!isLocked) row.remove();
    });
  }

  container.append(row);
  if (!name) row.querySelector("input").focus();
}

function getProjectParticipantNames() {
  return [...projectParticipants.querySelectorAll("[name='participantName']")]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function getEditedMembers(project) {
  const usedMemberIds = [];
  const members = [...editProjectParticipants.querySelectorAll(".participant-row")]
    .map((row, index) => {
      const name = row.querySelector("[name='participantName']").value.trim();
      if (!name) return null;

      const existingId = row.dataset.memberId;
      const id = existingId || uniqueSettingId(slugify(name) || `member-${index + 1}`, usedMemberIds);
      usedMemberIds.push(id);

      return {
        id,
        name,
        isMe: project.members.find((member) => member.id === existingId)?.isMe ?? index === 0,
      };
    })
    .filter(Boolean);

  if (members.length && !members.some((member) => member.isMe)) members[0].isMe = true;
  return members;
}

function isMemberUsed(project, memberId) {
  return project.expenses.some((expense) => expense.paidBy === memberId || expense.splitWith?.includes(memberId));
}

function renderSettings() {
  categoryList.replaceChildren();
  currencyList.replaceChildren();

  state.settings.categories.forEach((category) => {
    const row = document.createElement("article");
    row.className = "settings-row";
    row.innerHTML = `
      <span>${category.emoji}</span>
      <strong>${category.name}</strong>
      <button class="delete-button" type="button" aria-label="Borrar categoria">×</button>
    `;
    row.querySelector("button").addEventListener("click", () => deleteCategory(category.id));
    categoryList.append(row);
  });

  state.settings.currencies.forEach((currency) => {
    const row = document.createElement("article");
    row.className = "settings-row";
    row.innerHTML = `
      <span>${currency.symbol ?? currency.code}</span>
      <strong>${currency.name}</strong>
      <small>${currency.code}</small>
    `;
    currencyList.append(row);
  });
}

function deleteCategory(categoryId) {
  if (state.settings.categories.length <= 1) return;
  state.settings.categories = state.settings.categories.filter((category) => category.id !== categoryId);
  saveState();
  renderSettings();
}

function fillCurrencySelect(select, selectedCode) {
  select.replaceChildren();
  state.settings.currencies.forEach((currency) => {
    const option = document.createElement("option");
    option.value = currency.code;
    option.textContent = `${currency.code} ${currency.symbol ?? ""}`.trim();
    option.selected = currency.code === selectedCode;
    select.append(option);
  });
}

function fillCategorySelect(select) {
  select.replaceChildren();
  state.settings.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${category.emoji} ${category.name}`;
    select.append(option);
  });
}

function updateSplitPreview() {
  const amount = parseAmount(expenseForm.amount.value);
  const splitMode = expenseForm.splitMode.value;
  const checkedRows = [...splitMembers.querySelectorAll(".split-row")].filter((row) =>
    row.querySelector("input").checked
  );
  const share = checkedRows.length ? amount / checkedRows.length : 0;

  splitMembers.classList.toggle("is-manual", splitMode === "manual");
  splitError.hidden = true;
  splitError.textContent = "";

  splitMembers.querySelectorAll(".split-row").forEach((row) => {
    const checkbox = row.querySelector("[name='splitWith']");
    const manualInput = row.querySelector(".manual-share");
    const isChecked = checkbox.checked;

    row.querySelector(".split-value").textContent = isChecked ? formatMoney(share) : formatMoney(0);
    manualInput.disabled = !isChecked || splitMode !== "manual";
    if (splitMode === "equal") manualInput.value = isChecked && amount ? formatPlainAmount(share) : "";
  });
}

function calculateBalances(project) {
  const balances = Object.fromEntries(project.members.map((member) => [member.id, 0]));

  project.expenses.forEach((expense) => {
    balances[expense.paidBy] += expense.amount;
    const shares = getExpenseShares(expense);
    Object.entries(shares).forEach(([memberId, share]) => {
      if (balances[memberId] === undefined) return;
      balances[memberId] -= share;
    });
  });

  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < -0.01)
    .map(([id, amount]) => ({ id, amount: Math.abs(amount) }));
  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > 0.01)
    .map(([id, amount]) => ({ id, amount }));
  const settlements = [];

  debtors.forEach((debtor) => {
    creditors.forEach((creditor) => {
      if (debtor.amount <= 0.01 || creditor.amount <= 0.01) return;
      const amount = Math.min(debtor.amount, creditor.amount);
      settlements.push({ from: debtor.id, to: creditor.id, amount });
      debtor.amount -= amount;
      creditor.amount -= amount;
    });
  });

  return { balances, settlements };
}

function buildSplitShares(amount, splitMode, splitWith) {
  const selectedIds = splitWith;

  if (splitMode === "manual") {
    return Object.fromEntries(
      selectedIds
        .map((memberId) => [memberId, parseAmount(expenseForm.elements[`manualShare-${memberId}`]?.value)])
        .filter(([, share]) => share > 0)
    );
  }

  const share = selectedIds.length ? roundMoney(amount / selectedIds.length) : 0;
  const shares = Object.fromEntries(selectedIds.map((memberId) => [memberId, share]));
  const remainder = roundMoney(amount - Object.values(shares).reduce((sum, value) => sum + value, 0));
  if (selectedIds[0]) shares[selectedIds[0]] = roundMoney(shares[selectedIds[0]] + remainder);
  return shares;
}

function validateSplit(amount, shares, splitMode) {
  const totalShares = Object.values(shares).reduce((sum, value) => sum + value, 0);

  if (amount <= 0) {
    showSplitError("El monto tiene que ser mayor a cero.");
    return false;
  }

  if (!Object.keys(shares).length) {
    showSplitError("Selecciona al menos una persona para dividir el gasto.");
    return false;
  }

  if (splitMode === "manual" && Math.abs(totalShares - amount) > 0.01) {
    showSplitError(`El split manual suma ${formatMoney(totalShares)} y el gasto es ${formatMoney(amount)}.`);
    return false;
  }

  return true;
}

function showSplitError(message) {
  splitError.textContent = message;
  splitError.hidden = false;
}

function getExpenseShares(expense) {
  if (expense.shares) return expense.shares;
  const splitWith = expense.splitWith?.length ? expense.splitWith : [];
  const share = splitWith.length ? expense.amount / splitWith.length : 0;
  return Object.fromEntries(splitWith.map((memberId) => [memberId, share]));
}

function groupByDate(expenses) {
  return [...expenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .reduce((groups, expense) => {
      groups[expense.date] ??= [];
      groups[expense.date].push(expense);
      return groups;
    }, {});
}

function totalPaidBy(project, memberId) {
  return project.expenses
    .filter((expense) => expense.paidBy === memberId)
    .reduce((sum, expense) => sum + expense.amount, 0);
}

function totalExpense(project) {
  return project.expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

function memberLabel(project, memberId) {
  const member = project.members.find((item) => item.id === memberId);
  if (!member) return "Unknown";
  return member.id === currentUserMemberId(project) ? `${member.name} (me)` : member.name;
}

function categoryEmoji(categoryId) {
  const category = state.settings.categories.find((item) => item.id === categoryId || item.name === categoryId);
  return category?.emoji ?? "🧾";
}

function formatMoney(amount, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function parseAmount(value) {
  if (!value) return 0;
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPlainAmount(amount) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function roundMoney(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function uniqueSettingId(baseId, existingIds) {
  const fallback = baseId || "item";
  let id = fallback;
  let index = 2;
  while (existingIds.includes(id)) {
    id = `${fallback}-${index}`;
    index += 1;
  }
  return id;
}

function initialsFromName(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function normalizeState(rawState) {
  const normalized = {
    ...rawState,
    settings: {
      categories: rawState.settings?.categories?.length ? rawState.settings.categories : cloneData(defaultSettings.categories),
      currencies: rawState.settings?.currencies?.length ? rawState.settings.currencies : cloneData(defaultSettings.currencies),
    },
  };

  normalized.projects = normalized.projects.map((project) => ({
    ...project,
    adminUid: project.adminUid ?? "",
    defaultCurrency: project.defaultCurrency ?? "ARS",
    memberLinks: project.memberLinks ?? {},
    expenses: project.expenses ?? [],
  }));

  normalized.projects.forEach((project) => {
    project.expenses.forEach((expense) => {
      const category = normalized.settings.categories.find((item) => item.name === expense.category);
      if (category) expense.category = category.id;
    });
  });

  return normalized;
}

function linkCurrentUserToMember(project, memberId) {
  if (!authUser?.uid) return;
  project.memberLinks ??= {};
  project.memberLinks[authUser.uid] = memberId;
}

function currentUserMemberId(project) {
  if (!authUser?.uid) return state.currentUserId;
  return project.memberLinks?.[authUser.uid] ?? state.currentUserId;
}

async function createInviteLink(project) {
  const code = generateInviteCode();
  const payload = {
    id: project.id,
    name: project.name,
    adminUid: project.adminUid ?? authUser?.uid ?? "",
    defaultCurrency: project.defaultCurrency ?? "ARS",
    members: project.members,
  };
  await saveProjectInvite(code, payload);

  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("join", code);
  url.hash = "";
  return url.toString();
}

function readInviteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get("join");
  const inviteParam = params.get("invite");
  if (joinCode) return { code: joinCode, isShortInvite: true };
  if (!inviteParam) return null;

  try {
    return decodeInvitePayload(inviteParam);
  } catch {
    return null;
  }
}

async function resolvePendingInvite(invite) {
  if (!invite?.isShortInvite) return invite;

  try {
    const storedInvite = await getProjectInvite(invite.code);
    if (!storedInvite) {
      authError.textContent = "Ese link de invitación no existe o venció.";
      authError.hidden = false;
      clearInviteFromUrl();
      pendingInvite = null;
      showHome();
      return null;
    }

    return storedInvite;
  } catch (error) {
    authError.textContent = readableFirestoreError(error);
    authError.hidden = false;
    return null;
  }
}

function clearInviteFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("invite");
  url.searchParams.delete("join");
  window.history.replaceState({}, "", url);
}

function importInvitedProject(invite) {
  let project = state.projects.find((item) => item.id === invite.id);

  if (!project) {
    project = {
      id: invite.id,
      name: invite.name,
      adminUid: invite.adminUid ?? "",
      defaultCurrency: invite.defaultCurrency ?? "ARS",
      archived: false,
      memberLinks: {},
      members: invite.members,
      expenses: [],
    };
    state.projects.unshift(project);
  }

  return project;
}

function isProjectAdmin(project) {
  return Boolean(authUser?.uid && project.adminUid === authUser.uid);
}

function ensureLocalProjectAdmins() {
  if (!authUser?.uid) return;
  let changed = false;

  state.projects.forEach((project) => {
    if (project.adminUid) return;
    project.adminUid = authUser.uid;
    project.memberLinks ??= {};
    const currentMember = project.members.find((member) => member.isMe) ?? project.members[0];
    if (currentMember) project.memberLinks[authUser.uid] = currentMember.id;
    changed = true;
  });

  if (changed) saveState();
}

function encodeInvitePayload(payload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeInvitePayload(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function generateInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

function setSelectedNav(viewName) {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.view === viewName);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

renderHome();
