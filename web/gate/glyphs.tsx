// Small inline icons that look like the browser buttons the install steps refer to.

interface GlyphProps {
  label: string;
}

function Glyph({ label, children }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      className="sisu-gate-glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
    >
      {children}
    </svg>
  );
}

/** The iOS Share glyph: a box with an arrow pointing up out of it. */
export function ShareGlyph({ label = "Share" }: Partial<GlyphProps>) {
  return (
    <Glyph label={label}>
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M8.5 10H6.5a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5h-2" />
    </Glyph>
  );
}

/** The "Add to Home Screen" glyph: a plus in a rounded square. */
export function AddToHomeGlyph({ label = "Add to Home Screen" }: Partial<GlyphProps>) {
  return (
    <Glyph label={label}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Glyph>
  );
}

/** Three dots in a row (⋯). */
export function MoreHorizontalGlyph({ label = "More" }: Partial<GlyphProps>) {
  return (
    <Glyph label={label}>
      <circle cx="5.5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.3" fill="currentColor" />
    </Glyph>
  );
}

/** Three dots stacked (⋮), the Android Chrome menu. */
export function MoreVerticalGlyph({ label = "Menu" }: Partial<GlyphProps>) {
  return (
    <Glyph label={label}>
      <circle cx="12" cy="5.5" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.3" fill="currentColor" />
    </Glyph>
  );
}

/** Three lines (≡), the Samsung Internet and Firefox menu. */
export function MenuGlyph({ label = "Menu" }: Partial<GlyphProps>) {
  return (
    <Glyph label={label}>
      <path d="M5 7h14M5 12h14M5 17h14" />
    </Glyph>
  );
}
