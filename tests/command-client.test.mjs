import assert from "node:assert/strict";
import { test } from "node:test";
import { runCommand } from "../command-client.js";

function storage() { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), values }; }

test("conserva el requestId ante red y lo borra al responder", async () => {
  const saved = storage(); const requests = []; const args = { type: "expense.create", countId: "count", payload: { title: "x" }, uid: "user", storage: saved, randomUUID: () => "request-1" };
  await assert.rejects(runCommand({ ...args, invoke: async (request) => { requests.push(request); throw new Error("offline"); } }), /offline/);
  const result = await runCommand({ ...args, invoke: async (request) => { requests.push(request); return { data: { result: { expenseId: "x" } } }; } });
  assert.deepEqual(requests[0], requests[1]); assert.deepEqual(result, { expenseId: "x" }); assert.equal(saved.values.size, 0);
});

test("no invoca si no puede persistir el requestId", async () => {
  let called = false;
  await assert.rejects(runCommand({ type: "expense.create", countId: "count", payload: {}, uid: "user", storage: { getItem: () => null, setItem: () => { throw new Error("blocked"); } }, randomUUID: () => "id", invoke: async () => { called = true; } }), /identificador/);
  assert.equal(called, false);
});
