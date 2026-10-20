// countCommandV1 (runCountCommand) contra Firestore Emulator — casos C01–C17 del SDD-2 + monedas del SDD-3.
import assert from "node:assert/strict";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { before, beforeEach, test } from "node:test";

import { runCountCommand } from "../count-commands.js";
import { createSettlementCommand } from "../settlement-service.js";
import { calculateNetBalances, simplifyDebts } from "../../balances.js";

const C = "countA"; let db; let n = 0;
const uuid = () => `123e4567-e89b-42d3-a456-${String(++n).padStart(12, "0")}`;
const run = (uid, type, payload, requestId = uuid(), countId = C) => runCountCommand({ db, uid, input: { type, countId, requestId, payload } });
const reason = (r) => (e) => e?.details?.reason === r || e?.code === r;
const expensePayload = (over = {}) => ({ title: "Jumbo", merchantId: null, categoryId: "cat1", amountMinor: 9000, expenseDate: "2026-10-19",
  payerShares: { a: 9000 }, participantMemberIds: ["a", "b", "c"], notes: "", ...over });
const count = async (path) => (await db.collection(path).get()).size;

async function seed({ currency = "ARS", members = ["a:owner", "b", "c"], status = "active" } = {}) {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-truchicount/databases/(default)/documents`, { method: "DELETE" });
  for (const [uid, s] of [["owner", "approved"], ["bob", "approved"], ["pend", "pending"], ["stranger", "approved"]]) await db.doc(`users/${uid}`).set({ uid, accessStatus: s, alias: uid });
  await db.doc(`counts/${C}`).set({ status, primaryCurrency: currency, defaultCurrency: currency, hasMovements: false });
  for (const spec of members) {
    const [id, uid] = spec.split(":");
    await db.doc(`counts/${C}/members/${id}`).set(uid ? { type: "registered", userId: uid, active: true, alias: uid } : { type: "manual", userId: null, active: true, alias: id, manualAlias: id });
    if (uid) await db.doc(`memberships/${C}_${uid}`).set({ countId: C, uid, memberId: id, status: "active" });
  }
  await db.doc("memberships/countA_pend").set({ countId: C, uid: "pend", memberId: "p", status: "active" });
  await db.doc("categories/cat1").set({ name: "Groceries", emoji: "🛒", status: "active", createdBy: "owner" });
  await db.doc("categories/old").set({ name: "Vieja", emoji: "🧾", status: "inactive", createdBy: "owner" });
  await db.doc("invites/tok").set({ countId: C, status: "active", manualCandidates: [] });
}
async function suggestions() {
  const get = async (p) => (await db.collection(`counts/${C}/${p}`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  return simplifyDebts(calculateNetBalances(await get("members"), await get("expenses"), await get("settlements")));
}
async function settleAll() {
  for (let i = 0; i < 10; i++) { const [s] = await suggestions(); if (!s) return; await createSettlementCommand({ db, uid: "owner", input: { countId: C, requestId: uuid(), suggestion: s } }); }
}

before(() => { if (!getApps().length) initializeApp({ projectId: "demo-truchicount" }); db = getFirestore(); });
beforeEach(() => seed());

test("C01 expense.create: shares del servidor, version 1, auditoría, hasMovements y revision", async () => {
  const id = uuid(); const r = await run("owner", "expense.create", expensePayload(), id);
  assert.deepEqual(r, { ok: true, result: { expenseId: id, version: 1 }, alreadyApplied: false });
  const e = (await db.doc(`counts/${C}/expenses/${id}`).get()).data();
  assert.deepEqual(e.participantShares, { a: 3000, b: 3000, c: 3000 });
  assert.equal(e.payerShares, null); assert.equal(e.payerMemberId, "a"); assert.equal(e.currency, "ARS"); assert.equal(e.createdBy, "owner"); assert.equal(e.categoryNameSnapshot, "Groceries");
  const c = (await db.doc(`counts/${C}`).get()).data(); assert.equal(c.hasMovements, true); assert.equal(c.revision, 1);
  assert.equal(await count("auditLogs"), 1);
});
test("C02 reintento con el mismo requestId: 1 gasto, 1 auditoría, 1 recibo", async () => {
  const id = uuid(); await run("owner", "expense.create", expensePayload(), id);
  const r = await run("owner", "expense.create", expensePayload(), id);
  assert.equal(r.alreadyApplied, true);
  assert.equal(await count(`counts/${C}/expenses`), 1); assert.equal(await count("auditLogs"), 1); assert.equal(await count(`counts/${C}/commandReceipts`), 1);
});
test("C03 mismo requestId con otro payload u otro usuario → REQUEST_REUSED", async () => {
  await seed({ members: ["a:owner", "b:bob", "c"] });
  const id = uuid(); await run("owner", "expense.create", expensePayload(), id);
  await assert.rejects(run("owner", "expense.create", expensePayload({ title: "Otro" }), id), reason("REQUEST_REUSED"));
  await assert.rejects(run("bob", "expense.create", expensePayload(), id), reason("REQUEST_REUSED"));
});
test("C04 payload con campos del servidor o extra → INVALID_INPUT sin escrituras", async () => {
  for (const extra of [{ createdBy: "x" }, { currency: "USD" }, { participantShares: { a: 9000 } }, { hack: 1 }])
    await assert.rejects(run("owner", "expense.create", expensePayload(extra)), reason("INVALID_INPUT"));
  await assert.rejects(runCountCommand({ db, uid: "owner", input: { type: "expense.create", countId: C, requestId: uuid(), payload: expensePayload(), actorUid: "x" } }), reason("INVALID_INPUT"));
  assert.equal(await count(`counts/${C}/expenses`), 0); assert.equal(await count("auditLogs"), 0);
});
test("C04b validación: payerShares corruptos, participantes ajenos, categoría inactiva, fecha inválida", async () => {
  const bad = [{ payerShares: { a: 1, b: 1 } }, { payerShares: { ghost: 9000 } }, { participantMemberIds: ["a", "ghost"] }, { participantMemberIds: ["a", "a"] },
    { categoryId: "old" }, { categoryId: "nope" }, { expenseDate: "2026-13-01" }, { expenseDate: "19/10/2026" }, { amountMinor: 10.5 }, { amountMinor: 0 }, { title: "" }, { merchantId: "nope" }];
  for (const over of bad) await assert.rejects(run("owner", "expense.create", expensePayload(over)), (e) => ["INVALID_INPUT", "NOT_FOUND"].includes(e?.details?.reason), JSON.stringify(over));
  assert.equal(await count(`counts/${C}/expenses`), 0);
});
test("C04c pagador fuera del reparto y pagadores múltiples válidos", async () => {
  const id = uuid(); await run("owner", "expense.create", expensePayload({ payerShares: { a: 3000, c: 6000 }, participantMemberIds: ["a", "b"] }), id);
  const e = (await db.doc(`counts/${C}/expenses/${id}`).get()).data();
  assert.deepEqual(e.payerShares, { a: 3000, c: 6000 }); assert.deepEqual(e.participantShares, { a: 4500, b: 4500 });
});
test("C05 anónimo, pendiente, no integrante, integrante dado de baja", async () => {
  await assert.rejects(run(null, "expense.create", expensePayload()), (e) => e.code === "unauthenticated");
  await assert.rejects(run("pend", "expense.create", expensePayload()), reason("FORBIDDEN"));
  await assert.rejects(run("stranger", "expense.create", expensePayload()), reason("FORBIDDEN"));
  await db.doc(`counts/${C}/members/a`).update({ active: false });
  await assert.rejects(run("owner", "expense.create", expensePayload()), reason("FORBIDDEN"));
});
test("C06 Count archivado: create/update/delete/remove → COUNT_ARCHIVED", async () => {
  const id = uuid(); await run("owner", "expense.create", expensePayload(), id);
  await db.doc(`counts/${C}`).update({ status: "archived" });
  await assert.rejects(run("owner", "expense.create", expensePayload()), reason("COUNT_ARCHIVED"));
  await assert.rejects(run("owner", "expense.update", { expenseId: id, expectedVersion: 1, ...expensePayload() }), reason("COUNT_ARCHIVED"));
  await assert.rejects(run("owner", "expense.delete", { expenseId: id, expectedVersion: 1 }), reason("COUNT_ARCHIVED"));
  await assert.rejects(run("owner", "member.remove", { memberId: "c" }), reason("COUNT_ARCHIVED"));
});
test("C07 dos expense.update simultáneos con la misma versión: 1 OK, 1 STALE_STATE", async () => {
  const id = uuid(); await run("owner", "expense.create", expensePayload(), id);
  const results = await Promise.allSettled([1, 2].map((k) => run("owner", "expense.update", { expenseId: id, expectedVersion: 1, ...expensePayload({ title: "T" + k }) })));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(results.some((r) => r.status === "rejected" && reason("STALE_STATE")(r.reason)));
  assert.equal((await db.doc(`counts/${C}/expenses/${id}`).get()).data().version, 2);
});
test("C08 update de gasto legacy sin version (expectedVersion 0) → version 1; conserva currency y createdBy", async () => {
  await db.doc(`counts/${C}/expenses/legacy`).set({ status: "active", currency: "ARS", amountMinor: 9000, payerMemberId: "a", participantMemberIds: ["a", "b", "c"], participantShares: { a: 3000, b: 3000, c: 3000 }, createdBy: "someone", categoryId: "cat1" });
  const r = await run("owner", "expense.update", { expenseId: "legacy", expectedVersion: 0, ...expensePayload({ title: "Editado" }) });
  assert.equal(r.result.version, 1);
  const e = (await db.doc(`counts/${C}/expenses/legacy`).get()).data(); assert.equal(e.createdBy, "someone"); assert.equal(e.currency, "ARS"); assert.equal(e.title, "Editado");
});
test("C09 delete y luego delete con versión vieja → STALE_STATE; reintento mismo id → alreadyApplied", async () => {
  const id = uuid(); await run("owner", "expense.create", expensePayload(), id);
  const del = uuid(); await run("owner", "expense.delete", { expenseId: id, expectedVersion: 1 }, del);
  await assert.rejects(run("owner", "expense.delete", { expenseId: id, expectedVersion: 1 }), reason("STALE_STATE"));
  assert.equal((await run("owner", "expense.delete", { expenseId: id, expectedVersion: 1 }, del)).alreadyApplied, true);
});
test("C10 archivar con deuda → BALANCE_NOT_ZERO con monedas; tras liquidar → OK", async () => {
  await run("owner", "expense.create", expensePayload());
  await assert.rejects(run("owner", "count.archive", {}), (e) => reason("BALANCE_NOT_ZERO")(e) && JSON.stringify(e.details.currencies) === '["ARS"]');
  await settleAll();
  assert.deepEqual((await run("owner", "count.archive", {})).result, { status: "archived" });
  assert.deepEqual((await db.doc(`counts/${C}`).get()).data().archiveBalanceSnapshot, { ARS: 0 });
});
test("C11 archive vs expense.create en paralelo (10 rondas): nunca archivado con saldo", async () => {
  for (let round = 0; round < 10; round++) {
    await seed();
    await Promise.allSettled([run("owner", "count.archive", {}), run("owner", "expense.create", expensePayload())]);
    const c = (await db.doc(`counts/${C}`).get()).data();
    if (c.status === "archived") assert.deepEqual(await suggestions(), [], `ronda ${round}`);
  }
});
test("C12 member.remove: con saldo / con historial / sin historial", async () => {
  await run("owner", "expense.create", expensePayload({ participantMemberIds: ["a", "b"] }));
  await assert.rejects(run("owner", "member.remove", { memberId: "b" }), reason("BALANCE_NOT_ZERO"));
  assert.deepEqual((await run("owner", "member.remove", { memberId: "c" })).result, { memberId: "c", mode: "hard" });
  assert.equal((await db.doc(`counts/${C}/members/c`).get()).exists, false);
  await settleAll();
  assert.deepEqual((await run("owner", "member.remove", { memberId: "b" })).result, { memberId: "b", mode: "soft" });
  assert.equal((await db.doc(`counts/${C}/members/b`).get()).data().active, false);
});
test("C13 quitar a los 2 últimos registrados en paralelo: como máximo 1 OK", async () => {
  await seed({ members: ["a:owner", "b:bob"] });
  const results = await Promise.allSettled([run("owner", "member.remove", { memberId: "b" }), run("bob", "member.remove", { memberId: "a" })]);
  assert.ok(results.filter((r) => r.status === "fulfilled").length <= 1);
  const active = (await db.collection(`counts/${C}/members`).get()).docs.filter((d) => d.data().active !== false && d.data().type === "registered").length;
  assert.ok(active >= 1);
  await assert.rejects(run("owner", "member.remove", { memberId: "a" }), (e) => ["LAST_REGISTERED_MEMBER", "FORBIDDEN"].includes(e?.details?.reason));
});
test("C13b baja de registrado deja la membership inactiva", async () => {
  await seed({ members: ["a:owner", "b:bob", "c"] });
  await run("owner", "member.remove", { memberId: "b" });
  assert.equal((await db.doc(`memberships/${C}_bob`).get()).data().status, "inactive");
});
test("C14 baja de un manual actualiza manualCandidates de las invitaciones activas", async () => {
  await db.doc("invites/tok").update({ manualCandidates: [{ memberId: "b", alias: "b" }, { memberId: "c", alias: "c" }] });
  await run("owner", "member.remove", { memberId: "c" });
  assert.deepEqual((await db.doc("invites/tok").get()).data().manualCandidates.map((x) => x.memberId), ["b"]);
});
test("C15 archivar con un integrante inactivo en el historial no lanza", async () => {
  await run("owner", "expense.create", expensePayload({ participantMemberIds: ["a", "c"] }));
  await settleAll();
  await run("owner", "member.remove", { memberId: "c" });
  assert.equal((await run("owner", "count.archive", {})).result.status, "archived");
});
test("C16 pagadores múltiples → createSettlementV2 acepta; luego archivar OK", async () => {
  await run("owner", "expense.create", expensePayload({ payerShares: { a: 3000, b: 6000 } }));
  const [s] = await suggestions();
  assert.deepEqual({ ...s }, { fromMemberId: "c", toMemberId: "b", amountMinor: 3000, currency: "ARS" });
  await createSettlementCommand({ db, uid: "owner", input: { countId: C, requestId: uuid(), suggestion: s } });
  assert.equal((await run("owner", "count.archive", {})).result.status, "archived");
});
test("C17 count.unarchive por integrante OK / por ajeno FORBIDDEN / Count activo rechazado", async () => {
  await assert.rejects(run("owner", "count.unarchive", {}));
  await db.doc(`counts/${C}`).update({ status: "archived" });
  await assert.rejects(run("stranger", "count.unarchive", {}), reason("FORBIDDEN"));
  assert.equal((await run("owner", "count.unarchive", {})).result.status, "active");
});
test("M01 SDD-3: Count en EUR — gasto, liquidación y archivo con snapshot { EUR: 0 }", async () => {
  await seed({ currency: "EUR" });
  const id = uuid(); await run("owner", "expense.create", expensePayload(), id);
  assert.equal((await db.doc(`counts/${C}/expenses/${id}`).get()).data().currency, "EUR");
  await settleAll();
  await run("owner", "count.archive", {});
  assert.deepEqual((await db.doc(`counts/${C}`).get()).data().archiveBalanceSnapshot, { EUR: 0 });
});
test("M02 SDD-3: Count con moneda fuera del catálogo → gasto rechazado", async () => {
  await seed({ currency: "ZZZ" });
  await assert.rejects(run("owner", "expense.create", expensePayload()), reason("INVALID_INPUT"));
});

