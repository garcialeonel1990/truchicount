import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("release: CI valida unitarios y reglas antes de aceptar cambios", async () => {
  const workflow = await read(".github/workflows/test.yml");
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm --prefix functions ci/);
  assert.match(workflow, /npm run test:all/);
  assert.match(workflow, /npm --prefix functions ci/);
  assert.match(workflow, /actions\/setup-java@v4/);
});

test("release: producción requiere ejecución manual y una suite exitosa", async () => {
  const workflow = await read(".github/workflows/firebase-hosting-merge.yml");
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.match(workflow, /deploy_live:[\s\S]*?needs: test/);
  assert.match(workflow, /npm run test:all/);
  assert.match(workflow, /environment: production/);
});

test("release: Hosting no publica archivos internos ni logs locales", async () => {
  const config = JSON.parse(await read("firebase.json"));
  const ignored = config.hosting.ignore;
  assert.ok(ignored.includes("docs/**"));
  assert.ok(ignored.includes("functions/**"));
  assert.ok(ignored.includes("package*.json"));
  assert.ok(ignored.includes("*-debug.log"));
  const headerSources = config.hosting.headers.map((entry) => entry.source);
  assert.ok(headerSources.includes("/"));
  assert.ok(headerSources.includes("/index.html"));
});
