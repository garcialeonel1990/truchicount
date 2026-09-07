export const DEFAULT_CURRENCY = "ARS";

export const CURRENCIES = {
  ARS: { code: "ARS", name: "Peso argentino", symbol: "$", decimals: 2 },
  USD: { code: "USD", name: "Dólar estadounidense", symbol: "US$", decimals: 2 },
  BRL: { code: "BRL", name: "Real brasileño", symbol: "R$", decimals: 2 },
  UYU: { code: "UYU", name: "Peso uruguayo", symbol: "$U", decimals: 2 },
};

// Money is kept as an integer in its smallest unit (centavos in V1).
export function parseMoney(value) {
  const raw = String(value ?? "").trim().replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!raw) return 0;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);
  let normalized = raw;

  if (decimalIndex >= 0) {
    const decimalPart = raw.slice(decimalIndex + 1).replace(/\D/g, "");
    const integerPart = raw.slice(0, decimalIndex).replace(/\D/g, "");
    normalized = `${integerPart}.${decimalPart}`;
  } else {
    normalized = raw.replace(/\D/g, "");
  }

  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function formatMoney(amountMinor = 0, currency = DEFAULT_CURRENCY) {
  const currencyMeta = CURRENCIES[currency] ?? { code: currency, decimals: 2 };
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currencyMeta.code,
    minimumFractionDigits: currencyMeta.decimals,
    maximumFractionDigits: currencyMeta.decimals,
  }).format((Number(amountMinor) || 0) / 10 ** currencyMeta.decimals);
}

export function formatMoneyPlain(amountMinor = 0) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((Number(amountMinor) || 0) / 100);
}

export function divideAmount(amountMinor, participantUids, payerUid = "") {
  const ids = [...new Set(participantUids)].sort();
  if (!ids.length) return {};

  const shares = Object.fromEntries(ids.map((uid) => [uid, Math.floor(amountMinor / ids.length)]));
  let remainder = amountMinor % ids.length;
  const remainderOrder = payerUid && shares[payerUid] !== undefined ? [payerUid, ...ids.filter((uid) => uid !== payerUid)] : ids;

  for (const uid of remainderOrder) {
    if (!remainder) break;
    shares[uid] += 1;
    remainder -= 1;
  }
  return shares;
}

export function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
