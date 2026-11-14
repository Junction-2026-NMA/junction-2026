"use client";

import { useEffect, useState } from "react";

const prefersStill = (): boolean => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// A number that runs up to its target, easing out. With reduced motion it lands on the target at once.
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const duration = prefersStill() ? 0 : durationMs;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = duration ? Math.min(1, (now - startedAt) / duration) : 1;
      setValue(target * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}

// Text that types itself, one character at a time. With reduced motion it appears whole.
export function useTyped(text: string, msPerChar = 14): { shown: string; done: boolean } {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const perChar = prefersStill() ? 0 : msPerChar;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const reached = perChar ? Math.min(text.length, Math.floor((now - startedAt) / perChar)) : text.length;
      setCount(reached);
      if (reached < text.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, msPerChar]);
  return { shown: text.slice(0, count), done: count >= text.length };
}
