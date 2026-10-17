import { FieldValue } from "firebase-admin/firestore";
import { currentSuggestions } from "./ledger.js";

const ADMIN_UID = "8qvbKFXafDXWWGDPo2OFDul6uss1";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPPORTED_CURRENCIES = new Set(["ARS", "USD", "BRL", "UYU"]);

export class SettlementCommandError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SettlementCommandError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new SettlementCommandError(code, message);
}

function validId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && !value.includes("/");
}

function parseInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("invalid-argument", "Solicitud inválida.");
  if (Object.keys(input).sort().join(",") !== "countId,requestId,suggestion") fail("invalid-argument", "La solicitud contiene campos no permitidos.");
  const { countId, requestId, suggestion } = input;
  if (!validId(countId) || !UUID_V4.test(requestId || "")) fail("invalid-argument", "Identificadores inválidos.");
  if (!suggestion || typeof suggestion !== "object" || Array.isArray(suggestion)) fail("invalid-argument", "Liquidación inválida.");
  if (Object.keys(suggestion).sort().join(",") !== "amountMinor,currency,fromMemberId,toMemberId") fail("invalid-argument", "La liquidación contiene campos no permitidos.");
  const { fromMemberId, toMemberId, currency, amountMinor } = suggestion;
  if (!validId(fromMemberId) || !validId(toMemberId) || fromMemberId === toMemberId) fail("invalid-argument", "Los integrantes de la liquidación no son válidos.");
  if (!SUPPORTED_CURRENCIES.has(currency) || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) fail("invalid-argument", "El monto o la moneda no son válidos.");
  return { countId, requestId: requestId.toLowerCase(), suggestion: { fromMemberId, toMemberId, currency, amountMinor } };
}

function sameSettlement(data, uid, countId, suggestion) {
  return data.createdBy === uid && data.countId === countId
    && data.fromMemberId === suggestion.fromMemberId && data.toMemberId === suggestion.toMemberId
    && data.currency === suggestion.currency && data.amountMinor === suggestion.amountMinor;
}

function matchesSuggestion(expected, actual) {
  return expected.fromMemberId === actual.fromMemberId && expected.toMemberId === actual.toMemberId
    && expected.currency === actual.currency && expected.amountMinor === actual.amountMinor;
}

export async function createSettlementCommand({ db, uid, input }) {
  if (!uid) fail("unauthenticated", "Iniciá sesión para registrar una liquidación.");
  const { countId, requestId, suggestion } = parseInput(input);
  const countRef = db.doc(`counts/${countId}`);
  const userRef = db.doc(`users/${uid}`);
  const membershipRef = db.doc(`memberships/${countId}_${uid}`);
  const settlementRef = db.doc(`counts/${countId}/settlements/${requestId}`);
  const auditRef = db.doc(`auditLogs/settlement_${countId}_${requestId}`);

  return db.runTransaction(async (transaction) => {
    const [countSnapshot, userSnapshot, membershipSnapshot, existing] = await transaction.getAll(countRef, userRef, membershipRef, settlementRef);
    const approved = uid === ADMIN_UID || (userSnapshot.exists && userSnapshot.data().accessStatus === "approved");
    if (!approved) fail("permission-denied", "Tu cuenta no está autorizada para registrar liquidaciones.");
    if (existing.exists) {
      if (!sameSettlement(existing.data(), uid, countId, suggestion)) fail("already-exists", "Este identificador ya fue usado para otra liquidación.");
      return { settlementId: requestId, alreadyApplied: true };
    }
    if (!countSnapshot.exists || countSnapshot.data().status !== "active") fail("failed-precondition", "El Count ya no está disponible para liquidar.");
    if (!membershipSnapshot.exists) fail("permission-denied", "No pertenecés a este Count.");
    const membership = membershipSnapshot.data();
    if (membership.countId !== countId || membership.uid !== uid || membership.status !== "active" || !validId(membership.memberId)) fail("permission-denied", "Tu membresía no está activa.");

    const actorMemberSnapshot = await transaction.get(db.doc(`counts/${countId}/members/${membership.memberId}`));
    if (!actorMemberSnapshot.exists) fail("permission-denied", "Tu integrante asociado no existe.");
    const actorMember = actorMemberSnapshot.data();
    if (actorMember.type !== "registered" || actorMember.userId !== uid || actorMember.active !== true) fail("permission-denied", "Tu integrante asociado no está activo.");

    const [membersSnapshot, expensesSnapshot, settlementsSnapshot] = await Promise.all([
      transaction.get(db.collection(`counts/${countId}/members`).limit(201)),
      transaction.get(db.collection(`counts/${countId}/expenses`).limit(2001)),
      transaction.get(db.collection(`counts/${countId}/settlements`).limit(2001)),
    ]);
    if (membersSnapshot.size > 200 || expensesSnapshot.size > 2000 || settlementsSnapshot.size > 2000) fail("resource-exhausted", "El historial es demasiado grande para procesarlo de forma segura.");
    const members = membersSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    const expenses = expensesSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    const settlements = settlementsSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    let suggestions;
    try {
      suggestions = currentSuggestions(members, expenses, settlements);
    } catch {
      fail("failed-precondition", "El historial del Count necesita revisión antes de registrar pagos.");
    }
    if (!suggestions.some((item) => matchesSuggestion(item, suggestion))) fail("failed-precondition", "Esta sugerencia ya cambió. Revisá los balances antes de registrar el pago.");

    const timestamp = FieldValue.serverTimestamp();
    const settlement = {
      countId, requestId, ...suggestion, status: "active",
      createdAt: timestamp, createdBy: uid, updatedAt: timestamp, updatedBy: uid,
      reversedAt: null, reversedBy: null, schemaVersion: 1,
    };
    transaction.create(settlementRef, settlement);
    transaction.update(countRef, { hasMovements: true, updatedAt: timestamp, updatedBy: uid });
    transaction.create(auditRef, {
      entityType: "settlement", entityId: requestId, countId, action: "settle",
      actorUid: uid,
      actorNameSnapshot: userSnapshot.exists ? userSnapshot.data().alias || userSnapshot.data().googleDisplayName || "Usuario" : "Administrador",
      after: settlement,
      createdAt: timestamp,
    });
    return { settlementId: requestId, alreadyApplied: false };
  });
}
