// The tab icons: drawn stand-ins for the SF Symbols sun.max, waveform.circle and flag (outline when idle, filled
// when selected). The bubble of the old Ask tab is kept; the jar of the old Jars tab went with the jar illustrations
// on 2026-11-15.
// Each sits in a 28 x 26 frame like TabItem's, drawn at the 20 pt semibold symbol weight.

const STROKE = 1.9;

export function TabIcon({ index, selected }: { index: number; selected: boolean }) {
  switch (index) {
    case 0:
      return <SunIcon filled={selected} />;
    case 1:
      return <WaveformCircleIcon filled={selected} />;
    default:
      return <FlagIcon filled={selected} />;
  }
}

/** waveform.circle: five bars in a circle. Filled: a solid disc with the bars cut out of it. */
function WaveformCircleIcon({ filled }: { filled: boolean }) {
  const bars = [{ x: 9.2, h: 4.2 }, { x: 11.6, h: 8.4 }, { x: 14, h: 11.4 }, { x: 16.4, h: 7.2 }, { x: 18.8, h: 3.6 }];
  const lines = bars.map((bar) => (
    <line key={bar.x} x1={bar.x} y1={13 - bar.h / 2} x2={bar.x} y2={13 + bar.h / 2} strokeLinecap="round" strokeWidth={1.8} />
  ));
  if (!filled) {
    return (
      <Frame>
        <circle cx="14" cy="13" r="9.4" fill="none" stroke="currentColor" strokeWidth={STROKE} />
        <g stroke="currentColor">{lines}</g>
      </Frame>
    );
  }
  return (
    <Frame>
      <mask id="sisu-tab-waveform-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="28" height="26">
        <rect x="0" y="0" width="28" height="26" fill="white" />
        <g stroke="black">{lines}</g>
      </mask>
      <circle cx="14" cy="13" r="10.35" fill="currentColor" mask="url(#sisu-tab-waveform-cut)" />
    </Frame>
  );
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

export function BubbleIcon({ filled }: { filled: boolean }) {
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

