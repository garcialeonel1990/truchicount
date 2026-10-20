import { Timestamp } from "firebase-admin/firestore";
import { divideAmount } from "./money-core.js";
import { isSupportedCurrency } from "./currencies.js";

const ID = /^[^/]{1,128}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export class ExpenseInputError extends Error {
  constructor(message) { super(message); this.name = "ExpenseInputError"; this.code = "invalid-argument"; }
}

const invalid = (message) => { throw new ExpenseInputError(message); };
const plain = (value) => value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

export function normalizePayerShares(value, memberIds, amountMinor) {
  if (!plain(value) || !Object.keys(value).length) invalid("Los pagadores del gasto no son válidos.");
  const allowed = new Set(memberIds);
  const entries = Object.entries(value);
  let total = 0;
  for (const [id, paid] of entries) {
    if (!ID.test(id) || !allowed.has(id)) invalid("El gasto contiene un pagador inexistente.");
    if (!Number.isSafeInteger(paid) || paid < 0) invalid("El gasto contiene un pago inválido.");
    total += paid;
  }
  if (!Number.isSafeInteger(total) || total !== amountMinor || !entries.some(([, paid]) => paid > 0)) invalid("Los pagos del gasto no suman el monto total.");
  const nonZero = entries.filter(([, paid]) => paid > 0).sort(([a], [b]) => a.localeCompare(b));
  if (nonZero.length === 1) return { payerMemberId: nonZero[0][0], payerShares: null };
  return { payerMemberId: nonZero[0][0], payerShares: Object.fromEntries(nonZero) };
}

function dateValue(value) {
  if (typeof value !== "string") invalid("La fecha del gasto no es válida.");
  const match = value.match(DATE);
  if (!match) invalid("La fecha del gasto no es válida.");
  const date = new Date(`${value}T12:00:00-03:00`);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() + 1 !== Number(match[2]) || date.getUTCDate() !== Number(match[3])) invalid("La fecha del gasto no es válida.");
  return Timestamp.fromDate(date);
}

export function normalizeExpenseInput(payload, { members, amountCurrency, before = null, category = null, merchant = null, mode = "create" }) {
  if (!plain(payload)) invalid("El gasto no es válido.");
  const expected = mode === "update" ? ["amountMinor", "categoryId", "expenseDate", "merchantId", "notes", "participantMemberIds", "payerShares", "title"] : ["amountMinor", "categoryId", "expenseDate", "merchantId", "notes", "participantMemberIds", "payerShares", "title"];
  if (Object.keys(payload).sort().join(",") !== expected.join(",")) invalid("El gasto contiene campos no permitidos.");
  const title = String(payload.title ?? "").trim();
  const notes = String(payload.notes ?? "").trim();
  if (title.length < 1 || title.length > 100 || notes.length > 500) invalid("El título o las notas no son válidos.");
  if (!Number.isSafeInteger(payload.amountMinor) || payload.amountMinor <= 0) invalid("El monto del gasto no es válido.");
  const ids = Array.isArray(payload.participantMemberIds) ? payload.participantMemberIds : [];
  if (!ids.length || new Set(ids).size !== ids.length) invalid("Los participantes del gasto no son válidos.");
  const membersById = new Map(members.map((member) => [member.id, member]));
  const eligible = mode === "create" ? ids.every((id) => membersById.get(id)?.active === true) : ids.every((id) => membersById.has(id));
  if (!eligible) invalid("El gasto contiene un participante inexistente o inactivo.");
  const payer = normalizePayerShares(payload.payerShares, mode === "create" ? members.filter((member) => member.active).map((member) => member.id) : members.map((member) => member.id), payload.amountMinor);
  if (!isSupportedCurrency(amountCurrency)) invalid("La moneda del Count no es válida.");
  if (payload.merchantId !== null && (typeof payload.merchantId !== "string" || !merchant)) invalid("El comercio no existe.");
  if (!category) invalid("La categoría no existe.");
  const participantChanged = !before || before.amountMinor !== payload.amountMinor || before.payerMemberId !== payer.payerMemberId || [...(before.participantMemberIds || [])].sort().join() !== [...ids].sort().join();
  const participantShares = !participantChanged && before.participantShares ? before.participantShares : divideAmount(payload.amountMinor, ids, payer.payerMemberId);
  const currency = before?.currency ?? amountCurrency;
  if (!isSupportedCurrency(currency)) invalid("La moneda del gasto no es válida.");
  return { title, notes, amountMinor: payload.amountMinor, currency, expenseDate: dateValue(payload.expenseDate), merchantId: payload.merchantId, merchantNameSnapshot: merchant?.name || "", categoryId: category.id, categoryNameSnapshot: category.name, payerMemberId: payer.payerMemberId, payerShares: payer.payerShares, participantMemberIds: ids, participantShares };
}
