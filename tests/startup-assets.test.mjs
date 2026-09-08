import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("RF-P05: los recursos públicos se revalidan sin no-store", async () => {
  const config = await readFile(new URL("../firebase.json", import.meta.url), "utf8");
  assert.match(config, /"value": "no-cache"/);
  assert.doesNotMatch(config, /no-store/);
});

test("RF-P03 y RF-P06: Home no inicia recursos secundarios", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const startup = app.slice(app.indexOf("function startAppWatches"), app.indexOf("function ensureCategories"));
  assert.match(startup, /watchCounts/);
  assert.doesNotMatch(startup, /watchCategories|watchMerchants|watchAccessUsers/);
  assert.match(app, /function ensureCategories/);
  assert.match(app, /function ensureMerchants/);
  assert.match(app, /function ensureAdminUsers/);
});
