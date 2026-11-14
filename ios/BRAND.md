# Sisu brand rules for the iOS app

> **Update, 14 Nov 2026 (from the owner). These rules override the older ones below where they differ.**
>
> - **Lighter S-Pankki look.** The screen is near-white (`background` `#F6F8F7`), cards are white with a 1 pt
>   hairline (`hairline` `#E3E8E5`) and no shadow, text is dark and readable (`text` `#18211C`, muted
>   `#5E6662`). S-Pankki green is only for the primary action, selected states, progress and the spending
>   basket colours. Pale-green fills (`green50`, `green25`, `green100` as a background) are no longer used for
>   screens, sheets, cards, inputs or notes. Liito and the type (Bricolage Grotesque, Figtree) stay.
> - **Glass for navigation and selected controls only.** The floating tab bar is Liquid Glass on iOS 26 (a
>   system-material capsule on iOS 17 to 25, a solid near-white capsule with a hairline when Reduce
>   Transparency is on), with a softly green-tinted pill under the selected tab. Transaction lists, charts and
>   money figures always stay on solid surfaces. This replaces "No gradients or glass" for those two uses.
> - **Demo disclosure.** The demo is disclosed once, at profile selection. The screens (Today, Ask, Jars, Path
>   and the sheets) no longer carry a "Sample data" badge. Source and freshness are in Settings > Data and
>   sources. When the app falls back from live to demo data at the moment it happens (the backend cannot be
>   reached), it says so once, in place, with a short notice that goes away; never as a permanent badge.
>   "Mock data" stays only where it is part of a card's source line (the server itself reports example data).
> - **Unchanged:** simulated actions keep "Simulated, no real switch" and the approval step exactly as before.

The short version of the brand kit. The full kit (persona, voice, colour reasoning, mascot spec, concept art) is on the `brand-kit` branch of this repo. Read `git show brand-kit:AGENTS.md` when in doubt.

## Colours (the S-mobiili app's own palette, nothing else)

| Token | Hex | Use |
|---|---|---|
| `green900` Dark green | `#004628` | All main text, hero blocks, the Fixed basket |
| `green700` Deep green | `#007841` | Primary colour: buttons, active states, links, the Curveballs basket |
| `green500` S green | `#00AA46` | Accent, progress fills, large shapes, the Leaks basket. Never body text |
| `green300` Soft green | `#99D59F` | Outlines, soft blocks, muted text on dark |
| `green200` Mint | `#91FA9B` | Highlight on dark, button on dark, the Jars colour |
| `green100` Pale mint | `#D2FCD5` | Selected rows, tracks, chips |
| `green50` Surface green | `#EBF7EC` | Was the screen background; replaced by `background` `#F6F8F7` (14 Nov) |
| `green25` Near-white green | `#F7FCF7` | Was alternate sections and sheets; replaced by `background` (14 Nov) |
| `white` | `#FFFFFF` | Cards |
| `background` | `#F6F8F7` | Screen, sheets, input fill, launch screen (14 Nov) |
| `hairline` | `#E3E8E5` | 1 pt edge of white cards on the near-white screen (14 Nov) |
| `neutral900` / `600` / `400` / `200` | `#1F1F1F` / `#666666` / `#949494` / `#E6E6E6` | Long text / secondary text / input borders / dividers |
| `amber` bg / mark / text | `#FFF1D8` / `#CF8300` / `#885600` | Streak flame and heads-up notes only |
| `info` bg / text | `#E0F4FF` / `#006E87` | Tips |
| `error` bg / text | `#FFEDED` / `#B70000` | Failed actions only. Spending is never red |
| Dark mode | bg `#00301B`, card `#004628`, outline `#1B6B43`, text `#F7FCF7`, muted `#99D59F` | Primary button becomes mint with `#00301B` label |

Baskets are a ramp, dark to light: Fixed `#004628`, Curveballs `#007841`, Leaks `#00AA46`, Jars `#91FA9B`. Always with an icon and a label. API names map as `regular` → Fixed, `irregular` → Curveballs, `everyday` → Leaks.

## Type

- Bricolage Grotesque ExtraBold or Bold: headlines and hero numbers. Figtree Regular, SemiBold, Bold: everything else. Files are in `ios/Sisu/Resources/Fonts`.
- Sentence case. No all-caps headings, no italics, nothing lighter than Regular.
- Sizes (pt): hero 64, display 40, h1 32, h2 24, h3 20, body-lg 18, body 16, label 14, caption 12, button 17.
- Amounts: English `€1,234.50` and `€64`; Finnish `1 234,50 €` and `64 €`. Use a real minus sign.

## Shape and layout

- 20 pt side margins, 4 pt grid, 16 pt between cards, 32 pt between sections. Touch targets at least 48 pt.
- Corners: buttons 18, cards 24, sheets and hero blocks 32, pills fully round. Nothing square.
- White cards with a hairline on the near-white screen, no shadow, no gradients. Glass only for the tab bar
  and selected controls, never behind money figures, charts or lists (14 Nov).
- Pressable things have a 4 pt darker bottom edge and move down when pressed.
- One hero number, one primary button and at most one Liito per screen.

## Voice

- Number first, one idea per message, short sentences, sentence case.
- Praise effort, never shame. No "overspent", "wasted" or "should have". Say "above your usual".
- Jokes on good or neutral news only. Bad news is calm and comes with one next step.
- Say "about" for estimates and say where a number comes from.

## Hard rules from the team (judges check these)

- Every number on screen comes from the API payload or from deterministic code in `SisuCore`. Never from a model.
- Every figure can open the transactions behind it.
- Never fake a live call. The demo is disclosed once at profile selection; Settings > Data and sources says
  where every figure comes from and when it was fetched; a live-to-demo fallback is announced where it happens.
- Simulated actions are labelled "Simulated, no real switch", need an approval tap, and are written to the audit log.
- Bill names are Sisu's guess until the user confirms them.
- Never market credit, promise savings, rank users by euros, or push investing before a buffer exists.

## Mascot

Liito, a grey flying squirrel with huge dark eyes and S green inside the glide membrane. Liito's mood follows the user's effort, never their balance. Liito is never sad, angry or begging, and never appears on payment confirmations, money errors or legal text.
