"use client";
// A tap that still works over a Rive canvas. RiveCanvas cancels `touchend` so that a layout that moved under the
// finger never receives a ghost click, which also means no `click` follows a finger tap on a canvas. Pointer
// events are not affected: a pointerup close to its pointerdown, soon after it, is a tap. A drag that scrolls
// gets `pointercancel` from the browser, so scrolling never taps. Works for a mouse too (use it instead of onClick).
import { useRef, type PointerEvent as ReactPointerEvent } from "react";

const SLOP_PX = 12;
const MAX_MS = 700;

export function useTap(action: () => void) {
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  return {
    onPointerDown: (event: ReactPointerEvent) => {
      if (!event.isPrimary || event.button > 0) return;
      start.current = { x: event.clientX, y: event.clientY, t: event.timeStamp, id: event.pointerId };
    },
    onPointerUp: (event: ReactPointerEvent) => {
      const down = start.current;
      start.current = null;
      if (!down || down.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > SLOP_PX) return;
      if (event.timeStamp - down.t > MAX_MS) return;
      action();
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
