import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("iOS home screen uses the full viewport without disabling zoom", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /name="viewport" content="[^"]*viewport-fit=cover/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
});

test("the page clips horizontal overflow while retaining safe areas and vertical scrolling", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /html\s*\{[^}]*overflow-x:\s*clip/);
  assert.match(css, /body\s*\{[^}]*overflow-x:\s*clip/);
  assert.doesNotMatch(css, /(?:html|body)\s*\{[^}]*overflow-y:\s*hidden/);
  assert.match(css, /padding-top:\s*calc\(10px \+ env\(safe-area-inset-top\)\)/);
  assert.match(css, /padding-top:\s*calc\(20px \+ env\(safe-area-inset-top\)\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /env\(safe-area-inset-left\)/);
  assert.match(css, /env\(safe-area-inset-right\)/);
});
