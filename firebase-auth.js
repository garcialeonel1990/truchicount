import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDErUOtXuvBuGGhsfPjxPPuC-RYQsbBCO0",
  authDomain: "truchicount.firebaseapp.com",
  projectId: "truchicount",
  storageBucket: "truchicount.firebasestorage.app",
  messagingSenderId: "1034367568835",
  appId: "1:1034367568835:web:ec9bc6c2dfe7b213e64b76",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});

export async function completeRedirectSignIn() {
  return getRedirectResult(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error.code === "auth/popup-blocked" || error.code === "auth/cancelled-popup-request") {
      return signInWithRedirect(auth, googleProvider);
    }

    throw error;
  }
}

export function signOutUser() {
  return signOut(auth);
}

export function updateUserProfile(displayName) {
  return updateProfile(auth.currentUser, { displayName });
}

export function requestProjectAccess(projectId, request) {
  return setDoc(
    doc(db, "projects", projectId, "joinRequests", request.uid),
    {
      ...request,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function watchProjectJoinRequests(projectId, onChange) {
  return onSnapshot(
    collection(db, "projects", projectId, "joinRequests"),
    (snapshot) => {
      onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    },
    (error) => onChange([], error)
  );
}

export function reviewProjectAccess(projectId, uid, status) {
  return updateDoc(doc(db, "projects", projectId, "joinRequests", uid), {
    status,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
