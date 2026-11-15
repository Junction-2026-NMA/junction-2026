"use client";
// Focus for BottomSheet, as a modal dialog: Tab and Shift+Tab wrap inside the topmost open sheet, the app behind
// it is inert while it is open, and focus goes back to what opened it. Safari does not focus a tapped button, so
// the opener is the control under a fresh pointer press when that differs from the focused one. Tab skips what
// a closed <details> hides. Also brings a focused text field (and the primary button after it) above the
// on-screen keyboard.

const TABBABLE = [
  "button:not([disabled])", "a[href]", "input:not([disabled]):not([type='hidden'])", "select:not([disabled])",
  "textarea:not([disabled])", "summary", "[tabindex]:not([tabindex='-1'])",
].join(", ");

/** The open sheets, in the order they opened; only the last one handles Tab and Escape. */
const stack: object[] = [];

export const SheetStack = {
  push(token: object): void { stack.push(token); },
  remove(token: object): void {
    const at = stack.lastIndexOf(token);
    if (at >= 0) stack.splice(at, 1);
  },
  isTop(token: object): boolean { return stack[stack.length - 1] === token; },
};

/** The last pointer press, for openers Safari does not focus. Older than this, it did not open the sheet. */
const POINTER_FRESH_MS = 1500;
let lastPress: { target: Element; at: number } | null = null;
let tracking = false;

/** Starts remembering pointer presses (once per page). A key press forgets the last one, so a sheet opened from
 *  the keyboard returns focus to the focused control, never to something tapped just before. */
export function trackPointerPresses(): void {
  if (tracking || typeof document === "undefined") return;
  tracking = true;
  document.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Element) lastPress = { target: event.target, at: performance.now() };
  }, true);
  document.addEventListener("keydown", () => { lastPress = null; }, true);
}

/** Where focus goes back on close: the control under a fresh pointer press when that is not the focused one
 *  (Safari leaves focus where an earlier sheet put it back, so a tap on another control must win), else the
 *  focused control, else the pressed one. A canvas or an icon inside a control resolves to the control itself. */
export function openerOf(active: Element | null): HTMLElement | null {
  const focusedElement = active && active !== document.body && active !== document.documentElement ? active : null;
  const focused = focusedElement?.closest<HTMLElement>(TABBABLE) ?? null;
  const pressedElement = lastPress && performance.now() - lastPress.at < POINTER_FRESH_MS ? lastPress.target : null;
  const pressed = pressedElement?.closest<HTMLElement>(TABBABLE) ?? null;
  return pressed && pressed.isConnected && pressed !== focused ? pressed : focused ?? pressed;
}

/** True when `el` sits in the body of a closed <details> (any level): shown neither on screen nor to Tab. Its
 *  <summary>, and what is inside the summary, stay reachable. Browsers still give the hidden body boxes
 *  (content-visibility), so `getClientRects` alone does not tell. */
export function inClosedDetails(el: Element): boolean {
  for (let details = el.parentElement?.closest("details") ?? null; details; details = details.parentElement?.closest("details") ?? null) {
    if (details.open) continue;
    const summary = Array.from(details.children).find((child) => child.tagName === "SUMMARY");
    if (!summary || !summary.contains(el)) return true;
  }
  return false;
}

/** The elements Tab reaches inside `root`, in order (hidden ones, like a closed details' body, left out). */
export function tabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter((el) =>
    el.getClientRects().length > 0 && !el.closest("[inert], [aria-hidden='true']") && !inClosedDetails(el));
}

/** Keeps Tab inside `root`: each press moves to the next element (Shift: the previous one), wrapping at the ends.
 *  Moved here rather than left to the browser, because Safari's Tab skips buttons and would leave the sheet. */
export function trapTab(event: KeyboardEvent, root: HTMLElement): void {
  event.preventDefault();
  const items = tabbables(root);
  if (items.length === 0) {
    root.focus({ preventScroll: true });
    return;
  }
  const active = document.activeElement;
  const at = active instanceof HTMLElement ? items.indexOf(active) : -1;
  const back = event.shiftKey;
  if (at >= 0) {
    items[(at + (back ? items.length - 1 : 1)) % items.length].focus();
    return;
  }
  // Focus is on the sheet itself or on something Tab does not reach: go to the nearest element in that direction.
  const inside = active instanceof Node && root.contains(active) && active !== root;
  const follows = (el: HTMLElement) => inside && ((active as Node).compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  const target = back
    ? [...items].reverse().find((el) => inside && !follows(el)) ?? items[items.length - 1]
    : items.find(follows) ?? items[0];
  target.focus();
}

/** Makes everything next to `layer` in its parent inert (the app behind the sheet); returns the undo. Elements
 *  already inert stay as they were, and the celebration overlay stays live. */
export function muteBehind(layer: HTMLElement | null): () => void {
  const host = layer?.parentElement;
  if (!layer || !host) return () => {};
  const muted = Array.from(host.children).filter((el): el is HTMLElement =>
    el instanceof HTMLElement && el !== layer && !el.inert && !el.classList.contains("sisu-celebration"));
  muted.forEach((el) => { el.inert = true; });
  return () => muted.forEach((el) => { el.inert = false; });
}

const isTextField = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
  || (el instanceof HTMLInputElement && !["button", "submit", "checkbox", "radio", "range", "hidden"].includes(el.type));

/** The primary action after a field: its form's submit button, else the next primary (Rive) button in the sheet. */
function actionAfter(field: HTMLElement, root: HTMLElement): HTMLElement | null {
  const form = field.closest("form");
  const submit = form?.querySelector<HTMLElement>("button[type='submit'], button:not([type])");
  if (submit) return submit;
  return Array.from(root.querySelectorAll<HTMLElement>("[data-rive='Button'], button[type='submit']"))
    .find((el) => (field.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) ?? null;
}

/** The nearest scrolling box around `el`, inside `root`. */
function scrollerOf(el: HTMLElement, root: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node && node !== root.parentElement; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") return node;
  }
  return null;
}

const GAP = 12;

/** Scrolls the focused text field in `root`, and the primary button after it, into the part of the screen the
 *  keyboard leaves (`visibleTop`…`visibleBottom`, in page pixels). The field's top stays in view first. `shift`:
 *  how far the sheet still has to move (px, negative is up) while it slides, so the result fits where it lands. */
export function revealFocusedField(root: HTMLElement, visibleTop: number, visibleBottom: number, shift = 0): void {
  const field = document.activeElement;
  if (!isTextField(field) || !root.contains(field)) return;
  const scroller = scrollerOf(field, root);
  if (!scroller) return;
  const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { top: r.top + shift, bottom: r.bottom + shift }; };
  const box = rect(scroller);
  const top = Math.max(box.top, visibleTop) + GAP;
  const bottom = Math.min(box.bottom, visibleBottom) - GAP;
  const fieldBox = rect(field);
  const actionElement = actionAfter(field, root);
  const action = actionElement ? rect(actionElement) : null;
  const end = Math.max(fieldBox.bottom, action && action.bottom - fieldBox.top <= bottom - top ? action.bottom : 0);
  const down = Math.min(end - bottom, fieldBox.top - top);
  if (down > 0) scroller.scrollTop += down;
  else if (fieldBox.top < top) scroller.scrollTop -= top - fieldBox.top;
}
