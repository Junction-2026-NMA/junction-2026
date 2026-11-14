# 06 · Specifications

Status: v0.2, 2026-11-13 (colours now follow the S-mobiili app). These are the exact values. Machine-readable copies: [`tokens.css`](tokens.css) and [`tokens.json`](tokens.json). Units are points on iOS, dp on Android and px on the web at 1x.

## Frame

| Item | Value |
|---|---|
| Reference frame | 390 × 844 |
| Side margin | 20 |
| Grid | 4 |
| Gap between cards | 16 |
| Gap between sections | 32 |
| Minimum touch target | 48 × 48 |
| Tab bar height | 64 plus the bottom safe area |
| Top bar height | 56 |

## Spacing scale

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. Tokens `space-1` to `space-10` in that order.

## Radii

| Token | Value | Use |
|---|---|---|
| `radius-xs` | 6 | The "tail" corner of a chat bubble |
| `radius-sm` | 12 | Inputs, small tiles |
| `radius-md` | 18 | Buttons |
| `radius-lg` | 24 | Cards, chat bubbles |
| `radius-xl` | 32 | Sheets, hero blocks |
| `radius-full` | 999 | Pills, chips, bars, avatars |

## Borders and edges

| Token | Value | Use |
|---|---|---|
| `border` | 2 | Card and bubble outlines |
| `edge` | 4 | The bottom edge on pressable things |
| `sticker-border` | 4, white | Die-cut border on stickers |

No shadows. The only elevation is the 4-unit edge.

## Type

Families: `"Bricolage Grotesque"` for display, `"Figtree"` for text. Fallback stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.

| Token | Family | Weight | Size / line height | Use |
|---|---|---|---|---|
| `hero-xl` | Bricolage | 800 | 96 / 96 | Streak count on a celebration |
| `hero` | Bricolage | 800 | 64 / 68 | The hero number |
| `display` | Bricolage | 800 | 40 / 44 | Celebration headline |
| `h1` | Bricolage | 800 | 32 / 36 | Screen title |
| `h2` | Bricolage | 700 | 24 / 28 | Card title |
| `h3` | Figtree | 700 | 20 / 26 | Section title |
| `body-lg` | Figtree | 400 | 18 / 26 | Chat text, onboarding |
| `body` | Figtree | 400 | 16 / 24 | Default text |
| `label` | Figtree | 600 | 14 / 20 | Labels, chips |
| `caption` | Figtree | 600 | 12 / 16 | Source lines, tab labels |
| `button` | Figtree | 700 | 17 / 24 | Button labels |
| `amount` | Figtree | 700 | 16 / 24, tabular numerals | Amounts in lists |

- Letter spacing: −2 % on Bricolage at 32 and above, 0 elsewhere.
- Minimum text size 12.
- Support Dynamic Type and font scaling up to 200 %. Hero numbers shrink to fit; they never truncate.

## Formats

| Thing | Finnish | English |
|---|---|---|
| Amount | `1 234,50 €` | `€1,234.50` |
| Whole euros in headlines | `64 €` | `€64` |
| Date | `13.11.2026` | `13 Nov 2026` |
| Time | `14.30` | `14:30` |
| Percent | `12 %` | `12%` |
| Change | `+40 €`, `−12 €` | `+€40`, `−€12` |

Use a real minus sign (−) and a non-breaking space between number and unit.

## Components

### Primary button

| Property | Value |
|---|---|
| Height | 56 face + 4 edge |
| Width | Full width minus margins; never under 160 |
| Radius | 18 |
| Face | `green-700` `#007841` |
| Edge | `green-900` `#004628` |
| Label | `button`, white `#FFFFFF` |
| On a dark block | Face `#91FA9B`, edge `#00AA46`, label `#004628` |
| Pressed | Face moves down 4, edge hidden |
| Disabled | Face `#E6E6E6`, no edge, label `#666666` |
| Loading | Label swaps for three dots; width does not change |

### Secondary button

Same size. Face `#FFFFFF`, edge and 2 outline `#99D59F`, label `#004628`.

### Quiet button

Text only, `button` style in `#007841`, 48 tall.

### Card

Radius 24, padding 20, background `#FFFFFF` on the `#EBF7EC` screen, no outline. On a white background add an outline 2 `#99D59F`. Tappable cards add a 4 edge in `#99D59F`.

### Hero block

Radius 32, padding 24, background `#004628`. Label `label` in `#91FA9B`, number `hero` in `#91FA9B`, context line `body` in `#FFFFFF`.

### Chip

Height 32, horizontal padding 12, radius full, icon 20, gap 6, text `label`. Basket chips use the basket's tint and tint text colour.

### Progress bar

Height 14, radius full, track `#D2FCD5`, fill `#00AA46`. All progress is green.

### Input

Height 56, radius 12, background `#FFFFFF`, outline 2 `#949494`, focus outline 2 `#004628` plus a 4 ring in `#91FA9B`. Label above in `label`. Error text below in `#B70000` with an icon.

### Tab bar

Height 64, background `#FFFFFF`, top divider 1 `#E6E6E6`. Four tabs, icon 28 plus `caption`. Active: icon and label `#004628` on a `#D2FCD5` pill 56 × 36. Inactive: `#666666`.

### Chat bubble

Max width 80 % of the frame. Padding 14 × 16. Radius 24 with one 6 corner. Liito: `#FFFFFF`, text `#004628`. User: `#007841`, text `#FFFFFF`. Gap between bubbles in a group 4, between groups 16. Avatar 32.

### Streak pill and berries pill

Height 36, radius full, padding 12. Streak: `#FFF1D8` background, flame `#CF8300`, number `#885600`. Berries: `#D2FCD5` background, berry mark `#00AA46`, number `#004628`.

### Sticker

72 to 120 across, 4 white border, tilt between −6° and +6°. In a grid: 3 columns, 16 gap.

### Bottom sheet

Top radius 32, padding 24, a 36 × 4 grabber in `#E6E6E6`. Holds one headline, up to two lines of text and one or two buttons.

## Motion tokens

| Token | Value | Use |
|---|---|---|
| `duration-press` | 80 ms | Button down |
| `duration-fast` | 150 ms | Fades, chip changes |
| `duration-base` | 250 ms | Screen and sheet moves |
| `duration-fill` | 600 ms | Bars and jars filling |
| `duration-celebrate` | 1200 ms | Confetti |
| `ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Entrances |
| `ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Pops and fills (slight overshoot) |

Respect the system "Reduce motion" setting: fades only, no confetti, no overshoot.

## Haptics

| Moment | iOS | Android |
|---|---|---|
| Button press | Impact, light | `KEYBOARD_TAP` |
| Action done | Impact, light | `CONFIRM` |
| Daily set done | Impact, medium | `CONFIRM` |
| Big win | Notification, success | `CONFIRM` twice |
| Error | Notification, error | `REJECT` |

## Accessibility

- WCAG 2.2 AA. Text contrast at least 4.5, large text and meaningful graphics at least 3. Checked pairs are in [`04-colors.md`](04-colors.md).
- Colour never carries meaning alone. Baskets always have an icon and a label.
- Every image and every Liito pose has a text alternative that says what it means ("Liito is cheering"). Decorative confetti is hidden from screen readers.
- Touch targets at least 48. At least 8 between targets.
- All animations stop within 5 seconds and follow "Reduce motion".
- Celebrations never trap the user: one button, and it works with a screen reader.
- Amounts are read out in full ("sixty-four euros").
- Light and dark mode are both complete.

## For code generation

- Web: Tailwind or plain CSS with the variables in `tokens.css`. Load fonts from Google Fonts: `Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800` and `Figtree:wght@400;600;700`.
- Icons: `@phosphor-icons/react` (web) or `phosphor-react-native`.
- Build the pressable edge with a solid bottom border or a `box-shadow: 0 4px 0 <edge>` with no blur, and `transform: translateY(4px)` plus `box-shadow: none` on press. This is the one allowed use of `box-shadow`.
- Never hard-code a hex value in a component. Use a token.
