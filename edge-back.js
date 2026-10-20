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

// One horizontal gesture handles the Count tabs. The caller decides which
// controls should retain their own touch behavior.
export function installSwipeTabs({ target, canStart, onNext, onPrevious, isInteractive }) {
  let gesture = null;
  const passive = { passive: true };

  target.addEventListener("touchstart", (event) => {
    gesture = null;
    const tab = canStart();
    if (event.touches.length !== 1 || !tab || isInteractive(event.target)) return;
    const touch = event.touches[0];
    gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, tab };
  }, passive);

  target.addEventListener("touchmove", (event) => {
    if (!gesture) return;
    if (event.touches.length !== 1 || event.touches[0].identifier !== gesture.id) {
      gesture = null;
      return;
    }
    const dx = event.touches[0].clientX - gesture.x;
    const dy = Math.abs(event.touches[0].clientY - gesture.y);
    if (dy > 24 && dy > Math.abs(dx)) gesture = null;
  }, passive);

  target.addEventListener("touchend", (event) => {
    if (!gesture) return;
    const start = gesture;
    gesture = null;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === start.id);
    if (!touch || event.touches.length || canStart() !== start.tab) return;
    const dx = touch.clientX - start.x;
    const dy = Math.abs(touch.clientY - start.y);
    if (Math.abs(dx) < 65 || Math.abs(dx) < dy * 1.5) return;
    event.preventDefault(); // A swipe on an expense card must not also open it.
    if (dx < 0) onPrevious();
    else onNext();
  }, { passive: false });

  target.addEventListener("touchcancel", () => { gesture = null; }, passive);
}
