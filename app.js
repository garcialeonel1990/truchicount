const state = {
  currentScreen: "groups",
  currentTab: "expenses",
  currentGroupId: "aug-26",
  groups: [
    {
      id: "aug-26",
      title: "Dpto - Agosto '26",
      emoji: "🏡",
      monthLabel: "Agosto 2026",
      expenses: [
        {
          id: "exp-1",
          dateLabel: "30 Ago 2026",
          name: "Jumbo",
          payer: "Leo",
          amount: 21920.4,
          emoji: "🛒",
        },
        {
          id: "exp-2",
          dateLabel: "14 Ago 2026",
          name: "Farmacity",
          payer: "Aldu",
          amount: 52995,
          emoji: "🧴",
        },
        {
          id: "exp-3",
          dateLabel: "1 Ago 2026",
          name: "Mc",
          payer: "Aldu",
          amount: 44600,
          emoji: "🍔",
        },
      ],
      photos: [
        { id: "ph-1", title: "Jumbo", meta: "Ticket leído · 30 Ago" },
        { id: "ph-2", title: "Farmacity", meta: "Pendiente de validar · 14 Ago" },
      ],
    },
    {
      id: "jul-26",
      title: "Dpto - Julio '26",
      emoji: "🏡",
      monthLabel: "Julio 2026",
      expenses: [
        {
          id: "exp-4",
          dateLabel: "22 Jul 2026",
          name: "Coto",
          payer: "Leo",
          amount: 18440,
          emoji: "🧃",
        },
      ],
      photos: [{ id: "ph-3", title: "Coto", meta: "Ticket leído · 22 Jul" }],
    },
    {
      id: "jun-26",
      title: "Dpto - Junio '26",
      emoji: "🏡",
      monthLabel: "Junio 2026",
      expenses: [
        {
          id: "exp-5",
          dateLabel: "3 Jun 2026",
          name: "Easy",
          payer: "Aldu",
          amount: 77200,
          emoji: "🧰",
        },
      ],
      photos: [],
    },
  ],
};

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const groupList = document.querySelector("#group-list");
const expenseSections = document.querySelector("#expense-sections");
const balanceList = document.querySelector("#balance-list");
const photoGrid = document.querySelector("#photo-grid");
const detailTitle = document.querySelector("#detail-title");
const myTotal = document.querySelector("#my-total");
const groupTotal = document.querySelector("#group-total");
const balanceHeadline = document.querySelector("#balance-headline");
const balanceSubtitle = document.querySelector("#balance-subtitle");
const screens = document.querySelectorAll(".screen");
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".tab-panel");
const detailTabs = document.querySelector("#detail-tabs");
const expenseModal = document.querySelector("#expense-modal");
const ocrPreview = document.querySelector("#ocr-preview");

function formatMoney(value) {
  return currency.format(value);
}

function getCurrentGroup() {
  return state.groups.find((group) => group.id === state.currentGroupId);
}

function calculateTotals(group) {
  const totals = group.expenses.reduce(
    (acc, expense) => {
      acc.total += expense.amount;
      acc[expense.payer] += expense.amount;
      return acc;
    },
    { total: 0, Leo: 0, Aldu: 0 }
  );

  const half = totals.total / 2;

  return {
    total: totals.total,
    leoSpent: totals.Leo,
    alduSpent: totals.Aldu,
    leoBalance: totals.Leo - half,
    alduBalance: totals.Aldu - half,
  };
}

function groupExpensesByDate(expenses) {
  return expenses.reduce((acc, expense) => {
    if (!acc[expense.dateLabel]) {
      acc[expense.dateLabel] = [];
    }
    acc[expense.dateLabel].push(expense);
    return acc;
  }, {});
}

function renderGroups() {
  groupList.innerHTML = state.groups
    .map(
      (group) => `
        <button class="group-card" data-group-id="${group.id}" type="button">
          <div class="group-emoji">${group.emoji}</div>
          <div>
            <p class="group-title">${group.title}</p>
            <p class="group-meta">${group.expenses.length} gastos cargados</p>
          </div>
          <div class="group-chevron">›</div>
        </button>
      `
    )
    .join("");
}

function renderExpenses(group) {
  const groupedExpenses = groupExpensesByDate(group.expenses);
  expenseSections.innerHTML = Object.entries(groupedExpenses)
    .map(
      ([dateLabel, expenses]) => `
        <section>
          <h3 class="expense-date">${dateLabel}</h3>
          <div class="group-list">
            ${expenses
              .map(
                (expense) => `
                  <article class="expense-card">
                    <div class="expense-emoji">${expense.emoji}</div>
                    <div>
                      <p class="expense-title">${expense.name}</p>
                      <p class="expense-subtitle">Pagó ${expense.payer}</p>
                    </div>
                    <div class="expense-amount">${formatMoney(expense.amount)}</div>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      `
    )
    .join("");
}

function renderBalances(group, totals) {
  const leoLabel = totals.leoBalance < 0 ? "Debe" : "Recibe";
  const alduLabel = totals.alduBalance < 0 ? "Debe" : "Recibe";
  const absLeo = Math.abs(totals.leoBalance);
  const absAldu = Math.abs(totals.alduBalance);

  if (absLeo < 1 && absAldu < 1) {
    balanceHeadline.textContent = "Están empatados";
    balanceSubtitle.textContent = "No hace falta compensar nada este mes.";
  } else if (totals.leoBalance < 0) {
    balanceHeadline.textContent = `Leo le debe ${formatMoney(absLeo)} a Aldu`;
    balanceSubtitle.textContent = "Si compensan eso, el mes queda saldado.";
  } else {
    balanceHeadline.textContent = `Aldu le debe ${formatMoney(absAldu)} a Leo`;
    balanceSubtitle.textContent = "Si compensan eso, el mes queda saldado.";
  }

  balanceList.innerHTML = `
    <article class="balance-card">
      <div class="balance-avatar">L</div>
      <div>
        <p class="balance-name">Leo</p>
        <p class="balance-role">Yo · ${leoLabel}</p>
      </div>
      <div class="balance-amount ${totals.leoBalance >= 0 ? "positive" : "negative"}">
        ${totals.leoBalance >= 0 ? "+" : "-"}${formatMoney(absLeo)}
      </div>
    </article>
    <article class="balance-card">
      <div class="balance-avatar">A</div>
      <div>
        <p class="balance-name">Aldu</p>
        <p class="balance-role">${alduLabel}</p>
      </div>
      <div class="balance-amount ${totals.alduBalance >= 0 ? "positive" : "negative"}">
        ${totals.alduBalance >= 0 ? "+" : "-"}${formatMoney(absAldu)}
      </div>
    </article>
  `;
}

function renderPhotos(group) {
  photoGrid.innerHTML = group.photos.length
    ? group.photos
        .map(
          (photo) => `
            <article class="photo-tile">
              <strong>${photo.title}</strong>
              <p class="photo-caption">${photo.meta}</p>
            </article>
          `
        )
        .join("")
    : `
      <article class="photo-tile">
        <strong>Todavía no hay tickets cargados</strong>
        <p class="photo-caption">Empezá con una foto para completar comercio, fecha y total.</p>
      </article>
    `;
}

function renderDetail() {
  const group = getCurrentGroup();
  const totals = calculateTotals(group);

  detailTitle.textContent = group.title;
  myTotal.textContent = formatMoney(totals.leoSpent);
  groupTotal.textContent = formatMoney(totals.total);

  renderExpenses(group);
  renderBalances(group, totals);
  renderPhotos(group);
}

function setScreen(screenName) {
  state.currentScreen = screenName;
  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === screenName);
  });
}

function setTab(tabName) {
  state.currentTab = tabName;
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });
  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });
}

function initEvents() {
  groupList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-group-id]");
    if (!target) return;

    state.currentGroupId = target.dataset.groupId;
    renderDetail();
    setScreen("detail");
    setTab("expenses");
  });

  document.querySelector("#back-button").addEventListener("click", () => {
    setScreen("groups");
  });

  detailTabs.addEventListener("click", (event) => {
    const target = event.target.closest("[data-tab]");
    if (!target) return;
    setTab(target.dataset.tab);
  });

  const openExpenseModal = () => {
    expenseModal.showModal();
  };

  document.querySelector("#add-expense-button").addEventListener("click", openExpenseModal);
  document.querySelector("#new-group-button").addEventListener("click", openExpenseModal);
  document.querySelector("#scan-ticket-button").addEventListener("click", () => {
    setTab("photos");
    openExpenseModal();
    ocrPreview.classList.add("visible");
  });

  document.querySelector("#modal-scan-button").addEventListener("click", () => {
    ocrPreview.classList.add("visible");
  });

  document.querySelector("#manual-entry-button").addEventListener("click", () => {
    ocrPreview.classList.remove("visible");
  });

  document.querySelector("#close-modal-button").addEventListener("click", () => {
    ocrPreview.classList.remove("visible");
  });

  expenseModal.addEventListener("close", () => {
    ocrPreview.classList.remove("visible");
  });
}

renderGroups();
renderDetail();
initEvents();
