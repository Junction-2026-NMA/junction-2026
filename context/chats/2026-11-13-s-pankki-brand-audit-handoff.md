# S-Pankki brand audit completion

Source: <t3-thread://v2/699bd055-6afa-4ddf-9c94-4b70358a24dd/thread:provider:claudeAgent:native-thread:provider-thread%3Aprovider%3AclaudeAgent%3Anative-thread%3Apending%253Arun%253Athread%253A9bd03a63-a893-442d-9b8e-8004ddd29fa7%253Aordinal%253A1%3Aae9cb97ff11626df2>

Source updated: 2026-11-13T20:14:53.559Z. Coverage: completion handoff. Tool traces are omitted.

Historical record. Later user corrections and current repository instructions take precedence. Local project links point at the verified asset commit; personal emails are redacted. Older completion claims are preserved as history, not independent proof.

## Assistant · 2026-11-13T20:14:53.550Z

<tools-used-before-summary>WebFetch, WebSearch, Write, mcp__obscura__browser_evaluate, mcp__obscura__browser_navigate, mcp__obscura__browser_screenshot, mcp__obscura__browser_scroll</tools-used-before-summary>

The audit is written to `https://github.com/Junction-2026-NMA/junction-2026/blob/0b58ea220fb93bd1dc0f19178afb23567ef57065/research/s-pankki-brand-audit.md`. I touched no other file and ran no git commands, so the vault note `Projects/s-banking.md` is not updated with these findings.

## Most important findings

1. **Challenge brief: found, with a caveat.** The text is at https://junction2026.com/challenges/s-pankki-personal-economic-trainer, but that site names no operator and the official site (2026.hackjunction.com) does not link to it. The official site and the Junction Platform do list S-Pankki as a challenge partner. The brief reads like a condensed summary, so confirm the wording at the venue.

2. **The brief asks for an AI chat, not a rebrand.** Core line: "Build an AI experience that lets people chat with their own money, turning personal banking data into a trusted financial coach."
   - **Valued:** a teaching angle on three spending baskets (mandatory regular, mandatory irregular, everyday spending that slips away), free exploration of data in the "MyData spirit", and optional open data from Statistics Finland.
   - **Data and output:** a synthetic transaction dataset; a mobile app or embeddable web app.
   - **Prizes:** €2,000 Airbnb gift card, €1,000, €500.
   - **Target group:** only "especially for young adults". The 18–35 and under-€2,000 persona is the team's own, not S-Pankki's.

3. **Judging:** no S-Pankki criteria are published. Each partner picks its own winners "against their own criteria"; the top 5 of the whole event then pitch to a grand jury.

4. **"Biggest bank in Finland" is false.** What is true:
   - S-Pankki has 3.5 million customers, but only 914,000 are "active" (30.9.2026).
   - It holds 3.4 % of Finnish loans and 4.9 % of deposits (31.12.2024), against OP at 34.2 % / 40.8 %, Nordea at 23.8 % / 26.9 % and Danske at 9.4 % / 10.0 %.
   - Total assets were €13.24 bn at end 2025.
   - It called itself the fourth-largest retail bank in December 2024 and bought about 97 % of Oma Säästöpankki in 2026.
   - It does lead on brand esteem (nine years running), customer satisfaction and loyalty, and EPSI 2026 names S-mobiili the best bank app in Finland.

5. **Verified colours** (from the live CSS, scoped to `[data-theme=sPankki]`):

   | Role | Hex |
   |---|---|
   | Text, icons, dark blocks | `#004628` |
   | Logo, app icon, hero headline | `#00AA46` |
   | Deep green (store art, success) | `#007841` |
   | Primary button (mint) | `#91FA9B` |
   | Button hover | `#00EB5A` |
   | App surface | `#EBF7EC` |
   | Soft border | `#99D59F` |
   | Avatar circle | `#D2FCD5` |
   | Web section grey-green | `#F5F8F7` |
   | Neutral text | `#1F1F1F` |
   | Error | `#B70000` |
   | Warning / icon background | `#FFF1D8` |
   | Info | `#006E87` |

   The brand is green on green: text is dark green, not black, and buttons are mint with dark green text. There are no non-green brand colours.

6. **Verified fonts:** S Bonus Display (weights 600, 700) for headings, often uppercase; S Bonus UX (300, 400, 500, 700) for body and UI; fallbacks Arial and Roboto. Both are a custom S Group family credited to the agency BOND, so treat them as proprietary.

7. **Shapes:** very round. Primary buttons are pills with 22–40 px radius, cards about 40 px with a thin grey outline, almost no shadows, outline icons in one colour, and no illustration or mascot.

8. **S-mobiili:**
   - About 2.9 million users, 1.7 million weekly.
   - App Store 4.36 from 32,120 ratings; Google Play 4.26 from about 67.8 thousand.
   - Säästäjä is the existing micro-saving feature: €0.50–€5 per card purchase, Bonus to a fund, or a monthly sum. It has over 130,000 users, but only 11 % are 18–25 and 26 % are 26–35.
   - No budgeting or spending insight on bank transactions appears in any public material; the only breakdown is for S Group shop purchases.
   - The app is retail-first and list-based, and the store screenshots date from about 2023.

9. **Voice:** always "sinä", plain and practical (helppo, mutkaton, arki), lightly colloquial, rarely funny. Headlines are short, body copy long, with heavy product names. There is no English website; English exists only in the app as a beta, with typos. Ten real quotes with URLs are in the file.

10. **Young Finns:**
    - About one in three 18–24 year olds is in a low-income household; the line is about €1,530 net a month (Tilastokeskus, 2024).
    - The study grant is at most about €280 a month, plus an €850 student loan (Kela).
    - 48 % of under-30s worry about money weekly and 21 % have no savings (S-Pankki / Kantar, 2026).
    - Financial knowledge is weakest at 18–29 (Ministry of Justice, 2023).
    - First payment defaults are most common at 20–24 (Asiakastieto, 2026), and new debt-collection cases peak at 25–29 (Lowell, 2026).

## Could not verify

- That junction2026.com is run by Junction, and that its text is S-Pankki's full exact wording.
- S-Pankki's own judging criteria and judges.
- The ownership split between SOK and the regional cooperatives, and how "active customer" is defined.
- OP's and Nordea's total personal customer counts and total assets, so no like-for-like customer ranking.
- Market shares at 31.12.2025, and the combined size with Oma Säästöpankki.
- The age profile of S-Pankki's whole customer base; only Säästäjä users' ages were found.
- Whether the logged-in app has any spending categorisation, and what the current app looks like. App radii and sizes are estimated by eye.
- A public S Group design-system site or brand guide, Pantone or CMYK values, and official colour names.
- The designer, launch year and licence of the S Bonus fonts.
- The under-30 share of Takuusäätiö debt-advice contacts in 2025, and an official BNPL-by-age statistic. The BNPL point rests on an Intrum survey reported by Verkkouutiset.
- One pink background (`rgb(255,201,215)`) seen once on the homepage; its purpose is unknown.
