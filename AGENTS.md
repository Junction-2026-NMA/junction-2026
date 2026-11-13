# Instructions for AI assistants

This branch (`brand-kit`) is the brand and UI reference for **Hillo**, a money coach for young adults inside S-Pankki, built for the Junction 2026 challenge "Personal Economic Trainer". Use it so that every screen, image and line of copy you produce matches, in any chat and with any model.

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
2. **Greens are S-Pankki's own** and stay unchanged. Text is spruce `#004628`, never pure black.
3. **Primary button:** aurora face `#00EB5A`, S green edge `#00AA46`, spruce label. One per screen. It presses down.
4. **No white body text on `#00AA46`.** It fails contrast.
5. **Berry colours have fixed meanings:** Mustikka = Fixed basket, Lakka = Curveballs basket and berries, Puolukka = Leaks basket, Nuotio = streak. Do not use them for anything else.
6. **Fonts:** Bricolage Grotesque for headlines and hero numbers, Figtree for everything else. Sentence case.
7. **One hero number, one primary action, at most one Liito per screen.**
8. **No shadows, gradients, glass effects, thin fonts or square corners.**
9. **Voice:** number first, one idea per message, praise effort, never shame. Follow `brand/03-voice.md`.
10. **Mascot:** Liito's mood follows the user's effort, never their balance. Liito is never sad, angry or begging.
11. **Never** market credit, promise savings, rank users by euros, use random money rewards, or push investing before a buffer exists.
12. **References are for patterns only.** Never copy a reference screen or reproduce the Appllama watermark.

## Checklist before you hand over a screen

- [ ] Background is Oat (light) or forest `#04140D` (dark); cards are white with a 2 px outline and 24 px corners.
- [ ] Exactly one primary button, with a label that says what happens.
- [ ] The biggest thing on screen is one number or one headline in Bricolage Grotesque.
- [ ] Every spending amount shows its basket (icon, name and colour).
- [ ] Text contrast is at least 4.5; touch targets are at least 48.
- [ ] Copy is short, in sentence case, with no blame.
- [ ] Amounts and dates use the format for the language (`1 234,50 €` in Finnish, `€1,234.50` in English).
- [ ] It works in dark mode and with "Reduce motion".

## Status of this kit

Version 0.1, 2026-11-13. The product name (Hillo), the mascot (Liito), the fonts and all Finnish wording are proposals awaiting the team's confirmation. No brand images exist yet; prompts are ready in `brand/07-image-prompts.md`.
