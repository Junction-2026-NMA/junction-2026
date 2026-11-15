"use client";
// Where the on-screen keyboard is, from the visual viewport: the web side of SwiftUI moving the composer up with
// the keyboard. iOS Safari and Chrome on Android (resizes-visual) shrink only the visual viewport while a text
// field has focus, and iOS may also pan it up (offsetTop). The app's root is fixed to the layout viewport, so the
// Ask column pads itself by both: its header stays at the top of what is visible, the composer sits on the keys.
import { useEffect, useState } from "react";

export interface KeyboardInset {
  /** Pixels of the layout viewport hidden above the visible area (iOS pans to the focused field). */
  top: number;
  /** Pixels of the layout viewport covered by the keyboard. 0 when it is down. */
  bottom: number;
}

/** Below this the difference is browser chrome settling, not a keyboard. */
const KEYBOARD_MIN = 60;
const NONE: KeyboardInset = { top: 0, bottom: 0 };

function measure(): KeyboardInset {
  const viewport = window.visualViewport;
  if (!viewport) return NONE;
  const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
  const bottom = layoutHeight - (viewport.offsetTop + viewport.height);
  if (bottom < KEYBOARD_MIN) return NONE;
  return { top: Math.max(0, Math.round(viewport.offsetTop)), bottom: Math.round(bottom) };
}

export function useKeyboardInset(): KeyboardInset {
  const [inset, setInset] = useState<KeyboardInset>(NONE);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = measure();
        setInset((was) => (was.top === next.top && was.bottom === next.bottom ? was : next));
      });
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return inset;
}
