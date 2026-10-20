export const DEFAULT_COUNT_EMOJI = "🧾";

export function cleanCountEmoji(value = DEFAULT_COUNT_EMOJI) {
  if (typeof value !== "string") throw new Error("Elegí un emoji para el Count.");
  const emoji = value.trim() || DEFAULT_COUNT_EMOJI;
  const segments = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(emoji)];
  if (emoji.length > 32 || segments.length !== 1 || !/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(emoji)) {
    throw new Error("Elegí un solo emoji para el Count.");
  }
  return emoji;
}
