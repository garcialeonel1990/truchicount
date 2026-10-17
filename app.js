import { completeRedirectSignIn, signInWithGoogle, watchAuth } from "./firebase.js";
import { startBootstrap } from "./bootstrap.js";

startBootstrap({
  document,
  watchAuth,
  completeRedirectSignIn,
  signInWithGoogle,
  loadApp: () => import("./app-main.js"),
  reload: () => location.reload(),
});
