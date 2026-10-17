import { calculateNetBalances, simplifyDebts } from "./balances.js";

export function hasZeroBalance(balances, memberId) {
  return Object.values(balances[memberId] || {}).every((amount) => amount === 0);
}

export function pendingBalanceCurrencies(balances) {
  const pending = new Set();
  Object.values(balances).forEach((byCurrency) => {
    Object.entries(byCurrency).forEach(([currency, amount]) => {
      if (amount !== 0) pending.add(currency);
    });
  });
  return [...pending].sort();
}

// A settlement is valid only when it is still one of the deterministic
// suggestions produced from the exact ledger snapshot being committed.
export function isCurrentSettlementSuggestion({ members, expenses, settlements, suggestion }) {
  if (!suggestion || !Number.isSafeInteger(suggestion.amountMinor) || suggestion.amountMinor <= 0) return false;
  const suggestions = simplifyDebts(calculateNetBalances(members, expenses, settlements));
  return suggestions.some((item) => item.fromMemberId === suggestion.fromMemberId
    && item.toMemberId === suggestion.toMemberId
    && item.currency === suggestion.currency
    && item.amountMinor === suggestion.amountMinor);
}
