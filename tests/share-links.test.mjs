import assert from "node:assert/strict";
import test from "node:test";
import { buildWhatsAppUrl } from "../share-links.js";
test("construye un link de WhatsApp codificado", () => { const url = buildWhatsAppUrl("Depto & 🏡", "https://truchicount.web.app/j/a b"); assert.match(url, /^https:\/\/wa\.me\/\?text=/); assert.ok(url.includes(encodeURIComponent("Depto & 🏡"))); });
