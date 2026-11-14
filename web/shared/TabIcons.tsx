// The tab icons: drawn stand-ins for the SF Symbols sun.max, bubble.left and flag (outline when idle, filled
// when selected), and the drawn jar for Jars (JarGlyph in GlassTabBar.swift: the brand's own savings picture).
// Each sits in a 28 x 26 frame like TabItem's, drawn at the 20 pt semibold symbol weight.

const STROKE = 1.9;

export function TabIcon({ index, selected }: { index: number; selected: boolean }) {
  switch (index) {
    case 0:
      return <SunIcon filled={selected} />;
    case 1:
      return <BubbleIcon filled={selected} />;
    case 2:
      return <JarGlyph filled={selected} />;
    default:
      return <FlagIcon filled={selected} />;
  }
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg className="sisu-tab-icon" width="28" height="26" viewBox="0 0 28 26" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

function SunIcon({ filled }: { filled: boolean }) {
  const rays = Array.from({ length: 8 }, (_, index) => {
    const angle = (index * Math.PI) / 4;
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    return { x1: 14 + cos * 7.1, y1: 13 + sin * 7.1, x2: 14 + cos * 9.6, y2: 13 + sin * 9.6 };
  });
  return (
    <Frame>
      <circle cx="14" cy="13" r="4.3" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={STROKE} />
      {rays.map((ray, index) => (
        <line key={index} {...ray} stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
      ))}
    </Frame>
  );
}

function BubbleIcon({ filled }: { filled: boolean }) {
  return (
    <Frame>
      <path
        d="M14 4.4c5.2 0 9.3 3.4 9.3 7.7S19.2 19.8 14 19.8c-1.1 0-2.1-.14-3.1-.42l-4.2 2.1c-.62.31-1.3-.3-1.05-.95l1.1-2.9C5.4 16.2 4.7 14.2 4.7 12.1c0-4.3 4.1-7.7 9.3-7.7z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
    </Frame>
  );
}

function FlagIcon({ filled }: { filled: boolean }) {
  return (
    <Frame>
      <path
        d="M8 5.4c2.1-1.1 4.1-1.1 6.1 0s4 1.1 6.1 0v8.9c-2.1 1.1-4.1 1.1-6.1 0s-4-1.1-6.1 0z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <line x1="8" y1="4.6" x2="8" y2="22.4" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
    </Frame>
  );
}

/** A jar with a lid (18 x 21 inside the frame), drawn to sit with the other icons at the same weight. */
function JarGlyph({ filled }: { filled: boolean }) {
  const w = 18;
  const h = 21;
  const x = (28 - w) / 2;
  const y = (26 - h) / 2;
  const line = 2;
  const lid = { x: x + w * 0.16, y, width: w * 0.68, height: h * 0.2 };
  const jar = { x, y: y + h * 0.28, width: w, height: h * 0.72 };
  const inset = filled ? 0 : line / 2;
  return (
    <Frame>
      <rect {...lid} rx={lid.height / 2} fill="currentColor" />
      <rect
        x={jar.x + inset}
        y={jar.y + inset}
        width={jar.width - inset * 2}
        height={jar.height - inset * 2}
        rx={w * 0.3 - inset}
        fill={filled ? "currentColor" : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={line}
      />
    </Frame>
  );
}
