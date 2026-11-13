# Sisu Rive library

`rive/sisu-ui` is the source of `ios/Sisu/Resources/Rive/sisu_ui.riv`: 17 artboards written as text (RML) and built with the Rive CLI. `rive/contract.json` is the contract with the Swift app. Artboard, view model, property and enum names, types and defaults are fixed by it. Visuals are free. There are no scripts in the file, so it loads unsigned.

## Build

    sh rive/build.sh        # from the repository root: verify, build, copy to ios/Sisu/Resources/Rive/

## How it is organised

    rive/sisu-ui/
      rive.yaml             project name (sisu_ui) and default artboard
      00_shared.rml         fonts, the 10 enums, shared converters           ids 0:n
      01_button.rml ...     one artboard and its view model per file         ids 1:n ... 17:n
      17_tag.rml            (file order = contract order = artboard order in the .riv)
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
- **Numbers.** Bound into geometry through converters from `00_shared.rml`: a box's flex weight (`fractionalWidth`, key 706) for BasketBar and ProgressBar, `displayValue` (key 596) to drop a zero segment, a rectangle's `height` (key 21) for the jam in Jar. `ease to new value` (a `DataConverterInterpolator`) makes them animate when the app writes a new value.
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
| Button, ActionRow, ChoiceCard | `_down` (boolean) | private: pointer is held on the control |
| VoiceButton | `_touchDown`, `_touchUp` (trigger) | private: raw pointer events for the Hold layer |

The app should not read or write the properties that start with an underscore.

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

Known from the CLI docs or the runtime source, and designed around:

- `AnyState` never re-enters the state a layer is already in. That is why replayable timelines use the twin states A and B.
- `problems` also lists editor warnings (`states-overlap`, `artboards-overlap`), so every state and artboard has its own x/y.
- `BindablePropertyTrigger` is written with `propertyValue="1"`, as the CLI's own sample does.
- The CLI can be newer than the app's runtime. This file uses `LayoutParticipant`, `ComponentOrigin`, `Stroke position` and `StateMachineFireTrigger`. It was loaded and tapped through the stock Apple runtime of rive-ios 6.28.1; check again before pinning an older version.
