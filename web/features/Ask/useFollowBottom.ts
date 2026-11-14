"use client";
// Following the bottom of the conversation while an answer streams in: only while the user is at (or near) the
// bottom, so their own scrolling is never fought. Port of the BottomEdgeKey / ViewportHeightKey / drag logic of
// CoachConversation in AskScreen.swift: back within 120 px of the bottom follows again; moving away only counts
// when the user moved it (touch, mouse or wheel), never when content grew.
import { useCallback, useEffect, useRef, type RefObject } from "react";

const NEAR_BOTTOM = 120;

export interface FollowBottom {
  /** Give it to the scroll container. */
  scroller: RefObject<HTMLDivElement | null>;
  /** Scrolls to the bottom when following (Swift `follow(proxy)`): 0.2 s, or at once with Reduce Motion. */
  follow: () => void;
  /** Swift `followBottom = …`. */
  setFollowing: (following: boolean) => void;
  /** Scroll so the element with `data-anchor={id}` sits at the top or the bottom (ScrollViewProxy.scrollTo). */
  scrollToAnchor: (id: string, anchor: "top" | "bottom") => boolean;
}

export function useFollowBottom(reduceMotion: boolean, onUserDrag?: () => void): FollowBottom {
  const scroller = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const dragging = useRef(false);
  const dragCallback = useRef(onUserDrag);
  useEffect(() => { dragCallback.current = onUserDrag; });

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    let wheelTimer = 0;
    const onScroll = () => {
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
      const near = distance <= NEAR_BOTTOM;
      if (near && !following.current) following.current = true;
      if (!near && dragging.current && following.current) following.current = false;
    };
    const start = () => { dragging.current = true; };
    const end = () => { dragging.current = false; };
    let startY = 0;
    const touchStart = (event: TouchEvent) => { start(); startY = event.touches[0]?.clientY ?? 0; };
    // A drag of at least 8 px (Swift DragGesture minimumDistance) also lets the keyboard go (.interactively).
    const touchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? startY;
      if (Math.abs(y - startY) >= 8) dragCallback.current?.();
    };
    const wheel = () => {
      start();
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(end, 200);
    };
    const mouseDown = (event: MouseEvent) => { if (event.button === 0) start(); };
    element.addEventListener("scroll", onScroll, { passive: true });
    element.addEventListener("touchstart", touchStart, { passive: true });
    element.addEventListener("touchmove", touchMove, { passive: true });
    element.addEventListener("touchend", end, { passive: true });
    element.addEventListener("touchcancel", end, { passive: true });
    element.addEventListener("wheel", wheel, { passive: true });
    element.addEventListener("mousedown", mouseDown);
    window.addEventListener("mouseup", end);
    return () => {
      window.clearTimeout(wheelTimer);
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("touchstart", touchStart);
      element.removeEventListener("touchmove", touchMove);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", end);
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("mousedown", mouseDown);
      window.removeEventListener("mouseup", end);
    };
  }, []);

  const follow = useCallback(() => {
    const element = scroller.current;
    if (!element || !following.current) return;
    element.scrollTo({ top: element.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [reduceMotion]);

  const setFollowing = useCallback((value: boolean) => { following.current = value; }, []);

  const scrollToAnchor = useCallback((id: string, anchor: "top" | "bottom") => {
    const element = scroller.current;
    if (!element) return false;
    const target = Array.from(element.querySelectorAll<HTMLElement>("[data-anchor]")).find((node) => node.dataset.anchor === id);
    if (!target) return false;
    const box = element.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const top = anchor === "top"
      ? rect.top - box.top + element.scrollTop
      : rect.bottom - box.top + element.scrollTop - element.clientHeight;
    element.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    return true;
  }, []);

  return { scroller, follow, setFollowing, scrollToAnchor };
}
