// Keep browser SDK imports on 12.8.0: newer Auth releases can lose redirect state in iOS webviews (firebase-js-sdk#10428).
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDErUOtXuvBuGGhsfPjxPPuC-RYQsbBCO0",
  authDomain: "truchicount.firebaseapp.com",
  projectId: "truchicount",
  storageBucket: "truchicount.firebasestorage.app",
  messagingSenderId: "1034367568835",
  appId: "1:1034367568835:web:ec9bc6c2dfe7b213e64b76",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export const watchAuth = (callback) => onAuthStateChanged(auth, callback);
export const completeRedirectSignIn = () => getRedirectResult(auth);
export const signOutUser = () => signOut(auth);
export const updateDisplayName = (displayName) => updateProfile(auth.currentUser, { displayName });

function shouldUseRedirectSignIn() {
  const userAgent = navigator.userAgent || "";
  const isMobileDevice = navigator.userAgentData?.mobile
    || /Android|iPhone|iPad|iPod/i.test(userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = navigator.standalone === true
    || window.matchMedia?.("(display-mode: standalone)").matches;
  const isCompactTouchDevice = window.matchMedia?.("(pointer: coarse)").matches
    && window.matchMedia?.("(max-width: 1024px)").matches;
  return Boolean(isMobileDevice || isStandalone || isCompactTouchDevice);
}

export async function signInWithGoogle() {
  if (shouldUseRedirectSignIn()) return signInWithRedirect(auth, provider);
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (error.code === "auth/popup-blocked" || error.code === "auth/cancelled-popup-request") return signInWithRedirect(auth, provider);
    throw error;
  }
}
