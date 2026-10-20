import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { app } from "./firebase.js";
import { recordSettlement } from "./settlement-client.js";
import { runCommand } from "./command-client.js";
import { joinInviteInTransaction } from "./invite-join.js";
import { CURRENCIES, DEFAULT_CURRENCY, normalizeText } from "./money.js";
import { DEFAULT_COUNT_EMOJI, cleanCountEmoji } from "./count-metadata.js";

const db = getFirestore(app);
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
  // Existing profiles are verified by the live listener before Home starts.
  // Never turn that verification into a blocking informational write.
  if (current.exists()) return false;
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

export async function refreshUserInfo(user) {
  const ref = doc(db, "users", user.uid);
  return setDoc(ref, {
    googleDisplayName: user.displayName || user.email?.split("@")[0] || "Usuario",
    email: user.email || "",
    updatedAt: serverTimestamp(),
    lastLoginAttemptAt: serverTimestamp(),
  }, { merge: true });
}

export const watchUser = (uid, onChange, onError) => onSnapshot(
  doc(db, "users", uid),
  { includeMetadataChanges: true },
  (snap) => onChange(snap.exists() ? toItem(snap) : null, { fromCache: snap.metadata.fromCache, exists: snap.exists() }),
  onError
);
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

export async function deleteUserAccess({ target, actor }) {
  if (actor.uid !== ADMIN_UID) throw new Error("No tenés permisos de administración.");
  if (target.uid === ADMIN_UID) throw new Error("No podés eliminar el acceso del administrador.");
  // No eliminamos perfiles con historia: así un reingreso no puede perder ni
  // desvincular gastos existentes. Para esos casos se usa Bloquear.
  const memberships = await getDocs(query(collection(db, "memberships"), where("uid", "==", target.uid)));
  if (!memberships.empty) throw new Error("No podés eliminar este usuario porque tiene historial en uno o más Counts. Podés bloquear su acceso en su lugar.");
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", target.uid));
  audit(batch, { entityType: "userAccess", entityId: target.uid, action: "deleteAccess", actor, before: { accessStatus: target.accessStatus }, after: null });
  await batch.commit();
}

export function watchCounts(uid, onChange, onError) {
  const countWatches = new Map();
  const countStates = new Map();
  const counts = new Map();
  let membershipsReady = false;
  let frame = null;
  const sortedCounts = () => [...counts.values()].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    if (a.status === "archived") return (dateValue(b.lastArchivedAt) || 0) - (dateValue(a.lastArchivedAt) || 0);
    return (dateValue(b.updatedAt) || 0) - (dateValue(a.updatedAt) || 0);
  });
  const publish = () => {
    if (frame !== null) return;
    const commit = () => {
      frame = null;
      const pendingCountIds = [...countStates.entries()].filter(([, state]) => !state.resolved && !state.error).map(([id]) => id);
      onChange(sortedCounts(), { membershipsReady, pendingCountIds, countErrors: [...countStates.entries()].filter(([, state]) => state.error).map(([id]) => id) });
    };
    frame = typeof requestAnimationFrame === "function" ? requestAnimationFrame(commit) : setTimeout(commit, 0);
  };

  const stopMemberships = onSnapshot(
    query(collection(db, "memberships"), where("uid", "==", uid), where("status", "==", "active")),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.metadata.fromCache) membershipsReady = true;
      const nextIds = new Set(snapshot.docs.map((item) => item.data().countId));
      countWatches.forEach((stop, countId) => {
        if (nextIds.has(countId)) return;
        stop(); countWatches.delete(countId); countStates.delete(countId); counts.delete(countId);
      });
      nextIds.forEach((countId) => {
        if (countWatches.has(countId)) return;
        countStates.set(countId, { resolved: false, error: false });
        const stopCount = onSnapshot(doc(db, "counts", countId), { includeMetadataChanges: true }, (countSnapshot) => {
          const countState = countStates.get(countId);
          if (!countState) return;
          if (!countSnapshot.metadata.fromCache) countState.resolved = true;
          if (countSnapshot.exists()) counts.set(countId, { ...toItem(countSnapshot), status: countSnapshot.data().status || "active" });
          else counts.delete(countId);
          publish();
        }, (error) => {
          const countState = countStates.get(countId);
          if (countState) { countState.error = true; publish(); }
          onError(error, { scope: "count", countId });
        });
        countWatches.set(countId, stopCount);
      });
      publish();
    },
    onError
  );

  return () => {
    stopMemberships();
    countWatches.forEach((stop) => stop());
    if (frame !== null) {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      else clearTimeout(frame);
    }
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

export async function startCountDraft({ user, profileAlias = "" }) {
  await clearCurrentDraft(user, { includeRecent: true });
  const count = doc(collection(db, "counts"));
  const membership = doc(db, "memberships", `${count.id}_${user.uid}`);
  const member = doc(db, "counts", count.id, "members", `registered_${user.uid}`);
  const invite = doc(collection(db, "invites"));
  const batch = writeBatch(db);
  batch.set(count, {
    name: "", normalizedName: "", emoji: DEFAULT_COUNT_EMOJI, status: "draft", primaryCurrency: null,
    defaultCurrency: null, ownerUid: user.uid, createdBy: user.uid,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: user.uid,
    draftExpiresAt: draftExpiry(), draftInviteToken: invite.id, hasMovements: false, schemaVersion: 1,
  });
  const aliasSnapshot = String(profileAlias).trim() || user.displayName || user.email || "Usuario";
  batch.set(member, { memberId: member.id, countId: count.id, type: "registered", userId: user.uid, alias: null, aliasSnapshot, role: "owner", active: true, createdAt: serverTimestamp(), createdBy: user.uid, updatedAt: serverTimestamp(), updatedBy: user.uid, removedAt: null, removedBy: null, reactivatedAt: null, reactivatedBy: null, schemaVersion: 1 });
  batch.set(membership, { countId: count.id, uid: user.uid, memberId: member.id, role: "owner", status: "active", joinedAt: serverTimestamp(), joinedByInvite: false, createdAt: serverTimestamp() });
  batch.set(invite, { countId: count.id, status: "draft", createdBy: user.uid, createdAt: serverTimestamp(), usageCount: 0, lastUsedAt: null, manualCandidates: [] });
  batch.update(doc(db, "users", user.uid), { draftCountId: count.id, draftExpiresAt: draftExpiry(), updatedAt: serverTimestamp() });
  await batch.commit();
  return { id: count.id, draftInviteToken: invite.id, status: "draft", name: "", normalizedName: "", emoji: DEFAULT_COUNT_EMOJI, primaryCurrency: null };
}

export async function saveDraftName({ countId, name, emoji = DEFAULT_COUNT_EMOJI, actor, existingCounts = [] }) {
  const values = { ...cleanCountName(name), emoji: cleanCountEmoji(emoji) };
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

export const watchCount = (countId, onChange, onError) => onSnapshot(doc(db, "counts", countId), { includeMetadataChanges: true }, (snap) => onChange(snap.exists() ? toItem(snap) : null, { fromCache: snap.metadata.fromCache }), onError);
// También observamos los inactivos para poder resolver sus alias en históricos.
// La UI filtra los activos para formularios y gestión cotidiana.
export const watchMembers = (countId, onChange, onError) => onSnapshot(collection(db, "counts", countId, "members"), { includeMetadataChanges: true }, (snap) => onChange(snap.docs.map(toItem), { fromCache: snap.metadata.fromCache }), onError);
export const watchExpenses = (countId, onChange, onError) => onSnapshot(collection(db, "counts", countId, "expenses"), { includeMetadataChanges: true }, (snap) => onChange(snap.docs.map(toItem), { fromCache: snap.metadata.fromCache }), onError);
export const watchSettlements = (countId, onChange, onError) => onSnapshot(collection(db, "counts", countId, "settlements"), { includeMetadataChanges: true }, (snap) => onChange(snap.docs.map(toItem), { fromCache: snap.metadata.fromCache }), onError);
export const watchCategories = (onChange, onError) => onSnapshot(collection(db, "categories"), { includeMetadataChanges: true }, (snap) => onChange(snap.docs.map(toItem).sort((a, b) => a.name.localeCompare(b.name, "es")), { fromCache: snap.metadata.fromCache }), onError);
export const watchMerchants = (onChange, onError) => onSnapshot(collection(db, "merchants"), (snap) => onChange(snap.docs.map(toItem).sort((a, b) => a.name.localeCompare(b.name, "es"))), onError);

export function normalizeCategoryName(name) {
  return normalizeText(String(name ?? "").trim().replace(/\s+/g, " "));
}

function cleanCategoryInput({ name, emoji }) {
  const cleanName = String(name ?? "").trim().replace(/\s+/g, " ");
  const cleanEmoji = String(emoji ?? "").trim();
  if (!cleanName) throw new Error("Ingresá un nombre para la categoría.");
  if (cleanName.length > 20) throw new Error("El nombre puede tener hasta 20 caracteres.");
  // Accept composed emoji (ZWJ, flags and skin tones), but never arbitrary
  // markup or text. Rendering still escapes legacy values defensively.
  const emojiParts = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Regional_Indicator}\u200D\uFE0F\u20E3#*0-9]+$/u;
  const hasEmoji = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Regional_Indicator}\u20E3]/u.test(cleanEmoji);
  if (!cleanEmoji || cleanEmoji.length > 32 || !emojiParts.test(cleanEmoji) || !hasEmoji) throw new Error("Elegí un emoji válido.");
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
  const countSnapshot = await getDoc(doc(db, "counts", countId));
  if (!countSnapshot.exists() || countSnapshot.data().status !== "active") throw new Error("Este Count no está disponible para cargar gastos.");
  const expectedCurrency = expenseId ? before?.currency : (countSnapshot.data().primaryCurrency || countSnapshot.data().defaultCurrency);
  const activeMembers = members.filter((member) => member.active);
  const eligibleMembers = expenseId ? members : activeMembers;
  const payer = eligibleMembers.find((member) => member.id === form.payerMemberId);
  const participantMemberIds = [...new Set(form.participantMemberIds)];
  const category = categories.find((item) => item.id === form.categoryId)
    || (before?.categoryId === form.categoryId ? { id: before.categoryId, name: before.categoryNameSnapshot } : null);
  const title = String(form.title ?? "").trim();
  const merchantName = String(form.merchantName ?? "").trim();
  const notes = String(form.notes ?? "").trim();
  const amountMinor = form.amountMinor;
  const expenseDate = new Date(`${form.expenseDate}T12:00:00`);
  if (!title || title.length > 100 || merchantName.length > 100 || notes.length > 500 || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !CURRENCIES[form.currency] || form.currency !== expectedCurrency || Number.isNaN(expenseDate.getTime()) || !payer || !category || !participantMemberIds.length || participantMemberIds.some((memberId) => !eligibleMembers.some((member) => member.id === memberId))) throw new Error("Revisá los datos obligatorios del gasto.");
  const merchant = await upsertMerchant(merchantName, actor);
  const payload = { title, merchantId: merchant.id, categoryId: category.id, amountMinor, expenseDate: form.expenseDate, payerShares: form.payerShares && typeof form.payerShares === "object" ? form.payerShares : { [payer.id]: amountMinor }, participantMemberIds, notes };
  const type = expenseId ? "expense.update" : "expense.create";
  return invokeCountCommand({ type, countId, payload: expenseId ? { ...payload, expenseId, expectedVersion: before?.version ?? 0 } : payload, uid: actor.uid });
}

export async function softDeleteExpense({ countId, expense, actor }) {
  return invokeCountCommand({ type: "expense.delete", countId, payload: { expenseId: expense.id, expectedVersion: expense.version ?? 0 }, uid: actor.uid });
}

async function invokeCountCommand({ type, countId, payload, uid }) {
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-functions.js");
  const invoke = httpsCallable(getFunctions(app, "us-central1"), "countCommandV1");
  return runCommand({ type, countId, payload, uid, storage: localStorage, randomUUID: () => crypto.randomUUID(), invoke });
}

export async function createSettlement({ countId, suggestion, actor }) {
  if (!CURRENCIES[suggestion?.currency] || suggestion.fromMemberId === suggestion.toMemberId) throw new Error("No se pudo registrar esta liquidación.");
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-functions.js");
  const invoke = httpsCallable(getFunctions(app, "us-central1"), "createSettlementV2");
  return recordSettlement({ countId, suggestion, uid: actor.uid, storage: localStorage, randomUUID: () => crypto.randomUUID(), invoke });
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
  return members.some((member) => member.active && member.id !== exceptMemberId && member.type === "manual" && (member.normalizedManualAlias || member.normalizedAlias) === normalizedAlias)
    || members.some((member) => member.active && member.id !== exceptMemberId && member.type === "registered" && normalizeMemberAlias(member.aliasSnapshot) === normalizedAlias);
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
  return invokeCountCommand({ type: "member.remove", countId, payload: { memberId: member.id }, uid: actor.uid });
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

export async function archiveCount({ countId, actor }) {
  return invokeCountCommand({ type: "count.archive", countId, payload: {}, uid: actor.uid });
}

export async function unarchiveCount({ countId, actor }) {
  return invokeCountCommand({ type: "count.unarchive", countId, payload: {}, uid: actor.uid });
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

export async function joinInvite(token, user, { manualMemberId = undefined, profileAlias = "" } = {}) {
  return runTransaction(db, (transaction) => joinInviteInTransaction({
    transaction, token, user, manualMemberId, profileAlias, serverTimestamp,
    refs: {
      invite: (inviteToken) => doc(db, "invites", inviteToken),
      membership: (countId, uid) => doc(db, "memberships", `${countId}_${uid}`),
      member: (countId, memberId) => doc(db, "counts", countId, "members", memberId),
      newMember: (countId) => doc(collection(db, "counts", countId, "members")),
      audit: auditRef,
    },
  }));
}

export async function updateUserSettings(uid, data) {
  if (data.alias !== undefined) {
    const normalizedAlias = normalizeMemberAlias(data.alias);
    if (!normalizedAlias) throw new Error("Ingresá un alias válido.");
    const memberships = await getDocs(query(collection(db, "memberships"), where("uid", "==", uid), where("status", "==", "active")));
    const memberLists = await Promise.all(memberships.docs.map((membership) => getDocs(collection(db, "counts", membership.data().countId, "members"))));
    const conflict = memberLists.some((snapshot) => snapshot.docs.some((member) => {
      const item = member.data();
      if (!item.active || item.userId === uid) return false;
      const visibleAlias = item.type === "manual"
        ? item.normalizedManualAlias || item.normalizedAlias
        : normalizeMemberAlias(item.aliasSnapshot);
      return visibleAlias === normalizedAlias;
    }));
    if (conflict) throw new Error("Ya existe un integrante con ese alias en uno de tus Counts activos.");
  }
  return updateDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() });
}

// Una persona recién aprobada todavía no pertenece a ningún Count. En ese
// momento no puede listar memberships (por privacidad), por lo que su primer
// alias se guarda sólo en su propio perfil. Los cambios posteriores siguen
// pasando por updateUserSettings y validan conflictos dentro de sus Counts.
export async function saveInitialUserAlias(uid, alias) {
  const cleanAlias = String(alias ?? "").trim().replace(/\s+/g, " ");
  if (!normalizeMemberAlias(cleanAlias)) throw new Error("Ingresá un alias válido.");
  return updateDoc(doc(db, "users", uid), { alias: cleanAlias, updatedAt: serverTimestamp() });
}
