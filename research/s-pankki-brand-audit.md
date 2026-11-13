# S-Pankki brand audit

Prepared 2026-11-13 for the Junction 2026 challenge "Personal Economic Trainer". Everything below was checked on that date. Each claim has its source beside it. Anything that could not be checked is labelled **unverified** and is listed again at the end of section 6.

How the values were obtained: the live site `https://www.s-pankki.fi` was downloaded with curl, its five stylesheets were read and counted, the homepage was rendered in a headless browser to read computed styles, and the App Store and Google Play listings and screenshots were downloaded and viewed.

---

## 1. The challenge brief

**Found, with one caveat.** The brief text is published at [junction2026.com/challenges/s-pankki-personal-economic-trainer](https://junction2026.com/challenges/s-pankki-personal-economic-trainer). That site does not name its operator, and the official event site [2026.hackjunction.com](https://2026.hackjunction.com/) does not link to it or host the brief. The official site and the [Junction Platform event page](https://hackjunction.app/hackathons/junction-2026) both list S-Pankki as a challenge partner, so the challenge is real. The wording below reads like a condensed summary, so check it against the brief S-Pankki hands out at the venue or on the Junction Platform (login needed).

### Brief, verbatim from junction2026.com

The text is copied as published. Only the page's section headings are shown here as bold labels.

> **Personal Economic Trainer** · Junction 2026 · FinTech Track · by S-Pankki
>
> **The Challenge.** Build an AI experience that lets people chat with their own money, turning personal banking data into a trusted financial coach.
>
> **Insight.** Data: a large synthetic transaction dataset modelled on real S-Bank data. Example questions: "How much did I spend on taxis last month?", "What kind of spender am I?", "What is safe for me to spend this week?", "How much could I save if I reduced dining out by 20%?"
>
> Valued: a pedagogical angle based on three spending baskets — mandatory and regular (e.g. rent), mandatory and irregular (e.g. a broken washing machine), and everyday spending that slips through your fingers (e.g. coffees). MyData spirit: let users explore their own data freely instead of fixed bank-picked charts. Can add open data (e.g. Statistics Finland) for benchmarks. Financial literacy, especially for young adults.
>
> Recommended output: a mobile app, or a web app that can be embedded in a mobile app. Context: S-Bank has 3.5 million customers; S-mobiili is used weekly by one in three Finnish adults. No Finnish bank yet lets customers chat with their own financial data.
>
> **Prizes.** 1st €2,000 Airbnb gift card · 2nd €1,000 · 3rd €500

### Judging

- No S-Pankki-specific judging criteria are published. **Unverified.**
- The general process, from the official site: "Each Challenge Partner chooses their own track winners against their own criteria." Then face-to-face peer review picks the top 5 projects of the whole event, and those 5 pitch live to a grand jury of seven judges. ([2026.hackjunction.com](https://2026.hackjunction.com/), section "How the winner is chosen")
- So S-Pankki's own people pick the S-Pankki winners. The "Valued" list in the brief is the closest thing to criteria.

### Constraints and schedule

- Teams of 1 to 4. A main challenge can be combined with any tech challenge. ([junction2026.com/about](https://junction2026.com/about))
- Preliminary submission Fri 13 Nov 23:55. Final submissions Sun 15 Nov 10:00. Final ceremony Sun 15 Nov 14:00. Venue: Hype Areena, Espoo. ([junction2026.com/about](https://junction2026.com/about))

### What the brief does not say

- It does **not** state an age range of 18–35 or an income limit of €2,000 net a month. The only target-group wording is "Financial literacy, especially for young adults". The 18–35 and under-€2,000 persona is the team's own choice.
- It does not ask for a rebrand. It asks for an AI chat over the user's own transactions, a teaching angle built on the three spending baskets, and free exploration of data. A youth rebrand has to serve those three things to score.
- The word "trusted" is in the first sentence. Playfulness must not cost trust.

---

## 2. Facts about the bank

### Owner and basics

| Fact | Value | Source |
|---|---|---|
| Legal name | S-Pankki Oyj (S-Bank Plc), business ID 2557308-3, Helsinki | [s-pankki.fi footer](https://www.s-pankki.fi/fi/) |
| Owner | "sen omistavat SOK ja S-ryhmään kuuluvat alueosuuskaupat" (SOK and the regional cooperatives of S Group). Exact ownership split: **unverified** | [Tietoa S-Pankista](https://www.s-pankki.fi/fi/s-pankki-yrityksena/tietoa-meista/) |
| Founded | 2007 (the bank's own key-figures page) | [Tietoa S-Pankista](https://www.s-pankki.fi/fi/s-pankki-yrityksena/tietoa-meista/) |
| CEO | Riikka Laine-Tolonen | [S-Pankki yrityksenä](https://www.s-pankki.fi/fi/s-pankki-yrityksena/) |
| Staff | about 1,300 | [Tietoa S-Pankista](https://www.s-pankki.fi/fi/s-pankki-yrityksena/tietoa-meista/) |
| Purpose line | "Olemme olemassa siksi, että jokaisella olisi mahdollisuus vähän rahakkaampaan huomiseen." (We exist so that everyone can have a slightly wealthier tomorrow.) | [S-Pankki yrityksenä](https://www.s-pankki.fi/fi/s-pankki-yrityksena/) |
| Slogan | "Suomen mutkattomin pankki" (Finland's most hassle-free bank) | [homepage title](https://www.s-pankki.fi/fi/) |

### Size (30 Sept 2026 unless stated)

| Measure | Value | Source |
|---|---|---|
| Customers in total | 3.5 million (the press boilerplate still says "yli kolme miljoonaa") | [Tietoa S-Pankista](https://www.s-pankki.fi/fi/s-pankki-yrityksena/tietoa-meista/), [press release 28.10.2026](https://www.sttinfo.fi/tiedote/72449905/s-pankki-nousi-suomen-ykkoseksi-asiakasuskollisuudessa?publisherId=4521144) |
| **Active** customers | 914,000 (839,000 a year earlier). Target: 1 million. How "active" is defined: **unverified** | [Interim report 1–9/2026](https://www.s-pankki.fi/fi/tiedotteet/2026/s-pankki-oyjn-osavuosikatsaus-1.1.30.9.2026/) |
| Deposits | €11.1 billion | same |
| Lending | €9.5 billion | same |
| Assets under management | €9.4 billion | same |
| Fund unit holders | 556,000, "more than doubled in six years" | same |
| Operating profit Jan–Sep 2026 | €75.4 million | same |
| Total assets, 31 Dec 2025 | €13.24 billion | [Financial statements bulletin 2025 (PDF)](https://www.sttinfo.fi/ir-files/4521144/71790740/14668/S-Pankki%20Oyj%20Tilinp%C3%A4%C3%A4t%C3%B6stiedote%201.1.%20-%2031.12.2025.pdf) |
| Online banking credentials | 2.9 million | [Tietoa S-Pankista](https://www.s-pankki.fi/fi/s-pankki-yrityksena/tietoa-meista/) |
| International payment cards | 3 million | same |

### Is S-Pankki "the biggest bank in Finland"? No.

What is true:

- **By headline customer count it is very large.** 3.5 million customers in a country of about 5.6 million people. OP Pohjola, the market leader, reports 2.136 million owner-customers ([OP Pohjola financial statements bulletin 2025](https://www.inderes.fi/releases/op-pohjolan-tilinpaatostiedote-11-31122025-op-pohjolalla-jalleen-vahva-vuosi-liikevoitto-2-269-miljoonaa-euroa)). These two numbers are not like for like: OP's total customer count and Nordea's Finnish customer count are **unverified**, so "most customers of any Finnish bank" cannot be claimed.
- **Most of those customers do not bank mainly with S-Pankki.** Only 914,000 are "active". A 2024 interview put it this way: "S-pankki on tullut vihreän kortin kautta monelle kuin itsestään kakkospankiksi" (through the green card it became many people's second bank almost by itself). ([Taloustaito, 9.10.2024](https://www.taloustaito.fi/Rahat/kuinka-paihitatte-suurpankit-s-pankin-toimitusjohtaja-riikka-laine-tolonen/))
- **By money it is a mid-sized bank.** Market shares at 31 Dec 2024, Bank of Finland data published by Finance Finland:

| Bank | Loans in Finland | Share | Deposits | Share |
|---|---|---|---|---|
| OP | €94.6 bn | 34.2 % | €77.9 bn | 40.8 % |
| Nordea | €65.7 bn | 23.8 % | €51.2 bn | 26.9 % |
| Danske Bank | €26.0 bn | 9.4 % | €19.1 bn | 10.0 % |
| Kuntarahoitus (municipal lender) | €35.8 bn | 12.9 % | 0 | 0 % |
| Säästöpankkiryhmä | €10.1 bn | 3.6 % | €6.5 bn | 3.4 % |
| **S-Pankki** | **€9.4 bn** | **3.4 %** | **€9.4 bn** | **4.9 %** |
| Oma Säästöpankki | €6.2 bn | 2.3 % | €3.9 bn | 2.1 % |

Source: [Finanssialan vuositilasto 2024 (PDF), table "Pankkien markkinaosuudet 31.12.2024"](https://www.finanssiala.fi/wp-content/uploads/2025/05/finanssialan-vuositilasto-2024.pdf). The 31.12.2025 table was not found: **unverified** for 2025.

- In household business only, the bank says its share at end of June 2025 was "noin 8 prosenttia" of household deposits and "lähes 6 prosenttia" of housing loans. ([Financial statements bulletin 2025 (PDF)](https://www.sttinfo.fi/ir-files/4521144/71790740/14668/S-Pankki%20Oyj%20Tilinp%C3%A4%C3%A4t%C3%B6stiedote%201.1.%20-%2031.12.2025.pdf))
- S-Pankki described itself as Finland's fourth-largest retail bank after buying Handelsbanken's Finnish retail business, about 100,000 customers, on 1 Dec 2024 ([Verkkouutiset, 2.12.2024](https://www.verkkouutiset.fi/a/s-pankin-liiketoimintakauppa-handelsbankenin-kanssa-on-valmis/)).
- **It is growing by acquisition.** In 2026 S-Pankki made a public offer for Oma Säästöpankki at €17.20 a share and held about 97.32 % of the shares by 23 Oct 2026 ([stock exchange release 23.10.2026](https://www.sttinfo.fi/announcement/72438975?publisherId=4521144)). The bank says the merger into "one bank" will take one to two years ([Interim report 1–9/2026](https://www.s-pankki.fi/fi/tiedotteet/2026/s-pankki-oyjn-osavuosikatsaus-1.1.30.9.2026/)). Adding the two banks' 2024 shares gives roughly 5.7 % of loans and 7.0 % of deposits (my arithmetic on the table above, not a published figure).

**Accurate one-liner for the pitch:** "S-Pankki reaches 3.5 million Finns and has the most-used and best-rated bank app, but it is a challenger by balance sheet: about 3–5 % of Finnish loans and deposits against OP's 34–41 %."

### Where it does lead

- Most esteemed banking brand in Finland for the ninth year running (Taloustutkimus, Brändien arvostus 2026). ([press release 27.8.2026](https://www.sttinfo.fi/tiedote/72269432/s-pankki-jo-yhdeksatta-vuotta-perakkain-pankkialan-arvostetuin-brandi?lang=fi))
- Most satisfied retail bank customers, index 82.0, and "S-mobiili on Suomen paras pankin mobiilisovellus" (EPSI Rating 2026). ([press release 21.9.2026](https://www.sttinfo.fi/tiedote/72337793/epsi-rating-s-pankilla-tyytyvaisimmat-pankkiasiakkaat-ja-paras-mobiilisovellus?lang=fi))
- First of 51 companies in customer loyalty (ASML Asiakkuusindeksi 2026). ([press release 28.10.2026](https://www.sttinfo.fi/tiedote/72449905/s-pankki-nousi-suomen-ykkoseksi-asiakasuskollisuudessa?publisherId=4521144))

### Who the customers are

- Customers are S Group co-op members (asiakasomistaja) and their households. Daily banking is free for them: "Päivittäiset pankkipalvelut S-Tili, S-Etukortti Visa, verkkopankki ja S-mobiili ovat maksuttomia kaikille osuuskauppojen asiakasomistajille." ([homepage meta description](https://www.s-pankki.fi/fi/))
- The bank positions itself for everyone, not the wealthy: "jokaiselle lompakon paksuudesta riippumatta" (for everyone, whatever the thickness of their wallet). ([homepage](https://www.s-pankki.fi/fi/))
- Age profile of the whole customer base: **unverified**. The only age split found is for Säästäjä users (below).

### S-Etukortti and Bonus

- The S-Etukortti is the green S Group loyalty card. The S-Etukortti Visa is the same card with payment. "S-Etukortti Visan omistaja on S-Pankin asiakas. Kortilla tehdyistä S-ryhmän ostoksista kertynyt Bonus ja maksutapaetu maksetaan S-Pankin tilille." (Bonus and the payment benefit are paid into the S-Pankki account.) ([Tietoa S-Pankista](https://www.s-pankki.fi/fi/s-pankki-yrityksena/tietoa-meista/))
- Paying with the card in S Group shops gives 0.5 % back on top of Bonus ("saat puoli prosenttia maksutapaetua"). ([homepage FAQ](https://www.s-pankki.fi/fi/))
- In December 2025 co-op members paid 27.8 % of their Bonus purchases with an S-Pankki card. ([Financial statements bulletin 2025 (PDF)](https://www.sttinfo.fi/ir-files/4521144/71790740/14668/S-Pankki%20Oyj%20Tilinp%C3%A4%C3%A4t%C3%B6stiedote%201.1.%20-%2031.12.2025.pdf))
- This is the bank's unfair advantage for the challenge: it sees both the bank transactions and the grocery receipts. S-mobiili already shows S Group purchases by product group, product, shop and date. ([S-mobiili page](https://www.s-pankki.fi/fi/verkkopalvelut/s-mobiili/))

### S-mobiili

| Fact | Value | Source |
|---|---|---|
| What it is | One app for S Group loyalty and S-Pankki banking: "combines retail, banking and asset management services into one app" | [App Store listing](https://apps.apple.com/fi/app/s-mobiili/id740514933) |
| Users | about 2.9 million, of whom about 1.7 million weekly (30.9.2026) | [Interim report 1–9/2026](https://www.s-pankki.fi/fi/tiedotteet/2026/s-pankki-oyjn-osavuosikatsaus-1.1.30.9.2026/) |
| App Store (Finland) | 4.36 / 5 from 32,120 ratings. Version 2.43.0, updated 30.10.2026. First released 15.11.2013. Needs iOS 16.6 | [iTunes lookup API](https://itunes.apple.com/search?term=S-mobiili&country=fi&entity=software&limit=5), read 2026-11-13 |
| Google Play | 4.26 / 5 (shown as 4.3) from about 67.8 thousand ratings. "1M+" downloads. Updated 11.11.2026 | [Google Play listing](https://play.google.com/store/apps/details?id=fi.spankki&hl=en&gl=FI), read 2026-11-13 |
| Language | Finnish and Swedish. English is offered as "English (Beta)" | [App Store listing](https://apps.apple.com/fi/app/s-mobiili/id740514933) |
| Entry barrier | Must be a co-op member or in a member household, needs bank credentials plus an SMS code, and "S-mobiilin voi ottaa käyttöön vain Suomessa" (can only be activated in Finland) | [S-mobiili page](https://www.s-pankki.fi/fi/verkkopalvelut/s-mobiili/) |

Main features, from the bank's own page: accounts and transactions, payments and e-invoices, card controls, loans, funds, Säästäjä, strong authentication for other services, e-payslips and pension record, a virtual assistant, plus the loyalty side (Bonus status, targeted offers, receipts, purchase history by product group). ([S-mobiili page](https://www.s-pankki.fi/fi/verkkopalvelut/s-mobiili/), [Uutta S-Pankissa](https://www.s-pankki.fi/fi/asiakaspalvelu/uutta-s-pankissa/))

### Existing saving, budgeting and insight features

**Säästäjä ("Saver") is the existing saving feature, and it is real micro-saving.**

- Four ways to save: send Bonus straight to a fund; put aside €0.50–€5 from every debit card purchase; a fixed monthly sum; one-off top-ups. ([Säästäjä page](https://www.s-pankki.fi/fi/saastaminen-ja-sijoittaminen/saastaja/))
- It is a fixed amount per purchase, not a round-up to the next euro.
- Setup: set a goal and time, answer investor-suitability questions, accept a plan. Money goes into two funds (Säästäjä 10 and Säästäjä 100) and the share of equities falls as the goal date nears. ([Säästäjä page](https://www.s-pankki.fi/fi/saastaminen-ja-sijoittaminen/saastaja/))
- Over 130,000 users at the end of January 2026, up 18 % in a year. 55 % of people who opened it in 2025 had never invested before. Median saving €50 a month. Card micro-saving averages €1.36 per purchase. ([Säästäjien Suomi, March 2026 (PDF)](https://dokumentit.s-pankki.fi/tiedostot/s-pankki-saastajien-suomi-032026))
- **Users by age: 18–25: 11 %, 26–35: 26 %, 36–50: 37 %, 51–65: 20 %, over 65: 6 %.** The typical user is 36–50. The report itself notes that effortless saving matters most to young adults yet they are not the main users, and that "Nuoremmilla säästämisen esteeksi nousevat herkästi pienet tulot" (for younger people low income easily becomes the barrier). (same PDF)
- Built with Solita, described as Finland's first mobile micro-saving service. ([Solita case](https://www.solita.fi/work/saastaja-finlands-first-mobile-microsaving-service/))

**Virtual assistant.** New in S-mobiili. It is a help bot, not a money coach: "Virtuaaliavustaja ymmärtää parhaiten lyhyitä, muutaman sanan mittaisia kysymyksiä." (It best understands short questions of a few words.) ([Uutta S-Pankissa](https://www.s-pankki.fi/fi/asiakaspalvelu/uutta-s-pankissa/))

**Budgeting and spending insight on bank transactions: none found.** The public feature lists show no budget tool, no categorising of account or card transactions, no spending forecast and no "safe to spend". The only spending breakdown is for S Group shop purchases (the loyalty data). This matches the brief's line "No Finnish bank yet lets customers chat with their own financial data". Whether something exists inside the logged-in app that the public pages do not mention: **unverified**.

---

## 3. Current visual identity

### Logo

- A ribbon-like "S" made of three parallel strokes, followed by the wordmark "PANKKI" in condensed bold capitals. One colour only.
- Live file: [`/Assets/img/logos/s-pankki-logo-107x46.svg`](https://www.s-pankki.fi/Assets/img/logos/s-pankki-logo-107x46.svg), 107 × 46 px, every path filled `#00AA46`.
- App icon: white S on a flat green square. Sampled colour `#00AA47`, which is `#00AA46` with JPEG noise. ([App Store icon](https://apps.apple.com/fi/app/s-mobiili/id740514933))
- The S symbol is shared across S Group. The agency BOND redesigned it and made it "the key visual throughout the customer's path". ([BOND case study, archived 2023](https://web.archive.org/web/20231204162849/https://bond-agency.com/project/s-group); the live page now returns 404)

### Design system

- The site loads `design-system.min.css`, a set of design tokens with the prefix `--sds-` scoped to `[data-theme=sPankki]`. The `<html>` tag carries `data-theme="sPankki"`. So S-Pankki is one theme of a shared S Group design system. ([design-system.min.css](https://www.s-pankki.fi/Assets/css/design-system.min.css))
- The agency HiQ confirms this: "The new look was created within the framework of the S Group's corporate design system" and S-Bank wanted "to move away from its old, grey, and conservative appearance" using "white space, rounded corners, and soft shapes" and "brighter greens". ([HiQ case study](https://hiq.se/en/case/a-technically-and-visually-compelling-digital-service-ecosystem-for-s-bank/))
- A public documentation site for the design system was **not found** (tried design.s-ryhma.fi, sds.s-ryhma.fi, npm `@s-group/*`). **Unverified** whether one exists.
- The site sits on Bootstrap 5.3.8 underneath. ([s-vendor.min.css](https://www.s-pankki.fi/Assets/css/s-vendor.min.css))

### Brand colours

All hex values below are declared in the live CSS. "Count" is how many times the value appears in the main stylesheet [`s-pankki_theme.min.css`](https://www.s-pankki.fi/Assets/css/s-pankki_theme.min.css). "Rendered" is how many elements on the homepage had that computed colour on 2026-11-13.

| Role | Hex | Token in the design system | Where it is used | Count / rendered | How sure |
|---|---|---|---|---|---|
| Darkest green (text, icons) | `#004628` | `text-strongest-primary`, `background-strongest-primary` | All body text, headings h2–h6, links, icons, dark blocks | 1,272 in CSS (about 424 are icon classes) plus 232 token uses; 917 text elements and 43 backgrounds rendered | Certain |
| Brand green (logo) | `#00AA46` | `background-medium-primary`, `text-medium-primary`, `border-success` | Logo, app icon, hero H1 (`.green-font`), card art | 26 in CSS; hero H1 rendered `rgb(0,170,70)` | Certain |
| Deep green | `#007841` | `background-strong-primary`, `text-strong-primary`, `text-success` | Store art backgrounds (sampled), app headings (by eye), button text token, success | 26 in CSS; 51 % of pixels in a Google Play screenshot | Certain |
| Mint (primary button) | `#91FA9B` | `button-…-filled-primary-default`, `background-weak-secondary` | Primary buttons, highlighted cards, login button | 66 in CSS; 47 backgrounds rendered | Certain |
| Bright green (hover) | `#00EB5A` | `button-…-primary-active`, `background-medium-secondary` | Primary button hover | 21 in CSS | Certain |
| Button hover step | `#49F37B` | `button-…-filled-primary-hover` | Token only | Token only | Certain it is declared; use on site not seen |
| Pale mint | `#D2FCD5` | `background-weaker-secondary` | Avatar circle on the app's "Me" screen (sampled from the store screenshot) | 2 in CSS | Certain |
| Palest mint | `#EAFEEC` | `background-weakest-secondary` | Token | Token only | Certain it is declared |
| Soft green surface | `#EBF7EC` | `background-weak-primary`, `background-success` | App screen background behind white cards | 6–10 % of pixels in app screenshots | Certain |
| Soft green border | `#99D59F` | `border-weak-primary` | Borders; background of store art | 35 % of pixels in one App Store image | Certain |
| Near-white green | `#F7FCF7` | `background-weakest-primary` | Token | Seen in store art | Certain it is declared |
| Web page grey-green | `#F5F8F7` | none (site stylesheet only) | Alternate page sections, footer | 31 in CSS; 16 backgrounds rendered | Certain |
| Web line grey | `#EFF0F1` | none (site stylesheet only) | Borders, dividers | 94 in CSS | Certain |
| White | `#FFFFFF` | `background-default-neutral` | Page and card background | 219 in CSS; 179 backgrounds rendered | Certain |
| Neutral text | `#1F1F1F` | `text-default-neutral` | Neutral text and dark buttons in tokens | Token | Certain it is declared |
| Neutral greys | `#363636`, `#666666`, `#949494`, `#E6E6E6`, `#F5F5F5`, `#FAFAFA` | neutral tokens | Secondary text, borders, sunken areas | Token | Certain |
| Error red | `#B70000` (hover `#9F0000`, active `#730000`, pale `#FFEDED`) | danger tokens | Errors, destructive buttons | 15 in CSS | Certain |
| Warning | `#FFF1D8` background, `#CF8300` border, `#885600` text | warning tokens | Warnings. `#FFF1D8` is also the round icon background in the homepage link list | 9 backgrounds rendered | Certain |
| Info blue | `#E0F4FF` background, `#00A1C5` border, `#006E87` text | info tokens | Info notes | 10 in CSS | Certain |
| Older green | `#008035` | none | Scattered older rules | 16 in CSS | Certain it exists; looks like legacy |

Three things to take from the table:

1. The brand is **green on green**. Text is dark green `#004628`, not black. Buttons are mint with dark green text, not white text on green.
2. There are effectively **no non-green brand colours**. Cream, red and blue exist only as status colours. One pink background (`rgb(255,201,215)`) rendered once on the homepage; what it belongs to is **unverified**.
3. "S-Pankki green" is not one colour. The logo green is `#00AA46`. The colour people see most is the dark `#004628` and the mint `#91FA9B`.

Brand colours in a printed or official brand guide (Pantone, CMYK, official names): **unverified**. No public brand guide was found.

### Typography

| Use | Font family | Weights shipped | Evidence | How sure |
|---|---|---|---|---|
| Headings, display | **S Bonus Display** | 600, 700 | [`SBonusDisplay.css`](https://www.s-pankki.fi/Assets/fonts/SBonusDisplay.css); token `--sds-font-family-display`; 89 uses in the site stylesheet | Certain |
| Body, buttons, UI | **S Bonus UX** | 300, 400, 500, 700 | [`SBonusUX.css`](https://www.s-pankki.fi/Assets/fonts/SBonusUX.css); token `--sds-font-family-primary`; 127 uses | Certain |
| Fallback | Arial, Roboto, sans-serif | — | Named in the `@font-face` rules | Certain |

- Both are a custom S Group family. BOND: "The basis for the S-Bonus loyalty programme font family design and its form language was in the redesigned S logo… a personal, concise title font as well as a functional text font that works well in digital channels." ([BOND case study, archived](https://web.archive.org/web/20231204162849/https://bond-agency.com/project/s-group))
- The type designer or foundry and the licence terms: **unverified**. Treat the fonts as proprietary. Do not ship them in a hackathon build without asking S-Pankki.
- S Bonus Display is a tall, condensed, heavy sans. S Bonus UX is a plain humanist sans with open shapes.

Measured on the homepage (desktop, 1280 px wide):

| Element | Font | Size | Weight | Other |
|---|---|---|---|---|
| Hero H1 | S Bonus Display | 104 px, line height 108 px | 700 | UPPERCASE, letter-spacing −0.53 px, colour `#00AA46` |
| H2 | S Bonus Display | 83 px, line height 86 px | 700 | Sentence case, `#004628` |
| Card titles | S Bonus Display | about 48 px (by eye, not measured) | 700 | UPPERCASE |
| Body | S Bonus UX | 18 px / 27.9 px (17 px / 26.35 px on mobile) | 400 | `#004628` |
| Buttons | S Bonus UX | 16–18 px | 700 | `#004628` on `#91FA9B` |

Uppercase appears 35 times in the stylesheet and is used for hero and card headlines, and for every App Store caption.

### Corner radii and button shapes

Website, counted in the site stylesheet: `40px` (44 times), `34px` (35), `36px` (26), `50%` (25), `56px` (19), `12px` (18), `32px` (11), `22px` (9). Very round is the rule.

| Component | Shape | Source |
|---|---|---|
| Primary button, large | Mint `#91FA9B`, dark green text, bold, radius 32 px on mobile and 40 px on desktop, padding 26 × 28 px, hover `#00EB5A` | `.s-primary-large` |
| Primary button, small | Same colours, radius 22 px, padding about 10 × 24 px | `.s-primary-small` |
| Secondary button | Transparent, 2 px grey border, same radius, border turns `#004628` on hover | `.s-secondary-large` |
| Generic button | Radius 80 px (full pill), padding 8 × 22 px | `.s-btn` |
| Cards | White or mint, about 40 px radius, 1 px grey outline, no shadow | Rendered homepage |
| Link rows | Full pill with grey outline, round 40 px cream icon holder on the left, arrow on the right | Rendered homepage |
| Shadows | Almost none. `box-shadow:none` is the most common value | Stylesheet |

Design-system radius tokens run from 2 px to 64 px plus "circle". Named steps: xxsmall 6 px, xsmall 8 px, small 10 px, medium 12 px, large 14 px, xlarge 16 px, xxlarge 18 px, xxxlarge 20 px, xxxxlarge 24 px. Spacing tokens follow a 4 px grid (2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 64, 80). ([design-system.min.css](https://www.s-pankki.fi/Assets/css/design-system.min.css))

App, estimated by eye from store screenshots (**not measured**): cards about 8–12 px radius, circular quick-action buttons, one pill button, a raised round "+" in the middle of the tab bar.

Motion tokens exist: durations 100–500 ms, default 300 ms, and an "elastic" and a "spring-gentle" easing. ([design-system.min.css](https://www.s-pankki.fi/Assets/css/design-system.min.css))

### Icons

- Outline icons, single weight, rounded ends, in dark green `#004628`. Drawn with CSS masks (3,610 mask rules), so every icon is one flat colour.
- The design system names about 380 icons in groups such as banking (account, savings, trophy, stock, interest), commerce (shopping bag, receipt, barcode) and communication (five face icons from angry to delighted).
- BOND designed the UI icons for the S Group app. ([BOND case study, archived](https://web.archive.org/web/20231204162849/https://bond-agency.com/project/s-group))

### Illustration

- Very little. The app shows one flat diagram of a payment terminal and a phone. The Bonus screen has a simple gauge. No characters, no mascot, no illustrated scenes were found on the homepage or in the store listings.

### Photography

- Warm, natural-light lifestyle photos of ordinary adults in ordinary moments: a couple with a baby in a carrier looking at a phone, a man at a supermarket self-checkout with a red basket, a smiling young man in front of a plant, a woman with a savings jar theme ("saastaja_tytto"). Some are stock (file names include "istock").
- Products are shown as plain device mock-ups on a pale mint field (iPhone and Apple Watch with the green card).
- By eye, the people shown look about 25–45. Few images read as "student" or "18–25". ([homepage](https://www.s-pankki.fi/fi/), viewed 2026-11-13)

---

## 4. Current brand voice

### Real quotes

| # | Quote | Where | URL |
|---|---|---|---|
| 1 | "Suomen mutkattomin pankki" (Finland's most hassle-free bank) | Slogan, page title | [s-pankki.fi/fi](https://www.s-pankki.fi/fi/) |
| 2 | "Säästäminen ei aina vaadi suuria päätöksiä. Joskus se alkaa kahvikupillisesta tai siitä, että laittaa Bonuksen poikimaan." (Saving doesn't always need big decisions. Sometimes it starts with a cup of coffee, or with putting your Bonus to work.) | Homepage hero | [s-pankki.fi/fi](https://www.s-pankki.fi/fi/) |
| 3 | "…vaikkapa euron, satasen tai kymppitonnin kerrallaan." (…a euro, a hundred or ten grand at a time.) | Homepage hero | [s-pankki.fi/fi](https://www.s-pankki.fi/fi/) |
| 4 | "Säästäminen on aivan liian helppoa Säästäjällä" (Saving is far too easy with Säästäjä) | Säästäjä H1 | [Säästäjä](https://www.s-pankki.fi/fi/saastaminen-ja-sijoittaminen/saastaja/) |
| 5 | "Arkista ja helppoa niin kuin säästämisen kuuluukin olla." (Everyday and easy, the way saving should be.) | Säästäjä intro | [Säästäjä](https://www.s-pankki.fi/fi/saastaminen-ja-sijoittaminen/saastaja/) |
| 6 | "Kun arki täyttyy opiskeluista, raha-asioista ei kannata stressata." (When life is full of studying, money isn't worth stressing over.) | Student page | [Opiskelijan pankkipalvelut](https://www.s-pankki.fi/fi/elamantilanteet/opiskelijaelamaa/) |
| 7 | "Onko opiskelijaelämä aina köyhäilyä?" (Is student life always about being broke?) | Article title | [Opiskelijan pankkipalvelut](https://www.s-pankki.fi/fi/elamantilanteet/opiskelijaelamaa/) |
| 8 | "Ota palvelut käyttöön vaikka heti!" (Start using them right now!) | Homepage card | [s-pankki.fi/fi](https://www.s-pankki.fi/fi/) |
| 9 | "BENEFIT, BENEFITS AND MORE BENEFITS! BROWSE BENEFITS FROM YOUR FAVOURITE STORES AND SERVICES" | App Store caption, English | [App Store](https://apps.apple.com/fi/app/s-mobiili/id740514933) |
| 10 | "You're 33,17 € ahead your target." | In-app microcopy, English beta | [App Store](https://apps.apple.com/fi/app/s-mobiili/id740514933) |

### Tone

- **"Sinä", never "te".** Every page speaks to one person in the informal singular: "voit", "sinulle", "Ota Säästäjä käyttöön", "Tutustu tileihin", "Lataa S-mobiili". The bank calls itself "me" (we): "Tarjoamme", "Kehitämme".
- **Plain and practical.** The core words are helppo (easy), mutkaton (hassle-free), vaivaton (effortless), arki (everyday life), hyöty (benefit). The promise is "Ylivoimaista helppoutta ja hyötyä" (unbeatable ease and benefit). ([S-Pankki yrityksenä](https://www.s-pankki.fi/fi/s-pankki-yrityksena/))
- **Friendly, lightly colloquial, not funny.** Words like "kymppitonni", "poikimaan", "näppärästi" and "köyhäily" are relaxed spoken Finnish. Humour is rare and gentle (quote 4 is as far as it goes). No slang, no emoji, no memes, no first names.
- **Headlines are short. Body copy is long.** Headlines run 3–7 words. Under them sit paragraphs of 40–80 words, bullet lists of 10–15 features, and asterisk footnotes about fees and funds. The Säästäjä page explains risk allocation in full sentences before the reader can start.
- **Product names are heavy.** "S-Etukortti Visa Credit/Debit -yhdistelmäkortti", "S-Pankki Varainhoito Säästäjä 10", "asiakasomistajatalouden pääjäsen".
- **Equal and modest about money.** "lompakon paksuudesta riippumatta", "vähän rahakkaampaan huomiseen". The bank never talks about getting rich. It talks about small sums and ordinary life. This is the most useful part of the voice for a low-income audience.

### English

- **There is no English website.** `s-pankki.fi/en/` returns 404 and the homepage declares only Finnish and Swedish versions. English appears in the app (marked "Beta"), in the store listings and in investor releases.
- The English that exists is literal and uneven: all-caps captions, "STORE YOUR RECEIPTS DIGTALLY" (typo in the live App Store image), "ahead your target", and screens that mix languages ("Säästäjä – Oma tavoitteeni", "Tunnistaminen" next to "Scan QR-code"). ([App Store](https://apps.apple.com/fi/app/s-mobiili/id740514933), [Google Play](https://play.google.com/store/apps/details?id=fi.spankki&hl=en&gl=FI))
- For a Junction demo in English, the team is writing the brand's English voice almost from scratch.

---

## 5. Current app UI (S-mobiili)

Described from the 8 App Store and 8 Google Play screenshots, viewed 2026-11-13. Several screenshots show offers dated 2023 ("Valid until 31.12.2023"), so the store images are about three years old and the live app may differ. The bank says the Home view was since "clarified" and the pay button moved. ([Uutta S-Pankissa](https://www.s-pankki.fi/fi/asiakaspalvelu/uutta-s-pankissa/)) The current logged-in app was **not seen**.

**Structure**

- Bottom tab bar with five items: Home, S-Etukortti, Payment (a raised round green "+" in the centre), Bank, Me. A chat bubble sits top right on every screen.
- Home: a Bonus gauge first ("To the next Bonus level 10,44 €", "Bonus now 40,27 €"), then four round quick actions (New payment, Own transfer, Benefits nearby, Saved benefits), then "Accounts and cards" with balances.
- S-Etukortti tab: the loyalty card, "Bonus and purchases", "Receipts", then horizontally scrolling offer cards with retail photos and discount percentages.
- Bank tab: a vertical stack of large white cards, one per product: Accounts, Payments and e-invoices, Cards, Säästäjä, Investments. Each has an outline icon, a bold green title, one or two grey values and a chevron.
- Säästäjä screen: goal name ("New car"), one big green number (5987,65 €), a thin progress bar with start date, end date and target (12 000,00 €), one sentence of feedback, then three plain list rows.
- Me tab: initial in a mint circle, name in capitals, then settings lists.

**Look**

- White cards on a pale green surface (`#EBF7EC`). Headings in deep green (`#007841`). Body in near-black. Dark green circles for actions. Store art uses flat `#007841`, `#99D59F` and `#00AA46` backgrounds with condensed all-caps captions.
- Flat. No shadows to speak of, no gradients, no illustration, no photos on the banking side. Photos appear only in retail offers.
- Density is low to medium. Screens are mostly lists and labels. The only data graphics are the Bonus gauge and one progress bar.
- Tone on screen is neutral and descriptive: "Make a new payment or view and order e-invoices", "Contact information, membership, communication, privacy".

**What feels dated or unsuited to 18–35 year olds**

1. **Shopping first, money second.** Home opens on Bonus and coupons. A person who wants to know "can I afford this week?" gets a loyalty gauge.
2. **A filing cabinet, not a coach.** The Bank tab is a list of products named in the bank's terms. Nothing tells the user what happened to their money or what to do next.
3. **No insight into spending.** No categories, trends, forecasts or comparisons for bank transactions in any screenshot or public feature list.
4. **Saving has no emotion.** Säästäjä shows a number and a thin bar. No milestones, no streak, no celebration, no picture of the goal. The one line of feedback is a euro figure.
5. **Säästäjä starts with a questionnaire.** A goal, a time horizon and investor-suitability questions come before the first euro is saved. That is a legal need for funds, but it is a wall for a first-time saver on a low income.
6. **No character.** One green, one icon style, no illustration, no voice. It is calm and trustworthy, and it is also anonymous.
7. **Store presence is stale.** 2023 dates, a typo, mixed languages, English in beta.
8. **Heavy entry.** Co-op membership, bank credentials, an SMS code, Finland only, and a paper code card sent by post ("tunnuslukutaulukko") is still part of first setup. ([S-mobiili page](https://www.s-pankki.fi/fi/verkkopalvelut/s-mobiili/))

What already works and should not be thrown away: it is the best-rated bank app in Finland (EPSI 2026), 1.7 million people open it weekly, the layout is clean and readable, and green-on-green is instantly recognisable.

---

## 6. What young Finns need

| # | Fact | Source |
|---|---|---|
| 1 | **One in three 18–24 year olds lives in a low-income household.** In 2024 the low-income line for a person living alone was about €18,310 a year, "nettotulot noin 1 530 euroa/kk". 144,900 low-income people were aged 18–24, just under 30 % of all working-age low-income people. | [Tilastokeskus, 16.12.2025](https://stat.fi/julkaisu/cmin81ch45kp507vzolnh5sky) |
| 2 | **A student's state support is small and partly debt.** The study grant is at most about €280 a month for a student without children. The state-guaranteed student loan is €850 a month for students aged 18 or over. | [Kela, opintoraha (page updated 25.6.2026)](https://www.kela.fi/web/selkokieli/opintoraha), [Kela, opintolaina (updated 26.9.2026)](https://www.kela.fi/web/selkokieli/opintolaina) |
| 3 | **Half of under-30s worry about money every week.** 48 % of under-30s worry about their finances at least weekly, more than any other age group. 21 % have no savings at all, and a quarter have savings for one month at most. (Kantar for S-Pankki, n = 3,102 adults; size of the under-30 group not stated.) | [S-Pankki Arjen turvabarometri 2026, 2.9.2026](https://www.sttinfo.fi/tiedote/72282300/s-pankin-tutkimus-nuoret-kokevat-arjen-turvalliseksi-vaikka-talous-huolettaakin?lang=fi) |
| 4 | **Young adults know least about money.** "Parhainta taloudellinen tietämys on 40–49-vuotiailla suomalaisilla ja heikointa nuorilla aikuisilla, 18–29-vuotiailla." Young adults are also more impulsive in their attitudes than older people. (University of Vaasa and PTT for the Ministry of Justice, OECD/INFE method.) | [Oikeusministeriö, 15.5.2023](https://valtioneuvosto.fi/-/1410853/suomalaisten-talousosaamisessa-parantamisen-varaa) |
| 5 | **Payment defaults start young.** 382,000 people in Finland had a payment default entry at the end of 2025. "Ikäluokan kokoon suhteutettuna eniten ensimmäisiä maksuhäiriömerkintöjä tulee edelleen 20–24-vuotiaille." (Relative to group size, 20–24 year olds get the most first-time default entries.) | [Suomen Asiakastieto, 15.1.2026](https://www.asiakastieto.fi/web/fi/asiakastieto-media/uutiset/maksuhairioisten-kuluttajien-maaran-kasvu-hidastui-vuodessa-lahes-30-maksuhairioisia-on-nyt-382-000.html) |
| 6 | **Debt collection peaks at 25–29.** In 2025 new collection cases were highest among 25–29 year olds relative to group size, and cases among young adults have risen for three years. For 18–19 year olds the unpaid bills are mostly rent, sports and health. (One collection company's own data.) | [Lowell Analyysi 1/2026 (PDF)](https://www.lowell.fi/media/zbuf2u2z/new-lowell-analyysi-12026.pdf) |
| 7 | **Buy-now-pay-later is hard to keep track of.** "Nuorilla aikuisilla on muita ikäryhmiä enemmän haasteita pitää kirjaa osta nyt, maksa myöhemmin -ostoksistaan." (Intrum survey; sample size not given in the article.) | [Verkkouutiset, 12.8.2024](https://www.verkkouutiset.fi/a/maksujen-lykkaaminen-vaikeuttaa-nuorilla-aikuisilla-talouden-hallintaa/) |
| 8 | **They want saving to be automatic, but income is the barrier.** Nearly three in four young adults want saving to be automatic and unnoticed (against nearly 60 % of all Finns). Yet only 11 % of Säästäjä users are 18–25. | [S-Pankki, Säästäjien Suomi, March 2026 (PDF)](https://dokumentit.s-pankki.fi/tiedostot/s-pankki-saastajien-suomi-032026) |
| 9 | Background: Finnish households hold €28.0 billion of consumer credit, about half of it (€13.8 billion) unsecured. The Bank of Finland figures have no age split. | [Suomen Pankki, 1.7.2025](https://www.suomenpankki.fi/en/statistics/statistical-news/mfi-balance-sheet/2025/households-hold-significant-consumer-credit--growth-rate-has-slowed/) |

**What this means for the persona**

- "Under €2,000 net a month" is a sound cut. The official low-income line is about €1,530 net a month, so the persona covers people at and just above it.
- The need is not "learn to invest". It is: know what is safe to spend this week, see the small leaks, survive an irregular bill, and avoid the first default. That is exactly the brief's three baskets.
- Saving amounts must be tiny and automatic. The real numbers are €1.36 per purchase and €50 a month.
- Money is a weekly worry for half of them. The tone has to lower stress, not add pressure or shame.

### Could not verify

| Item | Status |
|---|---|
| That junction2026.com is run by Junction, and that its brief text is S-Pankki's full, exact wording | Unverified. Official sites confirm the partner, not the text |
| S-Pankki's own judging criteria and judges | Unverified. None published |
| An official age or income target in the brief | Not in the brief. The 18–35 and €2,000 persona is the team's |
| Ownership split between SOK and the regional cooperatives | Unverified |
| Definition of "active customer" | Unverified |
| OP's and Nordea's total personal customer counts in Finland, and OP's and Nordea's total assets | Unverified. A search snippet gave Nordea group total assets of €654 bn for 2025; the report was not opened |
| Market shares at 31.12.2025 and the combined size of S-Pankki plus Oma Säästöpankki | Unverified. 2024 table used |
| Age profile of S-Pankki's whole customer base | Unverified. Only Säästäjä users' ages found |
| Whether the logged-in app has any spending categorisation or budget tool | Unverified. None on public pages |
| Current look of the logged-in app | Not seen. Store screenshots date from about 2023 |
| App corner radii and font sizes | Estimated by eye from screenshots |
| A public S Group design-system site or brand guide; Pantone or CMYK values; official colour names | Not found |
| Designer or foundry of S Bonus Display and S Bonus UX, launch year, licence terms | Unverified. BOND is credited with "Custom Typography" |
| Under-30 share of Takuusäätiö debt-advice contacts in 2025; BNPL use by age from an official statistic | Not found. Older or secondary figures were left out |
| The one pink background on the homepage (`rgb(255,201,215)`) | Seen once. Purpose unknown |

---

## What to keep, what to change

- **Keep the green, and pick the right ones.** Use logo green `#00AA46` as the link to the bank, dark `#004628` for text instead of black, and mint `#91FA9B` for primary actions. Those three already read as S-Pankki. Add new accent colours next to them, since the brand has none and a game-like app needs them for categories, streaks and the three baskets.
- **Keep the S and the roundness.** Pills, 40 px cards and circles are already the house shape, so a soft, rounded, playful look is an extension of the brand and not a break from it.
- **Keep "sinä", plain words and the modest promise.** "Vähän rahakkaampi huominen" and "lompakon paksuudesta riippumatta" are the right stance for people on low incomes. Keep the bank's habit of talking about small sums.
- **Keep the trust.** It is the most esteemed bank brand in Finland nine years running and the brief asks for a "trusted" coach. Celebrate progress, but never joke about a user's balance, hide fees, or use fake urgency.
- **Change the type.** S Bonus Display in capitals is loud and corporate, and the fonts are proprietary. Choose a free, friendly rounded family for the new product and keep condensed capitals out of it.
- **Change the voice length and add personality.** Go from 60-word paragraphs and product names to one-line answers, first-person coaching and a mascot with moods. This is where the app can differ most, because today there is no character, no illustration and almost no humour.
- **Change what the app is about.** Today it is Bonus first and a list of products second. Lead with the user's own money: what is safe to spend this week, the three baskets, the small leaks. Use the grocery-receipt data as the special ingredient no other bank has.
- **Change how saving feels.** Säästäjä is a number and a thin bar behind a questionnaire, and only 11 % of its users are 18–25. Make the first saved euro take one tap, show goals as pictures, and reward streaks and milestones at the €1–€50 scale young users actually have.
