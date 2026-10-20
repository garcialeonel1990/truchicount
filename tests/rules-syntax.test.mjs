import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Rules: los paréntesis de autorización permanecen balanceados", async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  let balance = 0;
  let lineComment = false;
  for (let index = 0; index < rules.length; index += 1) {
    const char = rules[index];
    const next = rules[index + 1];
    if (lineComment) { if (char === "\n") lineComment = false; continue; }
    if (char === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (char === "(") balance += 1;
    if (char === ")") balance -= 1;
    assert.ok(balance >= 0, "hay un cierre de paréntesis sin apertura");
  }
  assert.equal(balance, 0, "los paréntesis de firestore.rules deben quedar balanceados");
});
