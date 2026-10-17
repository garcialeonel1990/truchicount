import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp as initializeAdmin } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import test from "node:test";
import { recordSettlement } from "../../settlement-client.js";

test("el callable desplegable carga y traduce el error de autenticación", async () => {
  const app = initializeApp({ projectId: "demo-truchicount", apiKey: "demo-key", appId: "demo-app" }, `callable-${Date.now()}`);
  const functions = getFunctions(app, "us-central1");
  const hostValue = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
  const separator = hostValue.lastIndexOf(":");
  connectFunctionsEmulator(functions, hostValue.slice(0, separator), Number(hostValue.slice(separator + 1)));
  await assert.rejects(httpsCallable(functions, "createSettlementV2")({}), (error) => error.code === "functions/unauthenticated");
  await deleteApp(app);
});

test("el cliente autenticado registra un pago a través del callable", async () => {
  assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST, "Se requiere el emulador de Auth");
  const app = initializeApp({ projectId: "demo-truchicount", apiKey: "demo-key", appId: "demo-app" }, `authenticated-${Date.now()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const { user } = await signInAnonymously(auth);
  const functions = getFunctions(app, "us-central1");
  const hostValue = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
  const separator = hostValue.lastIndexOf(":");
  connectFunctionsEmulator(functions, hostValue.slice(0, separator), Number(hostValue.slice(separator + 1)));
  const admin = initializeAdmin({ projectId: "demo-truchicount" }, `admin-${Date.now()}`);
  const db = getFirestore(admin);
  const countId = "client-integration";
  await db.doc(`users/${user.uid}`).set({ accessStatus: "approved", alias: "Prueba" });
  await db.doc(`counts/${countId}`).set({ status: "active", primaryCurrency: "ARS" });
  await db.doc(`memberships/${countId}_${user.uid}`).set({ countId, uid: user.uid, memberId: "a", status: "active" });
  await db.doc(`counts/${countId}/members/a`).set({ type: "registered", userId: user.uid, active: true });
  await db.doc(`counts/${countId}/members/b`).set({ type: "manual", userId: null, active: true });
  await db.doc(`counts/${countId}/expenses/e`).set({ status: "active", amountMinor: 10000, currency: "ARS", payerMemberId: "a", participantMemberIds: ["a", "b"], participantShares: { a: 5000, b: 5000 } });
  const items = new Map();
  const storage = { getItem: (key) => items.get(key), setItem: (key, value) => items.set(key, value), removeItem: (key) => items.delete(key) };
  const requestId = "123e4567-e89b-42d3-a456-426614174123";
  const result = await recordSettlement({ countId, uid: user.uid, suggestion: { fromMemberId: "b", toMemberId: "a", currency: "ARS", amountMinor: 5000 }, storage, randomUUID: () => requestId, invoke: httpsCallable(functions, "createSettlementV2") });
  assert.deepEqual(result, { settlementId: requestId, alreadyApplied: false });
  assert.equal((await db.doc(`counts/${countId}/settlements/${requestId}`).get()).data().createdBy, user.uid);
  await deleteApp(app);
});
