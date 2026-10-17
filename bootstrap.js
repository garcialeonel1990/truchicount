// Keep Firestore and the application out of the signed-out startup path.
export function startBootstrap({ document, watchAuth, completeRedirectSignIn, signInWithGoogle, loadApp, reload }) {
  const startup = document.querySelector("#startupScreen");
  const startupMessage = document.querySelector("#startupMessage");
  const retry = document.querySelector("#startupRetryButton");
  const login = document.querySelector("#loginScreen");
  const button = document.querySelector("#googleLoginButton");
  const authError = document.querySelector("#authError");
  let loading = false;
  let finished = false;
  let unsubscribe = () => {};

  async function launch() {
    if (loading || finished) return;
    loading = true;
    startup.hidden = false;
    startup.setAttribute("aria-busy", "true");
    login.hidden = true;
    retry.hidden = true;
    startupMessage.textContent = "Preparando tus Counts…";
    try {
      await loadApp();
      finished = true;
      unsubscribe();
      button.removeEventListener("click", signIn);
      retry.removeEventListener("click", reload);
    } catch (exception) {
      console.error(exception);
      startupMessage.textContent = "No pudimos cargar TruchiCount. Revisá tu conexión y reintentá.";
      startup.setAttribute("aria-busy", "false");
      retry.hidden = false;
    } finally {
      loading = false;
    }
  }

  async function signIn() {
    authError.hidden = true;
    button.disabled = true;
    try {
      await signInWithGoogle();
    } catch (exception) {
      console.error(exception);
      authError.textContent = exception?.message || "No se pudo iniciar sesión.";
      authError.hidden = false;
      button.disabled = false;
    }
  }

  button.addEventListener("click", signIn);
  retry.addEventListener("click", reload);
  completeRedirectSignIn().catch((exception) => {
    console.error(exception);
    authError.textContent = exception?.message || "No se pudo completar el inicio de sesión.";
    authError.hidden = false;
  });
  unsubscribe = watchAuth((user) => {
    if (finished) return;
    if (user) launch();
    else if (!loading) {
      startup.hidden = true;
      startup.setAttribute("aria-busy", "false");
      login.hidden = false;
      button.disabled = false;
    }
  });
}
