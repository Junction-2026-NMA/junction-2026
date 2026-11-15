// Motion tokens of the beUI agent components (https://beui.dev, MIT, see web/agents/LICENSE): its easing curve and
// springs, plus `cx`, the class joiner that stands in for beUI's `cn` (this app styles with plain CSS, not Tailwind).

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Content swaps: icon slots trading places inside a control. */
export const SPRING_SWAP = { type: "spring", stiffness: 460, damping: 30, mass: 0.55 } as const;

/** Shared-layout glides: surfaces and rows moving or resizing. */
export const SPRING_LAYOUT = { type: "spring", stiffness: 360, damping: 32, mass: 0.6 } as const;

/** A row rising from the live edge (Message). */
export const SPRING_POP_UP = { type: "spring", stiffness: 480, damping: 32, mass: 0.62 } as const;

/** A sent bubble popping into place with one restrained overshoot. */
export const SPRING_BUBBLE = { type: "spring", stiffness: 520, damping: 27, mass: 0.52 } as const;

/** Values that follow a level without rebounding (VoiceOrb). */
export const SPRING_GLIDE = { stiffness: 700, damping: 50, mass: 0.5 } as const;

export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}
