// The SF Symbols the first run uses, drawn as small SVGs in the current text colour (decorative: aria-hidden).

/** "checkmark". */
export function CheckGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M2.6 8.6l3.5 3.5 7.3-8.2" fill="none" stroke="currentColor" strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** "info.circle.fill". */
export function InfoCircleGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <circle cx="10" cy="5.9" r="1.35" fill="#fff" />
      <path d="M8.3 8.6h2.4v6.2M8.2 14.8h4" fill="none" stroke="#fff" strokeWidth="1.7"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** "chevron.right". */
export function ChevronRightGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M4.2 1.8L8.4 6l-4.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.9"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
