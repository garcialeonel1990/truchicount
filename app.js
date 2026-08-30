import {
  completeRedirectSignIn,
  requestProjectAccess,
  reviewProjectAccess,
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
const inviteLinkStatus = document.querySelector("#inviteLinkStatus");
const accountApprovalSection = document.querySelector("#accountApprovalSection");
const approvalRequestList = document.querySelector("#approvalRequestList");
const approvalStatus = document.querySelector("#approvalStatus");
const pendingSignOutButton = document.querySelector("#pendingSignOutButton");

googleLoginButton.addEventListener("click", handleGoogleLogin);
accountButton.addEventListener("click", openAccountModal);
accountForm.addEventListener("submit", handleProfileSave);
signOutButton.addEventListener("click", handleSignOut);
pendingSignOutButton.addEventListener("click", handleSignOut);
document.querySelector("#newProjectButton").addEventListener("click", openProjectModal);
document.querySelector("[data-close-project]").addEventListener("click", () => projectModal.close());
document.querySelector("[data-close-project-settings]").addEventListener("click", () => {
  projectSettingsModal.close();
});
document.querySelector("[data-close-account]").addEventListener("click", () => {
  stopJoinRequestWatch();
  accountModal.close();
});
document.querySelector("[data-close-expense]").addEventListener("click", () => expenseModal.close());
document.querySelector("#backButton").addEventListener("click", returnFromDetail);
document.querySelector("#settingsBackButton").addEventListener("click", showHome);
document.querySelector("#archivedBackButton").addEventListener("click", showHome);
addExpenseButton.addEventListener("click", openExpenseModal);
document.querySelector("#menuButton").addEventListener("click", openProjectSettingsModal);
document.querySelector("#archiveProjectButton").addEventListener("click", toggleActiveProjectArchive);
copyInviteButton.addEventListener("click", copyInviteLink);
document.querySelector("#addProjectParticipant").addEventListener("click", () => addParticipantRow());
document.querySelector("#addEditProjectParticipant").addEventListener("click", () => addEditParticipantRow());

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
    splitMode,
    splitWith: Object.keys(shares),
    shares,
  });

  saveState();
  expenseForm.reset();
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

function renderAuthState() {
  const isLoggedIn = Boolean(authUser);
  loginScreen.hidden = isLoggedIn;
  appShell.hidden = !isLoggedIn;

  if (!isLoggedIn) return;

  const name = authUser.displayName || authUser.email || "Usuario";
  accountButton.textContent = initialsFromName(name);
  accountButton.title = `Abrir cuenta de ${name}`;
  ensureLocalProjectAdmins();

  if (pendingInvite) {
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
  const project = getActiveProject();
  const link = createInviteLink(project);

  inviteLinkStatus.hidden = false;

  try {
    await navigator.clipboard.writeText(link);
    inviteLinkStatus.textContent = "Link copiado. Mandáselo a la otra persona para que entre con Google.";
  } catch {
    inviteLinkStatus.textContent = link;
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

function createInviteLink(project) {
  const payload = {
    id: project.id,
    name: project.name,
    adminUid: project.adminUid ?? authUser?.uid ?? "",
    defaultCurrency: project.defaultCurrency ?? "ARS",
    members: project.members,
    expenses: project.expenses,
    settings: state.settings,
  };
  const encoded = encodeInvitePayload(payload);
  const url = new URL(window.location.href);
  url.searchParams.set("invite", encoded);
  url.hash = "";
  return url.toString();
}

function readInviteFromUrl() {
  const inviteParam = new URLSearchParams(window.location.search).get("invite");
  if (!inviteParam) return null;

  try {
    return decodeInvitePayload(inviteParam);
  } catch {
    return null;
  }
}

function clearInviteFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("invite");
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
      expenses: invite.expenses ?? [],
    };
    state.projects.unshift(project);
  }

  state.settings = invite.settings ?? state.settings;
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
