import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("data-store usa countCommandV1 para mutaciones protegidas", async () => {
  const source = await readFile(new URL("../data-store.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /transaction\.get\((collection|query)\(/);
  for (const name of ["saveExpense", "softDeleteExpense", "archiveCount", "unarchiveCount", "removeCountMember"]) assert.match(source, new RegExp(name + "[\\s\\S]*?invokeCountCommand"));
});
