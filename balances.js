export function calculateNetBalances(members, expenses, settlements) {
  const balances = {};
  members.forEach((member) => {
    balances[member.id] ??= {};
  });

  expenses.filter((expense) => expense.status === "active").forEach((expense) => {
    const currency = expense.currency;
    balances[expense.payerMemberId] ??= {};
    balances[expense.payerMemberId][currency] = (balances[expense.payerMemberId][currency] ?? 0) + expense.amountMinor;
    Object.entries(expense.participantShares ?? {}).forEach(([memberId, share]) => {
      balances[memberId] ??= {};
      balances[memberId][currency] = (balances[memberId][currency] ?? 0) - share;
    });
  });

  settlements.filter((settlement) => settlement.status === "active").forEach((settlement) => {
    const { currency, amountMinor, fromMemberId, toMemberId } = settlement;
    balances[fromMemberId] ??= {};
    balances[toMemberId] ??= {};
    balances[fromMemberId][currency] = (balances[fromMemberId][currency] ?? 0) + amountMinor;
    balances[toMemberId][currency] = (balances[toMemberId][currency] ?? 0) - amountMinor;
  });

  return balances;
}

export function simplifyDebts(balances) {
  const currencies = new Set(Object.values(balances).flatMap((byCurrency) => Object.keys(byCurrency)));
  const suggestions = [];

  currencies.forEach((currency) => {
    const debtors = Object.entries(balances)
      .map(([memberId, totals]) => ({ memberId, amount: -(totals[currency] ?? 0) }))
      .filter((entry) => entry.amount > 0)
      .sort((a, b) => b.amount - a.amount || a.memberId.localeCompare(b.memberId));
    const creditors = Object.entries(balances)
      .map(([memberId, totals]) => ({ memberId, amount: totals[currency] ?? 0 }))
      .filter((entry) => entry.amount > 0)
      .sort((a, b) => b.amount - a.amount || a.memberId.localeCompare(b.memberId));

    let debtorIndex = 0;
    let creditorIndex = 0;
    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amountMinor = Math.min(debtor.amount, creditor.amount);
      if (amountMinor) suggestions.push({ fromMemberId: debtor.memberId, toMemberId: creditor.memberId, amountMinor, currency });
      debtor.amount -= amountMinor;
      creditor.amount -= amountMinor;
      if (!debtor.amount) debtorIndex += 1;
      if (!creditor.amount) creditorIndex += 1;
    }
  });

  return suggestions;
}

export function actionsForUser(suggestions, memberId) {
  return suggestions.filter((suggestion) => suggestion.fromMemberId === memberId || suggestion.toMemberId === memberId);
}

// Keep the Count state independent from the current user's actions. A member
// can be personally up to date while another pair still has a pending payment.
export function balancePresentation({ suggestions, memberId, ready = true, failed = false }) {
  if (failed) return { state: "error", suggestions: [], myActions: [] };
  if (!ready) return { state: "loading", suggestions: [], myActions: [] };
  const myActions = actionsForUser(suggestions, memberId);
  if (!suggestions.length) return { state: "settled", suggestions, myActions };
  return { state: myActions.length ? "actionable" : "up-to-date", suggestions, myActions };
}
