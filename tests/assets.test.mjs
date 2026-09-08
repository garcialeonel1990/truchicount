import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("RF-01: los assets de la aplicación se resuelven desde el origen", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /href="\/styles\.css\?/);
  assert.match(html, /src="\/app\.js\?/);
  assert.doesNotMatch(html, /(?:href|src)="\.\/(?:styles\.css|app\.js)/);
});
