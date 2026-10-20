// Reglas tras SDD-2/SDD-3: los 11 agujeros deben estar cerrados y los flujos legítimos deben seguir funcionando.
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const C = "countA"; let env;
const db = (uid) => env.authenticatedContext(uid).firestore();

before(async () => { env = await initializeTestEnvironment({ projectId: "demo-truchicount", firestore: { rules: await readFile(new URL("../../firestore.rules", import.meta.url), "utf8") } }); });
after(async () => env && env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    for (const uid of ["alice", "bob", "mallory"]) await setDoc(doc(d, "users", uid), { uid, accessStatus: "approved", isAdmin: false, alias: uid });
    await setDoc(doc(d, "counts", C), { status: "active", primaryCurrency: "ARS", hasMovements: true, createdBy: "alice", ownerUid: "alice" });
    await setDoc(doc(d, "counts", "draftC"), { status: "draft", createdBy: "alice", ownerUid: "alice", name: "", normalizedName: "", emoji: "🧾", primaryCurrency: null });
    for (const [uid, mid] of [["alice", "ma"], ["bob", "mb"]]) {
      await setDoc(doc(d, "memberships", `${C}_${uid}`), { countId: C, uid, memberId: mid, status: "active", role: "owner" });
      await setDoc(doc(d, "counts", C, "members", mid), { countId: C, type: "registered", userId: uid, active: true, role: "owner" });
    }
    await setDoc(doc(d, "counts", C, "members", "mc"), { countId: C, type: "manual", userId: null, active: true, alias: "c", role: "member" });
    await setDoc(doc(d, "counts", C, "expenses", "seed"), { countId: C, amountMinor: 1000, currency: "ARS", status: "active", createdBy: "alice" });
    await setDoc(doc(d, "categories", "cat1"), { name: "Groceries", emoji: "🛒", status: "active", createdBy: "alice" });
    await setDoc(doc(d, "categories", "off"), { name: "Vieja", emoji: "🧾", status: "inactive", createdBy: "alice" });
    await setDoc(doc(d, "merchants", "m1"), { name: "Jumbo", createdBy: "alice", usageCount: 1 });
  });
});
const exp = (over = {}) => ({ countId: C, amountMinor: 1000, currency: "ARS", payerMemberId: "ma", participantMemberIds: ["ma", "mb"], participantShares: { ma: 500, mb: 500 }, status: "active", createdBy: "alice", updatedBy: "alice", ...over });

// Cerrados
test("H01 escritura directa de gastos (create/update/delete) bloqueada", async () => {
  await assertFails(setDoc(doc(db("alice"), "counts", C, "expenses", "x"), exp()));
  await assertFails(updateDoc(doc(db("alice"), "counts", C, "expenses", "seed"), { amountMinor: 1 }));
  await assertFails(deleteDoc(doc(db("alice"), "counts", C, "expenses", "seed")));
});
test("H02 VULN-01..05 shares/pagadores corruptos bloqueados", async () => {
  for (const over of [{ payerShares: { ma: 1 } }, { payerShares: { ghost: 1000 } }, { participantShares: { ma: 1, mb: 1 } }, { payerMemberId: "ghost" }])
    await assertFails(setDoc(doc(db("alice"), "counts", C, "expenses", "x"), exp(over)));
});
test("H03 VULN-06 archivar directo y apagar hasMovements bloqueados", async () => {
  await assertFails(updateDoc(doc(db("alice"), "counts", C), { status: "archived", updatedBy: "alice" }));
  await assertFails(updateDoc(doc(db("alice"), "counts", C), { hasMovements: true, updatedBy: "alice" }));
});
test("H04 VULN-07 auditoría falsificada bloqueada", async () => {
  await assertFails(setDoc(doc(db("mallory"), "auditLogs", "fake"), { actorUid: "mallory", entityType: "category", action: "delete", entityId: "cat1" }));
  await assertFails(setDoc(doc(db("alice"), "auditLogs", "fake2"), { actorUid: "alice", entityType: "expense", action: "create", countId: C }));
});
test("H05 VULN-08 categoría ajena no editable; merchants solo uso", async () => {
  await assertFails(updateDoc(doc(db("mallory"), "categories", "cat1"), { name: "X", updatedBy: "mallory" }));
  await assertFails(updateDoc(doc(db("mallory"), "merchants", "m1"), { name: "X" }));
});
test("H06 VULN-09 aprobado no integrante no lee un registrado ajeno", async () => {
  await assertFails(getDoc(doc(db("mallory"), "counts", C, "members", "ma")));
});
test("H07 VULN-10 emoji con markup bloqueado", async () => {
  await assertFails(updateDoc(doc(db("alice"), "counts", "draftC"), { emoji: "<img src=x onerror=1>", updatedBy: "alice" }));
});
test("H08 members.delete y active:false directos bloqueados; membership no se inactiva directo", async () => {
  await assertFails(deleteDoc(doc(db("alice"), "counts", C, "members", "mc")));
  await assertFails(updateDoc(doc(db("alice"), "counts", C, "members", "mc"), { active: false, updatedBy: "alice" }));
  await assertFails(updateDoc(doc(db("alice"), "counts", C, "members", "mb"), { active: false, updatedBy: "alice" }));
  await assertFails(updateDoc(doc(db("alice"), "memberships", `${C}_bob`), { status: "inactive", removedBy: "alice", updatedBy: "alice" }));
});
test("H09 SDD-3 monedas inválidas en perfil y borrador bloqueadas", async () => {
  await assertFails(updateDoc(doc(db("alice"), "users", "alice"), { enabledCurrencies: ["ZZZ"] }));
  await assertFails(updateDoc(doc(db("alice"), "users", "alice"), { enabledCurrencies: [] }));
  await assertFails(updateDoc(doc(db("alice"), "users", "alice"), { enabledCurrencies: Array.from({ length: 21 }, (_, i) => ["ARS", "USD", "EUR", "BRL", "UYU", "CLP", "PYG", "BOB", "MXN", "PEN", "COP", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY", "INR", "KRW", "SEK", "NOK"][i]) }));
  await assertFails(updateDoc(doc(db("alice"), "users", "alice"), { defaultCurrency: "ZZZ" }));
  await assertFails(updateDoc(doc(db("alice"), "counts", "draftC"), { primaryCurrency: "ZZZ", updatedBy: "alice" }));
});
// Flujos legítimos
test("OK1 integrante lee Count, gastos e integrantes", async () => {
  await assertSucceeds(getDoc(doc(db("alice"), "counts", C)));
  await assertSucceeds(getDoc(doc(db("alice"), "counts", C, "expenses", "seed")));
  await assertSucceeds(getDoc(doc(db("bob"), "counts", C, "members", "ma")));
});
test("OK2 dueño del borrador guarda emoji y moneda del catálogo", async () => {
  await assertSucceeds(updateDoc(doc(db("alice"), "counts", "draftC"), { emoji: "🏡", updatedBy: "alice" }));
  await assertSucceeds(updateDoc(doc(db("alice"), "counts", "draftC"), { primaryCurrency: "EUR", defaultCurrency: "EUR", updatedBy: "alice" }));
});
test("OK3 creador edita su categoría; otro aprobado reactiva una inactiva", async () => {
  await assertSucceeds(updateDoc(doc(db("alice"), "categories", "cat1"), { name: "Súper", updatedBy: "alice" }));
  await assertSucceeds(updateDoc(doc(db("mallory"), "categories", "off"), { status: "active", updatedBy: "mallory" }));
});
test("OK4 cualquier aprobado actualiza el uso de un comercio", async () => {
  await assertSucceeds(updateDoc(doc(db("mallory"), "merchants", "m1"), { usageCount: 2, lastUsedAt: new Date() }));
});
test("OK5 perfil: monedas y predeterminada válidas", async () => {
  await assertSucceeds(updateDoc(doc(db("alice"), "users", "alice"), { enabledCurrencies: ["ARS", "EUR", "CLP"], defaultCurrency: "EUR" }));
});
test("OK6 aprobado no integrante lee un manual no vinculado (necesario para reclamarlo)", async () => {
  await assertSucceeds(getDoc(doc(db("mallory"), "counts", C, "members", "mc")));
});

