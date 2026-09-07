import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { DEFAULT_CURRENCY, divideAmount, normalizeText } from "./money.js";

const toItem = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });
const auditRef = () => doc(collection(db, "auditLogs"));

function audit(batch, { entityType, entityId, countId, action, actor, before = null, after = null }) {
  batch.set(auditRef(), {
    entityType, entityId, ...(countId ? { countId } : {}), action,
    actorUid: actor.uid,
    actorNameSnapshot: actor.displayName || actor.email || "Usuario",
    before, after,
    createdAt: serverTimestamp(),
  });
}

export async function ensureUser(user) {
  const ref = doc(db, "users", user.uid);
  const current = await getDoc(ref);
  const shared = {
    uid: user.uid,
    displayName: user.displayName || user.email?.split("@")[0] || "Usuario",
    email: user.email || "",
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };
  if (current.exists()) return setDoc(ref, shared, { merge: true });
  return setDoc(ref, { ...shared, defaultCurrency: DEFAULT_CURRENCY, enabledCurrencies: [DEFAULT_CURRENCY], createdAt: serverTimestamp() });
}

export const watchUser = (uid, onChange, onError) => onSnapshot(doc(db, "users", uid), (snap) => onChange(snap.exists() ? toItem(snap) : null), onError);

export function watchCounts(uid, onChange, onError) {
  return onSnapshot(query(collection(db, "memberships"), where("uid", "==", uid), where("status", "==", "active")), async (snapshot) => {
    try {
      const memberships = snapshot.docs.map(toItem);
      const countDocs = await Promise.all(memberships.map((membership) => getDoc(doc(db, "counts", membership.countId))));
      onChange(countDocs.filter((item) => item.exists() && item.data().status === "active").map(toItem));
    } catch (error) { onError?.(error); }
  }, onError);
}

export async function createCount({ name, user, defaultCurrency = DEFAULT_CURRENCY }) {
  const count = doc(collection(db, "counts"));
  const membership = doc(db, "memberships", `${count.id}_${user.uid}`);
  const batch = writeBatch(db);
  batch.set(count, { name, defaultCurrency, ownerUid: user.uid, status: "active", createdAt: serverTimestamp(), createdBy: user.uid, updatedAt: serverTimestamp(), updatedBy: user.uid, schemaVersion: 1 });
  batch.set(membership, { countId: count.id, uid: user.uid, role: "owner", status: "active", displayNameSnapshot: user.displayName || user.email || "Usuario", emailSnapshot: user.email || "", joinedAt: serverTimestamp(), joinedByInvite: false, createdAt: serverTimestamp() });
  audit(batch, { entityType: "count", entityId: count.id, countId: count.id, action: "create", actor: user, after: { name, defaultCurrency } });
  await batch.commit();
  return count.id;
}

export const watchCount = (countId, onChange, onError) => onSnapshot(doc(db, "counts", countId), (snap) => onChange(snap.exists() ? toItem(snap) : null), onError);
export const watchMembers = (countId, onChange, onError) => onSnapshot(query(collection(db, "memberships"), where("countId", "==", countId), where("status", "==", "active")), (snap) => onChange(snap.docs.map(toItem)), onError);
export const watchExpenses = (countId, onChange, onError) => onSnapshot(collection(db, "counts", countId, "expenses"), (snap) => onChange(snap.docs.map(toItem)), onError);
export const watchSettlements = (countId, onChange, onError) => onSnapshot(collection(db, "counts", countId, "settlements"), (snap) => onChange(snap.docs.map(toItem)), onError);
export const watchCategories = (onChange, onError) => onSnapshot(collection(db, "categories"), (snap) => onChange(snap.docs.map(toItem).filter((item) => item.status === "active").sort((a, b) => a.name.localeCompare(b.name, "es"))), onError);
export const watchMerchants = (onChange, onError) => onSnapshot(collection(db, "merchants"), (snap) => onChange(snap.docs.map(toItem).sort((a, b) => a.name.localeCompare(b.name, "es"))), onError);

export async function createCategory(name, actor) {
  const normalizedName = normalizeText(name);
  const match = await getDocs(query(collection(db, "categories"), where("normalizedName", "==", normalizedName), limit(1)));
  if (!match.empty) return toItem(match.docs[0]);
  const ref = doc(collection(db, "categories"));
  const batch = writeBatch(db);
  const data = { name: name.trim(), normalizedName, status: "active", createdBy: actor.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  batch.set(ref, data);
  audit(batch, { entityType: "category", entityId: ref.id, action: "createCategory", actor, after: { name: data.name } });
  await batch.commit();
  return { id: ref.id, ...data };
}

export async function ensureDefaultCategories(actor) {
  const defaults = ["Supermercado", "Salidas", "Transporte", "Servicios", "Hogar", "Comida", "Salud", "Viajes", "Otros"];
  await Promise.all(defaults.map((name) => createCategory(name, actor)));
}

async function upsertMerchant(name, actor) {
  const cleanName = name.trim();
  if (!cleanName) return { id: null, name: "" };
  const normalizedName = normalizeText(cleanName);
  const found = await getDocs(query(collection(db, "merchants"), where("normalizedName", "==", normalizedName), limit(1)));
  if (!found.empty) {
    const ref = found.docs[0].ref;
    await updateDoc(ref, { lastUsedAt: serverTimestamp(), usageCount: (found.docs[0].data().usageCount || 0) + 1 });
    return { id: ref.id, name: found.docs[0].data().name };
  }
  const ref = doc(collection(db, "merchants"));
  await setDoc(ref, { name: cleanName, normalizedName, createdAt: serverTimestamp(), createdBy: actor.uid, lastUsedAt: serverTimestamp(), usageCount: 1 });
  return { id: ref.id, name: cleanName };
}

export async function saveExpense({ countId, form, members, categories, actor, expenseId = null, before = null }) {
  const payer = members.find((member) => member.uid === form.payerUid);
  const participantUids = [...new Set(form.participantUids)];
  const category = categories.find((item) => item.id === form.categoryId);
  if (!form.title?.trim() || !form.amountMinor || !payer || !category || !participantUids.length || participantUids.some((uid) => !members.some((member) => member.uid === uid))) throw new Error("Revisá los datos obligatorios del gasto.");
  const merchant = await upsertMerchant(form.merchantName, actor);
  const ref = expenseId ? doc(db, "counts", countId, "expenses", expenseId) : doc(collection(db, "counts", countId, "expenses"));
  const participantShares = divideAmount(form.amountMinor, participantUids, form.payerUid);
  const data = {
    countId, title: form.title.trim(), merchantId: merchant.id, merchantNameSnapshot: merchant.name,
    categoryId: category.id, categoryNameSnapshot: category.name,
    amountMinor: form.amountMinor, currency: form.currency, expenseDate: Timestamp.fromDate(new Date(`${form.expenseDate}T12:00:00`)),
    payerUid: payer.uid, payerNameSnapshot: payer.displayNameSnapshot,
    participantUids, participantShares, splitType: "equal", paymentMethod: null, notes: form.notes?.trim() || "",
    status: "active", updatedAt: serverTimestamp(), updatedBy: actor.uid, schemaVersion: 1,
  };
  const batch = writeBatch(db);
  if (expenseId) {
    batch.update(ref, data);
    audit(batch, { entityType: "expense", entityId: ref.id, countId, action: "update", actor, before, after: data });
  } else {
    batch.set(ref, { ...data, createdAt: serverTimestamp(), createdBy: actor.uid, deletedAt: null, deletedBy: null });
    audit(batch, { entityType: "expense", entityId: ref.id, countId, action: "create", actor, after: data });
  }
  await batch.commit();
}

export async function softDeleteExpense({ countId, expense, actor }) {
  const ref = doc(db, "counts", countId, "expenses", expense.id);
  const batch = writeBatch(db);
  const after = { status: "deleted", deletedAt: serverTimestamp(), deletedBy: actor.uid, updatedAt: serverTimestamp(), updatedBy: actor.uid };
  batch.update(ref, after);
  audit(batch, { entityType: "expense", entityId: expense.id, countId, action: "delete", actor, before: expense, after: { ...expense, status: "deleted" } });
  await batch.commit();
}

export async function createSettlement({ countId, suggestion, members, actor }) {
  if (!suggestion.amountMinor || suggestion.fromUid === suggestion.toUid || !members.some((item) => item.uid === suggestion.fromUid) || !members.some((item) => item.uid === suggestion.toUid)) throw new Error("No se pudo registrar esta liquidación.");
  const from = members.find((item) => item.uid === suggestion.fromUid);
  const to = members.find((item) => item.uid === suggestion.toUid);
  const ref = doc(collection(db, "counts", countId, "settlements"));
  const data = { countId, fromUid: from.uid, fromNameSnapshot: from.displayNameSnapshot, toUid: to.uid, toNameSnapshot: to.displayNameSnapshot, amountMinor: suggestion.amountMinor, currency: suggestion.currency, status: "active", createdAt: serverTimestamp(), createdBy: actor.uid, updatedAt: serverTimestamp(), updatedBy: actor.uid, reversedAt: null, reversedBy: null, schemaVersion: 1 };
  const batch = writeBatch(db);
  batch.set(ref, data);
  audit(batch, { entityType: "settlement", entityId: ref.id, countId, action: "settle", actor, after: data });
  await batch.commit();
}

export async function createInvite(countId, actor) {
  const ref = doc(collection(db, "invites"));
  await setDoc(ref, { countId, status: "active", createdBy: actor.uid, createdAt: serverTimestamp(), usageCount: 0, lastUsedAt: null });
  return ref.id;
}

export async function joinInvite(token, user) {
  const inviteRef = doc(db, "invites", token);
  return runTransaction(db, async (transaction) => {
    const invite = await transaction.get(inviteRef);
    if (!invite.exists() || invite.data().status !== "active") throw new Error("Esta invitación no existe o ya no está activa.");
    const countId = invite.data().countId;
    const membershipRef = doc(db, "memberships", `${countId}_${user.uid}`);
    const membership = await transaction.get(membershipRef);
    if (!membership.exists()) transaction.set(membershipRef, { countId, uid: user.uid, role: "member", status: "active", displayNameSnapshot: user.displayName || user.email || "Usuario", emailSnapshot: user.email || "", joinedAt: serverTimestamp(), joinedByInvite: true, inviteToken: token, createdAt: serverTimestamp() });
    transaction.update(inviteRef, { usageCount: (invite.data().usageCount || 0) + (membership.exists() ? 0 : 1), lastUsedAt: serverTimestamp() });
    return countId;
  });
}

export async function updateUserSettings(uid, data) {
  return updateDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() });
}
