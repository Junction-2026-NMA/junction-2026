"use client";
// Small glyphs the Today screen and the sheets draw with SF Symbols on iOS: chevron.right and the
// ProgressView spinner (tinted green700).
import "./today.css";
import "./states.css";

/** SF Symbol "chevron.right", sized like the symbol at a font size (caption 12, label 14). */
export function Chevron({ size = 12, className }: { size?: number; className?: string }) {
  const height = Math.round(size * 0.95);
  const width = Math.round(height * 0.58);
  return (
    <svg className={className ? `sisu-chevron ${className}` : "sisu-chevron"} width={width} height={height}
      viewBox="0 0 7 12" aria-hidden="true">
      <path d="M1.2 1.2 5.8 6l-4.6 4.8" fill="none" stroke="currentColor" strokeWidth="1.9"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The iOS activity indicator (ProgressView()): eight spokes turning in steps. */
export function ProgressSpinner({ label }: { label?: string }) {
  const spokes = Array.from({ length: 8 }, (_, index) => index);
  return (
    <svg className="sisu-spinner" width="24" height="24" viewBox="0 0 24 24" role={label ? "img" : undefined}
      aria-label={label} aria-hidden={label ? undefined : true}>
      {spokes.map((index) => (
        <rect key={index} x="11" y="2" width="2" height="6" rx="1" fill="currentColor"
          opacity={0.25 + (index / 7) * 0.75} transform={`rotate(${index * 45} 12 12)`} />
      ))}
    </svg>
  );
}
