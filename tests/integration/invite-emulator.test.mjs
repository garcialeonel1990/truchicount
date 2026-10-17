import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { joinInviteInTransaction } from "../../invite-join.js";

const PROJECT_ID = "demo-truchicount";
const COUNT_ID = "countA";
const TOKEN = "inviteA";
const ADMIN_UID = "8qvbKFXafDXWWGDPo2OFDul6uss1";
let env;

const memberRef = (db, id) => doc(db, "counts", COUNT_ID, "members", id);
const membershipRef = (db, uid) => doc(db, "memberships", `${COUNT_ID}_${uid}`);
const inviteRef = (db) => doc(db, "invites", TOKEN);
const client = (uid) => env.authenticatedContext(uid).firestore();

async function seedUser(db, uid, accessStatus = "approved") {
  await setDoc(doc(db, "users", uid), { uid, accessStatus, isAdmin: false, googleDisplayName: uid });
}

async function seedBase({ status = "active", inviteStatus = "active", candidates = [] } = {}) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "counts", COUNT_ID), { status, ownerUid: "owner", createdBy: "owner", primaryCurrency: "ARS", hasMovements: false });
    await seedUser(db, "owner");
    await setDoc(memberRef(db, "registered_owner"), { memberId: "registered_owner", countId: COUNT_ID, type: "registered", userId: "owner", role: "owner", active: true });
    await setDoc(membershipRef(db, "owner"), { countId: COUNT_ID, uid: "owner", memberId: "registered_owner", role: "owner", status: "active" });
    await setDoc(inviteRef(db), { countId: COUNT_ID, status: inviteStatus, createdBy: "owner", usageCount: 0, manualCandidates: candidates });
  });
}

async function addUser(uid, status = "approved") {
  await env.withSecurityRulesDisabled((context) => seedUser(context.firestore(), uid, status));
}

async function join(uid, options = {}) {
  const db = client(uid);
  return runTransaction(db, (transaction) => joinInviteInTransaction({
    transaction,
    token: TOKEN,
    user: { uid, displayName: uid },
    manualMemberId: options.manualMemberId,
    profileAlias: options.profileAlias,
    serverTimestamp,
    refs: {
      invite: () => inviteRef(db),
      membership: (_countId, memberUid) => membershipRef(db, memberUid),
      member: (_countId, memberId) => memberRef(db, memberId),
      newMember: () => doc(collection(db, "counts", COUNT_ID, "members")),
      audit: () => doc(collection(db, "auditLogs")),
    },
  }));
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: await readFile(new URL("../../firestore.rules", import.meta.url), "utf8") },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedBase();
});

after(async () => {
  if (env) await env.cleanup();
});

test("joinInvite: primera invitación aprobada crea la membresía", async () => {
  await addUser("guest");
  assert.deepEqual(await join("guest"), { countId: COUNT_ID, alreadyMember: false });
});

test("reglas: quien acepta una invitación puede listar sus membresías activas", async () => {
  await addUser("guest");
  await join("guest");
  const memberships = await getDocs(query(collection(client("guest"), "memberships"), where("uid", "==", "guest"), where("status", "==", "active")));
  assert.equal(memberships.docs.length, 1);
  assert.equal(memberships.docs[0].data().countId, COUNT_ID);
});

test("reglas: un usuario no puede listar membresías de otra persona", async () => {
  await addUser("guest");
  await assertFails(getDocs(query(collection(client("guest"), "memberships"), where("uid", "==", "owner"))));
});

test("reglas: un usuario recién aprobado puede guardar su nickname sin membresías", async () => {
  await addUser("guest");
  await updateDoc(doc(client("guest"), "users", "guest"), { alias: "Lola" });
  assert.equal((await getDoc(doc(client("guest"), "users", "guest"))).data().alias, "Lola");
});

test("reglas: sólo el administrador puede eliminar un perfil para reiniciar su acceso", async () => {
  await addUser("guest");
  await assertFails(deleteDoc(doc(client("guest"), "users", "guest")));
  await deleteDoc(doc(client(ADMIN_UID), "users", "guest"));
  await env.withSecurityRulesDisabled(async (context) => assert.equal((await getDoc(doc(context.firestore(), "users", "guest"))).exists(), false));
});

test("joinInvite: usa el nickname elegido por quien acepta la invitación", async () => {
  await addUser("guest");
  await join("guest", { profileAlias: "Lola" });
  assert.equal((await getDoc(memberRef(client("guest"), "registered_guest"))).data().aliasSnapshot, "Lola");
});

test("joinInvite: la lectura de la membresía propia inexistente está permitida", async () => {
  await addUser("guest");
  const membership = await getDoc(membershipRef(client("guest"), "guest"));
  assert.equal(membership.exists(), false);
});

test("joinInvite: la segunda apertura es idempotente", async () => {
  await addUser("guest"); await join("guest");
  assert.deepEqual(await join("guest"), { countId: COUNT_ID, alreadyMember: true });
});

test("joinInvite: reingresa una membresía inactiva", async () => {
  await addUser("guest"); await join("guest");
  await env.withSecurityRulesDisabled(async (context) => updateDoc(membershipRef(context.firestore(), "guest"), { status: "inactive" }));
  assert.deepEqual(await join("guest"), { countId: COUNT_ID, alreadyMember: true });
  assert.equal((await getDoc(membershipRef(client("guest"), "guest"))).data().status, "active");
});

test("joinInvite: pide elegir identidad si hay manuales vigentes", async () => {
  await env.clearFirestore();
  await seedBase({ candidates: [{ memberId: "manual_1", alias: "Aldu" }] });
  await addUser("guest");
  await env.withSecurityRulesDisabled(async (context) => setDoc(memberRef(context.firestore(), "manual_1"), { memberId: "manual_1", countId: COUNT_ID, type: "manual", alias: "Aldu", manualAlias: "Aldu", role: "member", active: true, userId: null }));
  const result = await join("guest");
  assert.equal(result.requiresIdentityChoice, true);
});

test("joinInvite: vincula un integrante manual elegido", async () => {
  await env.clearFirestore(); await seedBase({ candidates: [{ memberId: "manual_1", alias: "Aldu" }] }); await addUser("guest");
  await env.withSecurityRulesDisabled(async (context) => setDoc(memberRef(context.firestore(), "manual_1"), { memberId: "manual_1", countId: COUNT_ID, type: "manual", alias: "Aldu", manualAlias: "Aldu", role: "member", active: true, userId: null }));
  assert.deepEqual(await join("guest", { manualMemberId: "manual_1" }), { countId: COUNT_ID, linkedManual: true });
});

test("joinInvite: el vínculo manual conserva el id histórico", async () => {
  await env.clearFirestore(); await seedBase({ candidates: [{ memberId: "manual_1", alias: "Aldu" }] }); await addUser("guest");
  await env.withSecurityRulesDisabled(async (context) => setDoc(memberRef(context.firestore(), "manual_1"), { memberId: "manual_1", countId: COUNT_ID, type: "manual", alias: "Aldu", manualAlias: "Aldu", role: "member", active: true, userId: null }));
  await join("guest", { manualMemberId: "manual_1" });
  assert.equal((await getDoc(membershipRef(client("guest"), "guest"))).data().memberId, "manual_1");
});

test("joinInvite: rechaza un candidato manual desactualizado", async () => {
  await addUser("guest");
  await assert.rejects(join("guest", { manualMemberId: "gone" }), /ya fue vinculado/);
});

test("joinInvite: un manual ya reclamado no se puede reclamar de nuevo", async () => {
  await env.clearFirestore(); await seedBase({ candidates: [{ memberId: "manual_1", alias: "Aldu" }] }); await addUser("guest");
  await env.withSecurityRulesDisabled(async (context) => setDoc(memberRef(context.firestore(), "manual_1"), { memberId: "manual_1", countId: COUNT_ID, type: "registered", userId: "other", role: "owner", active: true }));
  await assert.rejects(join("guest", { manualMemberId: "manual_1" }), /ya fue vinculado/);
});

test("joinInvite: rechaza perfiles pendientes", async () => {
  await addUser("pending", "pending");
  await assertFails(join("pending"));
});

test("joinInvite: rechaza perfiles bloqueados", async () => {
  await addUser("blocked", "blocked");
  await assertFails(join("blocked"));
});

test("joinInvite: rechaza perfiles sin documento", async () => {
  await assertFails(join("unknown"));
});

test("reglas: un ajeno no puede leer otra membresía", async () => {
  await addUser("outsider");
  await assertFails(getDoc(membershipRef(client("outsider"), "owner")));
});

test("reglas: un usuario aprobado no puede leer el perfil de otra persona", async () => {
  await addUser("outsider");
  await assertFails(getDoc(doc(client("outsider"), "users", "owner")));
  assert.equal((await getDoc(doc(client("outsider"), "users", "outsider"))).exists(), true);
});

test("reglas: un ajeno no puede listar integrantes", async () => {
  await addUser("outsider");
  await assertFails(getDocs(collection(client("outsider"), "counts", COUNT_ID, "members")));
});

test("reglas: un perfil pendiente no puede resolver una invitación", async () => {
  await addUser("pending", "pending");
  await assertFails(getDoc(inviteRef(client("pending"))));
});

test("reglas: una invitación draft no incorpora personas", async () => {
  await env.clearFirestore(); await seedBase({ status: "draft", inviteStatus: "draft" }); await addUser("guest");
  await assert.rejects(join("guest"), /todavía se está configurando/);
});

test("reglas: una invitación inválida no incorpora personas", async () => {
  await env.clearFirestore(); await seedBase({ inviteStatus: "invalid" }); await addUser("guest");
  await assert.rejects(join("guest"), /no existe/);
});

test("reglas: no se puede crear una membresía con id no canónico", async () => {
  await addUser("guest");
  await assertFails(setDoc(doc(client("guest"), "memberships", "wrong"), { countId: COUNT_ID, uid: "guest", memberId: "registered_guest", role: "owner", status: "active", inviteToken: TOKEN }));
});

test("reglas: no se puede usar un Member de otro usuario", async () => {
  await addUser("guest");
  await assertFails(setDoc(membershipRef(client("guest"), "guest"), { countId: COUNT_ID, uid: "guest", memberId: "registered_owner", role: "owner", status: "active", inviteToken: TOKEN }));
});

test("reglas: rechaza gastos con monto inválido o autor falsificado", async () => {
  const expense = (overrides = {}) => ({
    countId: COUNT_ID, title: "Cena", amountMinor: 1000, currency: "ARS",
    payerMemberId: "registered_owner", participantMemberIds: ["registered_owner"],
    participantShares: { registered_owner: 1000 }, status: "active",
    createdBy: "owner", updatedBy: "owner", ...overrides,
  });
  await assertFails(setDoc(doc(client("owner"), "counts", COUNT_ID, "expenses", "invalidAmount"), expense({ amountMinor: 0 })));
  await assertFails(setDoc(doc(client("owner"), "counts", COUNT_ID, "expenses", "invalidAuthor"), expense({ createdBy: "guest" })));
  await assertFails(setDoc(doc(client("owner"), "counts", COUNT_ID, "expenses", "otherCurrency"), expense({ currency: "USD" })));
});

test("reglas: ni miembros ni administradores escriben liquidaciones directamente", async () => {
  const settlement = { countId: COUNT_ID, fromMemberId: "registered_owner", toMemberId: "other", amountMinor: 1000, currency: "ARS", status: "active", createdBy: "owner", updatedBy: "owner" };
  const ref = (db) => doc(db, "counts", COUNT_ID, "settlements", "payment");
  await assertFails(setDoc(ref(client("owner")), settlement));
  await assertFails(setDoc(ref(client(ADMIN_UID)), settlement));
  await env.withSecurityRulesDisabled(async (context) => setDoc(ref(context.firestore()), settlement));
  assert.equal((await getDoc(ref(client("owner")))).exists(), true);
  await assertFails(updateDoc(ref(client("owner")), { amountMinor: 500 }));
  await assertFails(deleteDoc(ref(client(ADMIN_UID))));
});

test("reglas: la moneda principal queda fija al activar el Count", async () => {
  await assertFails(updateDoc(doc(client("owner"), "counts", COUNT_ID), {
    primaryCurrency: "USD", defaultCurrency: "USD", updatedBy: "owner",
  }));
});

test("joinInvite: incrementa el uso sólo al incorporar", async () => {
  await addUser("guest"); await join("guest"); await join("guest");
  assert.equal((await getDoc(inviteRef(client("guest")))).data().usageCount, 1);
});

test("joinInvite: registra auditoría al crear un registrado", async () => {
  await addUser("guest"); await join("guest");
  const audits = await getDocs(query(collection(client("guest"), "auditLogs"), where("countId", "==", COUNT_ID)));
  assert.equal(audits.docs.some((snapshot) => snapshot.data().action === "createRegisteredMember"), true);
});

test("joinInvite: rechaza una membresía histórica incoherente", async () => {
  await addUser("guest");
  await env.withSecurityRulesDisabled(async (context) => setDoc(membershipRef(context.firestore(), "guest"), { countId: "otherCount", uid: "guest", memberId: "registered_guest", status: "active" }));
  await assert.rejects(join("guest"), /membresía.*válida/);
});
