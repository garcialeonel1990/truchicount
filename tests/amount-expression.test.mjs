import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAmountExpression, hasOperator } from "../amount-expression.js";
test("evalúa expresiones de monto", () => { assert.equal(evaluateAmountExpression("60999,95-8000"), 5299995); assert.equal(evaluateAmountExpression("1.200×3"), 360000); assert.equal(evaluateAmountExpression("10.000÷3"), 333333); assert.equal(evaluateAmountExpression("100+50×2"), 20000); assert.equal(evaluateAmountExpression("52.380,99÷2"), 2619050); });
test("rechaza expresiones inválidas", () => { ["", "100+", "×3", "100++5", "100-100", "100÷0", "1e3+1", "100+$5", "1,234+1"].forEach((value) => assert.throws(() => evaluateAmountExpression(value))); });
test("detecta operadores", () => { assert.equal(hasOperator("100"), false); assert.equal(hasOperator("100+1"), true); assert.equal(hasOperator("-100"), false); });
