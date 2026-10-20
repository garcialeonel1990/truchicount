export async function runCommand({ type, countId, payload, uid, storage, randomUUID, invoke }) {
  const key = "truchicount:cmd:" + JSON.stringify([uid, type, countId, payload]);
  let requestId;
  try {
    requestId = storage.getItem(key);
    if (!requestId) { requestId = randomUUID(); storage.setItem(key, requestId); }
  } catch {
    throw new Error("No pudimos guardar el identificador de la operación en este dispositivo.");
  }
  const response = await invoke({ type, countId, requestId, payload });
  try { storage.removeItem(key); } catch { /* retry is safe */ }
  return response.data.result ?? response.data;
}
