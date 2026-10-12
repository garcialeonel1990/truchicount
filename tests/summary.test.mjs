import assert from "node:assert/strict";
import test from "node:test";
import { expensesCsv, summarizeExpenses } from "../summary.js";

test("el resumen conserva la parte y el pago de integrantes inactivos", () => {
  const summary = summarizeExpenses([
    { status: "active", categoryId: "food", categoryNameSnapshot: "Comidas", currency: "ARS", amountMinor: 9000, payerMemberId: "leo", participantShares: { leo: 4500, gallego: 4500 } },
    { status: "active", categoryId: "food", categoryNameSnapshot: "Comidas", currency: "ARS", amountMinor: 3000, payerMemberId: "gallego", participantShares: { gallego: 3000 } },
    { status: "deleted", categoryId: "food", currency: "ARS", amountMinor: 999, payerMemberId: "leo", participantShares: { leo: 999 } },
  ]);
  assert.deepEqual(summary.totalByCurrency, { ARS: 12000 });
  assert.equal(summary.categories[0].expenseCount, 2);
  assert.deepEqual(summary.categories[0].people.gallego, { paid: { ARS: 3000 }, share: { ARS: 7500 } });
});

test("el CSV conserva el detalle de categoría, pagador y reparto", () => {
  const csv = expensesCsv([{ status: "active", expenseDate: "2026-10-12", title: "Cena, viernes", categoryId: "food", amountMinor: 1000, currency: "ARS", payerMemberId: "leo", participantShares: { leo: 500, aldu: 500 }, notes: "Con postre" }], {
    categoryName: () => "Comidas", memberName: (id) => ({ leo: "Leo", aldu: "Aldu" })[id], date: (value) => value, money: (amount) => "$" + amount,
  });
  assert.match(csv, /"Cena, viernes"/);
  assert.match(csv, /Leo: \$500 · Aldu: \$500/);
});
