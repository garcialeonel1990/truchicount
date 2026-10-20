import assert from "node:assert/strict";
import test from "node:test";
import { normalizeExpenseInput, normalizePayerShares } from "../expense-input.js";

const members = [{ id: "a", active: true }, { id: "b", active: true }, { id: "old", active: false }];
const base = { title: "Cena", merchantId: null, categoryId: "cat", amountMinor: 9000, expenseDate: "2026-10-20", payerShares: { a: 3000, b: 6000 }, participantMemberIds: ["a", "b"], notes: "" };
const category = { id: "cat", name: "Comida", status: "active" };

test("U1: normaliza pagadores múltiples y descarta ceros", () => {
  assert.deepEqual(normalizePayerShares({ a: 9000, b: 0 }, ["a", "b"], 9000), { payerMemberId: "a", payerShares: null });
  assert.deepEqual(normalizePayerShares({ b: 6000, a: 3000 }, ["a", "b"], 9000), { payerMemberId: "a", payerShares: { a: 3000, b: 6000 } });
});

test("U2: rechaza pagadores corruptos", () => {
  for (const value of [{}, [], { a: 1.5 }, { a: -1 }, { z: 9000 }, { a: 8000 }]) assert.throws(() => normalizePayerShares(value, ["a", "b"], 9000));
});

test("U3/U4: normaliza gastos y permite pagador fuera del reparto", () => {
  const result = normalizeExpenseInput({ ...base, participantMemberIds: ["a"], payerShares: { a: 3000, b: 6000 } }, { members, amountCurrency: "ARS", category });
  assert.equal(result.payerMemberId, "a");
  assert.deepEqual(result.participantShares, { a: 9000 });
  assert.throws(() => normalizeExpenseInput({ ...base, expenseDate: "2026-13-01" }, { members, amountCurrency: "ARS", category }));
  assert.throws(() => normalizeExpenseInput({ ...base, participantMemberIds: ["old"] }, { members, amountCurrency: "ARS", category }));
  assert.doesNotThrow(() => normalizeExpenseInput({ ...base, participantMemberIds: ["old"], payerShares: { old: 9000 } }, { members, amountCurrency: "ARS", category, mode: "update", before: { participantMemberIds: ["old"], amountMinor: 9000, payerMemberId: "old", participantShares: { old: 9000 }, categoryId: "cat" } }));
});

test("BUG-06: el gasto normalizado incluye la moneda del Count (create) o la original (update)", () => {
  const created = normalizeExpenseInput(base, { members, amountCurrency: "EUR", category, mode: "create" });
  assert.equal(created.currency, "EUR");
  const before = { currency: "ARS", amountMinor: 9000, payerMemberId: "a", participantMemberIds: ["a", "b"], participantShares: { a: 4500, b: 4500 } };
  const updated = normalizeExpenseInput(base, { members, amountCurrency: "EUR", category, before, mode: "update" });
  assert.equal(updated.currency, "ARS");
  assert.throws(() => normalizeExpenseInput(base, { members, amountCurrency: "ZZZ", category, mode: "create" }), /moneda/);
});
