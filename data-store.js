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
import { calculateNetBalances } from "./balances.js";
import { CURRENCIES, DEFAULT_CURRENCY, divideAmount, normalizeText } from "./money.js";

const toItem = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });
const auditRef = () => doc(collection(db, "auditLogs"));
export const ADMIN_UID = "8qvbKFXafDXWWGDPo2OFDul6uss1";

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
  const googleDisplayName = user.displayName || user.email?.split("@")[0] || "Usuario";
  const isAdmin = user.uid === ADMIN_UID;
  const shared = {
    uid: user.uid,
    googleDisplayName,
    email: user.email || "",
    updatedAt: serverTimestamp(),
    lastLoginAttemptAt: serverTimestamp(),
  };
  if (current.exists()) {
    const legacyAlias = current.data().alias || current.data().displayName;
    const accessStatus = isAdmin ? "approved" : current.data().accessStatus || "pending";
    return setDoc(ref, { ...shared, alias: legacyAlias || null, accessStatus, isAdmin, ...(accessStatus === "pending" ? { requestedAt: current.data().requestedAt || serverTimestamp() } : {}) }, { merge: true });
  }
  const batch = writeBatch(db);
  const accessStatus = isAdmin ? "approved" : "pending";
  batch.set(ref, {
    ...shared, alias: null, accessStatus, isAdmin,
    requestedAt: isAdmin ? null : serverTimestamp(), lastLoginAttemptAt: serverTimestamp(),
    approvedAt: isAdmin ? serverTimestamp() : null, approvedBy: isAdmin ? ADMIN_UID : null,
    blockedAt: null, blockedBy: null, defaultCurrency: DEFAULT_CURRENCY,
    enabledCurrencies: [DEFAULT_CURRENCY], createdAt: serverTimestamp(), schemaVersion: 1,
  });
  batch.set(auditRef(), { entityType: "userAccess", entityId: user.uid, action: isAdmin ? "approveAccess" : "requestAccess", actorUid: user.uid, actorNameSnapshot: googleDisplayName, before: null, after: { accessStatus }, createdAt: serverTimestamp() });
  return batch.commit();
}

export const watchUser = (uid, onChange, onError) => onSnapshot(doc(db, "users", uid), (snap) => onChange(snap.exists() ? toItem(snap) : null), onError);
export const watchAccessUsers = (onChange, onError) => onSnapshot(collection(db, "users"), (snap) => onChange(snap.docs.map(toItem)), onError);

export async function updateUserAccess({ target, status, actor }) {
  if (actor.uid !== ADMIN_UID) throw new Error("No tenés permisos de administración.");
  if (target.uid === ADMIN_UID) throw new Error("No podés bloquear ni modificar el acceso del administrador.");
  if (!(["approved", "blocked"].includes(status))) throw new Error("Estado de acceso inválido.");
  const ref = doc(db, "users", target.uid);
  const action = status === "blocked" ? "blockAccess" : target.accessStatus === "blocked" ? "reapproveAccess" : "approveAccess";
  const changes = { accessStatus: status, updatedAt: serverTimestamp() };
  if (status === "approved") Object.assign(changes, { approvedAt: serverTimestamp(), approvedBy: actor.uid });
  else Object.assign(changes, { blockedAt: serverTimestamp(), blockedBy: actor.uid });
  const batch = writeBatch(db);
  batch.update(ref, changes);
  audit(batch, { entityType: "userAccess", entityId: target.uid, action, actor, before: { accessStatus: target.accessStatus }, after: { accessStatus: status } });
  await batch.commit();
}

export function watchCounts(uid, onChange, onError) {
  let stopCountWatches = [];
  let counts = new Map();
  const publish = () => onChange([...counts.values()].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    if (a.status === "archived") return (dateValue(b.lastArchivedAt) || 0) - (dateValue(a.lastArchivedAt) || 0);
    return (dateValue(b.updatedAt) || 0) - (dateValue(a.updatedAt) || 0);
  }));

  const stopMemberships = onSnapshot(
    query(collection(db, "memberships"), where("uid", "==", uid), where("status", "==", "active")),
    (snapshot) => {
      stopCountWatches.forEach((stop) => stop());
      stopCountWatches = [];
      counts = new Map();
      snapshot.docs.map(toItem).forEach((membership) => {
        const stopCount = onSnapshot(doc(db, "counts", membership.countId), (countSnapshot) => {
          if (countSnapshot.exists()) counts.set(countSnapshot.id, { ...toItem(countSnapshot), status: countSnapshot.data().status || "active" });
          else counts.delete(membership.countId);
          publish();
        }, onError);
        stopCountWatches.push(stopCount);
      });
      publish();
    },
    onError
  );

  return () => {
    stopMemberships();
    stopCountWatches.forEach((stop) => stop());
  };
}

function dateValue(value) {
  return value?.toMillis ? value.toMillis() : value ? new Date(value).getTime() : 0;
}

export function normalizeCountName(name) {
  return normalizeText(String(name ?? "").trim().replace(/\s+/g, " "));
}

function cleanCountName(name) {
  const cleanName = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!cleanName) throw new Error("Ingresá un nombre para el Count.");
  if (cleanName.length > 30) throw new Error("El nombre puede tener hasta 30 caracteres.");
  return { name: cleanName, normalizedName: normalizeCountName(cleanName) };
}

function countNameRef(normalizedName) {
  return doc(db, "countNames", "name-" + encodeURIComponent(normalizedName));
}

function draftExpiry() {
  return Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
}

function validCurrency(currency) {
  if (!CURRENCIES[currency]) throw new Error("Seleccioná una moneda principal.");
  return currency;
}

function draftOwner(count, user) {
  return count.exists() && count.data().status === "draft" && count.data().createdBy === user.uid;
}

function inviteManualCandidates(members) {
  return members.filter((member) => member.active && member.type === "manual" && !member.userId)
    .map((member) => ({ memberId: member.id, alias: member.manualAlias || member.alias }));
}

function syncActiveInviteCandidates(batch, countId, invites, members) {
  const manualCandidates = inviteManualCandidates(members);
  invites.filter((invite) => invite.status === "active").forEach((invite) => {
    batch.update(doc(db, "invites", invite.id), { manualCandidates, updatedAt: serverTimestamp() });
  });
}

export async function startCountDraft({ user }) {
  await clearCurrentDraft(user, { includeRecent: true });
  const count = doc(collection(db, "counts"));
  const membership = doc(db, "memberships", `${count.id}_${user.uid}`);
  const member = doc(db, "counts", count.id, "members", `registered_${user.uid}`);
  const invite = doc(collection(db, "invites"));
  const batch = writeBatch(db);
  batch.set(count, {
    name: "", normalizedName: "", status: "draft", primaryCurrency: null,
    defaultCurrency: null, ownerUid: user.uid, createdBy: user.uid,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: user.uid,
    draftExpiresAt: draftExpiry(), draftInviteToken: invite.id, hasMovements: false, schemaVersion: 1,
  });
  batch.set(member, { memberId: member.id, countId: count.id, type: "registered", userId: user.uid, alias: null, role: "owner", active: true, createdAt: serverTimestamp(), createdBy: user.uid, updatedAt: serverTimestamp(), updatedBy: user.uid, removedAt: null, removedBy: null, reactivatedAt: null, reactivatedBy: null, schemaVersion: 1 });
  batch.set(membership, { countId: count.id, uid: user.uid, memberId: member.id, role: "owner", status: "active", joinedAt: serverTimestamp(), joinedByInvite: false, createdAt: serverTimestamp() });
  batch.set(invite, { countId: count.id, status: "draft", createdBy: user.uid, createdAt: serverTimestamp(), usageCount: 0, lastUsedAt: null, manualCandidates: [] });
  batch.update(doc(db, "users", user.uid), { draftCountId: count.id, draftExpiresAt: draftExpiry(), updatedAt: serverTimestamp() });
  await batch.commit();
  return { id: count.id, draftInviteToken: invite.id, status: "draft", name: "", normalizedName: "", primaryCurrency: null };
}

export async function saveDraftName({ countId, name, actor, existingCounts = [] }) {
  const values = cleanCountName(name);
  if (existingCounts.some((count) => count.id !== countId && count.status !== "draft" && (count.normalizedName || normalizeCountName(count.name)) === values.normalizedName)) throw new Error("Ya existe un Count con ese nombre.");
  const countRef = doc(db, "counts", countId);
  await runTransaction(db, async (transaction) => {
    const count = await transaction.get(countRef);
    if (!draftOwner(count, actor)) throw new Error("Este borrador ya no está disponible.");
    const previousName = count.data().normalizedName || "";
    const targetRef = countNameRef(values.normalizedName);
    const reads = [transaction.get(targetRef)];
    if (previousName && previousName !== values.normalizedName) reads.push(transaction.get(countNameRef(previousName)));
    const [target, previous] = await Promise.all(reads);
    if (target.exists() && target.data().countId !== countId) throw new Error("Ya existe un Count con ese nombre.");
    if (previous && previous.exists() && previous.data().countId === countId) transaction.delete(previous.ref);
    if (!target.exists()) transaction.set(targetRef, { countId, normalizedName: values.normalizedName, createdAt: serverTimestamp(), createdBy: actor.uid });
    transaction.update(countRef, { ...values, updatedAt: serverTimestamp(), updatedBy: actor.uid, draftExpiresAt: draftExpiry() });
  });
  return values;
}

export async function saveDraftCurrency({ countId, currency, actor }) {
  validCurrency(currency);
  const countRef = doc(db, "counts", countId);
  const count = await getDoc(countRef);
  if (!draftOwner(count, actor)) throw new Error("Este borrador ya no está disponible.");
  await updateDoc(countRef, { primaryCurrency: currency, defaultCurrency: currency, updatedAt: serverTimestamp(), updatedBy: actor.uid, draftExpiresAt: draftExpiry() });
}

export async function getDraftMembers(countId) {
  const members = await getDocs(collection(db, "counts", countId, "members"));
  return members.docs.map(toItem);
}

async function assertDraftOwner(countId, actor) {
  const count = await getDoc(doc(db, "counts", countId));
  if (!draftOwner(count, actor)) throw new Error("Este borrador ya no está disponible.");
  return count;
}

export async function createDraftManualMember({ countId, alias, actor }) {
  const values = cleanMemberAlias(alias);
  const count = await assertDraftOwner(countId, actor);
  const membersRef = collection(db, "counts", countId, "members");
  const members = (await getDocs(membersRef)).docs.map(toItem);
  if (await hasActiveMemberAlias(members, values.normalizedAlias)) throw new Error("Ya existe un integrante con ese alias en este Count.");
  const ref = doc(membersRef);
  const item = { memberId: ref.id, countId, type: "manual", userId: null, ...values, role: "member", active: true, createdAt: serverTimestamp(), createdBy: actor.uid, updatedAt: serverTimestamp(), updatedBy: actor.uid, schemaVersion: 1 };
  const batch = writeBatch(db);
  batch.set(ref, item);
  batch.update(doc(db, "counts", countId), { updatedAt: serverTimestamp(), updatedBy: actor.uid, draftExpiresAt: draftExpiry() });
  batch.update(doc(db, "invites", count.data().draftInviteToken), { manualCandidates: inviteManualCandidates([...members, { id: ref.id, ...item }]), updatedAt: serverTimestamp() });
  await batch.commit();
  return { id: ref.id, ...values, type: "manual", active: true, role: "member" };
}

export async function updateDraftManualMember({ countId, member, alias, actor }) {
  const values = cleanMemberAlias(alias);
  const count = await assertDraftOwner(countId, actor);
  const members = await getDraftMembers(countId);
  if (await hasActiveMemberAlias(members, values.normalizedAlias, member.id)) throw new Error("Ya existe un integrante con ese alias en este Count.");
  const batch = writeBatch(db);
  batch.update(doc(db, "counts", countId, "members", member.id), { ...values, updatedAt: serverTimestamp(), updatedBy: actor.uid });
  batch.update(doc(db, "counts", countId), { updatedAt: serverTimestamp(), updatedBy: actor.uid, draftExpiresAt: draftExpiry() });
  batch.update(doc(db, "invites", count.data().draftInviteToken), { manualCandidates: inviteManualCandidates(members.map((item) => item.id === member.id ? { ...item, ...values } : item)), updatedAt: serverTimestamp() });
  await batch.commit();
  return values;
}

export async function removeDraftManualMember({ countId, member, actor }) {
  if (member.type !== "manual") throw new Error("El creador no se puede quitar del borrador.");
  const count = await assertDraftOwner(countId, actor);
  const members = await getDraftMembers(countId);
  const batch = writeBatch(db);
  batch.delete(doc(db, "counts", countId, "members", member.id));
  batch.update(doc(db, "counts", countId), { updatedAt: serverTimestamp(), updatedBy: actor.uid, draftExpiresAt: draftExpiry() });
  batch.update(doc(db, "invites", count.data().draftInviteToken), { manualCandidates: inviteManualCandidates(members.filter((item) => item.id !== member.id)), updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function finalizeCountDraft({ countId, actor }) {
  const countRef = doc(db, "counts", countId);
  const membersRef = collection(db, "counts", countId, "members");
  const members = await getDraftMembers(countId);
  const manualAliases = members.filter((member) => member.type === "manual" && member.active).map((member) => member.normalizedAlias);
  if (manualAliases.some((alias, index) => !alias || manualAliases.indexOf(alias) !== index)) throw new Error("Revisá los aliases de los integrantes.");
  return runTransaction(db, async (transaction) => {
    const count = await transaction.get(countRef);
    if (!draftOwner(count, actor)) throw new Error("Este borrador ya no está disponible.");
    const values = cleanCountName(count.data().name);
    const currency = validCurrency(count.data().primaryCurrency);
    const inviteRef = doc(db, "invites", count.data().draftInviteToken);
    const ownerRef = doc(membersRef, `registered_${actor.uid}`);
    const nameRef = countNameRef(values.normalizedName);
    const [invite, owner, nameClaim] = await Promise.all([transaction.get(inviteRef), transaction.get(ownerRef), transaction.get(nameRef)]);
    if (!owner.exists() || !owner.data().active || owner.data().type !== "registered") throw new Error("El creador debe permanecer entre los integrantes.");
    if (!invite.exists() || invite.data().countId !== countId || invite.data().status !== "draft") throw new Error("No pudimos validar la invitación del borrador.");
    if (nameClaim.exists() && nameClaim.data().countId !== countId) throw new Error("Ya existe un Count con ese nombre.");
    if (!nameClaim.exists()) transaction.set(nameRef, { countId, normalizedName: values.normalizedName, createdAt: serverTimestamp(), createdBy: actor.uid });
    transaction.update(countRef, { ...values, primaryCurrency: currency, defaultCurrency: currency, status: "active", activatedAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: actor.uid, draftExpiresAt: null });
    transaction.update(inviteRef, { status: "active", activatedAt: serverTimestamp() });
    transaction.update(doc(db, "users", actor.uid), { draftCountId: null, draftExpiresAt: null, updatedAt: serverTimestamp() });
    transaction.set(auditRef(), { entityType: "count", entityId: countId, countId, action: "createCount", actorUid: actor.uid, actorNameSnapshot: actor.displayName || actor.email || "Usuario", after: { name: values.name, primaryCurrency: currency, memberCount: members.filter((member) => member.active).length }, createdAt: serverTimestamp() });
    return countId;
  });
}

export async function clearCurrentDraft(user, { includeRecent = false } = {}) {
  const profile = await getDoc(doc(db, "users", user.uid));
  const countId = profile.exists() ? profile.data().draftCountId : null;
  if (!countId) return false;
  const count = await getDoc(doc(db, "counts", countId));
  if (!draftOwner(count, user)) {
    await updateDoc(doc(db, "users", user.uid), { draftCountId: null, draftExpiresAt: null, updatedAt: serverTimestamp() });
    return false;
  }
  const expired = dateValue(count.data().draftExpiresAt) <= Date.now();
  if (!includeRecent && !expired) return false;
  const members = await getDocs(collection(db, "counts", countId, "members"));
  const nameClaim = count.data().normalizedName ? await getDoc(countNameRef(count.data().normalizedName)) : null;
  const batch = writeBatch(db);
  members.docs.forEach((member) => batch.delete(member.ref));
  batch.delete(doc(db, "memberships", `${countId}_${user.uid}`));
  if (count.data().draftInviteToken) batch.delete(doc(db, "invites", count.data().draftInviteToken));
  if (nameClaim?.exists() && nameClaim.data().countId === countId) batch.delete(nameClaim.ref);
  batch.delete(count.ref);
  batch.update(doc(db, "users", user.uid), { draftCountId: null, draftExpiresAt: null, updatedAt: serverTimestamp() });
  await batch.commit();
  return true;
}

export async function updateCountPrimaryCurrency({ countId, currency, actor }) {
  validCurrency(currency);
  const countRef = doc(db, "counts", countId);
  const [count, expenses, settlements] = await Promise.all([
    getDoc(countRef), getDocs(query(collection(db, "counts", countId, "expenses"), limit(1))), getDocs(query(collection(db, "counts", countId, "settlements"), limit(1))),
  ]);
  if (!count.exists() || count.data().status !== "active") throw new Error("Este Count no está disponible.");
  if (expenses.size || settlements.size || count.data().hasMovements) throw new Error("La moneda principal no se puede cambiar después del primer movimiento.");
  const batch = writeBatch(db);
  batch.update(countRef, { primaryCurrency: currency, defaultCurrency: currency, updatedAt: serverTimestamp(), updatedBy: actor.uid });
  audit(batch, { entityType: "count", entityId: countId, countId, action: "updatePrimaryCurrency", actor, before: { primaryCurrency: count.data().primaryCurrency || count.data().defaultCurrency || null }, after: { primaryCurrency: currency } });
  await batch.commit();
}

export const watchCount = (countId, onChange, onError) => onSnapshot(doc(db, "counts", countId), (snap) => onChange(snap.exists() ? toItem(snap) : null), onError);
// También observamos los inactivos para poder resolver sus alias en históricos.
// La UI filtra los activos para formularios y gestión cotidiana.
export const watchMembers = (countId, onChange, onError) => onSnapshot(collection(db, "counts", countId, "members"), (snap) => onChange(snap.docs.map(toItem)), onError);
export const watchExpenses = (countId, onChange, onError) => onSnapshot(collection(db, "counts", countId, "expenses"), (snap) => onChange(snap.docs.map(toItem)), onError);
export const watchSettlements = (countId, onChange, onError) => onSnapshot(collection(db, "counts", countId, "settlements"), (snap) => onChange(snap.docs.map(toItem)), onError);
export const watchCategories = (onChange, onError) => onSnapshot(collection(db, "categories"), (snap) => onChange(snap.docs.map(toItem).sort((a, b) => a.name.localeCompare(b.name, "es"))), onError);
export const watchMerchants = (onChange, onError) => onSnapshot(collection(db, "merchants"), (snap) => onChange(snap.docs.map(toItem).sort((a, b) => a.name.localeCompare(b.name, "es"))), onError);

export function normalizeCategoryName(name) {
  return normalizeText(String(name ?? "").trim().replace(/\s+/g, " "));
}

function cleanCategoryInput({ name, emoji }) {
  const cleanName = String(name ?? "").trim().replace(/\s+/g, " ");
  const cleanEmoji = String(emoji ?? "").trim();
  if (!cleanName) throw new Error("Ingresá un nombre para la categoría.");
  if (cleanName.length > 20) throw new Error("El nombre puede tener hasta 20 caracteres.");
  if (!cleanEmoji) throw new Error("Elegí un emoji.");
  return { name: cleanName, emoji: cleanEmoji, normalizedName: normalizeCategoryName(cleanName) };
}

function categoryAuditData(category) {
  return {
    name: category.name,
    emoji: category.emoji || "🧾",
    normalizedName: category.normalizedName || normalizeCategoryName(category.name),
    status: category.status || "active",
  };
}

async function findCategoryByNormalizedName(normalizedName) {
  const match = await getDocs(query(collection(db, "categories"), where("normalizedName", "==", normalizedName), limit(2)));
  return match.docs.map(toItem);
}

export async function createCategory(input, actor) {
  const values = cleanCategoryInput(input);
  const matches = await findCategoryByNormalizedName(values.normalizedName);
  const active = matches.find((item) => item.status === "active");
  if (active) throw new Error("Ya existe una categoría con ese nombre.");

  const inactive = matches.find((item) => item.status === "inactive");
  const batch = writeBatch(db);
  if (inactive) {
    const ref = doc(db, "categories", inactive.id);
    const data = { ...values, status: "active", updatedAt: serverTimestamp(), updatedBy: actor.uid, deletedAt: null, deletedBy: null, schemaVersion: 1 };
    batch.update(ref, data);
    audit(batch, { entityType: "category", entityId: inactive.id, action: "reactivate", actor, before: categoryAuditData(inactive), after: { ...values, status: "active" } });
    await batch.commit();
    return { id: inactive.id, ...values, status: "active", reactivated: true };
  }

  // A deterministic ID prevents duplicate documents if two clients create
  // the same normalized name at almost the same time.
  const ref = doc(db, "categories", "name-" + encodeURIComponent(values.normalizedName));
  const data = { ...values, status: "active", createdBy: actor.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: actor.uid, deletedAt: null, deletedBy: null, schemaVersion: 1 };
  batch.set(ref, data);
  audit(batch, { entityType: "category", entityId: ref.id, action: "create", actor, after: { ...values, status: "active" } });
  await batch.commit();
  return { id: ref.id, ...data };
}

export async function ensureDefaultCategories(actor) {
  const anyCategory = await getDocs(query(collection(db, "categories"), limit(1)));
  if (!anyCategory.empty) return;
  const defaults = [
    { name: "Apo", emoji: "🐶" },
    { name: "Salidas", emoji: "🍔" },
    { name: "Servicios", emoji: "💡" },
    { name: "Super", emoji: "🛒" },
    { name: "Verdulería", emoji: "🥬" },
  ];
  await Promise.all(defaults.map((category) => createCategory(category, actor)));
}

export async function updateCategory({ category, name, emoji, actor }) {
  const values = cleanCategoryInput({ name, emoji });
  const matches = await findCategoryByNormalizedName(values.normalizedName);
  if (matches.some((item) => item.id !== category.id && item.status === "active")) throw new Error("Ya existe una categoría con ese nombre.");
  const ref = doc(db, "categories", category.id);
  const batch = writeBatch(db);
  const data = { ...values, updatedAt: serverTimestamp(), updatedBy: actor.uid };
  batch.update(ref, data);
  audit(batch, { entityType: "category", entityId: category.id, action: "update", actor, before: categoryAuditData(category), after: { ...values, status: category.status } });
  await batch.commit();
}

export async function softDeleteCategory({ category, actor }) {
  const ref = doc(db, "categories", category.id);
  const batch = writeBatch(db);
  const data = { status: "inactive", deletedAt: serverTimestamp(), deletedBy: actor.uid, updatedAt: serverTimestamp(), updatedBy: actor.uid };
  batch.update(ref, data);
  audit(batch, { entityType: "category", entityId: category.id, action: "delete", actor, before: categoryAuditData(category), after: { ...categoryAuditData(category), status: "inactive" } });
  await batch.commit();
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
  const activeMembers = members.filter((member) => member.active);
  const payer = activeMembers.find((member) => member.id === form.payerMemberId);
  const participantMemberIds = [...new Set(form.participantMemberIds)];
  const category = categories.find((item) => item.id === form.categoryId);
  if (!form.title?.trim() || !form.amountMinor || !payer || !category || !participantMemberIds.length || participantMemberIds.some((memberId) => !activeMembers.some((member) => member.id === memberId))) throw new Error("Revisá los datos obligatorios del gasto.");
  const merchant = await upsertMerchant(form.merchantName, actor);
  const ref = expenseId ? doc(db, "counts", countId, "expenses", expenseId) : doc(collection(db, "counts", countId, "expenses"));
  const participantShares = divideAmount(form.amountMinor, participantMemberIds, form.payerMemberId);
  const data = {
    countId, title: form.title.trim(), merchantId: merchant.id, merchantNameSnapshot: merchant.name,
    categoryId: category.id, categoryNameSnapshot: category.name,
    amountMinor: form.amountMinor, currency: form.currency, expenseDate: Timestamp.fromDate(new Date(`${form.expenseDate}T12:00:00`)),
    payerMemberId: payer.id,
    participantMemberIds, participantShares, splitType: "equal", paymentMethod: null, notes: form.notes?.trim() || "",
    status: "active", updatedAt: serverTimestamp(), updatedBy: actor.uid, schemaVersion: 1,
  };
  const batch = writeBatch(db);
  if (expenseId) {
    batch.update(ref, data);
    audit(batch, { entityType: "expense", entityId: ref.id, countId, action: "update", actor, before, after: data });
  } else {
    batch.set(ref, { ...data, createdAt: serverTimestamp(), createdBy: actor.uid, deletedAt: null, deletedBy: null });
    batch.update(doc(db, "counts", countId), { hasMovements: true, updatedAt: serverTimestamp(), updatedBy: actor.uid });
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
  const activeMembers = members.filter((member) => member.active);
  if (!suggestion.amountMinor || suggestion.fromMemberId === suggestion.toMemberId || !activeMembers.some((item) => item.id === suggestion.fromMemberId) || !activeMembers.some((item) => item.id === suggestion.toMemberId)) throw new Error("No se pudo registrar esta liquidación.");
  const ref = doc(collection(db, "counts", countId, "settlements"));
  const data = { countId, fromMemberId: suggestion.fromMemberId, toMemberId: suggestion.toMemberId, amountMinor: suggestion.amountMinor, currency: suggestion.currency, status: "active", createdAt: serverTimestamp(), createdBy: actor.uid, updatedAt: serverTimestamp(), updatedBy: actor.uid, reversedAt: null, reversedBy: null, schemaVersion: 1 };
  const batch = writeBatch(db);
  batch.set(ref, data);
  batch.update(doc(db, "counts", countId), { hasMovements: true, updatedAt: serverTimestamp(), updatedBy: actor.uid });
  audit(batch, { entityType: "settlement", entityId: ref.id, countId, action: "settle", actor, after: data });
  await batch.commit();
}

export function normalizeMemberAlias(alias) {
  return normalizeText(String(alias ?? "").trim().replace(/\s+/g, " "));
}

function cleanMemberAlias(alias) {
  const cleanAlias = String(alias ?? "").trim().replace(/\s+/g, " ");
  if (!cleanAlias) throw new Error("Ingresá un alias para el integrante.");
  const normalizedAlias = normalizeMemberAlias(cleanAlias);
  return { alias: cleanAlias, normalizedAlias, manualAlias: cleanAlias, normalizedManualAlias: normalizedAlias };
}

async function hasActiveMemberAlias(members, normalizedAlias, exceptMemberId = null) {
  const registered = members.filter((member) => member.active && member.type === "registered" && member.id !== exceptMemberId);
  const profiles = await Promise.all(registered.map((member) => getDoc(doc(db, "users", member.userId))));
  return members.some((member) => member.active && member.id !== exceptMemberId && member.type === "manual" && (member.normalizedManualAlias || member.normalizedAlias) === normalizedAlias)
    || profiles.some((profile) => profile.exists() && normalizeMemberAlias(profile.data().alias || profile.data().googleDisplayName || profile.data().displayName) === normalizedAlias);
}

export async function createManualMember({ countId, alias, actor }) {
  const values = cleanMemberAlias(alias);
  const countRef = doc(db, "counts", countId);
  const membersRef = collection(db, "counts", countId, "members");
  const [countSnapshot, membersSnapshot, invitesSnapshot] = await Promise.all([
    getDoc(countRef),
    getDocs(membersRef),
    getDocs(query(collection(db, "invites"), where("countId", "==", countId))),
  ]);
  if (!countSnapshot.exists() || countSnapshot.data().status !== "active") throw new Error("No podés modificar integrantes en un Count archivado.");
  const allMembers = membersSnapshot.docs.map(toItem);
  if (await hasActiveMemberAlias(allMembers, values.normalizedAlias)) throw new Error("Ya existe un integrante con ese alias en este Count.");
  const sameAlias = allMembers.filter((member) => (member.normalizedManualAlias || member.normalizedAlias) === values.normalizedAlias);
  const inactive = sameAlias.find((member) => member.type === "manual" && !member.active);
  const batch = writeBatch(db);
  if (inactive) {
    const ref = doc(membersRef, inactive.id);
    batch.update(ref, { ...values, active: true, reactivatedAt: serverTimestamp(), reactivatedBy: actor.uid, removedAt: null, removedBy: null, updatedAt: serverTimestamp(), updatedBy: actor.uid });
    syncActiveInviteCandidates(batch, countId, invitesSnapshot.docs.map(toItem), allMembers.map((member) => member.id === inactive.id ? { ...member, ...values, active: true } : member));
    audit(batch, { entityType: "member", entityId: inactive.id, countId, action: "reactivateMember", actor, before: { alias: inactive.alias, active: false }, after: { alias: values.alias, active: true } });
    await batch.commit();
    return { id: inactive.id, reactivated: true };
  }
  const ref = doc(membersRef);
  batch.set(ref, { memberId: ref.id, countId, type: "manual", userId: null, ...values, previousManualAlias: null, role: "member", active: true, createdAt: serverTimestamp(), createdBy: actor.uid, updatedAt: serverTimestamp(), updatedBy: actor.uid, removedAt: null, removedBy: null, reactivatedAt: null, reactivatedBy: null, schemaVersion: 1 });
  syncActiveInviteCandidates(batch, countId, invitesSnapshot.docs.map(toItem), [...allMembers, { id: ref.id, ...values, type: "manual", userId: null, active: true }]);
  audit(batch, { entityType: "member", entityId: ref.id, countId, action: "createManualMember", actor, after: { alias: values.alias, type: "manual" } });
  await batch.commit();
  return { id: ref.id, reactivated: false };
}

export async function updateManualMember({ countId, member, alias, actor }) {
  const values = cleanMemberAlias(alias);
  const membersRef = collection(db, "counts", countId, "members");
  const [countSnapshot, matches, invitesSnapshot] = await Promise.all([getDoc(doc(db, "counts", countId)), getDocs(membersRef), getDocs(query(collection(db, "invites"), where("countId", "==", countId)))]);
  if (!countSnapshot.exists() || countSnapshot.data().status !== "active") throw new Error("No podés modificar integrantes en un Count archivado.");
  if (await hasActiveMemberAlias(matches.docs.map(toItem), values.normalizedAlias, member.id)) throw new Error("Ya existe un integrante con ese alias en este Count.");
  const batch = writeBatch(db);
  batch.update(doc(membersRef, member.id), { ...values, updatedAt: serverTimestamp(), updatedBy: actor.uid });
  syncActiveInviteCandidates(batch, countId, invitesSnapshot.docs.map(toItem), matches.docs.map(toItem).map((item) => item.id === member.id ? { ...item, ...values } : item));
  audit(batch, { entityType: "member", entityId: member.id, countId, action: "updateManualMemberAlias", actor, before: { alias: member.alias }, after: { alias: values.alias } });
  await batch.commit();
}

export async function removeCountMember({ countId, member, actor }) {
  const countRef = doc(db, "counts", countId);
  const memberRef = doc(db, "counts", countId, "members", member.id);
  const [countSnapshot, memberSnapshot, activeMembers, balances, hasMovements, invitesSnapshot] = await Promise.all([
    getDoc(countRef), getDoc(memberRef), getDocs(query(collection(db, "counts", countId, "members"), where("active", "==", true))), getCountBalance(countId), memberHasMovements(countId, member.id), getDocs(query(collection(db, "invites"), where("countId", "==", countId))),
  ]);
  if (!countSnapshot.exists() || countSnapshot.data().status !== "active") throw new Error("No podés modificar integrantes en un Count archivado.");
  if (!memberSnapshot.exists() || !memberSnapshot.data().active) throw new Error("Este integrante ya no está activo.");
  if (Object.values(balances[member.id] || {}).some((amount) => amount !== 0)) throw new Error("Este integrante debe tener saldo $0 en todas las monedas para poder quitarlo.");
  const registered = activeMembers.docs.map(toItem).filter((item) => item.type === "registered");
  if (member.type === "registered" && registered.length < 2) throw new Error("No podés quitar al último usuario registrado del Count porque nadie podría administrarlo.");

  const batch = writeBatch(db);
  if (hasMovements) batch.update(memberRef, { active: false, removedAt: serverTimestamp(), removedBy: actor.uid, updatedAt: serverTimestamp(), updatedBy: actor.uid });
  else batch.delete(memberRef);
  if (member.type === "registered") batch.update(doc(db, "memberships", `${countId}_${member.userId}`), { status: "inactive", removedAt: serverTimestamp(), removedBy: actor.uid, updatedAt: serverTimestamp(), updatedBy: actor.uid });
  syncActiveInviteCandidates(batch, countId, invitesSnapshot.docs.map(toItem), activeMembers.docs.map(toItem).filter((item) => item.id !== member.id));
  audit(batch, {
    entityType: "member", entityId: memberRef.id, countId, action: "removeMember", actor,
    before: { type: member.type, alias: member.alias || null, active: true }, after: { active: false },
  });
  await batch.commit();
}

export async function correctMemberLink({ countId, member, targetManualId = null, actor }) {
  if (actor.uid !== ADMIN_UID) throw new Error("No tenés permisos de administración.");
  if (member?.type !== "registered" || !member.userId) throw new Error("Elegí un integrante registrado para corregir.");
  const countRef = doc(db, "counts", countId);
  const sourceRef = doc(db, "counts", countId, "members", member.id);
  const membershipRef = doc(db, "memberships", `${countId}_${member.userId}`);
  const profileRef = doc(db, "users", member.userId);
  const targetRef = targetManualId ? doc(db, "counts", countId, "members", targetManualId) : null;
  return runTransaction(db, async (transaction) => {
    const [count, source, membership, profile, target] = await Promise.all([
      transaction.get(countRef), transaction.get(sourceRef), transaction.get(membershipRef), transaction.get(profileRef),
      targetRef ? transaction.get(targetRef) : Promise.resolve(null),
    ]);
    if (!count.exists() || count.data().status !== "active") throw new Error("No podés corregir integrantes en un Count archivado.");
    if (!source.exists() || source.data().type !== "registered" || !source.data().active || source.data().userId !== member.userId) throw new Error("Esta vinculación ya cambió. Volvé a abrir el integrante.");
    if (!membership.exists() || membership.data().status !== "active" || membership.data().memberId !== sourceRef.id) throw new Error("El acceso de este integrante ya cambió. Volvé a intentar.");

    const globalAlias = profile.exists() ? (profile.data().alias || profile.data().googleDisplayName || profile.data().displayName) : null;
    const restoredAlias = source.data().manualAlias || source.data().previousManualAlias || globalAlias || "Integrante";
    const restored = cleanMemberAlias(restoredAlias);
    transaction.update(sourceRef, {
      type: "manual", userId: null, role: "member", ...restored,
      previousManualAlias: null, inviteToken: null, linkedAt: null, linkedByUid: null,
      updatedAt: serverTimestamp(), updatedBy: actor.uid,
    });

    let destinationRef;
    if (targetManualId) {
      destinationRef = targetRef;
      if (!target?.exists() || !target.data().active || target.data().type !== "manual" || target.data().userId != null) throw new Error("Ese perfil manual ya no está disponible. Elegí otro.");
      transaction.update(destinationRef, {
        type: "registered", userId: member.userId, alias: null, role: "owner",
        previousManualAlias: target.data().manualAlias || target.data().alias,
        inviteToken: source.data().inviteToken || null,
        linkedAt: serverTimestamp(), linkedByUid: actor.uid,
        updatedAt: serverTimestamp(), updatedBy: actor.uid,
      });
    } else {
      destinationRef = doc(collection(db, "counts", countId, "members"));
      transaction.set(destinationRef, {
        memberId: destinationRef.id, countId, type: "registered", userId: member.userId,
        alias: null, role: "owner", active: true, previousManualAlias: null,
        inviteToken: source.data().inviteToken || null,
        createdAt: serverTimestamp(), createdBy: actor.uid, updatedAt: serverTimestamp(), updatedBy: actor.uid,
        removedAt: null, removedBy: null, reactivatedAt: null, reactivatedBy: null, schemaVersion: 1,
      });
    }
    transaction.update(membershipRef, {
      memberId: destinationRef.id, role: "owner", status: "active",
      updatedAt: serverTimestamp(), updatedBy: actor.uid,
    });
    transaction.set(auditRef(), {
      entityType: "member", entityId: sourceRef.id, countId, action: "adminCorrectMemberLink",
      actorUid: actor.uid, actorNameSnapshot: actor.displayName || actor.email || "Usuario",
      before: { memberId: sourceRef.id, userId: member.userId, type: "registered" },
      after: { memberId: destinationRef.id, userId: member.userId, type: "registered" },
      createdAt: serverTimestamp(),
    });
    if (!targetManualId) transaction.set(auditRef(), {
      entityType: "member", entityId: destinationRef.id, countId, action: "adminCreateRegisteredDuringCorrection",
      actorUid: actor.uid, actorNameSnapshot: actor.displayName || actor.email || "Usuario",
      after: { type: "registered", userId: member.userId }, createdAt: serverTimestamp(),
    });
  });
}

function archiveSnapshot() {
  return Object.fromEntries(Object.keys(CURRENCIES).map((currency) => [currency, 0]));
}

function pendingBalanceCurrencies(balances) {
  const pending = new Set();
  Object.values(balances).forEach((byCurrency) => {
    Object.entries(byCurrency).forEach(([currency, amount]) => {
      if (amount !== 0) pending.add(currency);
    });
  });
  return [...pending].sort();
}

async function getCountBalance(countId) {
  const membersQuery = query(collection(db, "counts", countId, "members"), where("active", "==", true));
  const expensesQuery = collection(db, "counts", countId, "expenses");
  const settlementsQuery = collection(db, "counts", countId, "settlements");
  const [members, expenses, settlements] = await Promise.all([
    getDocs(membersQuery),
    getDocs(expensesQuery),
    getDocs(settlementsQuery),
  ]);
  return calculateNetBalances(
    members.docs.map(toItem),
    expenses.docs.map(toItem),
    settlements.docs.map(toItem)
  );
}

async function memberHasMovements(countId, memberId) {
  const [expenses, settlements] = await Promise.all([
    getDocs(collection(db, "counts", countId, "expenses")),
    getDocs(collection(db, "counts", countId, "settlements")),
  ]);
  return expenses.docs.some((snapshot) => {
    const expense = snapshot.data();
    return expense.payerMemberId === memberId || (expense.participantMemberIds || []).includes(memberId);
  }) || settlements.docs.some((snapshot) => {
    const settlement = snapshot.data();
    return settlement.fromMemberId === memberId || settlement.toMemberId === memberId;
  });
}

export async function archiveCount({ countId, actor }) {
  const countRef = doc(db, "counts", countId);
  const membershipRef = doc(db, "memberships", `${countId}_${actor.uid}`);
  const [countSnapshot, membershipSnapshot, balances] = await Promise.all([
    getDoc(countRef),
    getDoc(membershipRef),
    getCountBalance(countId),
  ]);
  if (!countSnapshot.exists()) throw new Error("Este Count ya no existe.");
  if (!membershipSnapshot.exists() || membershipSnapshot.data().status !== "active") throw new Error("No tenés permisos para archivar este Count.");
  const count = toItem(countSnapshot);
  if (count.status === "archived") throw new Error("Este Count ya está archivado.");

  const pendingCurrencies = pendingBalanceCurrencies(balances);
  if (pendingCurrencies.length) {
    const suffix = pendingCurrencies.length === 1 ? " en " + pendingCurrencies[0] : " en " + pendingCurrencies.join(", ");
    throw new Error("No se pudo archivar el Count porque todavía hay saldo pendiente" + suffix + ".");
  }

  const actorName = actor.displayName || actor.email || "Usuario";
  const changes = {
    status: "archived",
    archiveBalanceSnapshot: archiveSnapshot(),
    lastArchivedAt: serverTimestamp(),
    lastArchivedBy: actor.uid,
    lastArchivedByNameSnapshot: actorName,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  };
  if (!count.firstArchivedAt) {
    changes.firstArchivedAt = serverTimestamp();
    changes.firstArchivedBy = actor.uid;
  }
  const batch = writeBatch(db);
  batch.update(countRef, changes);
  audit(batch, {
    entityType: "count", entityId: countId, countId, action: "archiveCount", actor,
    before: { status: count.status || "active" }, after: { status: "archived" },
  });
  await batch.commit();
  return { balances, pendingCurrencies: [] };
}

export async function unarchiveCount({ countId, actor }) {
  const countRef = doc(db, "counts", countId);
  const membershipRef = doc(db, "memberships", `${countId}_${actor.uid}`);
  return runTransaction(db, async (transaction) => {
    const [countSnapshot, membershipSnapshot] = await Promise.all([
      transaction.get(countRef),
      transaction.get(membershipRef),
    ]);
    if (!countSnapshot.exists()) throw new Error("Este Count ya no existe.");
    if (!membershipSnapshot.exists() || membershipSnapshot.data().status !== "active") throw new Error("No tenés permisos para desarchivar este Count.");
    const count = toItem(countSnapshot);
    if (count.status !== "archived") throw new Error("Este Count ya está activo.");

    const actorName = actor.displayName || actor.email || "Usuario";
    transaction.update(countRef, {
      status: "active",
      lastUnarchivedAt: serverTimestamp(),
      lastUnarchivedBy: actor.uid,
      lastUnarchivedByNameSnapshot: actorName,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
    transaction.set(auditRef(), {
      entityType: "count", entityId: countId, countId, action: "unarchiveCount",
      actorUid: actor.uid, actorNameSnapshot: actorName,
      before: { status: "archived" },
      after: { status: "active" },
      createdAt: serverTimestamp(),
    });
  });
}

export async function createInvite(countId, actor) {
  const [count, members] = await Promise.all([getDoc(doc(db, "counts", countId)), getDocs(collection(db, "counts", countId, "members"))]);
  if (!count.exists() || count.data().status === "archived") throw new Error("Este Count está archivado y no acepta nuevos miembros.");
  const manualCandidates = members.docs.map(toItem).filter((member) => member.active && member.type === "manual" && !member.userId)
    .map((member) => ({ memberId: member.id, alias: member.manualAlias || member.alias }));
  const ref = doc(collection(db, "invites"));
  await setDoc(ref, { countId, status: "active", createdBy: actor.uid, createdAt: serverTimestamp(), usageCount: 0, lastUsedAt: null, manualCandidates });
  return ref.id;
}

export async function joinInvite(token, user, { manualMemberId = undefined } = {}) {
  const inviteRef = doc(db, "invites", token);
  return runTransaction(db, async (transaction) => {
    const invite = await transaction.get(inviteRef);
    if (!invite.exists() || invite.data().status === "invalid") throw new Error("Esta invitación no existe o ya no está activa.");
    if (invite.data().status === "draft") throw new Error("Este Count todavía se está configurando. Volvé a intentar cuando esté activo.");
    if (invite.data().status !== "active") throw new Error("Esta invitación no existe o ya no está activa.");
    const countId = invite.data().countId;
    const membershipRef = doc(db, "memberships", `${countId}_${user.uid}`);
    const membership = await transaction.get(membershipRef);
    const knownMemberId = membership.exists() && membership.data().memberId;
    const memberRef = doc(db, "counts", countId, "members", knownMemberId || `registered_${user.uid}`);
    const member = await transaction.get(memberRef);
    const needsMembership = !membership.exists() || membership.data().status !== "active";
    const isOwnRegisteredMember = member.exists() && member.data().type === "registered" && member.data().userId === user.uid;
    if (isOwnRegisteredMember && member.data().active && !needsMembership) return { countId, alreadyMember: true };
    if (isOwnRegisteredMember && member.data().active && needsMembership) {
      if (membership.exists()) transaction.update(membershipRef, { memberId: memberRef.id, role: "owner", status: "active", joinedAt: serverTimestamp(), joinedByInvite: true, inviteToken: token, removedAt: null, removedBy: null, updatedAt: serverTimestamp(), updatedBy: user.uid });
      else transaction.set(membershipRef, { countId, uid: user.uid, memberId: memberRef.id, role: "owner", status: "active", joinedAt: serverTimestamp(), joinedByInvite: true, inviteToken: token, createdAt: serverTimestamp() });
      transaction.update(inviteRef, { usageCount: (invite.data().usageCount || 0) + 1, lastUsedAt: serverTimestamp() });
      return { countId, alreadyMember: true };
    }
    const candidates = (invite.data().manualCandidates || []).filter((candidate) => candidate?.memberId && candidate?.alias);
    if (!isOwnRegisteredMember && manualMemberId === undefined && candidates.length) return { countId, candidates, requiresIdentityChoice: true };
    if (manualMemberId) {
      if (isOwnRegisteredMember) throw new Error("Ya sos integrante de este Count.");
      const manualRef = doc(db, "counts", countId, "members", manualMemberId);
      const manual = await transaction.get(manualRef);
      if (!manual.exists() || !manual.data().active || manual.data().type !== "manual" || manual.data().userId != null) throw new Error("Este perfil ya fue vinculado a otra cuenta. Elegí otro perfil o continuá con Ninguno de estos.");
      const previousManualAlias = manual.data().manualAlias || manual.data().alias;
      transaction.update(manualRef, { type: "registered", userId: user.uid, alias: null, role: "owner", previousManualAlias, inviteToken: token, linkedAt: serverTimestamp(), linkedByUid: user.uid, updatedAt: serverTimestamp(), updatedBy: user.uid });
      transaction.set(auditRef(), { entityType: "member", entityId: manualRef.id, countId, action: "manualLinkedToUser", actorUid: user.uid, actorNameSnapshot: user.displayName || user.email || "Usuario", before: { type: "manual", manualAlias: previousManualAlias }, after: { type: "registered", userId: user.uid }, createdAt: serverTimestamp() });
      if (!membership.exists()) transaction.set(membershipRef, { countId, uid: user.uid, memberId: manualRef.id, role: "owner", status: "active", joinedAt: serverTimestamp(), joinedByInvite: true, inviteToken: token, createdAt: serverTimestamp() });
      else if (needsMembership) transaction.update(membershipRef, { memberId: manualRef.id, role: "owner", status: "active", joinedAt: serverTimestamp(), joinedByInvite: true, inviteToken: token, removedAt: null, removedBy: null, updatedAt: serverTimestamp(), updatedBy: user.uid });
      transaction.update(inviteRef, { usageCount: (invite.data().usageCount || 0) + (needsMembership ? 1 : 0), lastUsedAt: serverTimestamp() });
      return { countId, linkedManual: true };
    }
    if (!isOwnRegisteredMember) {
      const newMemberRef = membership.exists() ? doc(collection(db, "counts", countId, "members")) : memberRef;
      if (member.exists()) throw new Error("Tu acceso a este Count cambió. Volvé a abrir la invitación.");
      transaction.set(newMemberRef, { memberId: newMemberRef.id, countId, type: "registered", userId: user.uid, alias: null, role: "owner", active: true, inviteToken: token, createdAt: serverTimestamp(), createdBy: user.uid, updatedAt: serverTimestamp(), updatedBy: user.uid, removedAt: null, removedBy: null, reactivatedAt: null, reactivatedBy: null, schemaVersion: 1 });
      transaction.set(auditRef(), { entityType: "member", entityId: newMemberRef.id, countId, action: "createRegisteredMember", actorUid: user.uid, actorNameSnapshot: user.displayName || user.email || "Usuario", after: { type: "registered", userId: user.uid }, createdAt: serverTimestamp() });
      if (!membership.exists()) transaction.set(membershipRef, { countId, uid: user.uid, memberId: newMemberRef.id, role: "owner", status: "active", joinedAt: serverTimestamp(), joinedByInvite: true, inviteToken: token, createdAt: serverTimestamp() });
      else transaction.update(membershipRef, { memberId: newMemberRef.id, role: "owner", status: "active", joinedAt: serverTimestamp(), joinedByInvite: true, inviteToken: token, removedAt: null, removedBy: null, updatedAt: serverTimestamp(), updatedBy: user.uid });
    } else if (!member.data().active) {
      transaction.update(memberRef, { active: true, inviteToken: token, reactivatedAt: serverTimestamp(), reactivatedBy: user.uid, removedAt: null, removedBy: null, updatedAt: serverTimestamp(), updatedBy: user.uid });
      transaction.set(auditRef(), { entityType: "member", entityId: memberRef.id, countId, action: "reactivateMember", actorUid: user.uid, actorNameSnapshot: user.displayName || user.email || "Usuario", before: { active: false }, after: { active: true }, createdAt: serverTimestamp() });
    }
    if (isOwnRegisteredMember && !membership.exists()) transaction.set(membershipRef, { countId, uid: user.uid, memberId: memberRef.id, role: "owner", status: "active", joinedAt: serverTimestamp(), joinedByInvite: true, inviteToken: token, createdAt: serverTimestamp() });
    else if (isOwnRegisteredMember && needsMembership) transaction.update(membershipRef, { memberId: memberRef.id, role: "owner", status: "active", joinedAt: serverTimestamp(), joinedByInvite: true, inviteToken: token, removedAt: null, removedBy: null, updatedAt: serverTimestamp(), updatedBy: user.uid });
    transaction.update(inviteRef, { usageCount: (invite.data().usageCount || 0) + (needsMembership ? 1 : 0), lastUsedAt: serverTimestamp() });
    return { countId, alreadyMember: !needsMembership };
  });
}

export async function updateUserSettings(uid, data) {
  if (data.alias !== undefined) {
    const normalizedAlias = normalizeMemberAlias(data.alias);
    if (!normalizedAlias) throw new Error("Ingresá un alias válido.");
    const memberships = await getDocs(query(collection(db, "memberships"), where("uid", "==", uid), where("status", "==", "active")));
    const memberLists = await Promise.all(memberships.docs.map((membership) => getDocs(collection(db, "counts", membership.data().countId, "members"))));
    const otherRegisteredIds = memberLists.flatMap((snapshot) => snapshot.docs.map(toItem))
      .filter((member) => member.active && member.type === "registered" && member.userId !== uid)
      .map((member) => member.userId);
    const otherProfiles = await Promise.all([...new Set(otherRegisteredIds)].map((userId) => getDoc(doc(db, "users", userId))));
    const conflict = memberLists.some((snapshot) => snapshot.docs.some((member) => {
      const item = member.data();
      return item.active && item.type === "manual" && (item.normalizedManualAlias || item.normalizedAlias) === normalizedAlias;
  })) || otherProfiles.some((profile) => profile.exists() && normalizeMemberAlias(profile.data().alias || profile.data().googleDisplayName || profile.data().displayName) === normalizedAlias);
    if (conflict) throw new Error("Ya existe un integrante con ese alias en uno de tus Counts activos.");
  }
  return updateDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() });
}
