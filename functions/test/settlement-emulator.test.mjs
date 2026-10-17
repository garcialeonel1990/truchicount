import assert from "node:assert/strict";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { after, before, beforeEach, test } from "node:test";
import { createSettlementCommand } from "../settlement-service.js";

const PROJECT_ID = "demo-truchicount";
const COUNT_ID = "countA";
const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const suggestion = { fromMemberId: "b", toMemberId: "a", currency: "ARS", amountMinor: 5000 };
let db;

async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  assert.ok(host, "FIRESTORE_EMULATOR_HOST es obligatorio");
  const response = await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
  assert.equal(response.ok, true);
}

async function seed() {
  await db.doc(`users/owner`).set({ uid: "owner", accessStatus: "approved", alias: "Owner" });
  await db.doc(`users/outsider`).set({ uid: "outsider", accessStatus: "approved", alias: "Outsider" });
  await db.doc(`counts/${COUNT_ID}`).set({ status: "active", primaryCurrency: "ARS", hasMovements: true });
  await db.doc(`memberships/${COUNT_ID}_owner`).set({ countId: COUNT_ID, uid: "owner", memberId: "a", status: "active" });
  await db.doc(`counts/${COUNT_ID}/members/a`).set({ type: "registered", userId: "owner", active: true });
  await db.doc(`counts/${COUNT_ID}/members/b`).set({ type: "manual", userId: null, active: true });
  await db.doc(`counts/${COUNT_ID}/expenses/expenseA`).set({
    status: "active", amountMinor: 10000, currency: "ARS", payerMemberId: "a",
    participantMemberIds: ["a", "b"], participantShares: { a: 5000, b: 5000 },
  });
}

async function seedSecondCount() {
  const countId = "countB";
  await db.doc(`counts/${countId}`).set({ status: "active", primaryCurrency: "ARS", hasMovements: true });
  await db.doc(`memberships/${countId}_owner`).set({ countId, uid: "owner", memberId: "a", status: "active" });
  await db.doc(`counts/${countId}/members/a`).set({ type: "registered", userId: "owner", active: true });
  await db.doc(`counts/${countId}/members/b`).set({ type: "manual", userId: null, active: true });
  await db.doc(`counts/${countId}/expenses/expenseB`).set({
    status: "active", amountMinor: 10000, currency: "ARS", payerMemberId: "a",
    participantMemberIds: ["a", "b"], participantShares: { a: 5000, b: 5000 },
  });
  return countId;
}

function input(requestId = REQUEST_ID, overrides = {}) {
  return { countId: COUNT_ID, requestId, suggestion: { ...suggestion, ...overrides } };
}

before(async () => {
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
  db = getFirestore();
});
beforeEach(async () => { await clearFirestore(); await seed(); });
after(async () => { await clearFirestore(); });

test("crea settlement, audit y marca el Count en una sola operación", async () => {
  assert.deepEqual(await createSettlementCommand({ db, uid: "owner", input: input() }), { settlementId: REQUEST_ID, alreadyApplied: false });
  assert.equal((await db.doc(`counts/${COUNT_ID}/settlements/${REQUEST_ID}`).get()).data().createdBy, "owner");
  assert.equal((await db.doc(`auditLogs/settlement_${COUNT_ID}_${REQUEST_ID}`).get()).data().action, "settle");
  assert.equal((await db.doc(`counts/${COUNT_ID}`).get()).data().hasMovements, true);
});

test("el mismo requestId puede usarse de forma independiente en otro Count", async () => {
  await createSettlementCommand({ db, uid: "owner", input: input() });
  const countId = await seedSecondCount();
  const secondInput = { ...input(), countId };
  assert.deepEqual(await createSettlementCommand({ db, uid: "owner", input: secondInput }), { settlementId: REQUEST_ID, alreadyApplied: false });
  assert.equal((await db.doc(`auditLogs/settlement_${countId}_${REQUEST_ID}`).get()).exists, true);
});

test("un retry confirmado permanece idempotente después de archivar el Count", async () => {
  await createSettlementCommand({ db, uid: "owner", input: input() });
  await db.doc(`counts/${COUNT_ID}`).update({ status: "archived" });
  assert.deepEqual(await createSettlementCommand({ db, uid: "owner", input: input() }), { settlementId: REQUEST_ID, alreadyApplied: true });
});

test("el mismo request es idempotente y no duplica pagos", async () => {
  await createSettlementCommand({ db, uid: "owner", input: input() });
  assert.deepEqual(await createSettlementCommand({ db, uid: "owner", input: input() }), { settlementId: REQUEST_ID, alreadyApplied: true });
  assert.equal((await db.collection(`counts/${COUNT_ID}/settlements`).get()).size, 1);
});

test("rechaza identidad ajena, sugerencia alterada y ledger corrupto", async () => {
  await assert.rejects(createSettlementCommand({ db, uid: null, input: input() }), (error) => error.code === "unauthenticated");
  await assert.rejects(createSettlementCommand({ db, uid: "outsider", input: input() }), (error) => error.code === "permission-denied");
  await assert.rejects(createSettlementCommand({ db, uid: "owner", input: input(REQUEST_ID, { amountMinor: 4999 }) }), (error) => error.code === "failed-precondition");
  await db.doc(`counts/${COUNT_ID}/expenses/expenseA`).update({ participantShares: { a: 1, b: 1 } });
  await assert.rejects(createSettlementCommand({ db, uid: "owner", input: input() }), (error) => error.code === "failed-precondition");
});

test("dos confirmaciones concurrentes sólo aplican una vez", async () => {
  const secondId = "123e4567-e89b-42d3-a456-426614174001";
  const results = await Promise.allSettled([
    createSettlementCommand({ db, uid: "owner", input: input() }),
    createSettlementCommand({ db, uid: "owner", input: input(secondId) }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected" && result.reason.code === "failed-precondition").length, 1);
  assert.equal((await db.collection(`counts/${COUNT_ID}/settlements`).get()).size, 1);
});
