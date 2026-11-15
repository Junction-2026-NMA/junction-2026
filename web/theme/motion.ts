"use client";
// Accessibility preferences as hooks: the web side of @Environment(\.accessibilityReduceMotion) and
// \.accessibilityReduceTransparency. Server render and the first client render say false, then the real value.
import { useSyncExternalStore } from "react";

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const REDUCE_TRANSPARENCY = "(prefers-reduced-transparency: reduce)";

/** True when the media query matches right now. False on the server. */
export function matchesMedia(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(query).matches;
}

/** True when the person asked for less motion (prefers-reduced-motion). Not a hook: reads it once. */
export function prefersReducedMotion(): boolean {
  return matchesMedia(REDUCE_MOTION);
}

/** True when the person asked for less transparency (prefers-reduced-transparency). Not a hook. */
export function prefersReducedTransparency(): boolean {
  return matchesMedia(REDUCE_TRANSPARENCY);
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => matchesMedia(query),
    () => false,
  );
}

/** Follows prefers-reduced-motion, live. */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCE_MOTION);
}

/** Follows prefers-reduced-transparency, live. */
export function useReducedTransparency(): boolean {
  return useMediaQuery(REDUCE_TRANSPARENCY);
}
