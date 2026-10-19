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

test("un gasto con varios pagadores reparte el crédito según lo que pagó cada uno", () => {
  const members = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const expenses = [{ status: "active", currency: "USD", amountMinor: 300000, payerMemberId: "a", payerShares: { a: 150000, b: 150000, c: 0 }, participantShares: { a: 100000, b: 100000, c: 100000 } }];
  assert.deepEqual(calculateNetBalances(members, expenses, []), { a: { USD: 50000 }, b: { USD: 50000 }, c: { USD: -100000 } });
  assert.deepEqual(simplifyDebts(calculateNetBalances(members, expenses, [])), [
    { fromMemberId: "c", toMemberId: "a", amountMinor: 50000, currency: "USD" },
    { fromMemberId: "c", toMemberId: "b", amountMinor: 50000, currency: "USD" },
  ]);
});
