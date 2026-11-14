# Sisu Rive library

`rive/sisu-ui` is the source of `ios/Sisu/Resources/Rive/sisu_ui.riv`: 22 artboards written as text (RML) and built with the Rive CLI. `rive/contract.json` is the contract with the Swift app. Artboard, view model, property and enum names, types and defaults are fixed by it. Visuals are free. There are no scripts in the file, so it loads unsigned.

## Build

    sh rive/build.sh        # from the repository root: verify, build, copy to ios/Sisu/Resources/Rive/

## How it is organised

    rive/sisu-ui/
      rive.yaml             project name (sisu_ui) and default artboard
      00_shared.rml         fonts, the 13 enums, shared converters           ids 0:n
      01_button.rml ...     one artboard and its view model per file         ids 1:n ... 22:n
      17_tag.rml            (file order = contract order = artboard order in the .riv)
      18_baskets.rml        Baskets: three baskets and a jam jar, each filled to its share
      19_berries.rml        Berries: a pile of berries in a dish, with a `drop` trigger
      20_icon_button.rml    IconButton: round pressable icon button, eight icons, three styles
      21_lesson_node.rml    LessonNode: one node of the learning path (upcoming, current, done)
      22_typing_dots.rml    TypingDots: three dots that bounce in turn while Sisu is thinking
      fonts/                Figtree Regular, SemiBold, Bold; Bricolage Grotesque ExtraBold
      build/                ignored: sisu_ui.riv, logs, shots/

Every artboard file reads top to bottom: a header comment (contract table, how it works), the `ViewModel`, then the `Artboard` with its scene (first sibling draws on top), the state machine `Main`, and the timelines. Ids are `client:number`, one namespace for the whole project. Each file has its own client number, so a new element just takes the next free number in its file.

## Authoring loop

    export RIVE_ANALYTICS=off RIVE_NO_TUI=1
    rive rive/sisu-ui --verify                                  # compiles and would load
    rive inspect rive/sisu-ui --json | jq '.problems'           # must be []
    rive rive/sisu-ui --artboard=Button --advance=30 --screenshot=rive/sisu-ui/build/shots/x.png \
         --data=style=secondary --viewport=300x60               # look at the PNG
    rive rive/sisu-ui --artboard=Button --advance=10 --pointer=click@100,30 --advance=30 --data-dump-every=1
    grep fired rive/sisu-ui/build/sisu_ui.data.jsonl            # {"path": "pressed", "fired": true}

Neither `--verify` nor `inspect` looks at a pixel or clicks anything. After a change, render the artboard with the data that exercises it, and for anything pressable count the `fired` lines.

## Patterns

- **View model.** One `ViewModel` named `<Artboard>VM` per file with one exported instance `Default` holding the contract defaults. The artboard points at it with `viewModelId` (and `viewModelInstanceId` for the editor). Bind paths are absolute: `sourcePathIds="<view model id>-<property id>"`.
- **Enums.** `DataEnumCustom` in `00_shared.rml`; `key` is the contract value. Property: `ViewModelPropertyEnumCustom enumId=..`. Default: `ViewModelInstanceEnum propertyValue="<value id>"`.
- **Bound text.** `<TextValueRun text=""><DataBindContext sourcePathIds=".." propertyKey="268"/></TextValueRun>`. The authored text is empty, so no copy lives in the file.
- **A look per enum value.** One layer, one state per value, `AnyState` transitions with a `TransitionViewModelCondition` (`BindablePropertyEnum` against `TransitionValueEnumComparator`). Each state plays a one-key timeline that sets colours (`KeyFrameColor`) and which child a `Solo` shows (`KeyFrameId` on `activeComponentId`). Looks that are set once (Button `style`/`enabled`, Tag `tone`, StatPill `kind`, Sticker `kind`, ProgressBar `tone`, BasketChip `basket`) switch with duration 0, so the first frame is already right. Looks that change on screen (ChoiceCard `state`, VoiceButton `state`, StageIndicator `stage`, Liito `mood`) blend for 120 to 200 ms.
- **Booleans and `selected`.** Two states with a conditioned transition each way. The `EntryState` has two transitions, the first one conditioned, so the layer starts in the right state without a blend (Toggle, ActionRow, Jar `full`, Button `loading`, TabBar tabs).
- **Numbers.** Bound into geometry through converters from `00_shared.rml`: a box's flex weight (`fractionalWidth`, key 706) for BasketBar and ProgressBar, `displayValue` (key 596) to drop a zero segment, a rectangle's `height` (key 21) for the jam in Jar. `ease to new value` (a `DataConverterInterpolator`, 0.6 s, cubic with `y1` above 1) makes them spring to a value the app writes, overshooting it by about 7 % of the change. Where the overshoot must not leave the valid range (a flex weight, a height), a clamp follows it in the group (`not below 0`, or `clamp 0..1` again). The first value is taken as it is, without a run-up.
- **A slide driven by a number (TabBar pill).** An absolute row over the bar holds two empty `fill` boxes with eased weights (2n + 1 and 7 - 2n for tab n of four) and a hairline `Marker` between them. The marker always stands on the centre of the selected tab; the pill is a box pinned around it.
- **Steps from a number (Berries).** One range mapper per item, one count wide (`minInput` = threshold - 1, `maxInput` = threshold, output 0..1, clamped), then a pop interpolator, bound to the item's `scaleX` and `scaleY`. For a position that climbs in steps, nest nodes and bind each one's `y` to its own step.
- **A wobble from a value change, with no trigger (Baskets).** `scaleY` is bound through a group: an elastic interpolator (a springy copy of the value), then a `DataConverterFormula` computing `1 + (copy - value) * 0.25`, where `value` is a `FormulaTokenValue` holding its own bind to the same property. The moment the app writes a new value the copy lags, the drawing is squashed or stretched by the difference, and it springs back as the copy arrives.
- **A level that looks liquid (Jar, Baskets).** The fill rectangle stops 4 pt under the level. A `Float` node has its `y` bound to the same value with the same easing and carries a slab whose top edge is the visible surface; a slow loop tilts the slab. Things that float (the Jar's berries) are children of `Float`.
- **Motion that answers a state change, once.** A second layer on the same property, next to the layer that blends the colours: `AnyState` transitions with duration 0 into one-shot timelines that end in the rest pose (ChoiceCard `Feedback`, StageIndicator `Progress`). `AnyState` does not re-enter a state, so each plays once. For a boolean that should not animate when it is already true on load, give the entry its own resting state (ActionRow `done at start`).
- **A boolean with a real slide (Toggle).** Four states: `off`, `turning on`, `on`, `turning off`. The two `turning` states are timelines, so the knob can overshoot and stretch; they leave at exit time 100 %, or blend for 120 ms into the other one when the value flips mid-slide.
- **Sliding or shaking something that lives in a layout.** Keying `x` / `y` on a `LayoutComponent` offsets it from its laid-out place (HeroNumber's lines, ChoiceCard's shake). A `Text` goes into a box of its own for that.
- **Speeding up a timeline without re-keying it.** `speed` on the `LinearAnimation` (Celebration plays its 170 frames at 2.2, about 1.3 s). Exit time 100 % still means the end.
- **A pill that hugs its text inside a fixed artboard (Tag, BasketChip, StatPill).** The pill box is `hug` wide and `fixed` high, and it is the artboard's only layout child, so it sits at the left edge of the fixed frame the app gives it. The text keeps a `maxWidth` in points that adds up to a full-width pill; past it the font shrinks.
- **Many icons in one component (IconButton).** A `Solo` holds the eight drawings; one layer has a state per `icon` value whose pose keys `activeComponentId`; the `Style` layer's poses key the disc, the edge and every drawing's stroke colour (a Shape owns its paint, so there is one colour key per drawing).
- **Look and motion on separate layers, wired state to state (LessonNode).** `State` blends the colours. `Life` has no `AnyState` transitions: `rest`, `inviting`, `win`, `check pop` and `done still` are joined one by one, so the same value (`done`) arrives with a different motion depending on where it came from (a win after `current`, a plain check pop after `upcoming`, nothing on load). `State` is joined the same way, with a conditional entry, because an `AnyState` transition with a duration fades in from the authored look on the first frame: a node that starts as `done` showed pale mint for a few frames until the states were joined one by one.
- **A looping indicator with an off switch (TypingDots).** `bouncing` (a loop) and `resting` (a pose), with a conditional entry and a short blend back to the baseline. Each dot is drawn from its foot, so the landing squash stays on the line.
- **Accessibility.** One `SemanticData` child on the node that best covers the component: `role`, and `label` bound to the component's own string (`propertyKey="983"`); `value` is 984, `isToggled` 1000, `isDisabled` 1002. `rive <dir> --artboard=X --semantics=-` prints the tree. There is no progress role, so ProgressBar is a read-only slider whose value is the percentage. The listeners are still pointer listeners only: VoiceOver's "activate" is not wired in the file.
- **`out` triggers.** A transparent `Hit` box (or shape) over the artboard is the listener target. `StateMachineListenerSingle listenerTypeValue="click"` holds `ListenerViewModelChange > BindablePropertyTrigger propertyValue="1" > DataBindContext propertyKey="686" direction="true"`. `click` means down and up on the same target, so one fire per completed tap.
- **Press feedback.** `down`, `up` and `exit` listeners write the private boolean `_down`; a `Press` layer moves the face down 4 and fades the edge. Button's `disabled` and `loading` poses key `Hit.x` / `Hit.y` to -10000, so no listener can fire while they hold.
- **Paired triggers (VoiceButton).** The listeners fire private triggers `_touchDown` / `_touchUp`. The `Hold` layer's transitions fire `pressDown` and `pressUp` with `StateMachineFireTrigger`, so every down gets exactly one up, also when the finger slides off.
- **`in` triggers and `done`.** `idle` plus twin states `A` and `B` that play the same timeline: idle to A, A to B and B to A on the trigger, A or B back to idle at exit time 100 %. Firing again mid-play restarts it. `Celebration.done` is a `StateMachineFireTrigger` on the transitions back to idle.
- **Flexible width.** The artboard has a `LayoutComponentStyle`; a root `LayoutComponent` set `fill`/`fill` holds rows and columns. Boxes are painted directly (`Fill`, `Stroke`, `cornerRadiusTL`). Overlays (hit box, bottom edge, loading dots, confetti) are `positionTypeValue="absolute"` boxes. Text and shapes join the flow with a nested `LayoutParticipant`.
- **Fixed and contain artboards.** A fixed-size root box (BasketChip, StatPill, Tag) or plain shapes at x/y (VoiceButton, Toggle, Liito, Jar, Sticker). They do not reflow. The three pills fill their artboard, with the content centred.
- **Text that may be too long.** Left-aligned, one line: `fill` participant, `wrapValue="noWrap"`, `overflowValue="ellipsis"`. Centred, one line: `hug` participant with `maxWidth`, `overflowValue="fitFontSize"` (the font shrinks). Two lines: `fill`/`fill` participant, `sizingValue="fixed"`, `wrap`, `ellipsis`.

## Properties that are not in the contract

| Artboard | Property | Why |
|---|---|---|
| TabBar | `label0`..`label3` (string; Today, Ask, Jars, Path) | added so the captions are bound, not hard-coded |
| Button, ActionRow, ChoiceCard, IconButton, LessonNode | `_down` (boolean) | private: pointer is held on the control |
| VoiceButton | `_touchDown`, `_touchUp` (trigger) | private: raw pointer events for the Hold layer |

The app should not read or write the properties that start with an underscore. The motion pass (Baskets, Berries, easing, feedback) added no properties to existing view models.

## Gotchas

Seen while building this file. Each one built clean and inspected clean.

- **Absolute boxes need auto units.** A box pinned by its insets also needs `widthUnitsValue="auto"` / `heightUnitsValue="auto"`, or it is 0 wide: invisible, and as a listener target it never fires (the first Button could not be pressed).
- **Insets need their units.** `positionLeft="0"` does nothing without `positionLeftUnitsValue="points"`. Padding and gap worked without units in CLI 1.6.0, although its docs say otherwise; the files set them anyway.
- **A layer that is blending ignores triggers.** While a transition with a duration is mixing, the layer takes no other transition, and a trigger fired in that time is lost: with a 300 ms blend into VoiceButton's `down` state, a quick tap never fired `pressUp`. So trigger-driven transitions have duration 0 and the motion lives in the timelines.
- **`AnyState` with a duration blends from the authored look on the first frame.** A secondary Button would start green. Hence duration 0 for set-once looks and conditional entry transitions for booleans. The four blended enums still fade from their default when they start in another state.
- **Centred single-line text with `ellipsis` overflows to the left.** Use `hug` + `maxWidth` + `fitFontSize`. A `fitFontSize` text keeps its box height; `verticalAlignValue="bottom"` keeps it on its neighbours' line (HeroNumber).
- **Flex weights that sum below 1 leave the row partly empty, and a zero-weight box still takes its gap.** So the weights are scaled by 1000 (`flex weight`) and zero segments get `displayValue` none (`zero hides`).
- **`--data` is applied before the scene runs, wherever it stands on the command line.** It can fire an `in` trigger only at frame 0. To test one mid-run, add a temporary click listener in a scratch copy of the project.
- **Screenshots paint transparent artboard areas dark grey (`#1D1D1D`).** Dark green text is hard to read on it. That is the previewer, not the file.
- **`inspect` shows numbers as 32-bit floats** (0.1 reads 0.100000001) and leaves `sourcePathIds` out, so a bind can only be proven by rendering.
- **A `fill` box starts from the width of its content.** Its weight only shares out the space that is left. The first sliding pill sat in a `fill` cell and was 21 pt off; spacer boxes that carry a bound weight must be empty.
- **A Shape inside a nested layout box can draw under an ancestor's fill.** The TabBar pill as a Shape was hidden by the bar's white fill; as a layout box with its own `Fill` it draws in order.
- **A component that fills its artboard cannot pop above 100 %.** The artboard clips it. ChoiceCard dips to 95 % and springs back instead; small things inside (ticks, checks) can overshoot freely.
- **An inset in percent did nothing; a percent `maxWidth` did nothing inside a `stack` layout.** ActionRow's strike line is pinned in points, and its title sits in an ordinary `hug` box with `maxWidth` 100 %, which is what lets `fitFontSize` shrink a long title.
- **An eased value leaves its range.** With an overshoot a height or a flex weight goes below 0 or above its maximum for a few frames. Clamp after the interpolator, or make sure a clip hides it.
- **A percent `maxWidth` has nothing to measure against inside a `hug` box.** When Tag's pill became `hug`, its text's 100 % limit stopped working; the limit is 176 pt now.
- **A fixed artboard is not scaled by `--viewport`.** It renders at 1x in the top left corner of a bigger viewport. To look closer, upscale the PNG.
- **To see a value change mid-run, write it from a click.** `--data` cannot. In a scratch copy, add a transparent shape and a click listener holding `ListenerViewModelChange > BindablePropertyNumber propertyValue=".." > DataBindContext propertyKey="636" direction="true"` (634 for a boolean, 637 for an enum with the value's id), then render `--advance=20 --pointer=click@x,y --advance=N` for several N.

Known from the CLI docs or the runtime source, and designed around:

- `AnyState` never re-enters the state a layer is already in. That is why replayable timelines use the twin states A and B.
- `problems` also lists editor warnings (`states-overlap`, `artboards-overlap`), so every state and artboard has its own x/y.
- `BindablePropertyTrigger` is written with `propertyValue="1"`, as the CLI's own sample does.
- The CLI can be newer than the app's runtime. This file uses `LayoutParticipant`, `ComponentOrigin`, `Stroke position` and `StateMachineFireTrigger`. It was loaded and tapped through the stock Apple runtime of rive-ios 6.28.1; check again before pinning an older version.

## Liito

`12_liito.rml` is the mascot: one rig, ten moods, and a tap reaction. The contract is unchanged (artboard `Liito`, view model `LiitoVM`, state machine `Main`, enum property `mood` with the ten `LiitoMood` values). One private trigger was added to the view model: `_tap` (a pointer went down on Liito). The app does not read or write it.

### The rig

Liito stands on a root node at the ground line (112, 228). Four nested nodes each carry one kind of motion, so layers never fight over a property, and `Body` holds the parts:

    Liito (root)  >  Squish (tap)  >  Breath (always on)  >  Pose (the mood: place, lean, squash, all from the feet)
                  >  Bank (turns about the middle of the body: the glide)  >  Body (the parts)

Parts, front to back, each with its own pivot: thinking dots and sleeping z; mug with steam; blanket; berry; `Arm L` and `Arm R` (pivot at the shoulder, paw at the end, the magnifier rides the left arm); jar with its sparkle; `Head` (eyes, mouths, nose, cheeks, pale face); belly; `Head Back` (skull and both ears, each ear on its own node); body; `Membrane L` and `Membrane R`; `Leg L` and `Leg R`; `Tail` (pivot at its base).

- **Head and Head Back turn together.** The belly sits between them in the draw order, so the pale face and belly read as one shape. Every head key is written to both nodes.
- **Eyes.** `Eyes` holds both open eyes (the mood moves it for a gaze, scales it for wide eyes, and squashes and fades it when the eyes close). Each `Eye` node is squashed by the Blink layer. Each eye has a lower lid, a face-coloured box that rises from under the eye (`scaleY` 0 to 1): 0.22 gives the smiling eyes of `cheering`. A second lid of the same shape (`Tap Lid`) belongs to the Tap layer alone, so a tap never fights the mood for a property. Closed eyes are two stroke shapes: `Eyes Happy` (arcs up: proud, cosy) and `Eyes Asleep` (arcs down: sleepy).
- **Membrane.** A green shape behind the body with three keyed points per side: the paw, the foot (or a lower corner the mood chooses) and a point between them with a large corner radius, which makes the edge curve inwards. It is behind the body and at opacity 0 unless the limbs spread (cheering, gliding); while it is hidden its points have one key each, placed where a blend will need them.
- **Props** (jar, berry, magnifier, mug, blanket, dots, z) are always in the scene, hidden by opacity 0 (and, all but the z, scaled down as well), and brought in by their mood.

### Moods and transitions

- **One looping timeline per mood** (`mood: idle` ... `mood: thinking`). Every mood keys the same set of about 80 rest-pose properties at frame 0 and adds keys where it moves. Because no mood leaves a property unkeyed, any mood blends into any other without leftovers. Effects that exist in one mood only (steam, z, dot hops, the sparkle) are keyed in that mood alone; their container is hidden everywhere else.
- **Loops are seamless by construction**: every keyed property has the same value on its first and last key. Follow-through (ears, tail, head, arms arriving late) is the same swing started later; where a swing crosses the loop seam its ease curve is split in two, so the motion is unchanged.
- **Every state has a transition to every other mood** (conditions on `mood`, 260 to 350 ms). The blend curve belongs to the mood being entered: quick with a small overshoot into the lively moods (`cheering`, `found`, `gliding`, `proud`), slow and soft into `cosy` and `sleepy`.
- **The first frame is right.** The `EntryState` has one conditioned transition per mood with no duration, and the layer has no `AnyState` transitions, so nothing blends from the authored pose. Proof: `build/shots/liito/first-frame.png` (each mood at `--advance=1`). The other renders are in the same folder: `all-moods.png`, `loop-idle.png`, `loop-cheering.png`, `loop-gliding.png`, `loop-cheering-arriving.png`, `loop-found-arriving.png`, `small-64.png`, `transitions.png`, `tap-squish.png`.
- **`cheering` and `found` arrive through a one-shot** (`mood: cheering, arriving`: one big first jump; `mood: found, arriving`: the "aha" bounce) and then move to their loop at exit time 100 %. The last frame of a one-shot equals the first frame of its loop. Transitions into these moods point at the arriving state.
- **Always-on layers**: `Breath` (the Breath node scales from the feet, 3.6 s), `Blink` (one blink and one double blink in 7 s; invisible while the open eyes are hidden).
- **Tap.** A `down` listener on `Hit` (an ellipse over the character, not the artboard) fires `_tap`. The `Tap` layer is the usual rest, A, B pattern and plays a 0.57 s squish on the Squish node, with the eyes smiling (`Tap Lid`). A pointer outside the character fires nothing.

### Adding a mood

1. Add the value to `LiitoMood` in `00_shared.rml` and to `contract.json` (a contract change: agree it with the app first).
2. Copy the timeline `mood: idle` as `mood: <new>`. Keep every frame-0 key (change values, never delete one), then add the motion. Make the last key of each property equal its first.
3. Add an `AnimationState` for it with a transition to each of the other moods, add a transition to it in each of the other states, and add its conditioned transition to the `EntryState`.
4. Render it: `--data=mood=<new>` at `--advance=1` (first frame), at several times across the loop, and at `--viewport=64x64 --fit=contain`.

The file was written with a small Python authoring aid that keeps these rules by itself (it fills in the rest pose, works the membrane points out from the arm and leg keys, splits eases at the loop seam, checks every seam and writes the transition matrix). A copy is in `.handoff/rive-liito-gen.py`: a mood there is one short function. The `.rml` is the source of truth; if you edit it by hand, the aid is out of date.

### Gotchas

- **`AnyState` owns the first frame** (see the first list of gotchas: an `AnyState` transition with a duration fades in from the authored pose). So the Mood layer has no `AnyState` transitions at all: it has the full matrix (12 states, 110 transitions here) plus conditioned entry transitions. Keeping `AnyState` and only adding entry conditions was not tried.
- **A blend curve that overshoots extrapolates every key**, opacity and scale included. A prop hidden by scale 0 alone showed as a small mirrored speck while the curve was past 1. Hide props by scale and opacity together: opacity below 0 draws nothing and above 1 draws as 1 (checked in renders).
- **Upper lids read as annoyed.** A lid coming down from the top made Liito look grumpy in every test, so the rig only has lower lids.
- **A mood change during a blend waits for the blend** (see the first list of gotchas). Two quick changes play one after the other, never a pop.
- **Keyed points move in straight lines.** The membrane's paw point is keyed to where the paw is at each arm key; between two moods it cuts the corner of the paw's arc for a few frames. It is behind the body and fading, so it does not show.
- **The magnifier passes the left edge for about three frames** when `found` is entered from a mood with the arm down (the arm sweeps through horizontal). Every held pose and loop stays inside the artboard.
- **To look at a transition**, add to a scratch copy a `click` listener with `ListenerViewModelChange > BindablePropertyEnum propertyValue="<enum value id>"` bound to `mood` with `direction="true"`, then render `--data=mood=<from> --advance=47 --pointer=click@112,140 --advance=<n>`.
- **Renders on a pale background** need a temporary background shape in a scratch copy; the artboard itself must stay transparent.
- **Reduce motion** is the app's side: show the mood's first frame (advance once, then pause the view).
