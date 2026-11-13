# Sisu concept artwork

Generated 13 November 2026 with the built-in imagegen tool. These PNGs are review drafts. The character master still needs team selection and a clean vector redraw for production.

| File | Size | Use |
|---|---|---|
| `liito-master-sheet.png` | 1536 × 1024 | Five views: front, three-quarter, side, back, membrane open. |
| `liito-moods.png` | 1774 × 887 | Eight effort/context states, in four columns and two rows. |
| `liito-glide.png` | 1254 × 1254, RGBA | Transparent signature pose, with a cleanup pass. |
| `mood-forest-pantry.png` | 1672 × 941 | Forest, berries and savings jars; no mascot. |

The mood grid and glide use the five-view sheet as a visual reference. Character colours follow the current identity: grey fur, pale face, S-green membrane and mint cheek accents. The three mascot neutrals remain confined to Liito.

- [Visual board](../updated-board.html) and [PNG export](../style-board-v02.png).
- [Character specification](../../brand/08-liito-character-spec.md).
- [Exact generation and cleanup prompts](../generation-prompts-v02.md).
- [Asset manifest](manifest.json).

The four `*-fill.svg` icons come from [Phosphor Icons](https://github.com/phosphor-icons/core/tree/main/assets/fill). They are inlined in the board and retain their [MIT license](PHOSPHOR-LICENSE.txt). They are not generated character assets.

Illustrations are raster concepts. Small edge artifacts and colour interpolation need correction in the production vector redraw; these files do not establish exact vector paths or an approved animation rig.

## Generation log

Sisu asset completion, 2026-11-13. Built-in imagegen; no git commands. All edits are confined to this directory. The preceding README and manifest are historical metadata and retain the old spelling; the current product name is **Sisu**. The manifest is preserved and is not a current inventory.

Prompts use the exact style block from `brand/07-image-prompts.md`, plus its exact character block wherever Liito appears. The selected `liito-master-sheet.png` is attached to every subsequent Liito generation and repair. Images were opened after each attempt. The original mascot PNGs and extra forest-pantry PNG failed flat-fill checks; SVG icons and supporting files are preserved.

**Status convention:** generated means a PNG was produced and saved. Remaining defects below are acceptance failures, not approved exceptions. After at most three attempts, the closest result is retained as requested. Strict flat-palette acceptance is not claimed: the tool retains tonal texture and colour drift within fills, confirmed by pixel inspection of the master background.

| File | Status | Attempts this session | Selected attempt | Remaining defect / check |
|---|---|---:|---:|---|
| `liito-master-sheet.png` | generated | 3 | 1 | Faint interior tonal texture and colour drift remain. Attempt 1 best preserves the broad back tail and original construction. |
| `liito-moods.png` | generated | 3 | 2 | Subtle shading and colour drift remain. Focused expression corrected to calm open eyes; eight poses and 4-by-2 layout present. |
| `liito-glide.png` | generated | 3 | 3 | Subtle shading and colour drift remain. S-green opaque background and dark-green membrane use the explicit A3 exception; three mint berries present. |
| `app-icon.png` | generated | 3 | 3 | Subtle shading and colour drift remain; face fills more than 70 percent and ears sit below the top edge. Face-only square remains readable. |
| `jar-states.png` | generated | 3 | 3 | Tonal texture/colour drift remain. Output 3:1 rather than requested 4:1; glass edge is visually an outline despite no-stroke instruction. |
| `shelf.png` | generated | 3 | 3 | Tonal texture/colour drift remain; second jar content is darker than S green despite repair. Five jars, varied levels and empty dashed slot present. |
| `basket-icons.png` | generated | 3 | 3 | Tonal texture/colour drift remain. Output 3:1 rather than requested 4:1; jar edge is thicker than requested. |
| `receipt-blank.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. Bars remain horizontal rather than tilting with the paper; pale-green bars used to avoid adding an unlisted grey. |
| `stickers.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. |
| `berries-flame.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. |
| `mood-forest-floor.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. Soft-green backing added behind dark spruce to keep it visible on dark ground. |
| `mood-pantry.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. |
| `mood-payday-glide.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. Uses the explicit C3 dark-membrane exception; unwanted rim removed. |
| `mood-tight-week.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. |
| `mood-celebration.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. |
| `mood-pattern.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. Clipped motifs removed; background edge pixels still vary, so exact seamlessness is not established. |
| `mood-forest-pantry.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. Extra pre-existing forest/pantry composition preserved. |
| `anchor-fill.svg` | kept | 0 | - | Existing filled path source inspected; no strokes, gradients, text or effects. Unchanged checksum. |
| `lightning-fill.svg` | kept | 0 | - | Existing filled path source inspected; no strokes, gradients, text or effects. Unchanged checksum. |
| `drop-fill.svg` | kept | 0 | - | Existing filled path source inspected; no strokes, gradients, text or effects. Unchanged checksum. |
| `jar-fill.svg` | kept | 0 | - | Existing filled path source inspected; no strokes, gradients, text or effects. Unchanged checksum. |
| `PHOSPHOR-LICENSE.txt` | kept | 0 | - | Existing MIT license preserved; unchanged checksum. |
| `manifest.json` | kept | 0 | - | Left untouched by this task. Historical four-asset inventory is incomplete and glide alpha metadata is stale. |
| `README.md` | kept; log appended | 0 | - | Existing content preserved; this Generation log is appended. |

**Final QA corrections:** The selected A1 back view does **not** show a distinct broad tail; the earlier row overstates that observation. Front, side and open constructions were prioritized when choosing the best of three attempts. Another session changed the historical README heading and manifest brand to Sisu during this task; the earlier old-spelling note describes the initial snapshot, not the final files. Those concurrent edits were preserved.

**Verification:** All 16 requested filenames and the extra pre-existing forest-pantry image are present as valid PNGs (17 total); PNG signatures, all chunk CRCs, and decompressed image-data lengths passed. Every final PNG was opened full size and at approximately 25 percent; shapes and meaning remain legible. The app icon was also opened at 60 by 60 pixels and is recognizable. All 17 remain **FAIL for strict flat-palette acceptance** after three attempts because of interior tonal variation/colour drift. For example, the master's blank top region contains 38 colours instead of one. The pattern's left/right borders contain 33 colour values, so exact seamlessness is not established. B1/B3 remain 3:1 because the generator returned that ratio on all attempts. No text, letters, banknotes, euro signs, third-party logos or watermarks were observed in any final PNG. Liito remains kind. All PNGs here are opaque RGB; A3 uses the allowed S-green-background option. No final PNG has been recoloured, cropped or resized after generation. Temporary scaled images were used only for QA and removed.

| PNG | Actual dimensions | SHA-256 |
|---|---|---|
| `app-icon.png` | 1254 x 1254 | `9b097af7a57aeb8640fcfbc45a8c2fa1ecfe30db24a212bc8db901c93ba679b2` |
| `basket-icons.png` | 2172 x 724 | `ccb5ac8cb3777fd9e1f12d584857ebf42338da36b5d5aed027d56bb0153b3568` |
| `berries-flame.png` | 2172 x 724 | `0074dd9d3df84d8d863aaeca5e2fd8b32762ead56df655ec1d7e9c7425898be2` |
| `jar-states.png` | 2172 x 724 | `ccdabc12a659beffb9ffddd98f9ea50cf6f8655dd20cbc484bc2297929d800c6` |
| `liito-glide.png` | 1254 x 1254 | `8bbb1283df7ed033a19c6ff8d1c8d47ea02a022746581416603d5fa167365dfd` |
| `liito-master-sheet.png` | 1536 x 1024 | `f40adc7b10c6da4968f0c923015386aed0814a3478a8eda081740e7ae473a0d9` |
| `liito-moods.png` | 1774 x 887 | `ef24597688f2be8601ec32c466509956eb56b0b1bb29dec9f92b5a57f7722795` |
| `mood-celebration.png` | 1122 x 1402 | `ab74eb6fd923bbe5911269b524c84a9e97bb596b338a42ec2ffaea6b30192e49` |
| `mood-forest-floor.png` | 1122 x 1402 | `976ee6913d56cfc5f1b378eaa4e3d2c9ba915078fa55cec7b7c5e758771e8770` |
| `mood-forest-pantry.png` | 1672 x 941 | `9eb0f935555fa747465bdd04cf865da50631cdcca8ce3e3e4c515c304d90eb5c` |
| `mood-pantry.png` | 1122 x 1402 | `1484fae821b32ffbaddd9d558dc8d7a3b2fca40117340adf7120a756d7831c8a` |
| `mood-pattern.png` | 1122 x 1402 | `cf018ffc6952d4ad0bc0717a2869c31b79c7d2c6e8a1f07e3f27ed0acefa87c1` |
| `mood-payday-glide.png` | 1122 x 1402 | `200468d25836b159a92c298e445194e21d5045fe5f3ce52fe4150595abf8e4af` |
| `mood-tight-week.png` | 1122 x 1402 | `4b411fdcc8f90e8eef3fe6a1fe23e8ac1b7a212aa03c4ccba0a7fc3ddcf8a229` |
| `receipt-blank.png` | 1086 x 1448 | `c6488324cf6064264877105a87f67d1f73d494ea03a213222555a6b8bbbdbe71` |
| `shelf.png` | 1672 x 941 | `0695a4bd83a34993e953b716c28a58d5e2f73ed8c699fa3b5b69f8ec012e2127` |
| `stickers.png` | 1448 x 1086 | `fda481047ee9e30e7c2c04ee1bdc196397b552a13930a2f020fdcf1a5485862f` |

<details>
<summary>Exact prompts for selected outputs</summary>

The prompt set below includes the verbatim shared style and character blocks plus each asset description and targeted repairs. Source: `brand/07-image-prompts.md`. Every later Liito call used the saved selected A1 as its first reference; repairs also attached the preceding candidate. A1 attempt 1 used the original pre-existing master as its design reference. No external generation API or CLI fallback was used.

**liito-master-sheet.png — selected attempt 1**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green. CHARACTER "Liito": a Siberian flying squirrel mascot. Body is one rounded dumpling shape, head and body merged, slightly taller than wide. Fur is soft warm grey #B9C2BD with a cream #F4F1E8 belly and face. Very large round near-black eyes #0B1F16, each with one white highlight; each eye is about one third of the face width. Small round ears. Tiny mouth. Round cheeks with a faint mint glow only when happy. A flat, wide, feather-like grey tail. A gliding membrane stretches between front and back paws: grey on the outside, S green #00AA46 on the inside, visible only when the arms are spread. No clothes. No outline. Emotion comes from the eyes, ears and arms. Never angry, sad or crying.
A character model sheet of Liito on a plain pale green #EBF7EC background: front view standing, three-quarter view, side view, back view showing the flat tail, and one front view with arms spread wide so the S green inside of the gliding membrane shows as a kite shape. Same size and proportions in every view, evenly spaced in one row.
Use case: illustration-story. Deliver a 3:2 landscape model sheet. Keep the same established Liito construction as the reference image, but REBUILD every shape as completely uniform flat fills. Precisely solid #EBF7EC background across the whole canvas. Grey regions must be uniform #B9C2BD; pale regions uniform #F4F1E8; eyes #0B1F16 and one #FFFFFF highlight each; membrane exactly #00AA46. No painterly mottling, noise, lighting, vignettes, soft shading, gradients or boundary strokes. No dark rim around the body; no seams on the tail. Five distinct equal-scale views in one single row. Each body a short rounded dumpling, head and body merged. Every colour region is flat, like cut paper or clean SVG fills. No text, no letters, no labels. Keep empty space above and below.
```

**liito-moods.png — selected attempt 2**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green. CHARACTER "Liito": a Siberian flying squirrel mascot. Body is one rounded dumpling shape, head and body merged, slightly taller than wide. Fur is soft warm grey #B9C2BD with a cream #F4F1E8 belly and face. Very large round near-black eyes #0B1F16, each with one white highlight; each eye is about one third of the face width. Small round ears. Tiny mouth. Round cheeks with a faint mint glow only when happy. A flat, wide, feather-like grey tail. A gliding membrane stretches between front and back paws: grey on the outside, S green #00AA46 on the inside, visible only when the arms are spread. No clothes. No outline. Emotion comes from the eyes, ears and arms. Never angry, sad or crying.
A grid of eight poses of Liito, four per row, on an pale green #EBF7EC background, same size in each cell:
1 cheering with both arms up and the green membrane open;
2 proud, eyes closed in a smile, hugging a jam jar filled with green;
3 gliding, seen from the front, fully spread;
4 curious, head tilted, one ear down;
5 surprised with wide eyes, holding a magnifying glass over a single S green drop;
6 focused, leaning forward, holding one S green berry;
7 cosy, wrapped in a mint blanket holding a steaming mug;
8 sleepy, yawning on a short branch.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
4:2 landscape canvas, exactly eight equal-size cells, four columns and two rows. Character design reference: attached selected master; copy its face, round ears, flat broad tail, grey and pale markings. No cell dividers or labels. All eight required poses must be distinct. A blanket may cover folded membrane; never show green body fur.
REPAIR PASS: Correct the focused pose (bottom row, second cell): both eyes must be fully open round circles, calm tiny smile, no angled eyelids or eyebrows. Never stern or angry. Keep the same eight poses, same character, same layout. Proud jar should have a blank pale label. Remove decorative expression lines around faces. Replace all shaded areas with flat uniform palette regions.
Input image 1 is the identity master. Input image 2 is the edit target.
```

**liito-glide.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green. CHARACTER "Liito": a Siberian flying squirrel mascot. Body is one rounded dumpling shape, head and body merged, slightly taller than wide. Fur is soft warm grey #B9C2BD with a cream #F4F1E8 belly and face. Very large round near-black eyes #0B1F16, each with one white highlight; each eye is about one third of the face width. Small round ears. Tiny mouth. Round cheeks with a faint mint glow only when happy. A flat, wide, feather-like grey tail. A gliding membrane stretches between front and back paws: grey on the outside, S green #00AA46 on the inside, visible only when the arms are spread. No clothes. No outline. Emotion comes from the eyes, ears and arms. Never angry, sad or crying.
Liito gliding straight toward the viewer, arms and legs spread, the membrane forming a rounded kite shape in S green, tail trailing behind, big happy eyes. Centred, with a few simple leaves and three mint berries drifting past. Plain S green #00AA46 background, so use dark green #004628 for the membrane's inside in this image only.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
Square canvas, opaque exactly #00AA46 background. Use the attached selected master as character design reference. One Liito facing straight forward with symmetrical arms and hind paws spread. In this asset only use #004628 for the inner membrane, to contrast with the S-green backdrop, as the source prompt requires. Grey fur, pale face and belly remain identical. Include exactly three mint berries and a few simple leaves. Keep the full tail and all paws inside frame.
REPAIR PASS: Preserve this composition, three mint berries, full tail, all paws, grey/cream Liito and DARK GREEN membrane against S green backdrop. Targeted fix: completely flat uniform fills, especially background, grey body and face. No lighting anywhere. Treat it as 6-colour screen-printed vector art.
Input image 1 is the identity master. Input image 2 is the edit target.
FINAL CORRECTION: redraw as digital vector art with ZERO interior tonal variation. Quantized flat ink regions only; not scanned paper, watercolor, print grain or airbrush. Fill every background pixel with the exact specified background colour. Keep all character shapes, layout and kind expressions from input 2. The only soft boundary is normal edge antialiasing, no colour drift inside shapes.
```

**app-icon.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green. CHARACTER "Liito": a Siberian flying squirrel mascot. Body is one rounded dumpling shape, head and body merged, slightly taller than wide. Fur is soft warm grey #B9C2BD with a cream #F4F1E8 belly and face. Very large round near-black eyes #0B1F16, each with one white highlight; each eye is about one third of the face width. Small round ears. Tiny mouth. Round cheeks with a faint mint glow only when happy. A flat, wide, feather-like grey tail. A gliding membrane stretches between front and back paws: grey on the outside, S green #00AA46 on the inside, visible only when the arms are spread. No clothes. No outline. Emotion comes from the eyes, ears and arms. Never angry, sad or crying.
A square app icon. Liito's face only, cropped close, filling about 70 percent of the square: two huge black eyes with white highlights, cream face, grey fur, small round ears touching the top edge. Solid S green #00AA46 background. Very simple, readable at 60 pixels.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
Square canvas filled edge-to-edge solid #00AA46. Reference character face: the selected master. Face only, no shoulders, paws, wings, tail or props. Two huge round #0B1F16 eyes, one white dot each; small round ears at upper edge; grey #B9C2BD fur and #F4F1E8 face. No border or rounded outer mask; the operating system will mask the square. Simple and readable when 60 pixels wide.
REPAIR PASS: Keep the same master face and proportions. Place ears touching the upper frame, face silhouette approximately 70 percent of total square. Targeted correction: remove ALL tonal variation from the eyes, face, fur, and #00AA46 backdrop. Each region must be one uniform solid colour, exactly specified hex, like a basic SVG.
Input image 1 is the identity master. Input image 2 is the edit target.
FINAL CORRECTION: redraw as digital vector art with ZERO interior tonal variation. Quantized flat ink regions only; not scanned paper, watercolor, print grain or airbrush. Fill every background pixel with the exact specified background colour. Keep all character shapes, layout and kind expressions from input 2. The only soft boundary is normal edge antialiasing, no colour drift inside shapes.
```

**jar-states.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green.
Four jam jars in a row on a white background, identical shape: a short wide glass jar with a dark green #004628 glass edge, a flat lid and a blank cream label. Jar 1 empty. Jar 2 one third full of S green #00AA46 with a flat top surface and two small berries floating. Jar 3 two thirds full. Jar 4 completely full with a mint #91FA9B lid and three small sparkle shapes around it.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
4:1 wide row. Exactly four jars, identical silhouette and scale: empty, one-third full, two-thirds full, completely full. Full jar has mint lid. All labels blank #F4F1E8. Model glass through nested solid silhouettes rather than a stroked contour. Uniform white background. No transparency, glass reflections, cast shadows or 3D; green contents have straight horizontal top surfaces.
REPAIR: Make output a true FOUR TO ONE width-to-height row, 4:1, not 3:1. Four identical short wide jars fit within the row with margin. Flatten every interior fill with exact palette colours. Keep fill levels and cream labels. Remove tonal variations from green, white and cream. Do not add stroked decorative outlines; glass edge only as originally specified.
FINAL PASS: absolutely flat uniform exact palette colours; no grain, no lighting, no shadows, no gloss. Preserve count, layout and blank labels. Desired exact aspect ratio 4:1, four wide jars in a short horizontal strip.
```

**shelf.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green.
A single wooden shelf drawn as one thick dark green #004628 line across an pale green #EBF7EC background. On it stand five jam jars of the same shape at different fill levels of green, each with a blank cream label, and one empty space marked by a dashed rounded outline. A small sprig with two leaves lies at the end of the shelf.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
16:9 landscape composition. Exactly five identical short wide jars at varied fill levels, plus one empty slot shown by separate rounded soft green dashes. Pale #EBF7EC background. A single thick dark #004628 shelf is an architectural filled block with rounded ends. Blank cream #F4F1E8 labels. Solid green forms only; no brown wood texture or realistic glass.
REPAIR: Correct the contents of ALL FIVE JARS to the same S green #00AA46, at varying heights. Do not change content colour from jar to jar. Keep dark #004628 shelf, same-shaped jars, blank cream labels, dashed empty slot, sprig. Flatten every region and background to one exact uniform fill; no tonal texture.
FINAL PASS: absolutely flat uniform exact palette colours; no grain, no lighting, no shadows, no gloss. Preserve count, layout and blank labels. All five contents exactly #00AA46. In particular recolour SECOND jar content to #00AA46 too. Only fill HEIGHT changes.
```

**basket-icons.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green.
Four simple filled icons in a row on white, each inside a pale mint #D2FCD5 rounded square tile: an anchor in dark green #004628; a lightning bolt in deep green #007841; a single water drop in S green #00AA46; a small jam jar in mint #91FA9B with an S green #00AA46 outline. Same visual weight, thick rounded forms. The four greens run from darkest to lightest, left to right.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
4:1 row, exactly four equal pale-mint rounded square tiles on pure white. Glyph order: dark #004628 anchor, deep #007841 lightning, S-green #00AA46 drop, mint #91FA9B jam jar. Equal optical weight, each glyph a simple solid filled silhouette. Jar: solid S-green base silhouette with mint inner filled area and mint lid, not a drawn stroke; no other outlines. No letters or labels.
REPAIR: The fourth icon must read as MINT, not S green: mint #91FA9B filled jar body and lid, with only a narrow #00AA46 edge as the source prompt specifies. Left to right is darkest to lightest. Widen canvas to true 4:1, not 3:1. Preserve four equal pale mint tiles. Remove all texture, tonal variation and shading, including inside glyphs and backgrounds.
FINAL PASS: absolutely flat uniform exact palette colours; no grain, no lighting, no shadows, no gloss. Preserve count, layout and blank labels. The jar must be a MINT filled silhouette with a narrow S-green edge, not an S-green jar with a mint label. Desired exact aspect ratio 4:1.
```

**receipt-blank.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green.
A long white paper shop receipt with a zigzag torn bottom edge, tilted four degrees, centred on a solid dark green #004628 background. The receipt is blank except for five faint pale-grey horizontal bars where text lines will go and one small green berry stamp at the bottom. No letters or numbers.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
Portrait 3:4. One flat WHITE receipt, no cast shadow, no paper texture, no crease. Whole background uniform #004628. Exactly five faint horizontal bars: use allowed #EBF7EC for these light placeholder bars instead of inventing a pale grey. No characters, numbers or barcode. Bottom berry stamp green. Torn zigzag edge as a flat silhouette.
REPAIR: Flatten the background to exactly #004628 and paper to #FFFFFF. Remove all fine texture and tonal shading. Keep exactly five pale-green bars and berry stamp. Rotate bars and stamp WITH the paper so they align naturally to the receipt. Receipt still tilted four degrees. No shadow.
FINAL PASS: Preserve the composition and contents. Only replace every non-uniform fill with a single flat exact specified palette colour. No texture or lighting. No strokes except the specified white die-cut border on stickers. This is basic clean vector art, not a photograph of printed art. Exact uniform background, no vignette.
```

**stickers.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green.
A grid of twelve die-cut stickers on an pale green #EBF7EC background, each with a thick white border and tilted a few degrees in different directions: a full jam jar with a mint lid; a flame in amber #CF8300; an S green drop with a plug in it; an S green berry; a green leaf; a steaming mint mug; a dark green anchor; a deep green lightning bolt; a paper receipt; a calendar page with a green tick; a small spruce tree; a green kite shape. No text.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
4:3 landscape sheet, exactly twelve stickers, four columns and three rows. White die-cut perimeter is part of each sticker, as specified, but there are no coloured strokes or shadows. Every object distinct. The one flame alone is #CF8300 amber. Everything else only specified greens and white, cream only on blank jar label. Calendar has a check mark with no date. Receipt has no text. Grid: jar/flame/plugged drop/berry; leaf/mug/anchor/lightning; receipt/calendar/spruce/kite.
REPAIR: Remove ALL gloss dots and curved shading from the berry; all jar, mug and paper surfaces must be flat filled. Keep 12 stickers, white cutout borders and 4-by-3 grid, no overlap. No cast shadows or gradients. Flame exactly #CF8300 only; no yellow. Use at most TWO flat palette tones for each object.
FINAL PASS: Preserve the composition and contents. Only replace every non-uniform fill with a single flat exact specified palette colour. No texture or lighting. No strokes except the specified white die-cut border on stickers. This is basic clean vector art, not a photograph of printed art. Exact uniform background, no vignette.
```

**berries-flame.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green.
Three marks in a row on white, each centred with space around it: one round S green #00AA46 berry made of small bumps with a tiny dark green leaf; a cluster of three such berries; a simple flame in amber #CF8300 with a lighter inner flame. Thick, rounded, icon-like.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
3:1 wide canvas. Exactly three groups spaced evenly: one bumpy S-green berry; a cluster of exactly three bumpy S-green berries; one simple #CF8300 amber flame. No yellow, orange or golden fill inside the flame: its lighter inner flame is a WHITE #FFFFFF inset silhouette, so all colours remain in the allowed palette. Leaves exactly dark #004628. No rings, outlines, gloss or shadows.
REPAIR: Keep three groups and exactly three berries in the middle cluster. Flatten all berries to solid #00AA46; leaves solid #004628; flame solid #CF8300 and white inset; background pure #FFFFFF. Remove every interior tonal change, shine, mottling and gradient.
FINAL PASS: Preserve the composition and contents. Only replace every non-uniform fill with a single flat exact specified palette colour. No texture or lighting. No strokes except the specified white die-cut border on stickers. This is basic clean vector art, not a photograph of printed art. Exact uniform background, no vignette.
```

**mood-forest-floor.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green.
A top-down view of a Finnish forest floor, simplified into flat shapes and drawn only in greens: moss in deep green, spruce twigs in dark green, fern fronds in S green, birch leaves in mint, lichen in pale mint and soft green, on a dark green #004628 ground. Arranged loosely like a colour swatch board, with clear space between the groups.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
Portrait 4:5 mood tile, completely overhead, not a landscape. Flat botanical swatch groups with generous dark #004628 negative space separating them. Only the seven exact approved green values, no grey/cream/amber here. Distinct simple moss cluster, spruce sprigs, fern, mint birch leaves, pale lichen. No texture or highlights on any leaf.
REPAIR: Flatten all backgrounds and botanical shapes to completely UNIFORM solid approved green fills. No grain or subtle shading. Keep overhead swatch arrangement. Spruce needles should be dark #004628 on a soft-green patch behind them to remain visible against the dark ground; do not add outlines.
FINAL FLAT-FILL CORRECTION: No rendering effects. Uniform palette colours in ALL regions. Remove background mottling and fine tonal variation, leaving the exact solid specified background. Preserve composition, correct body and filled shapes; no new shapes, details or text.
```

**mood-pantry.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green.
A cosy cellar pantry wall seen straight on: three shelves of jam jars filled with green at different levels, a few with mint lids, cream labels left blank, one small window with pale light. Dark green #004628 wall, pale green shelves. Tidy, warm, quiet.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
Portrait 4:5. Exactly three flat pale green shelf blocks on dark #004628 wall. Short wide jars with flat horizontal green fills and blank cream labels, a few mint lids. A single small window gives pale mint flat light, not rays, glow, gradient, shadows or a realistic illumination effect. Calm, tidy frontal arrangement. No brown or yellow.
REPAIR: Remove all tonal texture and interior shading from dark wall, shelf blocks, jars, window and blank cream labels. Preserve three shelves, jars with distinct fill heights, mint lids and single small window. Every region a precise flat palette fill.
FINAL FLAT-FILL CORRECTION: No rendering effects. Uniform palette colours in ALL regions. Remove background mottling and fine tonal variation, leaving the exact solid specified background. Preserve composition, correct body and filled shapes; no new shapes, details or text.
```

**mood-payday-glide.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green. CHARACTER "Liito": a Siberian flying squirrel mascot. Body is one rounded dumpling shape, head and body merged, slightly taller than wide. Fur is soft warm grey #B9C2BD with a cream #F4F1E8 belly and face. Very large round near-black eyes #0B1F16, each with one white highlight; each eye is about one third of the face width. Small round ears. Tiny mouth. Round cheeks with a faint mint glow only when happy. A flat, wide, feather-like grey tail. A gliding membrane stretches between front and back paws: grey on the outside, S green #00AA46 on the inside, visible only when the arms are spread. No clothes. No outline. Emotion comes from the eyes, ears and arms. Never angry, sad or crying.
Liito gliding diagonally across a wide S green #00AA46 sky from a spruce treetop toward a large mint #91FA9B sun shaped like a berry. Simple spruce tree shapes along the bottom edge. Fast, light, joyful. In this image the inside of the membrane is dark green #004628.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
Portrait 4:5 tile with an open band of S-green sky across its middle. Attached selected master is the character identity reference. One Liito glides diagonally from lower left spruce treetop toward upper right mint berry sun. Character all grey/pale except inner membrane DARK #004628 as this source prompt explicitly requires on an S-green sky. No lighting effects, speed lines or extra characters. Keep paws and tail in frame.
REPAIR: Preserve diagonal motion, master character proportions, dark membrane on S-green background and mint berry sun. Remove the narrow pale curved string/rim along the left side of the membrane: continuous membrane connected directly to grey arms and hind paws, no outlines. Remove all tonal texture and colour drift from the sky, body and trees.
FINAL FLAT-FILL CORRECTION: No rendering effects. Uniform palette colours in ALL regions. Remove background mottling and fine tonal variation, leaving the exact solid specified background. Preserve composition, correct body and filled shapes; no new shapes, details or text.
```

**mood-tight-week.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green. CHARACTER "Liito": a Siberian flying squirrel mascot. Body is one rounded dumpling shape, head and body merged, slightly taller than wide. Fur is soft warm grey #B9C2BD with a cream #F4F1E8 belly and face. Very large round near-black eyes #0B1F16, each with one white highlight; each eye is about one third of the face width. Small round ears. Tiny mouth. Round cheeks with a faint mint glow only when happy. A flat, wide, feather-like grey tail. A gliding membrane stretches between front and back paws: grey on the outside, S green #00AA46 on the inside, visible only when the arms are spread. No clothes. No outline. Emotion comes from the eyes, ears and arms. Never angry, sad or crying.
Liito wrapped in a mint blanket, holding a mug, sitting inside a round tree hollow at night. Outside, a few soft snowflakes on a dark green #004628 background. A small amber #CF8300 glow inside the hollow, the only warm colour in the image. Safe, warm and calm.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
Portrait 4:5. Character identity reference is selected master. ONE Liito with calm relaxed eyes, wrapped in a mint #91FA9B blanket and holding a plain mug, in a round dark-green tree hollow. Absolutely NO brown tree or yellow lamplight. Depict the small permitted warm glow as a HARD EDGED flat disc/oval of #CF8300 behind Liito, not a gradient, halo blur or simulated lighting. Keep it small inside hollow only. Grey/pale face remains un-recoloured. Snowflakes white or pale mint. No stars, text or clothing beyond situational blanket.
REPAIR: Keep calm master Liito in the mint blanket holding the white mug, green tree hollow, three snowflakes and small flat amber disc. Flatten ALL interiors and background to solid precise palette colours; remove texture, light modelling and gradients. No outline around blanket folds; folds can be separate solid mint/soft-green regions.
FINAL FLAT-FILL CORRECTION: Uniform exact palette fills only, no mottling, no soft lighting, no shadows, no gradients. Keep all shapes, props, kind expressions and spacing. Do not change the character identity or add details.
```

**mood-celebration.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green. CHARACTER "Liito": a Siberian flying squirrel mascot. Body is one rounded dumpling shape, head and body merged, slightly taller than wide. Fur is soft warm grey #B9C2BD with a cream #F4F1E8 belly and face. Very large round near-black eyes #0B1F16, each with one white highlight; each eye is about one third of the face width. Small round ears. Tiny mouth. Round cheeks with a faint mint glow only when happy. A flat, wide, feather-like grey tail. A gliding membrane stretches between front and back paws: grey on the outside, S green #00AA46 on the inside, visible only when the arms are spread. No clothes. No outline. Emotion comes from the eyes, ears and arms. Never angry, sad or crying.
A celebration scene on a solid S green #00AA46 background: Liito in the centre holding a full jam jar above its head, eyes closed in a smile, surrounded by large simple confetti shapes: circles, leaves and berries in dark green, white, mint and pale mint. Lots of empty green space at the top and bottom for a headline and a button.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
Portrait 4:5. ONE Liito exactly like attached master, eyes closed in kind smile, holding a full green jam jar above head with both paws. Grey body, pale belly, S-green membrane if visible; it must join front and back paws, not be separate wings. Blank jar label. Flat S-green #00AA46 backdrop. Confetti only dark green, mint, pale mint and white. No amber here. Keep upper 20 percent and lower 20 percent entirely empty, for UI text added later. No text in illustration.
REPAIR: Keep the character kind and eyes closed in smile; master proportions, raised jar, simple confetti and blank top/bottom areas. Jar contains solid green savings fill, not loose white coins or money; remove little round bead shapes inside the jar. No cash or currency. Flatten all surfaces, background and confetti to uniform palette fills.
FINAL FLAT-FILL CORRECTION: Uniform exact palette fills only, no mottling, no soft lighting, no shadows, no gradients. Keep all shapes, props, kind expressions and spacing. Do not change the character identity or add details.
```

**mood-pattern.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green.
A seamless repeating pattern on an pale green #EBF7EC background: small scattered berries in S green, deep green and mint, soft green leaves, tiny jam jars and kite shapes, evenly spaced, slightly rotated, no overlaps. Light and airy, suitable as a subtle background.
Use exactly the supplied colours as solid, uniform flat fills; no dithering, grain, lighting, vignettes or texture. No outlines on any shape. Where the source prompt describes a glass edge or lid, use overlapping solid silhouettes, not drawn strokes. All labels are blank. No letters, numbers, logos, watermarks, euro signs or banknotes.
Portrait 4:5 repeat tile. All four edges must meet seamlessly when tiled both horizontally and vertically: ensure edge-crossing motifs continue at opposite edges in the same position and orientation. Pale-green #EBF7EC background completely uniform, no texture. Small scattered bumpy berries, leaves, blank-label tiny jars and flat rounded kite silhouettes, consistent scale, airy spacing, varied slight rotations. No strings or thin lines. Only seven brand greens and white; no mascot, grey, cream or amber.
REPAIR: Fix tile boundaries. Remove every clipped motif touching a canvas edge. Keep all motifs whole inside the canvas with half the normal inter-motif spacing as an edge margin, so paired margins form the normal gap when repeated. Uniform pale #EBF7EC background across all edges. No gradient or texture. No curved shading inside leaves; only two flat approved tones. No overlap.
FINAL FLAT-FILL CORRECTION: Uniform exact palette fills only, no mottling, no soft lighting, no shadows, no gradients. Keep all shapes, props, kind expressions and spacing. Do not change the character identity or add details. Keep all motifs away from edges and ensure all edge pixels have exactly the same #EBF7EC value; no clipped motifs.
```

**mood-forest-pantry.png — selected attempt 3**

```text
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these; it is the S-Pankki mobile app's palette): dark green #004628, deep green #007841, S green #00AA46, soft green #99D59F, mint #91FA9B, pale mint #D2FCD5, pale green #EBF7EC, white #FFFFFF, plus squirrel grey #B9C2BD, cream #F4F1E8 and eye black #0B1F16 for the mascot, and amber #CF8300 only where a prompt asks for a flame or a warm glow. No pink, violet, gold, orange, yellow or neon green.
A wide 16:9 Finnish forest pantry illustration, no mascot. Preserve the attached composition: broad dark-green spruce boughs framing the left, rounded green birch leaves at the top/right and a quiet pale green clearing in the left two thirds; in the right third one thick dark-green shelf holds three identical short wide jars at three different green fill heights, with mint lids and blank white labels. A small cluster of green berries and a sprig on the shelf. Only seven approved greens and white. Absolutely uniform flat #EBF7EC clearing and solid #004628, #007841, #00AA46, #99D59F, #91FA9B, #D2FCD5 and #FFFFFF shapes. No grey, cream, amber, outlines, gradients, texture, lighting, gloss, shadows or letters. Maintain composition; replace every shaded region with completely uniform flat fill.
REPAIR PASS: Preserve the composition and all silhouettes. The only change is to remove EVERY gradient, shade, mottled pixel and lighting variation. Single solid exact palette fill per shape; background clearing solid #EBF7EC, three jar contents flat with horizontal tops. No gloss, outline, noise or texture. Output 16:9.
FINAL PASS: No interior texture or tonal change at all. Exact uniform palette regions, straight horizontal jar fill levels, solid clearing #EBF7EC. Keep the same forest/pantry scene with three green jars, same visual hierarchy, no new objects. No lettering or mascot.
```

</details>
