"use client";
// Whether the on-screen keyboard is up: the web side of UIResponder.keyboardWillShow/WillHide.
// The visual viewport shrinks well below the layout viewport while a text field has focus.
import { useEffect, useState } from "react";

const KEYBOARD_MIN_HEIGHT = 120;

function editableFocused(): boolean {
  const element = typeof document === "undefined" ? null : document.activeElement;
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement) return !element.readOnly;
  if (!(element instanceof HTMLInputElement)) return false;
  const nonText = ["button", "checkbox", "radio", "range", "submit", "reset", "file", "color", "image", "hidden"];
  return !element.readOnly && !nonText.includes(element.type);
}

function keyboardUp(): boolean {
  if (typeof window === "undefined") return false;
  const viewport = window.visualViewport;
  if (!editableFocused()) return false;
  // No visual viewport API: a focused text field is the best guess.
  if (!viewport) return true;
  // Safari and Chrome shrink only the visual viewport; where the layout viewport shrinks too, compare with
  // the screen.
  return window.innerHeight - viewport.height > KEYBOARD_MIN_HEIGHT || viewport.height < window.screen.height * 0.7;
}

/** True while the on-screen keyboard is shown. */
export function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const update = () => setShown(keyboardUp());
    // Focus changes come before the viewport resizes; check again once the keyboard has moved.
    const later = () => {
      update();
      window.setTimeout(update, 350);
    };
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", later);
    document.addEventListener("focusout", later);
    return () => {
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", later);
      document.removeEventListener("focusout", later);
    };
  }, []);
  return shown;
}
