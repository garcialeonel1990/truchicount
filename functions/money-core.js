export function divideAmount(amountMinor, participantIds, payerId = "") {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error("El monto debe ser un entero positivo en centavos.");
  const ids = [...new Set(participantIds)].sort();
  if (!ids.length) return {};
  const shares = Object.fromEntries(ids.map((id) => [id, Math.floor(amountMinor / ids.length)]));
  let remainder = amountMinor % ids.length;
  const order = payerId && shares[payerId] !== undefined ? [payerId, ...ids.filter((id) => id !== payerId)] : ids;
  for (const id of order) {
    if (!remainder) break;
    shares[id] += 1;
    remainder -= 1;
  }
  return shares;
}
