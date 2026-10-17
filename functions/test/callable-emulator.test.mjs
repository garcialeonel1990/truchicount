import assert from "node:assert/strict";
import { initializeApp } from "firebase/app";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import test from "node:test";

test("el callable desplegable carga y traduce el error de autenticación", async () => {
  const app = initializeApp({ projectId: "demo-truchicount", apiKey: "demo-key", appId: "demo-app" }, `callable-${Date.now()}`);
  const functions = getFunctions(app, "us-central1");
  const hostValue = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
  const separator = hostValue.lastIndexOf(":");
  connectFunctionsEmulator(functions, hostValue.slice(0, separator), Number(hostValue.slice(separator + 1)));
  await assert.rejects(httpsCallable(functions, "createSettlementV2")({}), (error) => error.code === "functions/unauthenticated");
});
