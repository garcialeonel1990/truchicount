import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { startBootstrap } from "../bootstrap.js";

function setup(overrides = {}) {
  const ids = ["startupScreen", "startupMessage", "startupRetryButton", "loginScreen", "googleLoginButton", "authError"];
  const elements = Object.fromEntries(ids.map((id) => [id, {
    hidden: false, disabled: false, textContent: "", attributes: {}, listeners: new Map(),
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.listeners.set(name, handler); },
    removeEventListener(name, handler) { if (this.listeners.get(name) === handler) this.listeners.delete(name); },
    click() { return this.listeners.get("click")?.(); },
  }]));
  let authCallback;
  let loads = 0;
  let unsubscribed = false;
  let reloads = 0;
  startBootstrap({
    document: { querySelector: (selector) => elements[selector.slice(1)] },
    watchAuth: (callback) => { authCallback = callback; return () => { unsubscribed = true; }; },
    completeRedirectSignIn: async () => {},
    signInWithGoogle: async () => {},
    loadApp: async () => { loads++; },
    reload: () => { reloads++; },
    ...overrides,
  });
  return { elements, auth: (user) => authCallback(user), loads: () => loads, unsubscribed: () => unsubscribed, reloads: () => reloads };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("signed-out startup shows login without loading Firestore or the app", async () => {
  const s = setup();
  s.auth(null);
  await flush();
  assert.equal(s.loads(), 0);
  assert.equal(s.elements.startupScreen.hidden, true);
  assert.equal(s.elements.loginScreen.hidden, false);
  assert.equal(s.elements.googleLoginButton.disabled, false);
  const entry = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const firebase = await readFile(new URL("../firebase.js", import.meta.url), "utf8");
  assert.match(entry, /import\("\.\/app-main\.js"\)/);
  assert.doesNotMatch(firebase, /firebase-firestore/);
});

test("existing session loads the app once and hands off the auth listener", async () => {
  const s = setup();
  s.auth({ uid: "test" });
  s.auth({ uid: "test" });
  await flush();
  assert.equal(s.loads(), 1);
  assert.equal(s.unsubscribed(), true);
  assert.equal(s.elements.googleLoginButton.listeners.has("click"), false);
});

test("Google login starts on the click and reports errors without loading the app", async () => {
  let calls = 0;
  const s = setup({ signInWithGoogle: async () => { calls++; throw new Error("No se pudo entrar"); } });
  s.auth(null);
  await s.elements.googleLoginButton.click();
  assert.equal(calls, 1);
  assert.equal(s.loads(), 0);
  assert.equal(s.elements.googleLoginButton.disabled, false);
  assert.equal(s.elements.authError.hidden, false);
  assert.equal(s.elements.authError.textContent, "No se pudo entrar");
});

test("an application loading error offers a full reload", async () => {
  const s = setup({ loadApp: async () => { throw new Error("network"); } });
  s.auth({ uid: "test" });
  await flush();
  assert.equal(s.elements.startupRetryButton.hidden, false);
  assert.equal(s.elements.startupScreen.attributes["aria-busy"], "false");
  s.elements.startupRetryButton.click();
  assert.equal(s.reloads(), 1);
});

test("redirect errors remain visible on the login screen", async () => {
  const s = setup({ completeRedirectSignIn: async () => { throw new Error("redirect"); } });
  s.auth(null);
  await flush();
  assert.equal(s.elements.authError.hidden, false);
  assert.equal(s.elements.authError.textContent, "redirect");
});
