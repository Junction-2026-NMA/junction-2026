# 08 · Liito character specification

Status: v0.2 draft, 13 November 2026. A drawing and implementation handoff for the Liito proposed in [`02-identity.md`](02-identity.md). The name and character still await the team's confirmation. The generated sheets below are concept references, not approved vector masters or production animation assets.

## The character

Liito is Hillo's Siberian flying squirrel: a small, rounded companion who makes money feel easier to approach. The character is playful, straight and on the user's side. Liito notices, explains and cheers an action. Liito never judges a balance.

The signature is **a grey dumpling, huge dark eyes, a pale face and a green glide**. Keep all four together. Do not turn Liito into an owl, a bat, a bushy-tailed red squirrel or a person in an animal costume.

## Construction locked by the kit

These rules come from the identity chapter. Preserve them across every view, pose and export.

| Part | Construction rule |
|---|---|
| Body | One soft rounded mass with head and body merged. Standing body width to height is approximately **1 : 1.1**, excluding ears, paws and tail. No separate head on a narrow neck. |
| Face and belly | Pale face and belly set into the grey body. Keep the face shape and the belly's position consistent when the body turns. |
| Eyes | Very large and round. Each eye is approximately **one third of the face width**. Each open eye has one white highlight. No extra sparkles, eyelashes or human eyebrows. |
| Ears | Small, round, set high. Ear angle can carry expression; do not lengthen them into rabbit ears or add pointed tufts. |
| Nose and mouth | Tiny and simple. Most expression comes from eyes, ears and arms; the mouth never becomes the dominant feature. |
| Paws | Small, rounded forepaws and hind paws. No detailed fingers, claws or human hands. |
| Gliding membrane | A continuous soft web between each forepaw and hind paw. Grey outside, S green inside. It opens when the limbs spread and folds close at rest. It is part of the body, not clothing or a pair of separate wings. |
| Tail | Flat, wide and feather-like, with a rounded tip. Curls around the body at rest; trails behind during a glide. No fluffy bottlebrush, rings or pointed fox tail. |
| Cheeks | Round. A small mint accent is allowed for pride or shyness; no pink blush. |
| Wardrobe | None. A blanket is a situational prop, never a permanent outfit. No scarf, hat, suit, shoes or jewellery. |
| Rendering | Flat colour, crisp edges, chunky shapes and no outline. At most two tones per colour; use only defined palette values. No gradients, texture, glossy highlights, 3D shading or drop shadows. |

### Proposed drawing refinements

These make the first sheets consistent; they do not replace the kit's established proportions. Confirm them when selecting the master.

- Build the neutral front view symmetrically. Let pose, ears and a slight head tilt add expression in the other states.
- Keep the eye highlights in the same upper corner relative to the face. When the eyes close, use two simple soft arcs and remove the highlights.
- Use two rounded cheek areas that meet the belly naturally. Avoid a separate heart, mask or moustache shape becoming a new logo.
- Show a small tail edge in the front view and its full flat silhouette in side and back views.
- In the open pose, draw one rounded kite silhouette with the torso still visible. The membrane must connect to both hind paws; avoid fingers, ribs and bat-wing scallops.
- Keep the same body mass in every state. A stretch for a glide is a pose change, not a thinner or older version of Liito.

## Palette

The current identity's **S green membrane** and **mint cheeks** take precedence over the old aurora membrane and pink blush in [`07-image-prompts.md`](07-image-prompts.md). The mood board and surrounding UI follow [`04-colors.md`](04-colors.md) v0.2.

| Role | Value | Source and scope |
|---|---|---|
| Fur and outside membrane | `#B9C2BD` | Existing mascot neutral in `02-identity.md`; character only. |
| Face and belly | `#F4F1E8` | Existing mascot pale neutral in `02-identity.md`; character only, never a cream UI background. |
| Eyes, tiny nose and mouth | `#0B1F16` | Existing mascot eye colour in `02-identity.md`; character only, never body text. |
| Eye highlight | `--white` · `#FFFFFF` | One highlight per open eye. |
| Inside membrane | `--green-500` · `#00AA46` | Fixed across all backgrounds; do not swap to aurora or spruce. |
| Optional proud cheek accent | `--green-200` · `#91FA9B` | Small flat accent, without a glow effect. |
| Jar, berry and prop accents | Existing green tokens | Apply the same object colours as the rest of Hillo. No gold lid or pink drop. |
| Branch or dark prop detail | `--green-900` · `#004628` | A simple filled shape, without a stroke. |

The three mascot neutrals above are inherited character values, not new brand hues. They are not present in the core `tokens.css` at this writing. Register them as dedicated mascot tokens before application integration; do not scatter hard-coded values through components. Preserve the core UI's green and status-colour roles. No other colour exceptions are proposed.

Do not recolour Liito for dark mode. Change the surrounding surface. Use a light backing tile when a small dark eye or a green membrane loses definition; never solve it with an outline or a shadow.

## Five-view model sheet

Draft artwork: [`liito-master-sheet.png`](../moodboard/generated/liito-master-sheet.png).

Use one baseline, equal standing scale and consistent facial proportions. Keep generous space between the views. No labels should be baked into the illustration; add view names as editable text in the board.

| Order | View | What it must establish |
|---|---|---|
| 1 | Front, standing | The neutral silhouette, open eyes, small paws, folded membrane and a glimpse of the tail. |
| 2 | Three-quarter | How the near eye, far eye, cheek, belly and ear turn together without sliding around the body. |
| 3 | Side | The shallow muzzle, merged head/body profile, membrane folded against the flank and broad flat tail. |
| 4 | Back | Grey outer membrane, ear placement and tail attachment. No face or belly visible through the body. |
| 5 | Front, arms spread | Green inner membrane connecting forepaws to hind paws, with the same face and body as view 1. |

Treat an inconsistent angle as a drawing to repair. Do not average five different generated characters into a master.

## Eight states

Draft artwork: [`liito-moods.png`](../moodboard/generated/liito-moods.png). Use the selected model sheet as the reference for every later image. The eight-pose sheet is a design document; the product still shows at most one Liito on a screen.

| State | Trigger | Pose and expression | Suggested text alternative |
|---|---|---|---|
| Cheering | The user completes a check-in, sorts a transaction or finishes another small action. | Arms up, membrane open, eyes bright, tiny smile. | “Liito cheers your completed action.” |
| Proud | An effort milestone or a savings goal is completed. | Eyes closed in a soft smile, hugging a jar; optional mint cheeks. The response celebrates the user's action, not their wealth. | “Liito hugs a jar to celebrate your progress.” |
| Gliding | Moving between learning steps or a short loading transition. A payday greeting can use the same pose without a reward. | Front-facing, limbs spread, rounded kite membrane and tail trailing. Alert and relaxed. | “Liito glides to the next step.” |
| Curious | The user asks a question or explores their own data. | Head tilted, one ear lower, forepaws relaxed, open attentive eyes. | “Liito listens to your question.” |
| Found something | A supported finding, such as an unused subscription, is ready to explain. | Attentive wide eyes and a small magnifier or green drop. No alarmed mouth or recoil. | “Liito has a finding to show you.” |
| Focused | A lesson or a task needs attention. | Leaning in, ears forward, holding one green berry. Calm concentration. | “Liito focuses on the lesson.” |
| Cosy | The user selects tight-week mode or accepts an offer to pause a savings action. | Mint blanket and a mug, relaxed eyes, comfortable posture. Never shivering, worried or hungry. | “Liito rests with a blanket and a mug.” |
| Sleepy | A daily action is still available. | A gentle yawn on a short branch; relaxed ears, safe resting pose. Never a reproachful stare. | “Liito rests while today's action waits.” |

Alt text should describe the meaning in context. If the adjacent text already conveys the full state and the picture adds no information, mark the image decorative instead of announcing the same message twice.

### State rules

- A purchase, low balance, missed day or debt never makes Liito sad, angry, disappointed, frightened or less healthy.
- Keep Liito's size, fur, home and appearance independent of the user's wealth. No luxury upgrades or decay tied to euros.
- Berries reward effort. Never show them as money, something to buy or something the user can lose.
- A full jar may earn a proud pose, but never invent a saving or promise a return. A failed transfer gets plain error UI with no mascot.
- Do not put Liito in a payment confirmation, a transaction list, a money error or legal text. One small home appearance is enough.
- No cash, banknotes, euro symbols, begging bowl, gambling props or pointing at the user. No sales pose for credit or investing.
- Tight-week and missed-day copy is gentle and factual. No “Liito misses you”, guilt, fake urgency or pressure to open the app.

## Size and placement

The following sizes reuse the kit's existing grid and component values; their use for Liito is a proposed implementation rule.

| Use | Size and treatment |
|---|---|
| Chat avatar | **32 × 32**, as specified in `06-specifications.md`. Face crop only: retain both eyes and both ears, omit paws, tail, cheek accents and props. |
| Compact companion | **64 × 64**. Use a simple front or curious pose. Keep the eyes readable and avoid a detailed prop. |
| Home or lesson spot | **96 × 96**. Full body where space permits, one simple gesture, no competing hero number. |
| Sticker or milestone | **72–120** across, matching the sticker component. A white die-cut border belongs to the sticker container, not Liito's illustration. |
| Onboarding or celebration | Scale the full pose to the available illustration area with a minimum **16** clear space around it. Leave the headline and primary action room to lead. |

At 32 pixels, recognition comes from ears, huge eyes and the pale face. Do not shrink a full gliding pose into the chat avatar. Check at the actual rendered size as well as at 25% of the master image. If the eyes merge or the face becomes indistinct, simplify the crop rather than adding detail.

Keep the image separate from the touch target. An actionable avatar still needs a target of at least **48 × 48** and an accessible name describing what opens.

## Motion

Use the motion tokens in [`06-specifications.md`](06-specifications.md). A pose must communicate its meaning while still.

| Moment | Treatment |
|---|---|
| Arriving | A short glide from a top corner using `--duration-base` (**250 ms**) and `--ease-out`; finish with a soft landing. |
| Small completed action | One brief arm lift or pose change using `--duration-fill` (**600 ms**). The reward stays beside the completed action. |
| Big milestone | One glide or proud pose with the celebration; confetti uses `--duration-celebrate` (**1200 ms**). At most one big win per session. |
| Idle | Optional slow blink or breath for a short, finite animation. No perpetual bounce, repeated demand for attention or sound by default. |
| Loading | A static glide pose beside an accessible progress indicator. Never keep an animation running to conceal a failed or stalled request. |
| Reduce motion | Static final pose, or a fade using `--duration-fast` (**150 ms**). No glide, bounce, overshoot, breathing loop or confetti. |

All animation stops within five seconds. Decorative movement stays out of the accessibility tree. Do not announce each frame or autoplay a sound.

## Production handoff

The current PNG sheets establish a visual direction. Before shipping, redraw the selected character as a clean vector master and correct generation inconsistencies. Do not label a raster illustration “SVG” by embedding the PNG in an SVG wrapper.

| Deliverable | Required contents |
|---|---|
| Editable master | A vector file with named layers for body, face/belly, eyes/highlights, ears, paws, inner/outer membrane, tail and props. One consistent character across views. |
| Static poses | One genuine vector SVG per state, no embedded raster, text, font dependency or effects. Use a consistent viewBox and baseline. |
| Raster fallback | Transparent PNG exports at 1×, 2× and 3× for each intended display size. Preserve alpha; no baked-in card, label or background. |
| Avatar | A dedicated face crop checked at 32 pixels and its higher-density exports. The app icon is a separate asset, on S green as defined in the identity chapter. |
| Motion, if built | Named start/end poses, reusable parts, a static poster frame and the reduced-motion alternative. Choose an animation format that the product stack supports. |
| Asset manifest | State name, trigger, file path, intrinsic dimensions/viewBox, text alternative or decorative status, version and approval state. |

The five-view sheet and eight-state grid should remain available as review images. Product assets must be exported separately; never crop arbitrary cells from a sheet at runtime.

## Acceptance before production

- [ ] Front, side, back and open views describe the same body and the same flat tail.
- [ ] Open membrane joins forepaws and hind paws; its inside is S green, never aurora.
- [ ] Grey fur, pale face and eye values match the identity; dedicated mascot tokens exist before UI use.
- [ ] No outline, gradient, shadow, texture, glossy effect, clothing or unapproved colour.
- [ ] Eight states remain kind and their triggers follow effort or context, never a balance.
- [ ] No text, banknotes, euro symbols, third-party logos or watermarks are baked into the art.
- [ ] Face reads at 32 pixels; full body reads at 64 and 96 pixels in both themes.
- [ ] PNG transparency and vector paths are checked in the actual exported files.
- [ ] Alt text, decorative status, reduced motion and one-mascot-per-screen rules are implemented.
- [ ] Team has selected a master; all later character images use that reference.

## Source status

This spec follows the current v0.2 identity, colour and UI chapters. The v0.1 prompts in chapter 07 still mention oat backgrounds, aurora membranes, pink cheeks and gold berries. Update those prompts before reusing them. They do not override the current identity.

The kit's general “no cream” UI rule and Liito's existing pale face value need a narrow distinction: keep the inherited neutral inside the character only. This document makes that distinction explicit; it does not introduce cream into the UI palette. Mascot token registration, master selection and production vector/animation delivery remain separate checks, not claims made by the concept sheets.
