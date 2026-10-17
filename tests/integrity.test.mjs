import assert from "node:assert/strict";
import test from "node:test";
import { hasZeroBalance, isCurrentSettlementSuggestion, pendingBalanceCurrencies } from "../integrity.js";
import { calculateNetBalances, simplifyDebts } from "../balances.js";
import { summarizeExpenses } from "../summary.js";

const members = [{ id: "a", active: true }, { id: "b", active: true }];
const expenses = [{ status: "active", currency: "ARS", amountMinor: 10000, payerMemberId: "a", participantShares: { a: 5000, b: 5000 } }];

test("una liquidación sólo acepta la sugerencia del historial actual", () => {
  const suggestion = { fromMemberId: "b", toMemberId: "a", currency: "ARS", amountMinor: 5000 };
  assert.equal(isCurrentSettlementSuggestion({ members, expenses, settlements: [], suggestion }), true);
  assert.equal(isCurrentSettlementSuggestion({ members, expenses, settlements: [], suggestion: { ...suggestion, amountMinor: 4000 } }), false);
  assert.equal(isCurrentSettlementSuggestion({ members, expenses, settlements: [{ ...suggestion, status: "active" }], suggestion }), false);
});

test("los saldos pendientes y cero se detectan por moneda", () => {
  const balances = { a: { ARS: 0, USD: 20 }, b: { ARS: 0, USD: -20 } };
  assert.equal(hasZeroBalance(balances, "a"), false);
  assert.equal(hasZeroBalance({ a: { ARS: 0 } }, "a"), true);
  assert.deepEqual(pendingBalanceCurrencies(balances), ["USD"]);
});

test("un gasto personal figura en el resumen sin generar deudas", () => {
  const personalMembers = [{ id: "owner", active: true }];
  const personalExpenses = [{ status: "active", currency: "ARS", amountMinor: 12345, payerMemberId: "owner", participantShares: { owner: 12345 } }];
  const balances = calculateNetBalances(personalMembers, personalExpenses, []);
  assert.equal(balances.owner.ARS, 0);
  assert.deepEqual(simplifyDebts(balances), []);
  assert.deepEqual(summarizeExpenses(personalExpenses).totalByCurrency, { ARS: 12345 });
});
