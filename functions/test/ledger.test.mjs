import assert from "node:assert/strict";
import test from "node:test";
import { calculateNetBalances as clientBalances, simplifyDebts as clientDebts } from "../../balances.js";
import { calculateNetBalances, currentSuggestions, simplifyDebts, validateLedger } from "../ledger.js";

const members = [{ id: "a" }, { id: "b" }, { id: "c" }];
const expenses = [
  { status: "active", amountMinor: 10001, currency: "ARS", payerMemberId: "a", participantMemberIds: ["a", "b", "c"], participantShares: { a: 3335, b: 3333, c: 3333 } },
  { status: "deleted", amountMinor: 900, currency: "ARS", payerMemberId: "b", participantMemberIds: ["a"], participantShares: { a: 900 } },
];

test("el algoritmo servidor conserva paridad con el cliente", () => {
  validateLedger(members, expenses, []);
  assert.deepEqual(calculateNetBalances(members, expenses, []), clientBalances(members, expenses, []));
  assert.deepEqual(simplifyDebts(calculateNetBalances(members, expenses, [])), clientDebts(clientBalances(members, expenses, [])));
});

test("el servidor rechaza repartos que no suman el total", () => {
  const corrupted = [{ ...expenses[0], participantShares: { a: 3333, b: 3333, c: 3333 } }];
  assert.throws(() => currentSuggestions(members, corrupted, []), /no suman/);
});

const multiPayer = [{ status: "active", amountMinor: 9000, currency: "ARS", payerMemberId: "a", payerShares: { a: 3000, b: 6000 }, participantMemberIds: ["a", "b", "c"], participantShares: { a: 3000, b: 3000, c: 3000 } }];

test("BUG-05: pagadores múltiples producen las mismas sugerencias en cliente y servidor", () => {
  assert.deepEqual(calculateNetBalances(members, multiPayer, []), clientBalances(members, multiPayer, []));
  assert.deepEqual(currentSuggestions(members, multiPayer, []), [{ fromMemberId: "c", toMemberId: "b", amountMinor: 3000, currency: "ARS" }]);
});

test("BUG-05: payerShares null usa el pagador único (legacy)", () => {
  const legacy = [{ ...multiPayer[0], payerShares: null }];
  assert.deepEqual(currentSuggestions(members, legacy, []), clientDebts(clientBalances(members, legacy, [])));
});

test("BUG-05: el servidor rechaza payerShares corruptos", () => {
  const bad = (payerShares) => [{ ...multiPayer[0], payerShares }];
  assert.throws(() => currentSuggestions(members, bad({ a: 3000, b: 5000 }), []), /no suman/);
  assert.throws(() => currentSuggestions(members, bad({ a: 9000, z: 0 }), []), /inexistente/);
  assert.throws(() => currentSuggestions(members, bad({ a: 9500, b: -500 }), []), /inválido/);
  assert.throws(() => currentSuggestions(members, bad({ a: 4500.5, b: 4499.5 }), []), /inválido/);
  assert.throws(() => currentSuggestions(members, bad({}), []), /inválidos/);
  assert.throws(() => currentSuggestions(members, bad([9000]), []), /inválidos/);
});
