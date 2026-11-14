# Landing page reference material

Inputs for the Sisu landing page at `public/sisu/` (branch `feature/landing-page`). This folder is reference only. Nothing in it is served by the app.

## Sisu brand kit (copies)

Copied unchanged from the `brand-kit` branch at `0b58ea2` on 2026-11-14. That branch stays the source of truth. The copies exist because work on this branch cannot read another branch.

| File | What it is |
|---|---|
| `02-identity.md` | The idea system (berries, jars, baskets), personality and the rules for Liito |
| `03-voice.md` | Voice rules, words to use and avoid, button labels |
| `04-colors.md` | Which colour goes where, and the contrast-safe pairs |
| `05-ui-style.md` | Components: hero number, basket bar, jar, shelf, streak, chat, receipt, stickers, motion |
| `06-specifications.md` | Exact sizes |

Links inside these files to other kit files do not resolve here. The token values are in `public/sisu/tokens.css`, a byte-for-byte copy of the kit's `brand/tokens.css`.

## Artwork in `public/sisu/img/`

- `liito-glide.png`: Liito's glide pose, 640 × 640, scaled down from the kit's `moodboard/generated/liito-glide.png`. It has an opaque green background and no transparency, so show it as a sticker: rounded shape, white border, tilted a few degrees. It is a concept draft, not an approved master.
- `anchor-fill.svg`, `lightning-fill.svg`, `drop-fill.svg`, `jar-fill.svg`: Phosphor Icons, fill weight, MIT licence (`PHOSPHOR-LICENSE.txt`). They use `currentColor`. As an `<img>` they render black. Inline the path, or use the file as a CSS mask, so the icon takes its basket colour.

## S-Pankki website screenshots

Taken on 2026-11-14 from https://www.s-pankki.fi/fi/saastaminen-ja-sijoittaminen/saastaja/, a product subpage and the closest model for a Sisu subpage. Use them to match the look of the header, breadcrumb and footer. Do not copy the site's code, fonts or photos, and do not ship these images.

| File | Shows |
|---|---|
| `s-pankki-desktop-top.png` | 1680 px wide: header, breadcrumb and the start of the page |
| `s-pankki-desktop-footer-1.png` | 1280 px wide: upper part of the footer |
| `s-pankki-desktop-footer-2.png` | 1280 px wide: lower part of the footer and the legal row |
| `s-pankki-mobile-top.png` | 390 px wide: the collapsed header and the start of the page |
| `s-pankki-mobile-footer.png` | 390 px wide: the start of the footer |

What they show:

- **Header, desktop.** White, two rows. Row 1 has the green logo at the left, then an outlined pill "Henkilöasiakkaat" with a chevron. At the right are the text link "På svenska" and a mint pill "Kirjaudu" with a lock icon. Row 2 has the main navigation as bold dark green text. The current section sits in a light grey pill. At the right are "Asiakastuki" and "Toimipaikat", each with a small outline icon.
- **Breadcrumb.** Small grey text with "/" between the steps, and the current page in dark green. On a phone it becomes one back link with a left arrow.
- **Product page hero.** A very large, heavy headline in dark green at the left, a large lead paragraph and a big mint pill button with an arrow. At the right, a pale mint card with large rounded corners holds the picture.
- **Header, phone.** A pale bar with the logo, the mint "Kirjaudu" pill, an info icon and a two-line menu icon.
- **Footer.** Pale grey-green background. Columns: "Asiakaspalvelu" (a mint pill "Asiakastuki" and the two blocking-service numbers), "Oikopolut" (bold dark green links, one per line), then the logo with the company lines. A white bottom row holds "© S-Pankki" and the legal links.
- **Everywhere.** Flat, no shadows, large radii, dark green text instead of black.

Where the Sisu page differs on purpose:

- Headlines inside `<main>` are sentence case in Bricolage Grotesque. The bank's capital-letter headlines and its fonts (S Bonus Display, S Bonus UX) are proprietary and are not used.
- The footer in the screenshots also has social icons, a contact-details card and the reference rate. They are left out. The request lists the footer items to include.
- The live site moves navigation items that do not fit into a "Katso lisää" menu. The page does the same with a script (`public/sisu/nav.js`): all eight links are in the HTML, and from 1024 px the ones that do not fit on one row move under a "Katso lisää" pill. Without scripts the row wraps.
- The cookie banner was dismissed before capture. The chat bubble at the bottom right is not part of the page.

## The reference landing page (patterns only)

The layout idea comes from the landing page shown in https://x.com/Tanjim38/status/2027765106918953007, a 35-second scroll through a software product page. Only its structure and motion are borrowed. Its colours (purple gradients), text and artwork are not.

From top to bottom it has:

1. **Hero.** A centred two-line headline whose last word sits in a highlighted, slightly tilted chip. One line of supporting text and one pill button. Below, a phone mock-up in the centre with small white cards at both sides, each tilted a few degrees (a big percentage, a small chart, a waveform).
2. **Trust strip.** One line of text and a row of logos.
3. **Three small cards** in a row under a centred heading: an icon chip, a title and two lines of text.
4. **Three large rounded panels**, one under another, under a centred heading. Each has a white inner card with a visual on the left (an area chart whose line draws in, a hand-drawn line, a ring gauge that counts up). On the right are a title, a short paragraph, three ticked points and a button. As the page scrolls, each panel slides up over the one before.
5. **A grid of quote cards** under a centred heading: one large, two small beside it.
6. **Two tall cards** side by side, each with a white inner card (an audio waveform, and a face with a number that counts up).
7. **Prices.** A heading with a monthly or annual switch and two plan cards.
8. **Questions** that open as an accordion, with a plus sign at the right.
9. **Closing banner.** Full width, rounded, in the brand colour: a heading, one line, a light button, and the phone mock-up cut off by the bottom edge.
10. **Footer.** A logo, three link columns and a copyright line.

Motion: sections fade in and rise a few pixels as they enter the view, numbers count up, chart lines draw, the hero cards drift slightly and the big panels stack.

How the Sisu page uses it:

| Reference | Sisu page |
|---|---|
| Hero | "Small wins with your own money." with "your own money" in the chip. A phone mock-up of the Today screen (safe to spend, days to payday, basket bar). Tilted cards: the streak, a jar, the Liito sticker |
| Trust strip | Two sourced facts about S-mobiili, no logos |
| Three small cards | The three baskets |
| Three large panels | "What Sisu does each day.": safe to spend (the number counts up), a chat with Liito (bubbles and a data card), one small action (checklist, streak flame, a jar filling) |
| Quote cards | "You are not the only one.": three sourced figures instead of testimonials |
| Two tall cards | "Your week on one receipt.": the weekly receipt and the jar shelf |
| Prices | Not used. Sisu is free, and a question in "Good to know." says so |
| Questions | "Good to know." |
| Closing banner | A dark green block, "Start with one small win.", with the mint button |
| Footer | The bank's footer |
