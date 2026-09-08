export const DEFAULT_CURRENCY = "ARS";

export const CURRENCIES = {
  ARS: { code: "ARS", name: "Peso argentino", symbol: "$", decimals: 2 },
  USD: { code: "USD", name: "Dólar estadounidense", symbol: "US$", decimals: 2 },
  BRL: { code: "BRL", name: "Real brasileño", symbol: "R$", decimals: 2 },
  UYU: { code: "UYU", name: "Peso uruguayo", symbol: "$U", decimals: 2 },
};

// Money is kept as an integer in its smallest unit (centavos in V1).
// Input policy: Argentine grouping/decimal notation, plus a convenient mobile
// decimal dot only when it is unambiguous (1000.50).
export class MoneyInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MoneyInputError";
    this.code = code;
  }
}

function invalidMoney(message = "Ingresá un monto con formato válido.") {
  throw new MoneyInputError("INVALID_AMOUNT", message);
}

export function parseMoney(value) {
  const raw = String(value ?? "").trim();
  if (!raw) invalidMoney("Ingresá un monto.");
  if (/\s|[+$\-]|[^\d,.]/.test(raw)) invalidMoney();

  let integerPart = raw;
  let decimalPart = "";

  if (raw.includes(",")) {
    // Comma is always the decimal separator. Dots before it must be valid
    // thousands grouping; a comma with three decimals is never guessed.
    if ((raw.match(/,/g) || []).length !== 1) invalidMoney();
    [integerPart, decimalPart] = raw.split(",");
    if (!/^\d{1,2}$/.test(decimalPart)) invalidMoney();
    if (!/^\d+$/.test(integerPart) && !/^\d{1,3}(?:\.\d{3})+$/.test(integerPart)) invalidMoney();
    integerPart = integerPart.replaceAll(".", "");
  } else if (raw.includes(".")) {
    const dots = raw.match(/\./g) || [];
    if (dots.length === 1) {
      const [left, right] = raw.split(".");
      if (!left || !right) invalidMoney();
      // One dot + exactly three trailing digits is Argentine grouping.
      if (right.length === 3) {
        if (!/^\d{1,3}\.\d{3}$/.test(raw)) invalidMoney();
        integerPart = left + right;
      } else if (/^\d{1,2}$/.test(right) && /^\d+$/.test(left)) {
        integerPart = left;
        decimalPart = right;
      } else invalidMoney();
    } else {
      // Several dots can only be valid Argentine thousands grouping.
      if (!/^\d{1,3}(?:\.\d{3})+$/.test(raw)) invalidMoney();
      integerPart = raw.replaceAll(".", "");
    }
  } else if (!/^\d+$/.test(raw)) {
    invalidMoney();
  }

  if (!/^\d+$/.test(integerPart)) invalidMoney();
  const whole = Number(integerPart);
  if (!Number.isSafeInteger(whole)) {
    throw new MoneyInputError("OUT_OF_RANGE", "El monto está fuera del rango permitido.");
  }
  const minor = whole * 100 + Number((decimalPart + "00").slice(0, 2));
  if (!Number.isSafeInteger(minor)) {
    throw new MoneyInputError("OUT_OF_RANGE", "El monto está fuera del rango permitido.");
  }
  return minor;
}

export function tryParseMoney(value) {
  try {
    return { ok: true, value: parseMoney(value) };
  } catch (error) {
    return { ok: false, error };
  }
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
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new MoneyInputError("INVALID_AMOUNT", "El monto debe ser un entero positivo en centavos.");
  }
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
