import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDErUOtXuvBuGGhsfPjxPPuC-RYQsbBCO0",
  authDomain: "truchicount.firebaseapp.com",
  projectId: "truchicount",
  storageBucket: "truchicount.firebasestorage.app",
  messagingSenderId: "1034367568835",
  appId: "1:1034367568835:web:ec9bc6c2dfe7b213e64b76",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export const watchAuth = (callback) => onAuthStateChanged(auth, callback);
export const completeRedirectSignIn = () => getRedirectResult(auth);
export const signOutUser = () => signOut(auth);
export const updateDisplayName = (displayName) => updateProfile(auth.currentUser, { displayName });

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (error.code === "auth/popup-blocked" || error.code === "auth/cancelled-popup-request") return signInWithRedirect(auth, provider);
    throw error;
  }
}
