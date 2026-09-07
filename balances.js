export function calculateNetBalances(members, expenses, settlements) {
  const balances = {};
  members.forEach((member) => {
    balances[member.uid] ??= {};
  });

  expenses.filter((expense) => expense.status === "active").forEach((expense) => {
    const currency = expense.currency;
    balances[expense.payerUid] ??= {};
    balances[expense.payerUid][currency] = (balances[expense.payerUid][currency] ?? 0) + expense.amountMinor;
    Object.entries(expense.participantShares ?? {}).forEach(([uid, share]) => {
      balances[uid] ??= {};
      balances[uid][currency] = (balances[uid][currency] ?? 0) - share;
    });
  });

  settlements.filter((settlement) => settlement.status === "active").forEach((settlement) => {
    const { currency, amountMinor, fromUid, toUid } = settlement;
    balances[fromUid] ??= {};
    balances[toUid] ??= {};
    balances[fromUid][currency] = (balances[fromUid][currency] ?? 0) + amountMinor;
    balances[toUid][currency] = (balances[toUid][currency] ?? 0) - amountMinor;
  });

  return balances;
}

export function simplifyDebts(balances) {
  const currencies = new Set(Object.values(balances).flatMap((byCurrency) => Object.keys(byCurrency)));
  const suggestions = [];

  currencies.forEach((currency) => {
    const debtors = Object.entries(balances)
      .map(([uid, totals]) => ({ uid, amount: -(totals[currency] ?? 0) }))
      .filter((entry) => entry.amount > 0)
      .sort((a, b) => b.amount - a.amount || a.uid.localeCompare(b.uid));
    const creditors = Object.entries(balances)
      .map(([uid, totals]) => ({ uid, amount: totals[currency] ?? 0 }))
      .filter((entry) => entry.amount > 0)
      .sort((a, b) => b.amount - a.amount || a.uid.localeCompare(b.uid));

    let debtorIndex = 0;
    let creditorIndex = 0;
    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amountMinor = Math.min(debtor.amount, creditor.amount);
      if (amountMinor) suggestions.push({ fromUid: debtor.uid, toUid: creditor.uid, amountMinor, currency });
      debtor.amount -= amountMinor;
      creditor.amount -= amountMinor;
      if (!debtor.amount) debtorIndex += 1;
      if (!creditor.amount) creditorIndex += 1;
    }
  });

  return suggestions;
}

export function actionsForUser(suggestions, uid) {
  return suggestions.filter((suggestion) => suggestion.fromUid === uid || suggestion.toUid === uid);
}
