// Preserve the operation ID across network failures and page reloads.
export async function recordSettlement({ countId, suggestion, uid, storage, randomUUID, invoke }) {
  const { fromMemberId, toMemberId, currency, amountMinor } = suggestion;
  const payment = { fromMemberId, toMemberId, currency, amountMinor };
  const key = "truchicount:settlement:" + JSON.stringify([uid, countId, fromMemberId, toMemberId, currency, amountMinor]);
  let requestId;
  try {
    requestId = storage.getItem(key);
    if (!requestId) {
      requestId = randomUUID();
      storage.setItem(key, requestId);
    }
  } catch {
    throw new Error("No pudimos guardar el identificador del pago en este dispositivo. Revisá la configuración de almacenamiento y volvé a intentar.");
  }
  const response = await invoke({ countId, requestId, suggestion: payment });
  try { storage.removeItem(key); } catch { /* A retry is safe even if cleanup fails. */ }
  return response.data;
}
