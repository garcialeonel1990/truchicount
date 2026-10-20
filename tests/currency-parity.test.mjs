import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CURRENCY_CODES } from "../currencies.js";

test("functions comparte el catálogo de monedas", async () => { const root = await readFile(new URL("../currencies.js", import.meta.url), "utf8"); const functions = await readFile(new URL("../functions/currencies.js", import.meta.url), "utf8"); assert.equal(functions, root); assert.equal(CURRENCY_CODES.length, 155); });
