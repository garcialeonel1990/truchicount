import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("iOS home screen uses the full viewport without disabling zoom", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /name="viewport" content="[^"]*viewport-fit=cover/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="theme-color" content="#0b1f33"/);
  assert.match(html, /name="mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-status-bar-style" content="default"/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /<style>html,body\{background:#0b1f33\}<\/style>/);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
});

test("the install manifest and first paint keep the iOS system area navy", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#0b1f33");
  assert.equal(manifest.background_color, "#0b1f33");
  assert.match(css, /\.startup-screen\s*\{\s*background:\s*var\(--color-header\)/);
});

test("the page clips horizontal overflow while retaining safe areas and vertical scrolling", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /html\s*\{[^}]*overflow-x:\s*clip/);
  assert.match(css, /body\s*\{[^}]*overflow-x:\s*clip/);
  assert.match(css, /@media \(max-width: 639px\) \{[\s\S]*?body\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /\.screen\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior-y:\s*none;/);
  assert.match(css, /\.login-screen\s*\{[^}]*height:\s*100dvh;[^}]*overflow-y:\s*auto;/);
  assert.match(css, /--app-navigation-height:\s*64px/);
  assert.match(css, /--safe-top:\s*env\(safe-area-inset-top, 0px\)/);
  assert.match(css, /min-height:\s*calc\(var\(--app-navigation-height\) \+ var\(--safe-top\)\)/);
  assert.match(css, /env\(safe-area-inset-bottom, 0px\)/);
});

test("Home, Detalle y Ajustes conservan una única navegación superior y una sola safe area", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.equal((html.match(/class="app-header"/g) || []).length, 1);
  assert.match(css, /\.app-shell\s*\{\s*display:\s*grid;[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.doesNotMatch(css, /\.app-shell\.is-detail-view \.app-header\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /\.app-shell\.is-detail-view::before/);
  assert.match(css, /\.count-context-header\s*\{/);
  assert.match(css, /\.settings-topline\s*\{/);
});
