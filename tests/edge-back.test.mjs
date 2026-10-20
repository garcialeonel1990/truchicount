import assert from "node:assert/strict";
import test from "node:test";
import { installEdgeBack, installSwipeTabs } from "../edge-back.js";

function harness() {
  const handlers = {};
  let screen = "detail";
  let interactive = false;
  let backs = 0;
  const target = { addEventListener(type, fn, options) { assert.equal(options.passive, true); handlers[type] = fn; } };
  installEdgeBack({ target, canStart: () => screen, isInteractive: () => interactive, onBack: () => { backs++; } });
  const touch = (x, y = 100, identifier = 1) => ({ clientX: x, clientY: y, identifier });
  return {
    emit(type, touches, changedTouches = touches) { handlers[type]({ touches, changedTouches, target: {} }); },
    touch, backs: () => backs,
    setScreen(value) { screen = value; },
    setInteractive(value) { interactive = value; },
  };
}

function swipe(h, start, end) {
  h.emit("touchstart", [start]);
  h.emit("touchmove", [end]);
  h.emit("touchend", [], [end]);
}

test("un deslizamiento horizontal desde el borde vuelve a la pantalla anterior", () => {
  const h = harness();
  swipe(h, h.touch(25), h.touch(130, 110));
  assert.equal(h.backs(), 1);
});

test("ignora gestos cortos, verticales, hacia la izquierda o lejos del borde", () => {
  const h = harness();
  swipe(h, h.touch(25), h.touch(90));
  swipe(h, h.touch(25), h.touch(120, 200));
  swipe(h, h.touch(25), h.touch(5));
  swipe(h, h.touch(60), h.touch(160));
  assert.equal(h.backs(), 0);
});

test("ignora controles, modales, cambios de pantalla y toques múltiples", () => {
  const h = harness();
  h.setInteractive(true);
  swipe(h, h.touch(10), h.touch(110));
  h.setInteractive(false);
  h.setScreen(null);
  swipe(h, h.touch(10), h.touch(110));
  h.setScreen("detail");
  h.emit("touchstart", [h.touch(10)]);
  h.setScreen("settings");
  h.emit("touchend", [], [h.touch(110)]);
  h.emit("touchstart", [h.touch(10)]);
  h.emit("touchmove", [h.touch(40), h.touch(50, 100, 2)]);
  h.emit("touchend", [], [h.touch(110)]);
  assert.equal(h.backs(), 0);
});

test("un gesto cancelado por el navegador no activa la navegación", () => {
  const h = harness();
  h.emit("touchstart", [h.touch(10)]);
  h.emit("touchcancel", []);
  h.emit("touchend", [], [h.touch(110)]);
  assert.equal(h.backs(), 0);
});

test("los swipes recorren las tres tabs en ambos sentidos sin abrir la tarjeta tocada", () => {
  const handlers = {};
  const target = { addEventListener(type, fn) { handlers[type] = fn; } };
  const tabs = ["expenses", "balances", "summary"];
  let current = 0;
  let canceledClicks = 0;
  installSwipeTabs({
    target,
    canStart: () => tabs[current],
    isInteractive: () => false,
    onPrevious: () => { current = Math.max(0, current - 1); },
    onNext: () => { current = Math.min(2, current + 1); },
  });
  const touch = (x, y = 100) => ({ identifier: 1, clientX: x, clientY: y });
  const swipe = (from, to, endY = 100) => {
    handlers.touchstart({ touches: [touch(from)], target: {} });
    handlers.touchmove({ touches: [touch(to, endY)] });
    handlers.touchend({ touches: [], changedTouches: [touch(to, endY)], preventDefault() { canceledClicks++; } });
  };
  swipe(180, 85);
  assert.equal(tabs[current], "expenses");
  swipe(90, 190);
  swipe(90, 190);
  assert.equal(tabs[current], "summary");
  swipe(190, 90);
  swipe(190, 90);
  assert.equal(tabs[current], "expenses");
  assert.equal(canceledClicks, 5);
  swipe(90, 190, 200);
  assert.equal(tabs[current], "expenses");
});
