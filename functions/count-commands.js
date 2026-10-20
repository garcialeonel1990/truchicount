import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { currentSuggestions, calculateNetBalances } from "./ledger.js";
import { ExpenseInputError, normalizeExpenseInput } from "./expense-input.js";

const ADMIN_UID = "8qvbKFXafDXWWGDPo2OFDul6uss1";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = /^[^/]{1,128}$/;
const LIMIT_MEMBERS = 200;

export class CountCommandError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = "CountCommandError"; this.code = code; this.details = { reason: details.reason || code.toUpperCase(), ...details }; }
}
const fail = (code, message, reason = code.toUpperCase(), extra = {}) => { throw new CountCommandError(code, message, { reason, ...extra }); };
const plain = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const stable = (v) => Array.isArray(v) ? `[${v.map(stable).join(",")}]` : (v && typeof v === "object" ? `{${Object.keys(v).sort().map((key) => `${JSON.stringify(key)}:${stable(v[key])}`).join(",")}}` : JSON.stringify(v));
const hash = (v) => crypto.createHash("sha256").update(stable(v)).digest("hex");
const item = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });
const validId = (v) => typeof v === "string" && ID.test(v);

function parseEnvelope(input) {
  if (!plain(input) || Object.keys(input).sort().join(",") !== "countId,payload,requestId,type") fail("invalid-argument", "La solicitud contiene campos no permitidos.", "INVALID_INPUT");
  if (!validId(input.countId) || !UUID_V4.test(input.requestId || "") || typeof input.type !== "string" || !plain(input.payload)) fail("invalid-argument", "La solicitud no es válida.", "INVALID_INPUT");
  return { ...input, requestId: input.requestId.toLowerCase() };
}

async function loadActor(tx, db, { uid, count, user, membership }) {
  const approved = uid === ADMIN_UID || user.exists && user.data().accessStatus === "approved";
  if (!approved || !membership.exists || membership.data().status !== "active") fail("permission-denied", "No tenés permisos para modificar este Count.", "FORBIDDEN");
  const memberId = membership.data().memberId;
  const memberSnapshot = await tx.get(db.doc(`counts/${count.id}/members/${memberId}`));
  if (!memberSnapshot.exists || memberSnapshot.data().type !== "registered" || memberSnapshot.data().userId !== uid || memberSnapshot.data().active !== true) fail("permission-denied", "Tu integrante asociado no está activo.", "FORBIDDEN");
  return { uid, user: user.exists ? user.data() : {}, member: item(memberSnapshot) };
}

async function readHistory(tx, db, countId) {
  const [members, expenses, settlements] = await Promise.all([
    tx.get(db.collection(`counts/${countId}/members`).limit(LIMIT_MEMBERS + 1)),
    tx.get(db.collection(`counts/${countId}/expenses`).limit(2001)),
    tx.get(db.collection(`counts/${countId}/settlements`).limit(2001)),
  ]);
  if (members.size > LIMIT_MEMBERS || expenses.size > 2000 || settlements.size > 2000) fail("resource-exhausted", "El historial es demasiado grande para procesarlo de forma segura.", "HISTORY_TOO_LARGE");
  return { members: members.docs.map(item), expenses: expenses.docs.map(item), settlements: settlements.docs.map(item) };
}

function ledgerOrFail(history) {
  try { return { balances: calculateNetBalances(history.members, history.expenses, history.settlements), suggestions: currentSuggestions(history.members, history.expenses, history.settlements) }; }
  catch { fail("failed-precondition", "El historial del Count necesita revisión.", "LEDGER_INVALID"); }
}

function pendingCurrencies(balances) {
  return [...new Set(Object.values(balances).flatMap((totals) => Object.entries(totals).filter(([, amount]) => amount !== 0).map(([currency]) => currency)))].sort();
}

function actorName(actor) { return actor.user.alias || actor.user.googleDisplayName || "Usuario"; }
function audit(tx, ref, { type, countId, actor, result, plan }) {
  tx.create(ref, { entityType: type.split(".")[0], entityId: result.expenseId || result.memberId || countId, countId, action: type, actorUid: actor.uid, actorNameSnapshot: actorName(actor), after: result, createdAt: FieldValue.serverTimestamp(), ...(plan?.before ? { before: plan.before } : {}) });
}

function exact(payload, keys) { return plain(payload) && Object.keys(payload).sort().join(",") === [...keys].sort().join(","); }

async function expensePlan(tx, db, { countId, count, actor, payload, before = null, mode }) {
  const membersSnapshot = await tx.get(db.collection(`counts/${countId}/members`).limit(LIMIT_MEMBERS + 1));
  if (membersSnapshot.size > LIMIT_MEMBERS) fail("resource-exhausted", "El historial es demasiado grande para procesarlo de forma segura.", "HISTORY_TOO_LARGE");
  const members = membersSnapshot.docs.map(item);
  const categorySnapshot = await tx.get(db.doc(`categories/${payload.categoryId}`));
  const category = categorySnapshot.exists && (categorySnapshot.data().status === "active" || before?.categoryId === payload.categoryId) ? item(categorySnapshot) : null;
  let merchant = null;
  if (payload.merchantId !== null) { const merchantSnapshot = await tx.get(db.doc(`merchants/${payload.merchantId}`)); merchant = merchantSnapshot.exists ? item(merchantSnapshot) : null; }
  const normalized = normalizeExpenseInput(payload, { members, amountCurrency: count.primaryCurrency || count.defaultCurrency, before, category, merchant, mode });
  return { normalized, members, before };
}

async function handleCreate(tx, db, ctx) {
  if (!exact(ctx.payload, ["title", "merchantId", "categoryId", "amountMinor", "expenseDate", "payerShares", "participantMemberIds", "notes"])) fail("invalid-argument", "El gasto contiene campos no permitidos.", "INVALID_INPUT");
  const plan = await expensePlan(tx, db, ctx);
  const ref = db.doc(`counts/${ctx.countId}/expenses/${ctx.requestId}`);
  const n = plan.normalized; const now = FieldValue.serverTimestamp();
  const expense = { countId: ctx.countId, ...n, status: "active", splitType: "equal", paymentMethod: null, version: 1, createdAt: now, createdBy: ctx.actor.uid, updatedAt: now, updatedBy: ctx.actor.uid, deletedAt: null, deletedBy: null, schemaVersion: 1 };
  return { plan: { ...plan, ref, writes: () => { tx.create(ref, expense); tx.update(ctx.countRef, { hasMovements: true }); } }, result: { expenseId: ctx.requestId, version: 1 } };
}

async function handleUpdate(tx, db, ctx) {
  if (!exact(ctx.payload, ["expenseId", "expectedVersion", "title", "merchantId", "categoryId", "amountMinor", "expenseDate", "payerShares", "participantMemberIds", "notes"]) || !validId(ctx.payload.expenseId) || !Number.isSafeInteger(ctx.payload.expectedVersion)) fail("invalid-argument", "El gasto contiene campos no permitidos.", "INVALID_INPUT");
  const ref = db.doc(`counts/${ctx.countId}/expenses/${ctx.payload.expenseId}`); const snapshot = await tx.get(ref);
  if (!snapshot.exists) fail("not-found", "El gasto no existe.", "NOT_FOUND");
  const before = item(snapshot); if (before.status !== "active") fail("failed-precondition", "El gasto ya no está activo.", "STALE_STATE");
  if (ctx.payload.expectedVersion !== (before.version ?? 0)) fail("failed-precondition", "Alguien modificó este gasto. Revisá los cambios y volvé a intentar.", "STALE_STATE");
  const plan = await expensePlan(tx, db, { ...ctx, payload: Object.fromEntries(Object.entries(ctx.payload).filter(([key]) => key !== "expenseId" && key !== "expectedVersion")), before, mode: "update" });
  const n = plan.normalized; const now = FieldValue.serverTimestamp();
  return { plan: { ...plan, ref, before, writes: () => tx.update(ref, { ...n, version: (before.version ?? 0) + 1, updatedAt: now, updatedBy: ctx.actor.uid }) }, result: { expenseId: ref.id, version: (before.version ?? 0) + 1 } };
}

async function handleDelete(tx, db, ctx) {
  if (!exact(ctx.payload, ["expenseId", "expectedVersion"]) || !validId(ctx.payload.expenseId) || !Number.isSafeInteger(ctx.payload.expectedVersion)) fail("invalid-argument", "La solicitud no es válida.", "INVALID_INPUT");
  const ref = db.doc(`counts/${ctx.countId}/expenses/${ctx.payload.expenseId}`); const snapshot = await tx.get(ref);
  if (!snapshot.exists) fail("not-found", "El gasto no existe.", "NOT_FOUND");
  const before = item(snapshot); if (ctx.payload.expectedVersion !== (before.version ?? 0)) fail("failed-precondition", "Alguien modificó este gasto. Revisá los cambios y volvé a intentar.", "STALE_STATE");
  const version = (before.version ?? 0) + 1; const now = FieldValue.serverTimestamp();
  return { plan: { before, ref, writes: () => tx.update(ref, { status: "deleted", deletedAt: now, deletedBy: ctx.actor.uid, updatedAt: now, updatedBy: ctx.actor.uid, version }) }, result: { expenseId: ref.id, version } };
}

async function handleArchive(tx, db, ctx) {
  if (!exact(ctx.payload, [])) fail("invalid-argument", "La solicitud no es válida.", "INVALID_INPUT");
  const history = await readHistory(tx, db, ctx.countId); const { balances } = ledgerOrFail(history); const currencies = pendingCurrencies(balances);
  if (currencies.length) fail("failed-precondition", "No se puede archivar el Count porque todavía hay saldo pendiente.", "BALANCE_NOT_ZERO", { currencies });
  const now = FieldValue.serverTimestamp(); const changes = { status: "archived", archiveBalanceSnapshot: Object.fromEntries(Object.keys(balances).flatMap((memberId) => Object.keys(balances[memberId] || {})).filter((currency, index, all) => all.indexOf(currency) === index).map((currency) => [currency, 0])), lastArchivedAt: now, lastArchivedBy: ctx.actor.uid, lastArchivedByNameSnapshot: actorName(ctx.actor), updatedAt: now, updatedBy: ctx.actor.uid };
  if (!ctx.count.firstArchivedAt) Object.assign(changes, { firstArchivedAt: now, firstArchivedBy: ctx.actor.uid });
  return { plan: { writes: () => tx.update(ctx.countRef, changes) }, result: { status: "archived" } };
}

async function handleUnarchive(tx, db, ctx) {
  if (!exact(ctx.payload, []) || ctx.count.status !== "archived") fail(ctx.count.status === "archived" ? "invalid-argument" : "failed-precondition", "El Count no está archivado.", ctx.count.status === "archived" ? "INVALID_INPUT" : "COUNT_ARCHIVED");
  const now = FieldValue.serverTimestamp(); return { plan: { writes: () => tx.update(ctx.countRef, { status: "active", lastUnarchivedAt: now, lastUnarchivedBy: ctx.actor.uid, lastUnarchivedByNameSnapshot: actorName(ctx.actor), updatedAt: now, updatedBy: ctx.actor.uid }) }, result: { status: "active" } };
}

async function handleMemberRemove(tx, db, ctx) {
  if (!exact(ctx.payload, ["memberId"]) || !validId(ctx.payload.memberId)) fail("invalid-argument", "La solicitud no es válida.", "INVALID_INPUT");
  const memberRef = db.doc(`counts/${ctx.countId}/members/${ctx.payload.memberId}`); const memberSnapshot = await tx.get(memberRef);
  if (!memberSnapshot.exists) fail("not-found", "El integrante no existe.", "NOT_FOUND");
  const member = item(memberSnapshot); if (!member.active) fail("failed-precondition", "El integrante ya no está activo.", "STALE_STATE");
  const history = await readHistory(tx, db, ctx.countId); const { balances } = ledgerOrFail(history); const total = Object.values(balances[member.id] || {}).some((amount) => amount !== 0);
  if (total) fail("failed-precondition", "El integrante debe tener saldo cero para poder quitarlo.", "BALANCE_NOT_ZERO", { currencies: Object.entries(balances[member.id] || {}).filter(([, amount]) => amount !== 0).map(([currency]) => currency).sort() });
  const registered = history.members.filter((entry) => entry.active && entry.type === "registered"); if (member.type === "registered" && registered.length < 2) fail("failed-precondition", "No podés quitar al último usuario registrado del Count.", "LAST_REGISTERED_MEMBER");
  const hasHistory = history.expenses.some((expense) => expense.payerMemberId === member.id || Object.keys(expense.payerShares || {}).includes(member.id) || (expense.participantMemberIds || []).includes(member.id)) || history.settlements.some((settlement) => settlement.fromMemberId === member.id || settlement.toMemberId === member.id);
  const invitesSnapshot = await tx.get(db.collection("invites").where("countId", "==", ctx.countId));
  const mode = hasHistory ? "soft" : "hard"; const now = FieldValue.serverTimestamp();
  const remaining = history.members.map((entry) => entry.id === member.id ? { ...entry, active: false } : entry);
  return { plan: { writes: () => {
    if (hasHistory) tx.update(memberRef, { active: false, removedAt: now, removedBy: ctx.actor.uid, updatedAt: now, updatedBy: ctx.actor.uid }); else tx.delete(memberRef);
    if (member.type === "registered") tx.update(db.doc(`memberships/${ctx.countId}_${member.userId}`), { status: "inactive", removedAt: now, removedBy: ctx.actor.uid, updatedAt: now, updatedBy: ctx.actor.uid });
    invitesSnapshot.docs.forEach((invite) => tx.update(invite.ref, { manualCandidates: remaining.filter((entry) => entry.active && entry.type === "manual" && !entry.userId).map((entry) => ({ memberId: entry.id, alias: entry.manualAlias || entry.alias })), updatedAt: now }));
  } }, result: { memberId: member.id, mode } };
}

const HANDLERS = { "expense.create": handleCreate, "expense.update": handleUpdate, "expense.delete": handleDelete, "count.archive": handleArchive, "count.unarchive": handleUnarchive, "member.remove": handleMemberRemove };

export async function runCountCommand({ db, uid, input }) {
  if (!uid) fail("unauthenticated", "Iniciá sesión para continuar.", "UNAUTHENTICATED");
  const envelope = parseEnvelope(input); const handler = HANDLERS[envelope.type]; if (!handler) fail("invalid-argument", "Operación desconocida.", "INVALID_INPUT");
  const payloadHash = hash({ type: envelope.type, payload: envelope.payload }); const countRef = db.doc(`counts/${envelope.countId}`); const receiptRef = db.doc(`counts/${envelope.countId}/commandReceipts/${envelope.requestId}`); const userRef = db.doc(`users/${uid}`); const membershipRef = db.doc(`memberships/${envelope.countId}_${uid}`);
  return db.runTransaction(async (tx) => {
    const [countSnapshot, userSnapshot, membershipSnapshot, receipt] = await tx.getAll(countRef, userRef, membershipRef, receiptRef);
    if (receipt.exists) { const value = receipt.data(); if (value.uid !== uid || value.payloadHash !== payloadHash) fail("already-exists", "Este identificador ya se usó para otra operación.", "REQUEST_REUSED"); return { ok: true, result: value.result, alreadyApplied: true }; }
    if (!countSnapshot.exists) fail("not-found", "El Count no existe.", "NOT_FOUND");
    const count = item(countSnapshot); if (envelope.type !== "count.unarchive" && count.status !== "active") fail("failed-precondition", "El Count está archivado.", "COUNT_ARCHIVED");
    const actor = await loadActor(tx, db, { uid, count, user: userSnapshot, membership: membershipSnapshot });
    const ctx = { ...envelope, count, countRef, actor };
    let planResult;
    try { planResult = await handler(tx, db, ctx); }
    catch (error) { if (error instanceof ExpenseInputError) fail("invalid-argument", error.message, "INVALID_INPUT"); throw error; }
    const { plan, result } = planResult; plan.writes(); tx.update(countRef, { revision: (count.revision ?? 0) + 1, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid });
    const auditRef = db.doc(`auditLogs/${envelope.type.replace(".", "_")}_${envelope.countId}_${envelope.requestId}`); audit(tx, auditRef, { type: envelope.type, countId: envelope.countId, actor, result, plan });
    tx.create(receiptRef, { type: envelope.type, uid, payloadHash, result, createdAt: FieldValue.serverTimestamp() });
    return { ok: true, result, alreadyApplied: false };
  });
}
