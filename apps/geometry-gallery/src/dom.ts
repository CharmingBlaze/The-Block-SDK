export function requireElement<T extends HTMLElement>(id: string, guard: (el: HTMLElement) => el is T): T {
  const el = document.getElementById(id);
  if (!el || !guard(el)) {
    throw new Error(`missing #${id}`);
  }
  return el;
}

export function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

export function setPressed(id: string, pressed: boolean): void {
  const el = document.getElementById(id);
  if (el) {
    el.setAttribute("aria-pressed", pressed ? "true" : "false");
  }
}
