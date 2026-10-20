import assert from "node:assert/strict";
import test from "node:test";
import { CURRENCY_CODES, POPULAR_CURRENCIES, currencyFlag, isSupportedCurrency } from "../currencies.js";
import { CURRENCIES, formatMoney } from "../money.js";

test("catálogo: 155 códigos ISO únicos y ordenados", () => { assert.equal(CURRENCY_CODES.length, 155); assert.equal(new Set(CURRENCY_CODES).size, 155); assert.deepEqual([...CURRENCY_CODES].sort(), [...CURRENCY_CODES]); });
test("catálogo: incluye populares y excluye códigos inválidos", () => { ["ARS", "USD", "BRL", "UYU", ...POPULAR_CURRENCIES].forEach((code) => assert.ok(isSupportedCurrency(code))); ["XDR", "XSU", "CUC", "HRK", "SLL", "ZWL", "ANG", "ars", "ZZZ", "<b>"].forEach((code) => assert.equal(isSupportedCurrency(code), false)); });
test("catálogo: cada moneda tiene nombre y formato", () => { assert.equal(Object.keys(CURRENCIES).length, 155); CURRENCY_CODES.forEach((code) => { assert.ok(CURRENCIES[code].name && CURRENCIES[code].name !== code); assert.doesNotThrow(() => formatMoney(123456, code)); }); assert.equal(CURRENCIES.ARS.symbol, "$"); });
test("catálogo: banderas válidas", () => { assert.equal(currencyFlag("ARS"), "🇦🇷"); assert.equal(currencyFlag("USD"), "🇺🇸"); assert.equal(currencyFlag("EUR"), "🇪🇺"); CURRENCY_CODES.forEach((code) => assert.ok([...currencyFlag(code)].length <= 2)); });
