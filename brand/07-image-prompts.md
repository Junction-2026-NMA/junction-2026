# 07 · Image prompts

Status: v0.1, 2026-11-13. **No images have been generated yet.** They are to be made with gpt-6.1-sol at xhigh effort through T3 delegation, which was not connected when this was written. Save results to [`moodboard/generated/`](../moodboard/) with the file names below.

## How to use these prompts

1. Generate **A1 (Liito master sheet)** first and get it approved.
2. Attach the approved A1 as a reference image to every later prompt that includes Liito, so the character stays the same.
3. Paste the **style block** at the top of every prompt.
4. Ask for flat colour and the exact hex values. If a result has gradients, outlines, 3D shading or text, regenerate.
5. Images contain no text, except the receipt (B4), where the text is added afterwards in the UI.

## Style block (paste first, every time)

```
STYLE: Flat vector illustration. No outlines, no gradients, no 3D render, no glossy or plastic look, no drop shadows, no texture, no text or letters. Chunky, simple, rounded shapes. At most two tones per colour: the base colour and one slightly darker shade for depth. Generous empty space. Crisp edges. Friendly and modern, for a Finnish money-coaching app for young adults.
PALETTE (use only these): aurora green #00EB5A, S green #00AA46, deep green #007841, spruce #004628, mint #91FA9B, pale mint #D2FCD5, oat #FBF8F1, white #FFFFFF, lingonberry pink #D81E5B, cloudberry gold #FFC233, bilberry violet #4B4BD8, campfire orange #FF7A1A, squirrel grey #B9C2BD, cream #F4F1E8, eye black #0B1F16.
```

## Character block (paste when Liito appears)

```
CHARACTER "Liito": a Siberian flying squirrel mascot. Body is one rounded dumpling shape, head and body merged, slightly taller than wide. Fur is soft warm grey #B9C2BD with a cream #F4F1E8 belly and face. Very large round near-black eyes #0B1F16, each with one white highlight; each eye is about one third of the face width. Small round ears. Tiny mouth. Round cheeks with a faint pink blush only when happy. A flat, wide, feather-like grey tail. A gliding membrane stretches between front and back paws: grey on the outside, bright aurora green #00EB5A on the inside, visible only when the arms are spread. No clothes. No outline. Emotion comes from the eyes, ears and arms. Never angry, sad or crying.
```

## A · Mascot

| ID | File | Format |
|---|---|---|
| A1 | `liito-master-sheet.png` | 3:2, oat background |
| A2 | `liito-moods.png` | 4:2 grid, oat background |
| A3 | `liito-glide.png` | 1:1, transparent or aurora background |
| A4 | `app-icon.png` | 1:1, aurora background |

**A1 · Master sheet**

```
[STYLE] [CHARACTER]
A character model sheet of Liito on a plain oat #FBF8F1 background: front view standing, three-quarter view, side view, back view showing the flat tail, and one front view with arms spread wide so the aurora green inside of the gliding membrane shows as a kite shape. Same size and proportions in every view, evenly spaced in one row.
```

**A2 · Eight moods**

```
[STYLE] [CHARACTER]
A grid of eight poses of Liito, four per row, on an oat #FBF8F1 background, same size in each cell:
1 cheering with both arms up and the green membrane open;
2 proud, eyes closed in a smile, hugging a jam jar filled with green;
3 gliding, seen from the front, fully spread;
4 curious, head tilted, one ear down;
5 surprised with wide eyes, holding a magnifying glass over a single pink drop;
6 focused, leaning forward, holding one gold berry;
7 cosy, wrapped in a mint blanket holding a steaming mug;
8 sleepy, yawning on a short branch.
```

**A3 · Signature glide**

```
[STYLE] [CHARACTER]
Liito gliding straight toward the viewer, arms and legs spread, the membrane forming a rounded kite shape in aurora green, tail trailing behind, big happy eyes. Centred, with a few simple leaves and three gold berries drifting past. Plain aurora green #00EB5A background, so use spruce #004628 for the membrane's inside in this image only.
```

**A4 · App icon**

```
[STYLE] [CHARACTER]
A square app icon. Liito's face only, cropped close, filling about 70 percent of the square: two huge black eyes with white highlights, cream face, grey fur, small round ears touching the top edge. Solid aurora green #00EB5A background. Very simple, readable at 60 pixels.
```

## B · Objects and system graphics

| ID | File | Format |
|---|---|---|
| B1 | `jar-states.png` | 4:1 row, white background |
| B2 | `shelf.png` | 16:9, oat background |
| B3 | `basket-icons.png` | 4:1 row, white background |
| B4 | `receipt-blank.png` | 3:4, spruce background |
| B5 | `stickers.png` | 4:3 grid, oat background |
| B6 | `berries-flame.png` | 3:1 row, white background |

**B1 · Jar, four states**

```
[STYLE]
Four jam jars in a row on a white background, identical shape: a short wide glass jar with a spruce #004628 glass edge, a flat lid and a blank cream label. Jar 1 empty. Jar 2 one third full of S green #00AA46 with a flat top surface and two small berries floating. Jar 3 two thirds full. Jar 4 completely full with a cloudberry gold #FFC233 lid and three small sparkle shapes around it.
```

**B2 · Shelf**

```
[STYLE]
A single wooden shelf drawn as one thick spruce #004628 line across an oat #FBF8F1 background. On it stand five jam jars of the same shape at different fill levels of green, each with a blank cream label, and one empty space marked by a dashed rounded outline. A small sprig with two leaves lies at the end of the shelf.
```

**B3 · Basket icons**

```
[STYLE]
Four simple filled icons in a row on white, each inside a rounded square tile: an anchor in bilberry violet #4B4BD8 on a pale violet tile #E6E6FF; a lightning bolt in cloudberry gold #FFC233 on a pale gold tile #FFF1CC; a single water drop in lingonberry pink #D81E5B on a pale pink tile #FFE3EC; a small jam jar in S green #00AA46 on a pale mint tile #D2FCD5. Same visual weight, thick rounded forms.
```

**B4 · Blank receipt**

```
[STYLE]
A long white paper shop receipt with a zigzag torn bottom edge, tilted four degrees, centred on a solid spruce #004628 background. The receipt is blank except for five faint pale-grey horizontal bars where text lines will go and one small green berry stamp at the bottom. No letters or numbers.
```

**B5 · Sticker set**

```
[STYLE]
A grid of twelve die-cut stickers on an oat #FBF8F1 background, each with a thick white border and tilted a few degrees in different directions: a full jam jar with a gold lid; a campfire flame in orange; a pink drop with a plug in it; a gold berry; a green leaf; a steaming mint mug; a blue-violet anchor; a gold lightning bolt; a paper receipt; a calendar page with a green tick; a small spruce tree; a green kite shape. No text.
```

**B6 · Berries and flame**

```
[STYLE]
Three marks in a row on white, each centred with space around it: one round cloudberry-gold #FFC233 berry made of small bumps with a tiny green leaf; a cluster of three such berries; a simple campfire flame in campfire orange #FF7A1A with a lighter inner flame. Thick, rounded, icon-like.
```

## C · Mood board tiles

These set the feeling of the brand. Each is a 4:5 tile.

| ID | File | Idea |
|---|---|---|
| C1 | `mood-forest-floor.png` | Where the colours come from |
| C2 | `mood-pantry.png` | Saving as putting things by for winter |
| C3 | `mood-payday-glide.png` | Motion and energy |
| C4 | `mood-tight-week.png` | Calm and safety |
| C5 | `mood-celebration.png` | The big-win screen |
| C6 | `mood-pattern.png` | A repeat pattern for backgrounds |

**C1**

```
[STYLE]
A top-down view of a Finnish forest floor, simplified into flat shapes: lingonberries in pink-red, bilberries in violet, cloudberries in gold, moss in deep green, a few birch leaves in mint, on a spruce #004628 ground. Arranged loosely like a colour swatch board, with clear space between the groups.
```

**C2**

```
[STYLE]
A cosy cellar pantry wall seen straight on: three shelves of jam jars filled with green at different levels, a few with gold lids, cream labels left blank, one small window with pale light. Spruce #004628 wall, oat shelves. Tidy, warm, quiet.
```

**C3**

```
[STYLE] [CHARACTER]
Liito gliding diagonally across a wide aurora green #00EB5A sky from a spruce treetop toward a large gold sun shaped like a berry. Simple spruce tree shapes along the bottom edge. Fast, light, joyful. In this image the inside of the membrane is spruce #004628.
```

**C4**

```
[STYLE] [CHARACTER]
Liito wrapped in a mint blanket, holding a mug, sitting inside a round tree hollow at night. Outside, a few soft snowflakes on a spruce #004628 background. A small campfire-orange glow inside the hollow. Safe, warm and calm.
```

**C5**

```
[STYLE] [CHARACTER]
A celebration scene on a solid aurora green #00EB5A background: Liito in the centre holding a full jam jar above its head, eyes closed in a smile, surrounded by large simple confetti shapes: circles, leaves and berries in spruce, white, gold and pink. Lots of empty green space at the top and bottom for a headline and a button.
```

**C6**

```
[STYLE]
A seamless repeating pattern on an oat #FBF8F1 background: small scattered berries in pink, gold and violet, green leaves, tiny jam jars and kite shapes, evenly spaced, slightly rotated, no overlaps. Light and airy, suitable as a subtle background.
```

## Checks before accepting an image

- Only palette colours, no gradients, no outlines.
- Liito matches the master sheet: grey fur, cream belly, huge black eyes, green only inside the membrane.
- Liito is never sad, angry or crying.
- No text, logos, euro signs or banknotes.
- No Appllama watermark and nothing that copies a reference app's screen or character.
- The image still reads at 25 % size.
