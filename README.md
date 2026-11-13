<img src="assets/icon.svg" width="64" height="64" alt="">

# s banking · brand kit

This is the `brand-kit` branch: the brand and UI reference for **Hillo** (working name), a money coach for 18 to 35 year olds inside S-Pankki, made for the Junction 2026 challenge "Personal Economic Trainer".

Its purpose is consistency. Point any AI assistant or teammate at this branch and the UI, images and copy they produce should match. Treat the branch as read-only; build the product elsewhere.

Version 0.2, 2026-11-13. Colours follow the S-mobiili app (see `references/s-mobiili/`).

## Start here

| If you want to | Open |
|---|---|
| Tell an AI how to use this kit | [`AGENTS.md`](AGENTS.md) |
| Understand the challenge and our concept | [`brand/00-brief.md`](brand/00-brief.md) |
| Know who we design for | [`brand/01-persona.md`](brand/01-persona.md) |
| See the name, personality, mascot and what makes it unique | [`brand/02-identity.md`](brand/02-identity.md) |
| Write copy or chat replies | [`brand/03-voice.md`](brand/03-voice.md) |
| Pick colours | [`brand/04-colors.md`](brand/04-colors.md) |
| Design a screen | [`brand/05-ui-style.md`](brand/05-ui-style.md) |
| Get exact sizes and tokens | [`brand/06-specifications.md`](brand/06-specifications.md), [`brand/tokens.css`](brand/tokens.css), [`brand/tokens.json`](brand/tokens.json) |
| Generate brand images | [`brand/07-image-prompts.md`](brand/07-image-prompts.md) |
| See the look on one page | [`moodboard/index.html`](moodboard/index.html) (open in a browser) |

## Research behind it

| File | What it is |
|---|---|
| [`research/s-pankki-brand-audit.md`](research/s-pankki-brand-audit.md) | S-Pankki today: the challenge brief, facts about the bank, real colours and fonts from the live site, voice, the app, and young Finns' money |
| [`research/competitor-analysis.md`](research/competitor-analysis.md) | 18 finance products and 3 interaction benchmarks, compared on UI and brand strategy, with what to borrow and what to avoid |
| [`research/ui-references.md`](research/ui-references.md) | 90 reference screens from 25 apps (via Appllama), a pattern library and a top 15 |
| [`references/ui/`](references/ui/) | The reference images. For studying patterns only. Do not copy a screen or reproduce the watermark. |

## To use it in a chat

Paste this to any AI assistant that can read the repository:

> Read `AGENTS.md` on the `brand-kit` branch of `riripatate/s-banking` and follow it. Then design [the screen you need].

For an assistant that cannot read the repository, paste the contents of `AGENTS.md`, `brand/05-ui-style.md` and `brand/tokens.css`.

## What is not done yet

- The product name, mascot, fonts and Finnish wording are proposals awaiting the team's confirmation.
- No brand images have been generated. Prompts are ready in `brand/07-image-prompts.md`.
- The chart colours have not been tested with a colour-blindness simulator.
- The name has not been checked for trademarks.

---

Created in [T3 Code](https://t3.codes).
