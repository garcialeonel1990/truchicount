import assert from "node:assert/strict";
import test from "node:test";
import { hasMinimumActiveMembers, hasZeroBalance, isCurrentSettlementSuggestion, pendingBalanceCurrencies } from "../integrity.js";

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

test("un Count necesita al menos dos integrantes activos", () => {
  assert.equal(hasMinimumActiveMembers([{ id: "owner", active: true }]), false);
  assert.equal(hasMinimumActiveMembers([{ id: "owner", active: true }, { id: "guest", active: false }]), false);
  assert.equal(hasMinimumActiveMembers([{ id: "owner", active: true }, { id: "guest", active: true }]), true);
});
