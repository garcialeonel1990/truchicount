export function openMenu({ anchor, container, items, onSelect, footer }) {
  const menu = document.createElement("div");
  menu.className = "menu-popover"; menu.setAttribute("role", "menu"); menu.tabIndex = -1;
  const all = [...items, ...(footer ? [{ ...footer, footer: true }] : [])];
  all.forEach((item, index) => {
    const row = document.createElement("button"); row.type = "button"; row.className = "menu-popover-item"; row.setAttribute("role", footer && item.footer ? "menuitem" : "menuitemradio");
    if (!item.footer) row.setAttribute("aria-checked", String(Boolean(item.checked)));
    row.textContent = (item.icon ? item.icon + "  " : "") + item.label;
    if (item.checked) row.textContent = "✓  " + row.textContent;
    row.addEventListener("click", () => { if (!item.footer) onSelect(item); else onSelect(item); close(); });
    row.addEventListener("keydown", (event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); all[(index + (event.key === "ArrowDown" ? 1 : -1) + all.length) % all.length]._button?.focus(); } });
    item._button = row; menu.append(row);
  });
  container.append(menu);
  const rect = anchor.getBoundingClientRect();
  menu.style.position = "fixed"; menu.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - menu.offsetWidth - 12))}px`; menu.style.top = `${Math.min(innerHeight - menu.offsetHeight - 12, rect.bottom + 8)}px`;
  const close = () => { menu.remove(); document.removeEventListener("pointerdown", outside, true); };
  const outside = (event) => { if (!menu.contains(event.target) && event.target !== anchor) close(); };
  document.addEventListener("pointerdown", outside, true);
  menu.focus();
  return { close };
}
