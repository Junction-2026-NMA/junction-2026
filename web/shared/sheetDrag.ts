"use client";
// Drag-to-dismiss for BottomSheet: the grab zone (grabber and header) follows the pointer, and the scroll area
// hands a downward drag to the sheet once it is scrolled to the top, like a SwiftUI sheet. Moves go straight
// to the DOM (no React render per frame); the release is reported with a velocity.
import { useEffect, type RefObject } from "react";

export interface SheetDragHandlers {
  /** The finger moved `dy` px down (negative: up) since the drag began. */
  onMove: (dy: number) => void;
  /** The finger lifted. `velocity` is px per ms, positive downwards. */
  onRelease: (dy: number, velocity: number) => void;
}

interface Tracker {
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
}

function begin(y: number): Tracker {
  const now = performance.now();
  return { startY: y, lastY: y, lastTime: now, velocity: 0 };
}

function track(tracker: Tracker, y: number): Tracker {
  const now = performance.now();
  const elapsed = Math.max(now - tracker.lastTime, 1);
  const instant = (y - tracker.lastY) / elapsed;
  return { ...tracker, lastY: y, lastTime: now, velocity: tracker.velocity * 0.6 + instant * 0.4 };
}

/** Wires pointer drags on `grab` and touch drags on `scroll` (at its top) to the handlers. */
export function useSheetDrag(
  grab: RefObject<HTMLElement | null>,
  scroll: RefObject<HTMLElement | null>,
  handlers: RefObject<SheetDragHandlers>,
  enabled: boolean,
): void {
  useEffect(() => {
    const grabElement = grab.current;
    if (!enabled || !grabElement) return;
    let tracker: Tracker | null = null;

    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement | null)?.closest("button, a, input, textarea, select, canvas, [role=button], [data-no-drag]")) return;
      tracker = begin(event.clientY);
      grabElement.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!tracker) return;
      tracker = track(tracker, event.clientY);
      handlers.current.onMove(event.clientY - tracker.startY);
    };
    const up = (event: PointerEvent) => {
      if (!tracker) return;
      const done = tracker;
      tracker = null;
      if (grabElement.hasPointerCapture(event.pointerId)) grabElement.releasePointerCapture(event.pointerId);
      handlers.current.onRelease(done.lastY - done.startY, done.velocity);
    };
    grabElement.addEventListener("pointerdown", down);
    grabElement.addEventListener("pointermove", move);
    grabElement.addEventListener("pointerup", up);
    grabElement.addEventListener("pointercancel", up);
    return () => {
      grabElement.removeEventListener("pointerdown", down);
      grabElement.removeEventListener("pointermove", move);
      grabElement.removeEventListener("pointerup", up);
      grabElement.removeEventListener("pointercancel", up);
    };
  }, [grab, handlers, enabled]);

  useEffect(() => {
    const scrollElement = scroll.current;
    if (!enabled || !scrollElement) return;
    let startY = 0;
    let tracker: Tracker | null = null;

    const start = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY ?? 0;
      tracker = null;
    };
    const move = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? 0;
      if (!tracker) {
        // Take over only a downward drag that starts at the top of the content.
        if (scrollElement.scrollTop > 0 || y - startY <= 4) return;
        tracker = begin(y);
      }
      event.preventDefault();
      tracker = track(tracker, y);
      handlers.current.onMove(Math.max(y - tracker.startY, 0));
    };
    const end = () => {
      if (!tracker) return;
      const done = tracker;
      tracker = null;
      handlers.current.onRelease(Math.max(done.lastY - done.startY, 0), done.velocity);
    };
    scrollElement.addEventListener("touchstart", start, { passive: true });
    scrollElement.addEventListener("touchmove", move, { passive: false });
    scrollElement.addEventListener("touchend", end);
    scrollElement.addEventListener("touchcancel", end);
    return () => {
      scrollElement.removeEventListener("touchstart", start);
      scrollElement.removeEventListener("touchmove", move);
      scrollElement.removeEventListener("touchend", end);
      scrollElement.removeEventListener("touchcancel", end);
    };
  }, [scroll, handlers, enabled]);
}
