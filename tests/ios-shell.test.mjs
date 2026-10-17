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
  assert.match(css, /\.startup-screen\s*\{\s*background:\s*var\(--navy-900\)/);
});

test("the page clips horizontal overflow while retaining safe areas and vertical scrolling", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /html\s*\{[^}]*overflow-x:\s*clip/);
  assert.match(css, /body\s*\{[^}]*overflow-x:\s*clip/);
  assert.match(css, /@media \(max-width: 639px\) \{[\s\S]*?body\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /\.screen\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior-y:\s*none;/);
  assert.match(css, /\.login-screen\s*\{[^}]*height:\s*100dvh;[^}]*overflow-y:\s*auto;/);
  assert.match(css, /padding-top:\s*calc\(10px \+ env\(safe-area-inset-top\)\)/);
  assert.match(css, /padding-top:\s*calc\(20px \+ env\(safe-area-inset-top\)\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /env\(safe-area-inset-left\)/);
  assert.match(css, /env\(safe-area-inset-right\)/);
});
