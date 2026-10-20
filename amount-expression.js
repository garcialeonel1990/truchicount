import { MoneyInputError, parseMoney } from "./money.js";
const OPS = { "+": "+", "-": "-", "−": "-", "*": "*", "×": "*", "x": "*", "X": "*", "/": "/", "÷": "/" };
const fail = (message = "Revisá la cuenta.") => { throw new MoneyInputError("INVALID_AMOUNT", message); };
const divRound = (a, b) => (a * 2n + b) / (b * 2n);
export function hasOperator(text) { return /[+\-−*×xX/÷]/.test(String(text ?? "").trim().replace(/^[+\-−]/, "")); }
export function evaluateAmountExpression(text) {
  const raw = String(text ?? "").replace(/\s+/g, ""); if (!raw) fail("Ingresá un monto.");
  const tokens = raw.split(/([+\-−*×xX/÷])/).filter((token) => token !== ""); if (tokens.length % 2 === 0) fail();
  const terms = []; let current = BigInt(parseMoney(tokens[0])); let sign = 1n;
  for (let i = 1; i < tokens.length; i += 2) { const op = OPS[tokens[i]]; if (!op) fail(); const value = BigInt(parseMoney(tokens[i + 1])); if (op === "*") current = divRound(current * value, 100n); else if (op === "/") { if (value === 0n) fail("No se puede dividir por cero."); current = divRound(current * 100n, value); } else { terms.push(sign * current); sign = op === "+" ? 1n : -1n; current = value; } }
  terms.push(sign * current); const total = terms.reduce((a, b) => a + b, 0n); if (total <= 0n) fail("El resultado debe ser mayor a cero."); if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new MoneyInputError("OUT_OF_RANGE", "El monto está fuera del rango permitido."); return Number(total);
}
