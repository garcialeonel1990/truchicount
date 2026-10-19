// A touch gesture supplements the visible back buttons; it never blocks scrolling
// or the browser's own navigation gesture.
export function installEdgeBack({ target, canStart, onBack, isInteractive }) {
  let gesture = null;
  const options = { passive: true };

  target.addEventListener("touchstart", (event) => {
    gesture = null;
    const screen = canStart();
    if (event.touches.length !== 1 || !screen || isInteractive(event.target)) return;
    const touch = event.touches[0];
    if (touch.clientX > 48) return;
    gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, screen };
  }, options);

  target.addEventListener("touchmove", (event) => {
    if (!gesture) return;
    if (event.touches.length !== 1 || event.touches[0].identifier !== gesture.id) {
      gesture = null;
      return;
    }
    const dx = event.touches[0].clientX - gesture.x;
    const dy = Math.abs(event.touches[0].clientY - gesture.y);
    if (dx < -12 || (dy > 24 && dy > Math.max(dx, 0))) gesture = null;
  }, options);

  target.addEventListener("touchend", (event) => {
    if (!gesture) return;
    const start = gesture;
    gesture = null;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === start.id);
    if (!touch || event.touches.length || canStart() !== start.screen) return;
    const dx = touch.clientX - start.x;
    const dy = Math.abs(touch.clientY - start.y);
    if (dx >= 80 && dx >= dy * 1.5) onBack();
  }, options);

  target.addEventListener("touchcancel", () => { gesture = null; }, options);
}

// Horizontal tab navigation for mobile detail views. A gesture that starts at
// either screen edge is intentionally required so normal content scrolling is
// left untouched.
export function installEdgeTabs({ target, canStart, onNext, onPrevious, isInteractive }) {
  let gesture = null;
  const options = { passive: true };

  target.addEventListener("touchstart", (event) => {
    gesture = null;
    const screen = canStart();
    if (event.touches.length !== 1 || !screen || isInteractive(event.target)) return;
    const touch = event.touches[0];
    const width = target.clientWidth || window.innerWidth;
    const edge = touch.clientX <= 48 ? "left" : touch.clientX >= width - 48 ? "right" : null;
    if (!edge) return;
    gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, screen, edge };
  }, options);

  target.addEventListener("touchmove", (event) => {
    if (!gesture) return;
    if (event.touches.length !== 1 || event.touches[0].identifier !== gesture.id) {
      gesture = null;
      return;
    }
    const dx = event.touches[0].clientX - gesture.x;
    const dy = Math.abs(event.touches[0].clientY - gesture.y);
    if (Math.abs(dx) < 12 || dy > 24 && dy > Math.abs(dx)) gesture = null;
  }, options);

  target.addEventListener("touchend", (event) => {
    if (!gesture) return;
    const start = gesture;
    gesture = null;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === start.id);
    if (!touch || event.touches.length || canStart() !== start.screen) return;
    const dx = touch.clientX - start.x;
    const dy = Math.abs(touch.clientY - start.y);
    if (dy > 0 && dy >= Math.abs(dx) / 1.5) return;
    if (start.edge === "right" && dx <= -80) onPrevious();
    if (start.edge === "left" && dx >= 80) onNext();
  }, options);

  target.addEventListener("touchcancel", () => { gesture = null; }, options);
}
