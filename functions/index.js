import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { createSettlementCommand, SettlementCommandError } from "./settlement-service.js";

if (!getApps().length) initializeApp();

export const createSettlementV2 = onCall({ enforceAppCheck: false, maxInstances: 10 }, async (request) => {
  try {
    return await createSettlementCommand({ db: getFirestore(), uid: request.auth?.uid, input: request.data });
  } catch (error) {
    if (error instanceof SettlementCommandError || error?.name === "SettlementCommandError") throw new HttpsError(error.code, error.message);
    logger.error("createSettlementV2 failed", { uid: request.auth?.uid || null, countId: request.data?.countId || null, error });
    throw new HttpsError("internal", "No pudimos registrar la liquidación.");
  }
});
