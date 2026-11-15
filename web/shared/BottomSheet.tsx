"use client";
// A SwiftUI-style sheet: slides up over a dimmed screen, with a grabber; drag down (on the grabber and header, or
// on the content once it is scrolled to the top) or tap the backdrop to close; Escape closes too. Detents
// "medium" (half the screen) and "large"; with both it opens at medium and can be dragged up
// (.presentationDetents). The content scrolls; the bottom clears the home indicator.
//
//     <BottomSheet open={sheet === "maths"} onClose={() => setSheet(null)} header={<SheetHeader />}>
//       ...
//     </BottomSheet>
//
// The parent owns `open` (like `.sheet(item:)`); onClose asks it to set `open` false, and the slide-out plays
// before the sheet unmounts (onClosed then runs, like onDisappear).
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { prefersReducedMotion } from "@/web/theme/motion";
import { useSheetDrag, type SheetDragHandlers } from "./sheetDrag";
import "./sheet.css";

export type SheetDetent = "medium" | "large";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Stays above the scrolling content and is a drag handle (a sheet's title row). */
  header?: ReactNode;
  /** Default ["large"]. */
  detents?: readonly SheetDetent[];
  /** The grabber at the top (.presentationDragIndicator(.visible)). Default true. */
  grabber?: boolean;
  /** The sheet's colour (.presentationBackground). Default the near-white screen colour. */
  background?: string;
  /** False to let the children scroll themselves. Default true. */
  scroll?: boolean;
  ariaLabel?: string;
  onClosed?: () => void;
  testId?: string;
}

export function BottomSheet(props: BottomSheetProps) {
  const [mounted, setMounted] = useState(props.open);
  const client = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (props.open && !mounted) setMounted(true);
  if (!mounted || !client) return null;
  const host = document.querySelector<HTMLElement>(".sisu-root") ?? document.body;
  return createPortal(<SheetLayer {...props} onGone={() => setMounted(false)} />, host);
}

const subscribeNothing = () => () => {};

/** The motion tokens (web/theme/tokens.css): a soft decelerating rise in, a quicker accelerating slide out. */
const EASE_IN = "var(--sisu-motion-sheet-easing, cubic-bezier(0.32, 0.72, 0, 1))";
const EASE_OUT = "var(--sisu-motion-ease-exit, cubic-bezier(0.3, 0, 0.8, 0.15))";

function SheetLayer(props: BottomSheetProps & { onGone: () => void }) {
  const { open, onClose, detents = ["large"], grabber = true, scroll = true } = props;
  const sheet = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const grab = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const hasMedium = detents.includes("medium");
  const hasLarge = detents.includes("large") || !hasMedium;
  const detent = useRef<SheetDetent>(hasMedium ? "medium" : "large");
  /** False until the first slide-in started: a re-open during the slide-out turns around without a jump. */
  const entered = useRef(false);
  const latest = useRef({ onClose, onClosed: props.onClosed, onGone: props.onGone });
  useLayoutEffect(() => {
    latest.current = { onClose, onClosed: props.onClosed, onGone: props.onGone };
  });

  const duration = (leaving = false) => (prefersReducedMotion() ? 200 : leaving ? 300 : 420);
  const height = () => sheet.current?.offsetHeight ?? window.innerHeight;
  const offsetOf = (which: SheetDetent) => (which === "large" ? 0 : Math.max(height() - window.innerHeight * 0.5, 0));

  const place = (offset: number, animated: boolean, leaving = false) => {
    const element = sheet.current;
    if (!element) return;
    const timing = `${duration(leaving)}ms ${leaving ? EASE_OUT : EASE_IN}`;
    element.style.transition = animated ? `transform ${timing}` : "none";
    element.style.transform = `translate3d(0, ${offset}px, 0)`;
    const fade = backdrop.current;
    if (fade) {
      fade.style.transition = animated ? `opacity ${timing}` : "none";
      const rest = offsetOf(hasMedium ? "medium" : "large");
      fade.style.opacity = String(Math.min(Math.max(1 - (offset - rest) / Math.max(height() - rest, 1), 0), 1));
    }
  };

  /** Rests at a detent. The part of the sheet below the screen's edge (at the medium detent) becomes bottom padding
   *  of the body, so the end of the content can still be scrolled into view, as in a SwiftUI medium sheet. */
  const settle = (which: SheetDetent) => {
    const offset = offsetOf(which);
    if (body.current) body.current.style.paddingBottom = offset > 0 ? `calc(env(safe-area-inset-bottom, 0px) + ${offset}px)` : "";
    place(offset, true);
  };

  // In on mount, out when `open` turns false.
  useEffect(() => {
    if (open) {
      if (!entered.current) place(height(), false);
      entered.current = true;
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => settle(detent.current)));
      return () => cancelAnimationFrame(frame);
    }
    place(height(), true, true);
    const timer = window.setTimeout(() => {
      latest.current.onGone();
      latest.current.onClosed?.();
    }, duration(true));
    return () => window.clearTimeout(timer);
    // place/settle/offsetOf read refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus the sheet, give focus back on close, Escape closes.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    sheet.current?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") latest.current.onClose();
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const handlers = useRef<SheetDragHandlers>({ onMove: () => {}, onRelease: () => {} });
  const dragHandlers: SheetDragHandlers = {
    onMove: (dy) => {
      const base = offsetOf(detent.current);
      const offset = base + dy;
      // Above the top detent the sheet resists (rubber band).
      place(offset < 0 ? offset * 0.25 : offset, false);
    },
    onRelease: (dy, velocity) => {
      const projected = offsetOf(detent.current) + dy + velocity * 180;
      const stops: { at: number; to: SheetDetent | "close" }[] = [
        ...(hasLarge ? [{ at: 0, to: "large" as const }] : []),
        ...(hasMedium ? [{ at: offsetOf("medium"), to: "medium" as const }] : []),
        { at: height(), to: "close" },
      ];
      const nearest = stops.reduce((best, stop) =>
        Math.abs(stop.at - projected) < Math.abs(best.at - projected) ? stop : best,
      );
      if (nearest.to === "close") {
        place(height(), true);
        latest.current.onClose();
        return;
      }
      detent.current = nearest.to;
      settle(nearest.to);
    },
  };
  useLayoutEffect(() => {
    handlers.current = dragHandlers;
  });
  useSheetDrag(grab, body, handlers, open);

  const style: CSSProperties = props.background ? { background: props.background } : {};
  return (
    <div className="sisu-layer sisu-sheet-layer" data-testid={props.testId}>
      <div ref={backdrop} className="sisu-sheet-backdrop" onClick={() => latest.current.onClose()} aria-hidden="true" />
      <div
        ref={sheet}
        className="sisu-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={props.ariaLabel}
        tabIndex={-1}
        style={style}
      >
        <div ref={grab} className="sisu-sheet-grab">
          {grabber ? <div className="sisu-sheet-grabber" aria-hidden="true" /> : null}
          {props.header}
        </div>
        <div ref={body} className={scroll ? "sisu-sheet-body sisu-sheet-body-scroll" : "sisu-sheet-body"}>
          {props.children}
        </div>
      </div>
    </div>
  );
}
