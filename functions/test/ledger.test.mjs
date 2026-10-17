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
