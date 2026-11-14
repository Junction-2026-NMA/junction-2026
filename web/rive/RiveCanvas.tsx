"use client";
// One loaded artboard on a canvas. RiveComponent remounts it (by key) when the component or its listened
// triggers change; a sizing change only switches the Layout, like RiveComponentModel.load(_:from:).
import { useCallback, useEffect, useRef } from "react";
import { useRive, type Rive, type RiveFile } from "@rive-app/react-canvas";
import type { RiveSizing } from "./contract";
import type { RiveComponentModel } from "./RiveComponentModel";
import { riveDevicePixelRatio, riveLayout } from "./sizing";

export interface RiveCanvasProps {
  file: RiveFile;
  artboard: string;
  sizing: RiveSizing;
  outTriggers: readonly string[];
  model: RiveComponentModel;
  /** The request key the model reports a failure under. */
  requestKey: string;
  /** Let a touch drag that starts on the canvas scroll the page (false for press-and-hold controls). */
  touchScroll: boolean;
  /** Reduced motion: pause this long after loading and after each `stillKey` change (RiveComponent.stillAfterMs). */
  stillAfterMs?: number;
  /** Changes with the component's values (RiveComponent's values key). */
  stillKey?: string;
}

export function RiveCanvas({ file, artboard, sizing, outTriggers, model, requestKey, touchScroll, stillAfterMs, stillKey }: RiveCanvasProps) {
  // Declared before useRive so its cleanup (stop listening) runs before the runtime instance is cleaned up.
  useEffect(() => {
    model.startLoading();
    return () => model.tearDown();
  }, [model]);

  // The runtime also reports a drawing error after Load as a load error; once loaded, the artboard stays up.
  const loaded = useRef(false);
  const { rive, setCanvasRef, setContainerRef } = useRive(
    {
      riveFile: file,
      artboard,
      stateMachine: "Main",
      autoplay: true,
      autoBind: true,
      layout: riveLayout(sizing),
      isTouchScrollEnabled: touchScroll,
      // Load fires before the first advance: values written here are on the first frame.
      onRiveReady: (instance) => {
        loaded.current = true;
        model.adopt(instance, artboard, outTriggers, requestKey);
      },
      onLoadError: (event) => {
        if (loaded.current) return logDrawError(artboard, event.data);
        model.fail(`no artboard '${artboard}' or no state machine 'Main' (${String(event.data)})`, requestKey);
      },
    },
    { useOffscreenRenderer: true, shouldResizeCanvasToContainer: true, useDevicePixelRatio: true },
  );

  // After a tap the browser also sends compatibility mouse events (mousedown, mouseup, click) to whatever is
  // under the finger by then. Rive handles the touch itself, and if the layout moved in between (a button that
  // starts loading, a list that follows its bottom) those mouse events would press the component that slid
  // under the finger, e.g. Decline right after Approve. Cancelling touchend stops them; scrolling is unaffected.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const attachCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    setCanvasRef(canvas);
  }, [setCanvasRef]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const swallow = (event: TouchEvent) => { if (event.cancelable) event.preventDefault(); };
    canvas.addEventListener("touchend", swallow);
    return () => canvas.removeEventListener("touchend", swallow);
  }, [rive]);

  // Reduced motion: run long enough for the new pose to land, then hold it still. Resumes when switched off.
  useEffect(() => {
    if (!rive) return;
    if (stillAfterMs === undefined) {
      if (rive.isPaused) safePlay(rive);
      return;
    }
    safePlay(rive);
    const timer = window.setTimeout(() => {
      try {
        rive.pause();
      } catch {
        // The instance went away; nothing to hold.
      }
    }, stillAfterMs);
    return () => window.clearTimeout(timer);
  }, [rive, stillAfterMs, stillKey]);

  const appliedSizing = useRef(sizing);
  useEffect(() => {
    if (!rive || appliedSizing.current === sizing) return;
    appliedSizing.current = sizing;
    applySizing(rive, sizing);
  }, [rive, sizing]);

  return (
    <div ref={setContainerRef} className="sisu-rive-canvas">
      <canvas ref={attachCanvas} aria-hidden="true" />
    </div>
  );
}

function safePlay(rive: Rive): void {
  try {
    rive.play();
  } catch {
    // The instance went away mid-change.
  }
}

/** Switches the fit of a loaded instance and lays it out again at the current canvas size. */
function applySizing(rive: Rive, sizing: RiveSizing): void {
  try {
    rive.layout = riveLayout(sizing);
    rive.resizeDrawingSurfaceToCanvas(riveDevicePixelRatio());
  } catch {
    // The instance went away mid-change; the next mount lays itself out.
  }
}

function logDrawError(artboard: string, detail: unknown): void {
  if (process.env.NODE_ENV !== "production") console.debug(`[Rive] ${artboard} failed to draw: ${String(detail)}`);
}
