const storageKey = "truchicount:v1";

const categories = {
  "Groceries": "🛒",
  "Restaurants & Bars": "🍔",
  "Rent & Charges": "🏠",
  Pet: "🐾",
  Transport: "🚕",
  Other: "✋",
};

const exampleState = {
  currentUserId: "leo",
  activeProjectId: "depto-mayo-26",
  projects: [
    {
      id: "depto-julio-26",
      name: "Depto - Julio '26",
      emoji: "🏡",
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
      emoji: "🏡",
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
      emoji: "🏡",
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

const homeScreen = document.querySelector("#homeScreen");
const detailScreen = document.querySelector("#detailScreen");
const projectList = document.querySelector("#projectList");
const expenseList = document.querySelector("#expenseList");
const balanceList = document.querySelector("#balanceList");
const settlementCard = document.querySelector("#settlementCard");
const projectModal = document.querySelector("#projectModal");
const expenseModal = document.querySelector("#expenseModal");
const projectForm = document.querySelector("#projectForm");
const expenseForm = document.querySelector("#expenseForm");
const paidBySelect = document.querySelector("#paidBySelect");
const splitMembers = document.querySelector("#splitMembers");

document.querySelector("#newProjectButton").addEventListener("click", () => projectModal.showModal());
document.querySelector("[data-close-project]").addEventListener("click", () => projectModal.close());
document.querySelector("[data-close-expense]").addEventListener("click", () => expenseModal.close());
document.querySelector("#backButton").addEventListener("click", showHome);
document.querySelector("#addExpenseButton").addEventListener("click", openExpenseModal);
document.querySelector("#seedButton").addEventListener("click", resetExampleData);

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    activeTab = button.dataset.tab;
    renderDetail();
  });
});

projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(projectForm);
  const members = data
    .get("members")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, index) => ({
      id: slugify(name) || `member-${index + 1}`,
      name,
      isMe: index === 0,
    }));

  const project = {
    id: uniqueId(),
    name: data.get("name").trim(),
    emoji: data.get("emoji").trim() || "🧾",
    archived: false,
    members,
    expenses: [],
  };

  state.projects.unshift(project);
  state.currentUserId = members[0].id;
  state.activeProjectId = project.id;
  saveState();
  projectForm.reset();
  projectModal.close();
  showDetail(project.id);
});

expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const project = getActiveProject();
  const data = new FormData(expenseForm);
  const splitWith = [...expenseForm.querySelectorAll("[name='splitWith']:checked")].map((input) => input.value);

  project.expenses.push({
    id: uniqueId(),
    title: data.get("title").trim(),
    category: data.get("category"),
    amount: parseAmount(data.get("amount")),
    currency: data.get("currency"),
    paidBy: data.get("paidBy"),
    date: data.get("date"),
    splitWith: splitWith.length ? splitWith : project.members.map((member) => member.id),
  });

  saveState();
  expenseForm.reset();
  expenseModal.close();
  renderDetail();
});

splitMembers.addEventListener("change", updateSplitPreview);
expenseForm.amount.addEventListener("input", updateSplitPreview);

function loadState() {
  const persisted = localStorage.getItem(storageKey);
  if (!persisted) return cloneData(exampleState);

  try {
    return JSON.parse(persisted);
  } catch {
    return cloneData(exampleState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function resetExampleData() {
  state = cloneData(exampleState);
  saveState();
  showHome();
}

function getActiveProject() {
  return state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0];
}

function renderHome() {
  projectList.replaceChildren();

  state.projects
    .filter((project) => !project.archived)
    .forEach((project) => {
      const template = document.querySelector("#projectTemplate").content.cloneNode(true);
      const card = template.querySelector(".project-card");
      card.querySelector(".project-emoji").textContent = project.emoji;
      card.querySelector("strong").textContent = project.name;
      card.querySelector("small").textContent = `${project.members.length} personas`;
      card.addEventListener("click", () => showDetail(project.id));
      projectList.append(card);
    });
}

function showHome() {
  detailScreen.hidden = true;
  homeScreen.hidden = false;
  renderHome();
}

function showDetail(projectId) {
  state.activeProjectId = projectId;
  saveState();
  homeScreen.hidden = true;
  detailScreen.hidden = false;
  renderDetail();
}

function renderDetail() {
  const project = getActiveProject();
  document.querySelector("#detailEmoji").textContent = project.emoji;
  document.querySelector("#detailTitle").textContent = project.name;

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
    expenseList.innerHTML = `<div class="empty-state"><strong>No hay gastos</strong><span>Agrega el primer gasto compartido.</span></div>`;
    return;
  }

  Object.entries(grouped).forEach(([date, expenses]) => {
    const group = document.createElement("section");
    group.className = "date-group";
    group.innerHTML = `<h3>${formatDate(date)}</h3>`;

    expenses.forEach((expense) => {
      const template = document.querySelector("#expenseTemplate").content.cloneNode(true);
      template.querySelector(".expense-icon").textContent = categories[expense.category] ?? categories.Other;
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
  balanceList.replaceChildren();

  const currentSettlement = settlements.find((item) => item.from === state.currentUserId || item.to === state.currentUserId);
  if (currentSettlement) {
    const direction = currentSettlement.from === state.currentUserId ? "owe" : "are owed";
    const otherId = currentSettlement.from === state.currentUserId ? currentSettlement.to : currentSettlement.from;
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
    const card = document.createElement("article");
    card.className = "balance-card";
    card.innerHTML = `
      <span class="balance-avatar">${member.isMe ? "◕" : member.name.slice(0, 1).toUpperCase()}</span>
      <span>
        <strong>${member.name}</strong>
        <small>${member.isMe ? "Me" : "Participant"}</small>
      </span>
      <span class="balance-amount ${amount >= 0 ? "positive" : "negative"}">${amount >= 0 ? "+" : "-"}${formatMoney(Math.abs(amount))}</span>
    `;
    balanceList.append(card);
  });
}

function openExpenseModal() {
  const project = getActiveProject();
  paidBySelect.replaceChildren();
  splitMembers.replaceChildren();

  project.members.forEach((member) => {
    const option = document.createElement("option");
    option.value = member.id;
    option.textContent = memberLabel(project, member.id);
    paidBySelect.append(option);

    const row = document.createElement("label");
    row.className = "split-row";
    row.innerHTML = `
      <input type="checkbox" name="splitWith" value="${member.id}" checked />
      <span class="check">✓</span>
      <span>${memberLabel(project, member.id)}</span>
      <span class="split-value">$ 0,00</span>
    `;
    splitMembers.append(row);
  });

  expenseForm.date.value = new Date().toISOString().slice(0, 10);
  updateSplitPreview();
  expenseModal.showModal();
}

function updateSplitPreview() {
  const amount = parseAmount(expenseForm.amount.value);
  const checkedRows = [...splitMembers.querySelectorAll(".split-row")].filter((row) =>
    row.querySelector("input").checked
  );
  const share = checkedRows.length ? amount / checkedRows.length : 0;

  splitMembers.querySelectorAll(".split-row").forEach((row) => {
    row.querySelector(".split-value").textContent = row.querySelector("input").checked ? formatMoney(share) : formatMoney(0);
  });
}

function calculateBalances(project) {
  const balances = Object.fromEntries(project.members.map((member) => [member.id, 0]));

  project.expenses.forEach((expense) => {
    balances[expense.paidBy] += expense.amount;
    const share = expense.amount / expense.splitWith.length;
    expense.splitWith.forEach((memberId) => {
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
  return member.isMe ? `${member.name} (me)` : member.name;
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

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

renderHome();
