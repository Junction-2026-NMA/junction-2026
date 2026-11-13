# 04 · Colours

Status: v0.1, 2026-11-13. Machine-readable values: [`tokens.css`](tokens.css) and [`tokens.json`](tokens.json).

## Where the palette comes from

S-Pankki today is green on green. These values are read from the live s-pankki.fi stylesheet (see [`research/s-pankki-brand-audit.md`](../research/s-pankki-brand-audit.md), section 3):

| S-Pankki role | Hex |
|---|---|
| Logo, app icon | `#00AA46` |
| Text and dark blocks | `#004628` |
| Deep green | `#007841` |
| Primary button (mint) | `#91FA9B` |
| Button hover | `#00EB5A` |
| App surface | `#EBF7EC` |
| Avatar circle | `#D2FCD5` |

We keep the whole green family unchanged. That is the link to the bank. The upgrade is everything around it: a warm background in place of white and grey-green, and four berry colours that each do one job. The hover green `#00EB5A`, which S-Pankki uses only on hover, becomes our hero colour.

## Greens (inherited from S-Pankki)

| Token | Name | Hex | Use |
|---|---|---|---|
| `green-400` | Aurora | `#00EB5A` | Primary button face, highlights, the hero colour |
| `green-500` | S green | `#00AA46` | Button edge, progress fill, logo link to S-Pankki, large shapes |
| `green-700` | Deep green | `#007841` | Green text and icons on light backgrounds, pressed edge |
| `green-900` | Spruce | `#004628` | All main text, icons, text on green buttons |
| `green-200` | Mint | `#91FA9B` | Secondary button face, selected chips |
| `green-100` | Pale mint | `#D2FCD5` | Selected rows, success sheets, avatar circles |
| `green-50` | Frost | `#EBF7EC` | Tinted cards and sections |

## Neutrals

| Token | Name | Hex | Use |
|---|---|---|---|
| `oat` | Oat | `#FBF8F1` | App background (light) |
| `white` | White | `#FFFFFF` | Cards, sheets, inputs |
| `line` | Line | `#E4E0D4` | Card outlines, dividers (decorative) |
| `line-strong` | Strong line | `#7F8C85` | Input borders and other outlines that must be seen |
| `muted` | Muted | `#4F6257` | Secondary text |
| `ink` | Spruce | `#004628` | Text. We do not use pure black. |

## Berries (new)

Each berry has one meaning. Do not use them for decoration.

| Token | Name | Fill | Text on white | Tint | Text on tint | Means |
|---|---|---|---|---|---|---|
| `puolukka` | Puolukka (lingonberry) | `#D81E5B` | `#C2185B` | `#FFE3EC` | `#8F0F3F` | The **Leaks** basket; "above your usual" |
| `lakka` | Lakka (cloudberry) | `#FFC233` | `#8A5A00` | `#FFF1CC` | `#6B4500` | The **Curveballs** basket; berries (points), rewards |
| `mustikka` | Mustikka (bilberry) | `#4B4BD8` | `#4B4BD8` | `#E6E6FF` | `#2B2BA8` | The **Fixed** basket; lessons, info, streak freeze |
| `nuotio` | Nuotio (campfire) | `#FF7A1A` | `#B84A00` | `#FFE8D6` | `#8A3600` | The **streak** only |

Text on a berry fill: white on Puolukka and Mustikka; spruce `#004628` on Lakka; dark brown `#4A1D00` on Nuotio.

## Status

| Token | Hex | Use |
|---|---|---|
| `success` | `#007841` | Confirmations. Uses green, with a check icon. |
| `error` | `#B70000` | Failed actions and form errors only (S-Pankki's own error red) |
| `error-tint` | `#FFE5E5` | Error banner background |

Spending is never shown in error red. A high Leaks figure is Puolukka pink, which means "look here", not "wrong".

## Dark mode

Forest-tinted, not black. Berries get lighter so they keep their contrast.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#04140D` | App background |
| `surface` | `#0B2418` | Cards |
| `surface-raised` | `#123524` | Sheets, pressed cards |
| `line` | `#1E4A33` | Outlines |
| `text` | `#EFFBF2` | Main text |
| `muted` | `#9DB8A8` | Secondary text |
| `green-400` | `#00EB5A` | Primary button face (text `#04140D`), highlights |
| `green-500` | `#00AA46` | Button edge |
| `puolukka` | `#FF6B97` | Leaks |
| `lakka` | `#FFC233` | Curveballs, berries |
| `mustikka` | `#9A9AFF` | Fixed, lessons |
| `nuotio` | `#FF8A3D` | Streak |
| `error` | `#FF7A7A` | Errors |

## Roles

| Role | Light | Dark |
|---|---|---|
| Screen background | Oat | `#04140D` |
| Card | White, 2 px Line outline | `#0B2418`, 2 px `#1E4A33` outline |
| Main text | Spruce | `#EFFBF2` |
| Primary button | Aurora face, S green edge, Spruce text | Aurora face, S green edge, `#04140D` text |
| Secondary button | White face, Line edge, Spruce text | `#123524` face, `#1E4A33` edge, light text |
| Progress fill | S green on Frost | Aurora on `#123524` |
| Link | Deep green, underlined | Aurora, underlined |
| Hero block | Spruce background, Aurora number, white text | `#0B2418` background, Aurora number |

## How much of each

On a typical screen, by area:

- about 60 % Oat and White,
- about 20 % greens,
- about 15 % Spruce (text and one dark block),
- about 5 % berries.

One berry leads a screen. A screen with all four at full strength is a chart or a celebration, nothing else.

## Charts

- Baskets always use their berry: Fixed = Mustikka, Curveballs = Lakka, Leaks = Puolukka. Savings = S green. Everything else = Muted grey.
- Never rely on colour alone. Each basket also has its icon and a text label on or next to the mark.
- Order is always Fixed, Curveballs, Leaks, then Jars.
- Leave a 2 px gap in the background colour between segments.
- Not yet tested with a colour-blindness simulator. The icon and label rule is what makes the charts safe until that is done.

## Contrast (checked)

WCAG 2 contrast ratios, computed for this palette. Body text needs 4.5, large text and icons need 3.

| Pair | Ratio | OK for |
|---|---|---|
| Spruce on Oat | 10.4 | All text |
| Spruce on White | 11.0 | All text |
| Spruce on Aurora (primary button) | 6.8 | All text |
| Spruce on Mint | 8.6 | All text |
| Spruce on Frost | 10.0 | All text |
| Muted on Oat | 6.2 | All text |
| Deep green on White | 5.6 | All text |
| Deep green on Oat | 5.3 | All text |
| White on Deep green | 5.6 | All text |
| **White on S green** | **3.1** | **Large text and icons only** |
| **S green on White** | **3.1** | **Large text, icons and fills only** |
| White on Puolukka | 4.9 | All text |
| White on Mustikka | 6.4 | All text |
| Spruce on Lakka | 6.8 | All text |
| Spruce on Nuotio | 4.2 | Large text only; use `#4A1D00` for small text |
| Puolukka text `#C2185B` on White | 5.9 | All text |
| Lakka text `#8A5A00` on White | 5.9 | All text |
| Nuotio text `#B84A00` on White | 5.2 | All text |
| Dark: text on background | 17.8 | All text |
| Dark: muted on surface | 7.7 | All text |
| Dark: Aurora on background | 11.7 | All text |
| Dark: Puolukka on background | 7.0 | All text |
| Dark: Mustikka on background | 7.6 | All text |
| Dark: Nuotio on background | 8.1 | All text |

## Rules

**Do**

- Put dark Spruce text on green buttons. This is S-Pankki's own habit and it passes contrast.
- Use Aurora for the one thing on screen the user should tap.
- Use a berry's tint for a whole card and its fill for a small mark.
- Keep the streak orange so green stays free to mean money and progress.

**Do not**

- Do not put white body text on S green `#00AA46`. It fails contrast.
- Do not use lime or yellow-green. `#58CC02` is Duolingo's.
- Do not pair green with pure black. That is Lunar's look.
- Do not use gradients, except one soft glow behind a celebration.
- Do not invent new colours. If a new meaning is needed, add a token here first.
