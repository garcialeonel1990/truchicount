// Shared invitation transaction. Keeping the decision tree independent from
// the browser data layer makes it possible to exercise the exact flow against
// the Firestore Emulator.
export async function joinInviteInTransaction({
  transaction,
  refs,
  token,
  user,
  manualMemberId = undefined,
  serverTimestamp,
}) {
  const inviteRef = refs.invite(token);
  const invite = await transaction.get(inviteRef);
  if (!invite.exists() || invite.data().status === "invalid") throw new Error("Esta invitación no existe o ya no está activa.");
  if (invite.data().status === "draft") throw new Error("Este Count todavía se está configurando. Volvé a intentar cuando esté activo.");
  if (invite.data().status !== "active") throw new Error("Esta invitación no existe o ya no está activa.");

  const countId = invite.data().countId;
  const membershipRef = refs.membership(countId, user.uid);
  const membership = await transaction.get(membershipRef);
  if (membership.exists() && (membership.data().countId !== countId || membership.data().uid !== user.uid)) {
    throw new Error("La membresía de esta invitación no es válida. Pedí un link nuevo al Count.");
  }

  const knownMemberId = membership.exists() && membership.data().memberId;
  const memberRef = refs.member(countId, knownMemberId || `registered_${user.uid}`);
  const member = await transaction.get(memberRef);
  const needsMembership = !membership.exists() || membership.data().status !== "active";
  const isOwnRegisteredMember = member.exists() && member.data().type === "registered" && member.data().userId === user.uid;
  const timestamp = () => serverTimestamp();
  const actorName = user.displayName || user.email || "Usuario";

  if (isOwnRegisteredMember && member.data().active && !needsMembership) return { countId, alreadyMember: true };
  if (isOwnRegisteredMember && member.data().active && needsMembership) {
    const data = { memberId: memberRef.id, role: "owner", status: "active", joinedAt: timestamp(), joinedByInvite: true, inviteToken: token, removedAt: null, removedBy: null, updatedAt: timestamp(), updatedBy: user.uid };
    if (membership.exists()) transaction.update(membershipRef, data);
    else transaction.set(membershipRef, { countId, uid: user.uid, ...data, createdAt: timestamp() });
    transaction.update(inviteRef, { usageCount: (invite.data().usageCount || 0) + 1, lastUsedAt: timestamp() });
    return { countId, alreadyMember: true };
  }

  const candidates = (invite.data().manualCandidates || []).filter((candidate) => candidate?.memberId && candidate?.alias);
  if (!isOwnRegisteredMember && manualMemberId === undefined && candidates.length) return { countId, candidates, requiresIdentityChoice: true };

  if (manualMemberId) {
    if (isOwnRegisteredMember) throw new Error("Ya sos integrante de este Count.");
    const manualRef = refs.member(countId, manualMemberId);
    const manual = await transaction.get(manualRef);
    if (!manual.exists() || !manual.data().active || manual.data().type !== "manual" || manual.data().userId != null) throw new Error("Este perfil ya fue vinculado a otra cuenta. Elegí otro perfil o continuá con Ninguno de estos.");
    const previousManualAlias = manual.data().manualAlias || manual.data().alias;
    transaction.update(manualRef, { type: "registered", userId: user.uid, alias: null, aliasSnapshot: actorName, role: "owner", previousManualAlias, inviteToken: token, linkedAt: timestamp(), linkedByUid: user.uid, updatedAt: timestamp(), updatedBy: user.uid });
    transaction.set(refs.audit(), { entityType: "member", entityId: manualRef.id, countId, action: "manualLinkedToUser", actorUid: user.uid, actorNameSnapshot: actorName, before: { type: "manual", manualAlias: previousManualAlias }, after: { type: "registered", userId: user.uid }, createdAt: timestamp() });
    const data = { memberId: manualRef.id, role: "owner", status: "active", joinedAt: timestamp(), joinedByInvite: true, inviteToken: token, removedAt: null, removedBy: null, updatedAt: timestamp(), updatedBy: user.uid };
    if (!membership.exists()) transaction.set(membershipRef, { countId, uid: user.uid, ...data, createdAt: timestamp() });
    else if (needsMembership) transaction.update(membershipRef, data);
    transaction.update(inviteRef, { usageCount: (invite.data().usageCount || 0) + (needsMembership ? 1 : 0), lastUsedAt: timestamp() });
    return { countId, linkedManual: true };
  }

  if (!isOwnRegisteredMember) {
    const newMemberRef = membership.exists() ? refs.newMember(countId) : memberRef;
    if (member.exists()) throw new Error("Tu acceso a este Count cambió. Volvé a abrir la invitación.");
    transaction.set(newMemberRef, { memberId: newMemberRef.id, countId, type: "registered", userId: user.uid, alias: null, aliasSnapshot: actorName, role: "owner", active: true, inviteToken: token, createdAt: timestamp(), createdBy: user.uid, updatedAt: timestamp(), updatedBy: user.uid, removedAt: null, removedBy: null, reactivatedAt: null, reactivatedBy: null, schemaVersion: 1 });
    transaction.set(refs.audit(), { entityType: "member", entityId: newMemberRef.id, countId, action: "createRegisteredMember", actorUid: user.uid, actorNameSnapshot: actorName, after: { type: "registered", userId: user.uid }, createdAt: timestamp() });
    const data = { memberId: newMemberRef.id, role: "owner", status: "active", joinedAt: timestamp(), joinedByInvite: true, inviteToken: token, removedAt: null, removedBy: null, updatedAt: timestamp(), updatedBy: user.uid };
    if (!membership.exists()) transaction.set(membershipRef, { countId, uid: user.uid, ...data, createdAt: timestamp() });
    else transaction.update(membershipRef, data);
  } else if (!member.data().active) {
    transaction.update(memberRef, { active: true, inviteToken: token, reactivatedAt: timestamp(), reactivatedBy: user.uid, removedAt: null, removedBy: null, updatedAt: timestamp(), updatedBy: user.uid });
    transaction.set(refs.audit(), { entityType: "member", entityId: memberRef.id, countId, action: "reactivateMember", actorUid: user.uid, actorNameSnapshot: actorName, before: { active: false }, after: { active: true }, createdAt: timestamp() });
  }

  if (isOwnRegisteredMember && !membership.exists()) transaction.set(membershipRef, { countId, uid: user.uid, memberId: memberRef.id, role: "owner", status: "active", joinedAt: timestamp(), joinedByInvite: true, inviteToken: token, createdAt: timestamp() });
  else if (isOwnRegisteredMember && needsMembership) transaction.update(membershipRef, { memberId: memberRef.id, role: "owner", status: "active", joinedAt: timestamp(), joinedByInvite: true, inviteToken: token, removedAt: null, removedBy: null, updatedAt: timestamp(), updatedBy: user.uid });
  transaction.update(inviteRef, { usageCount: (invite.data().usageCount || 0) + (needsMembership ? 1 : 0), lastUsedAt: timestamp() });
  return { countId, alreadyMember: !needsMembership };
}
