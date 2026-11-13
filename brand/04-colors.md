# 04 · Colours

Status: v0.2, 2026-11-13. Replaces v0.1, which drifted away from the S-mobiili app (warm background, neon green, pink, violet and gold). Machine-readable values: [`tokens.css`](tokens.css) and [`tokens.json`](tokens.json).

## The rule

**The palette is the S-mobiili app's palette.** Every brand colour below is used in the app today or declared in S-Pankki's own design tokens. We add no new hues. The upgrade is in how the colours are used: clear roles, stronger contrast between blocks, a dark mode, and a few moments of full colour.

## Where the values come from

| Source | What it gave |
|---|---|
| S-mobiili's App Store screenshots (version 2.43.0, sampled pixel by pixel on 2026-11-13) | `#007841`, `#00AA46`, `#004628`, `#99D59F`, `#EBF7EC`, `#F7FCF7`, `#D2FCD5`, white |
| The live s-pankki.fi stylesheet and its design tokens | The same greens, plus mint `#91FA9B`, the neutrals, and the warning, info and error colours |

The store screenshots are a few years old and the logged-in app was not seen, so check the palette against the live app on a phone.

## Core greens (from the app, unchanged)

| Token | Name | Hex | In S-mobiili today | In Sisu |
|---|---|---|---|---|
| `green-900` | Dark green | `#004628` | Headlines, text, dark blocks | All main text, hero blocks, the Fixed basket |
| `green-700` | Deep green | `#007841` | Headings, the round action buttons, the Bonus card | **The primary colour**: buttons, active states, links, the Curveballs basket |
| `green-500` | S green | `#00AA46` | Logo, app icon, the payment cards | Brand accent, progress fills, the Leaks basket, large shapes |
| `green-300` | Soft green | `#99D59F` | Borders, store-art backgrounds | Outlines, soft blocks, muted text on dark |
| `green-200` | Mint | `#91FA9B` | Primary buttons on the web | Highlight on dark blocks, buttons on dark, the Jars colour |
| `green-100` | Pale mint | `#D2FCD5` | Avatar circle | Selected rows, progress tracks, success sheets, chips |
| `green-50` | Surface green | `#EBF7EC` | The screen background behind white cards | **The screen background** |
| `green-25` | Near-white green | `#F7FCF7` | Store art, token | Alternate sections, sheets |

## Neutrals (S-Pankki's own tokens)

| Token | Hex | Use |
|---|---|---|
| `white` | `#FFFFFF` | Cards, inputs |
| `neutral-900` | `#1F1F1F` | Long body text where dark green would tire the eye (legal text, transaction details) |
| `neutral-600` | `#666666` | Secondary text |
| `neutral-400` | `#949494` | Input borders on white |
| `neutral-200` | `#E6E6E6` | Dividers, disabled faces |

## Signal colours (S-Pankki's own status tokens)

These are the only non-green colours, and they are S-Pankki's. Each keeps the meaning it has at the bank.

| Token | Background | Mark | Text | Means in Sisu |
|---|---|---|---|---|
| `amber` | `#FFF1D8` | `#CF8300` | `#885600` | Warm moments and heads-ups: the **streak** flame, "above your usual" notes |
| `info` | `#E0F4FF` | `#00A1C5` | `#006E87` | Explanations and tips |
| `error` | `#FFEDED` | `#B70000` | `#B70000` | Failed actions and form errors only |

Spending is never shown in error red.

## Roles

| Role | Light |
|---|---|
| Screen background | Surface green `#EBF7EC` |
| Card | White, no outline, exactly as in the app |
| Card on a white background | White with a 2 px Soft green outline |
| Main text and headlines | Dark green `#004628` |
| Secondary text | `#666666` |
| Primary button | Deep green face `#007841`, white label, Dark green edge `#004628` |
| Secondary button | White face, Dark green label, Soft green outline and edge |
| Button on a dark block | Mint face `#91FA9B`, Dark green label, S green edge |
| Hero block | Dark green background, Mint number, white text |
| Progress | S green fill on a Pale mint track |
| Selected or done row | Pale mint with a Deep green check |
| Link | Deep green, underlined |
| Berries (points) pill | Pale mint background, S green berry mark, Dark green number |
| Streak pill | Amber background, `#CF8300` flame, `#885600` number |

## The three baskets: the darker the green, the more fixed the money

The baskets use the app's own greens as a ramp from dark to light. It teaches the idea by itself: dark is locked, light is yours to steer.

| Basket | Colour | Hex | Icon |
|---|---|---|---|
| Fixed (mandatory, regular) | Dark green | `#004628` | Anchor |
| Curveballs (mandatory, irregular) | Deep green | `#007841` | Lightning |
| Leaks (everyday, slips away) | S green | `#00AA46` | Drop |
| Jars (savings) | Mint with a 2 px S green outline | `#91FA9B` | Jar |

- Order is always Fixed, Curveballs, Leaks, Jars.
- The steps differ in lightness, so the ramp also works for colour-blind users. Each basket still carries its icon and a text label. Never rely on the green alone.
- Leave a 2 px white gap between segments.
- Basket chips are Pale mint pills with the basket's icon in the basket's green.

## Dark mode (new: an upgrade the app does not have in its store screenshots)

Built by reversing the same greens. The values marked "new" are the only colours in this kit that do not come from S-Pankki.

| Role | Hex | Origin |
|---|---|---|
| Screen background | `#00301B` | New: a darker step of Dark green |
| Card | `#004628` | Dark green |
| Outline | `#1B6B43` | New |
| Main text | `#F7FCF7` | Near-white green |
| Secondary text | `#99D59F` | Soft green |
| Primary button | Mint face `#91FA9B`, label `#00301B`, edge `#00AA46` | Mint, S green |
| Progress | Mint fill on a `#1B6B43` track | |
| Hero number | Mint `#91FA9B` | |
| Amber mark and text | `#FFC14D` | New: lightened amber |
| Info text | `#7FD9F2` | New: lightened info |
| Error text | `#FF8A8A` | New: lightened error |

In dark mode, basket charts sit on a Near-white `#F7FCF7` card, so the dark-to-light ramp reads the same in both modes.

## Celebrations

For a big win only, the screen may fill with S green `#00AA46` or Dark green `#004628`, with confetti in Mint, Pale mint, white and one amber shape. The bright hover green from S-Pankki's web tokens, `#00EB5A`, may be used for confetti and glow only. It is never a button, text or background colour.

## How much of each

On a typical screen, by area:

- about 55 % Surface green and white,
- about 20 % Dark green (text and one hero block),
- about 15 % Deep green and S green,
- about 8 % Mint, Pale mint and Soft green,
- about 2 % amber, info or error.

## Contrast (checked)

WCAG 2 contrast ratios, computed for this palette. Body text needs 4.5, large text and icons need 3.

| Pair | Ratio | OK for |
|---|---|---|
| Dark green on Surface green | 10.0 | All text |
| Dark green on White | 11.0 | All text |
| White on Deep green (primary button) | 5.6 | All text |
| Deep green on White | 5.6 | All text |
| Deep green on Surface green | 5.1 | All text |
| Deep green on Pale mint | 5.0 | All text |
| Dark green on Mint | 8.6 | All text |
| Mint on Dark green (hero number) | 8.6 | All text |
| Soft green on Dark green | 6.5 | All text |
| Dark green on Soft green | 6.5 | All text |
| `#666666` on Surface green | 5.2 | All text |
| **White on S green** | **3.1** | **Large text and icons only** |
| **S green on White** | **3.1** | **Large text, icons and fills only** |
| **S green on Surface green** | **2.8** | **Fills and decoration only, never text** |
| Amber text `#885600` on amber background | 5.6 | All text |
| Amber mark `#CF8300` on White | 3.0 | Icons only |
| Info text `#006E87` on info background | 5.2 | All text |
| Error `#B70000` on White | 7.0 | All text |
| Dark: text on background | 14.1 | All text |
| Dark: Soft green on background | 8.6 | All text |
| Dark: Mint on background | 11.4 | All text |
| Dark: `#00301B` label on Mint button | 11.4 | All text |

## Rules

**Do**

- Start every screen from the app's own look: Surface green behind white cards, Dark green text.
- Use Deep green for the one thing the user should tap.
- Put Mint on Dark green for the hero number. It is the strongest pairing the brand has.
- Keep amber rare, so the streak flame is the warmest thing on screen.

**Do not**

- Do not add colours. No pink, violet, gold, orange, cream or neon green.
- Do not put text in S green `#00AA46` on a light background, or white body text on it. It fails contrast.
- Do not use lime or yellow-green. `#58CC02` is Duolingo's.
- Do not pair green with pure black. That is Lunar's look. Our dark is `#004628`.
- Do not use gradients.
