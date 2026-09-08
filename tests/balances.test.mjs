import assert from "node:assert/strict";
import test from "node:test";
import { balanceCurrencies, balancePresentation, calculateNetBalances, simplifyDebts } from "../balances.js";

test("RF-04: estar al día no equivale a que el Count esté saldado", () => {
  const members = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const expenses = [{ status: "active", currency: "ARS", amountMinor: 100000, payerMemberId: "c", participantShares: { b: 100000 } }];
  const suggestions = simplifyDebts(calculateNetBalances(members, expenses, []));
  const presentation = balancePresentation({ suggestions, memberId: "a" });
  assert.equal(presentation.state, "up-to-date");
  assert.deepEqual(presentation.suggestions, [{ fromMemberId: "b", toMemberId: "c", amountMinor: 100000, currency: "ARS" }]);
});

test("RF-19: nunca informa saldo cero mientras carga o ante un error", () => {
  assert.equal(balancePresentation({ suggestions: [], memberId: "a", ready: false }).state, "loading");
  assert.equal(balancePresentation({ suggestions: [], memberId: "a", failed: true }).state, "error");
});

test("los integrantes sin movimientos conservan la moneda usada por el Count", () => {
  assert.deepEqual(balanceCurrencies({ gallego: {}, aldu: {}, leo: { UYU: 500 } }, "ARS"), ["UYU"]);
  assert.deepEqual(balanceCurrencies({ gallego: {} }, "USD"), ["USD"]);
});
