"use client";
// One line of text that shrinks to fit its width, down to a minimum scale, then truncates
// (SwiftUI `.lineLimit(1).minimumScaleFactor(0.7)`).
import { useLayoutEffect, useRef, useState, type ElementType } from "react";

export function FitText({ text, minimumScale = 0.7, className, as: Tag = "span" }: {
  text: string;
  minimumScale?: number;
  className?: string;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement>(null);
  /** The shrunk font size in px, or null at full size. */
  const [fontSize, setFontSize] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      // Measure at full size: the natural width against the room there is.
      const previous = element.style.fontSize;
      element.style.fontSize = "";
      const base = parseFloat(getComputedStyle(element).fontSize) || 0;
      const natural = element.scrollWidth;
      const room = element.clientWidth;
      element.style.fontSize = previous;
      const scale = natural <= room || natural === 0 ? 1 : Math.max(room / natural, minimumScale);
      const next = scale >= 0.995 || base === 0 ? null : Math.floor(base * scale * 10) / 10;
      setFontSize((current) => (current === next ? current : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, minimumScale]);

  return (
    <Tag ref={ref} className={className ? `sisu-fit-text ${className}` : "sisu-fit-text"}
      style={fontSize === null ? undefined : { fontSize: `${fontSize}px` }}>
      {text}
    </Tag>
  );
}
