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

/** The basket icons of the Rive BasketChip: "anchor" (regular essentials), "bolt.fill" (occasional essentials) and
 *  "drop.fill" (everyday spending). */
export function BasketGlyph({ kind, size = 16 }: { kind: "fixed" | "curveballs" | "leaks"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {kind === "fixed" ? (
        <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="3.2" r="1.7" />
          <path d="M8 4.9v9.6M5.2 7.4h5.6M2.4 9.4a5.6 5.1 0 0 0 11.2 0" />
        </g>
      ) : kind === "curveballs" ? (
        <path d="M9.4 1 3.2 9.1h4.2L6.6 15l6.2-8.1H8.6L9.4 1Z" fill="currentColor" />
      ) : (
        <path d="M8 1.4S3.4 6.6 3.4 10a4.6 4.6 0 0 0 9.2 0C12.6 6.6 8 1.4 8 1.4Z" fill="currentColor" />
      )}
    </svg>
  );
}
