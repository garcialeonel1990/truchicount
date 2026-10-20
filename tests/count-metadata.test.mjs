import assert from "node:assert/strict";
import test from "node:test";
import { cleanCountEmoji, DEFAULT_COUNT_EMOJI } from "../count-metadata.js";

test("el emoji del Count admite familias, banderas y modificadores como un único símbolo", () => {
  for (const emoji of ["🏡", "🏖️", "🇦🇷", "👨‍👩‍👧‍👦", "👍🏽", "1️⃣"]) assert.equal(cleanCountEmoji(emoji), emoji);
  assert.equal(cleanCountEmoji(), DEFAULT_COUNT_EMOJI);
  assert.equal(cleanCountEmoji(""), DEFAULT_COUNT_EMOJI);
});

test("el emoji rechaza texto, varios símbolos y valores inválidos", () => {
  for (const value of ["casa", "🏡🏖️", "🏡 texto", "<script>", 42, {}, null, "🏡".repeat(40)]) {
    assert.throws(() => cleanCountEmoji(value), /emoji/);
  }
});
