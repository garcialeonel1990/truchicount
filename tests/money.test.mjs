import assert from "node:assert/strict";
import test from "node:test";
import { divideAmount, formatMoneyPlain, parseMoney } from "../money.js";

test("RF-02: parsea estrictamente el formato argentino y el punto decimal móvil", () => {
  const cases = new Map([
    ["1000", 100000], ["1.000", 100000], ["1.000,50", 100050],
    ["1000,5", 100050], ["1000.50", 100050], ["0,01", 1],
    ["1.234.567,89", 123456789], [" 100,00 ", 10000],
  ]);
  for (const [input, expected] of cases) assert.equal(parseMoney(input), expected, input);
});

test("RF-02: rechaza formatos ambiguos, texto y signos", () => {
  for (const input of ["", "-100", "+100", "abc100", "$100", "1,234", "12.34.56", "1,000.50", "1e3"]) {
    assert.throws(() => parseMoney(input), { code: "INVALID_AMOUNT" }, input);
  }
  assert.throws(() => parseMoney("90071992547410"), { code: "OUT_OF_RANGE" });
});

test("RF-02: el formateo vuelve a centavos sin perder precisión", () => {
  assert.equal(parseMoney(formatMoneyPlain(123456789)), 123456789);
});

test("RF-02: el reparto conserva exactamente el total", () => {
  const shares = divideAmount(100, ["c", "a", "b"], "b");
  assert.deepEqual(shares, { a: 33, b: 34, c: 33 });
  assert.equal(Object.values(shares).reduce((sum, value) => sum + value, 0), 100);
});
