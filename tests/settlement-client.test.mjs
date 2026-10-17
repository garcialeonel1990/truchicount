import assert from "node:assert/strict";
import { test } from "node:test";
import { recordSettlement } from "../settlement-client.js";

const suggestion = { fromMemberId: "b", toMemberId: "a", currency: "ARS", amountMinor: 5000 };
function memoryStorage() {
  const items = new Map();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: (key) => items.delete(key) };
}

test("un reintento tras perder la respuesta conserva el identificador", async () => {
  const storage = memoryStorage();
  const requests = [];
  let sequence = 0;
  const args = { countId: "count", suggestion, uid: "user", storage, randomUUID: () => `request-${++sequence}` };
  await assert.rejects(recordSettlement({ ...args, invoke: async (data) => { requests.push(data); throw new Error("offline"); } }), /offline/);
  const result = await recordSettlement({ ...args, invoke: async (data) => { requests.push(data); return { data: { alreadyApplied: true } }; } });
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(result.alreadyApplied, true);
  await recordSettlement({ ...args, invoke: async (data) => { requests.push(data); return { data: { alreadyApplied: false } }; } });
  assert.notEqual(requests[2].requestId, requests[0].requestId);
});

test("los pagos de usuarios o Counts distintos no comparten identificador", async () => {
  const storage = memoryStorage();
  const ids = [];
  let sequence = 0;
  const base = { suggestion, storage, randomUUID: () => `request-${++sequence}`, invoke: async (data) => { ids.push(data.requestId); throw new Error("offline"); } };
  await assert.rejects(recordSettlement({ ...base, uid: "one", countId: "one" }));
  await assert.rejects(recordSettlement({ ...base, uid: "two", countId: "one" }));
  await assert.rejects(recordSettlement({ ...base, uid: "one", countId: "two" }));
  assert.equal(new Set(ids).size, 3);
});

test("no envía el pago si no puede guardar el identificador", async () => {
  let called = false;
  const storage = { getItem: () => null, setItem: () => { throw new Error("blocked"); } };
  await assert.rejects(recordSettlement({ countId: "count", suggestion, uid: "user", storage, randomUUID: () => "id", invoke: async () => { called = true; } }), /almacenamiento/);
  assert.equal(called, false);
});
