# Instructions for AI assistants

This branch (`brand-kit`) is the brand and UI reference for **Sisu**, a money coach for young adults inside S-Pankki, built for the Junction 2026 challenge "Personal Economic Trainer". Use it so that every screen, image and line of copy you produce matches, in any chat and with any model.

**This branch is read-only reference.** Do not edit files here unless the user asks you to change the brand kit itself. Build the product on other branches.

## Before you design or write anything

Read these, in this order:

1. [`brand/00-brief.md`](brand/00-brief.md): what we are building and why.
2. [`brand/02-identity.md`](brand/02-identity.md): the idea system (berries, jars, baskets, Liito).
3. [`brand/05-ui-style.md`](brand/05-ui-style.md): how screens look and behave.
4. [`brand/06-specifications.md`](brand/06-specifications.md) and [`brand/tokens.css`](brand/tokens.css): exact values.

Read when relevant:

- Writing any text or chat reply: [`brand/03-voice.md`](brand/03-voice.md).
- Choosing or using colour: [`brand/04-colors.md`](brand/04-colors.md).
- Deciding what a user needs: [`brand/01-persona.md`](brand/01-persona.md).
- Generating images: [`brand/07-image-prompts.md`](brand/07-image-prompts.md).
- Looking for a pattern: [`research/ui-references.md`](research/ui-references.md) and the images in [`references/ui/`](references/ui/).

## Hard rules

1. **Use tokens.** Take every colour, size, radius and font from `brand/tokens.css` or `brand/tokens.json`. Never invent a hex value.
2. **The palette is the S-mobiili app's palette.** Surface green `#EBF7EC` behind white cards, dark green `#004628` text, deep green `#007841` for actions, S green `#00AA46` as accent, mint `#91FA9B` on dark. Add no other hues: no pink, violet, gold, cream or neon green.
3. **Primary button:** deep green face `#007841`, white label, dark green edge `#004628`. On a dark block: mint face `#91FA9B`, dark green label. One per screen. It presses down.
4. **No body text in or on `#00AA46`.** It fails contrast. Use it for fills, icons and large type.
5. **Baskets are a green ramp, dark to light:** Fixed `#004628`, Curveballs `#007841`, Leaks `#00AA46`, Jars `#91FA9B`, always with icon and label. The only non-green colours are S-Pankki's own status colours: amber (`#FFF1D8`, `#CF8300`, `#885600`) for the streak and heads-ups, blue for info, red `#B70000` for errors.
6. **Fonts:** Bricolage Grotesque for headlines and hero numbers, Figtree for everything else. Sentence case.
7. **One hero number, one primary action, at most one Liito per screen.**
8. **No shadows, gradients, glass effects, thin fonts or square corners.**
9. **Voice:** number first, one idea per message, praise effort, never shame. Follow `brand/03-voice.md`.
10. **Mascot:** Liito's mood follows the user's effort, never their balance. Liito is never sad, angry or begging.
11. **Never** market credit, promise savings, rank users by euros, use random money rewards, or push investing before a buffer exists.
12. **References are for patterns only.** Never copy a reference screen or reproduce the Appllama watermark.

## Checklist before you hand over a screen

- [ ] Background is surface green `#EBF7EC` (light) or `#00301B` (dark); cards are white with 24 px corners and no outline, as in S-mobiili.
- [ ] Exactly one primary button, with a label that says what happens.
- [ ] The biggest thing on screen is one number or one headline in Bricolage Grotesque.
- [ ] Every spending amount shows its basket (icon, name and colour).
- [ ] Text contrast is at least 4.5; touch targets are at least 48.
- [ ] Copy is short, in sentence case, with no blame.
- [ ] Amounts and dates use the format for the language (`1 234,50 €` in Finnish, `€1,234.50` in English).
- [ ] It works in dark mode and with "Reduce motion".

## Status of this kit

Version 0.2, 2026-11-13 (colours rebuilt to match the S-mobiili app). The mascot (Liito), the fonts and all Finnish wording are proposals awaiting the team's confirmation. Draft character sheets and a visual mood board are available in `moodboard/updated-board.html`; the drawing handoff is `brand/08-liito-character-spec.md`. Generated PNGs are concept references for team review, not approved vector masters.
