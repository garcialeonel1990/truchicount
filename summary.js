function addAmount(totals, currency, amount) {
  totals[currency] = (totals[currency] || 0) + amount;
}

// Keep reporting independent from the DOM. In particular, inactive members
// remain in the result because their historical participation is still real.
export function summarizeExpenses(expenses = []) {
  const totalByCurrency = {};
  const categories = new Map();

  expenses.filter((expense) => expense.status === "active").forEach((expense) => {
    const currency = expense.currency;
    const amount = Number(expense.amountMinor) || 0;
    const categoryId = expense.categoryId || "uncategorized";
    let category = categories.get(categoryId);
    if (!category) {
      category = {
        categoryId,
        categoryNameSnapshot: expense.categoryNameSnapshot || "Sin categoría",
        expenseCount: 0,
        totals: {},
        people: {},
      };
      categories.set(categoryId, category);
    }
    category.expenseCount += 1;
    addAmount(category.totals, currency, amount);
    addAmount(totalByCurrency, currency, amount);

    const payer = category.people[expense.payerMemberId] ||= { paid: {}, share: {} };
    addAmount(payer.paid, currency, amount);
    Object.entries(expense.participantShares || {}).forEach(([memberId, share]) => {
      const person = category.people[memberId] ||= { paid: {}, share: {} };
      addAmount(person.share, currency, Number(share) || 0);
    });
  });

  return {
    totalByCurrency,
    categories: [...categories.values()].sort((a, b) => {
      const aTotal = Object.values(a.totals).reduce((sum, amount) => sum + amount, 0);
      const bTotal = Object.values(b.totals).reduce((sum, amount) => sum + amount, 0);
      return bTotal - aTotal || a.categoryNameSnapshot.localeCompare(b.categoryNameSnapshot, "es");
    }),
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

export function expensesCsv(expenses, { categoryName, memberName, date, money }) {
  const header = ["Fecha", "Descripción", "Categoría", "Monto", "Moneda", "Pagó", "Participantes y partes", "Notas"];
  const rows = expenses.filter((expense) => expense.status === "active")
    .sort((a, b) => String(date(b.expenseDate)).localeCompare(String(date(a.expenseDate))))
    .map((expense) => {
      const split = Object.entries(expense.participantShares || {})
        .map(([memberId, amount]) => memberName(memberId) + ": " + money(amount, expense.currency)).join(" · ");
      return [
        date(expense.expenseDate), expense.title, categoryName(expense), money(expense.amountMinor, expense.currency), expense.currency,
        memberName(expense.payerMemberId), split, expense.notes || "",
      ].map(csvCell).join(",");
    });
  return "\uFEFF" + [header.map(csvCell).join(","), ...rows].join("\n");
}
