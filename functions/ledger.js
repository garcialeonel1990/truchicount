import { isSupportedCurrency } from "./currencies.js";

function add(current = 0, amount = 0) {
  const next = current + amount;
  if (!Number.isSafeInteger(next)) throw new Error("El ledger excede el rango numérico permitido.");
  return next;
}

function validId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && !value.includes("/");
}

// Legacy expenses have no payerShares: the single payer covered the full amount.
export function payerSharesOf(expense) {
  return expense.payerShares ?? { [expense.payerMemberId]: expense.amountMinor };
}

export function validateLedger(members, expenses, settlements) {
  const memberIds = new Set(members.map((member) => member.id));
  if (memberIds.size !== members.length || [...memberIds].some((id) => !validId(id))) throw new Error("El ledger contiene integrantes inválidos.");

  expenses.filter((expense) => expense.status === "active").forEach((expense) => {
    if (!Number.isSafeInteger(expense.amountMinor) || expense.amountMinor <= 0) throw new Error("El ledger contiene un gasto con monto inválido.");
    if (!isSupportedCurrency(expense.currency)) throw new Error("El ledger contiene una moneda inválida.");
    if (!memberIds.has(expense.payerMemberId)) throw new Error("El ledger contiene un pagador inexistente.");
    const payers = payerSharesOf(expense);
    if (!payers || typeof payers !== "object" || Array.isArray(payers) || !Object.keys(payers).length) throw new Error("El ledger contiene pagadores inválidos.");
    const paidTotal = Object.entries(payers).reduce((sum, [memberId, paid]) => {
      if (!memberIds.has(memberId)) throw new Error("El ledger contiene un pagador inexistente.");
      if (!Number.isSafeInteger(paid) || paid < 0) throw new Error("El ledger contiene un pago inválido.");
      return add(sum, paid);
    }, 0);
    if (paidTotal !== expense.amountMinor) throw new Error("Los pagos del gasto no suman el monto total.");
    const participants = expense.participantMemberIds;
    if (!Array.isArray(participants) || !participants.length || new Set(participants).size !== participants.length) throw new Error("El ledger contiene participantes inválidos.");
    if (participants.some((memberId) => !memberIds.has(memberId))) throw new Error("El ledger contiene participantes inexistentes.");
    const shares = expense.participantShares;
    if (!shares || typeof shares !== "object" || Array.isArray(shares)) throw new Error("El ledger contiene un reparto inválido.");
    const shareIds = Object.keys(shares).sort();
    const expectedIds = [...participants].sort();
    if (shareIds.length !== expectedIds.length || shareIds.some((id, index) => id !== expectedIds[index])) throw new Error("El reparto no coincide con los participantes.");
    const total = shareIds.reduce((sum, memberId) => {
      const share = shares[memberId];
      if (!Number.isSafeInteger(share) || share < 0) throw new Error("El ledger contiene una parte inválida.");
      return add(sum, share);
    }, 0);
    if (total !== expense.amountMinor) throw new Error("Las partes del gasto no suman el monto total.");
  });

  settlements.filter((settlement) => settlement.status === "active").forEach((settlement) => {
    if (!Number.isSafeInteger(settlement.amountMinor) || settlement.amountMinor <= 0) throw new Error("El ledger contiene una liquidación con monto inválido.");
    if (!isSupportedCurrency(settlement.currency)) throw new Error("El ledger contiene una liquidación con moneda inválida.");
    if (!memberIds.has(settlement.fromMemberId) || !memberIds.has(settlement.toMemberId) || settlement.fromMemberId === settlement.toMemberId) throw new Error("El ledger contiene una liquidación entre integrantes inválidos.");
  });
}

export function calculateNetBalances(members, expenses, settlements) {
  const balances = Object.fromEntries(members.map((member) => [member.id, {}]));
  expenses.filter((expense) => expense.status === "active").forEach((expense) => {
    const currency = expense.currency;
    Object.entries(payerSharesOf(expense)).forEach(([memberId, paid]) => {
      balances[memberId][currency] = add(balances[memberId][currency], paid);
    });
    Object.entries(expense.participantShares).forEach(([memberId, share]) => {
      balances[memberId][currency] = add(balances[memberId][currency], -share);
    });
  });
  settlements.filter((settlement) => settlement.status === "active").forEach((settlement) => {
    const { currency, amountMinor, fromMemberId, toMemberId } = settlement;
    balances[fromMemberId][currency] = add(balances[fromMemberId][currency], amountMinor);
    balances[toMemberId][currency] = add(balances[toMemberId][currency], -amountMinor);
  });
  return balances;
}

export function simplifyDebts(balances) {
  const currencies = new Set(Object.values(balances).flatMap((totals) => Object.keys(totals)));
  const suggestions = [];
  [...currencies].sort().forEach((currency) => {
    const debtors = Object.entries(balances).map(([memberId, totals]) => ({ memberId, amount: -(totals[currency] || 0) }))
      .filter((entry) => entry.amount > 0).sort((a, b) => b.amount - a.amount || a.memberId.localeCompare(b.memberId));
    const creditors = Object.entries(balances).map(([memberId, totals]) => ({ memberId, amount: totals[currency] || 0 }))
      .filter((entry) => entry.amount > 0).sort((a, b) => b.amount - a.amount || a.memberId.localeCompare(b.memberId));
    let debtorIndex = 0;
    let creditorIndex = 0;
    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amountMinor = Math.min(debtor.amount, creditor.amount);
      if (amountMinor > 0) suggestions.push({ fromMemberId: debtor.memberId, toMemberId: creditor.memberId, amountMinor, currency });
      debtor.amount -= amountMinor;
      creditor.amount -= amountMinor;
      if (debtor.amount === 0) debtorIndex += 1;
      if (creditor.amount === 0) creditorIndex += 1;
    }
  });
  return suggestions;
}

export function currentSuggestions(members, expenses, settlements) {
  validateLedger(members, expenses, settlements);
  return simplifyDebts(calculateNetBalances(members, expenses, settlements));
}
