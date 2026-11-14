# SisuCore: guide for the screens

Pure Swift, no dependencies, no UIKit or SwiftUI. Everything a screen shows comes from here: the models, the
network, the conversation with Sisu, the money plan, and the helpers that turn payloads into on-screen text.
The doc comments in the source are the reference; this file is the map. Tests: `sh ios/scripts/test-core.sh`.

## Files

| File | What it holds |
|---|---|
| `Models.swift`, `API.swift` | The four data routes (`Overview`, `TransactionList`, `ScenarioResponse`…), `SisuAPI`, `LiveAPI`, `FixtureAPI`, `ScenarioEngine` (offline futures, also with a lump sum `oneOffEur`), `SisuError` |
| `CoachModels.swift` | The chat contract: `SisuEvent`, `Stage`, `AgentAction`, `ResearchResult`, `Offer`, `Fact`, `Grounding`, `TeachingCard`, `CustomerMemory`, request bodies |
| `PlanModels.swift` | `Visual` (charts as data), `PlanEvent`, `MoneyPlan`, `PlanTotals`, `PlanCheck`, `ApproveAllResult` |
| `Activity.swift` | `SisuActivity`, `Activity.nextActivity`, `Activity.nextPlanActivity`, pose to `RiveBindings.LiitoMood` |
| `CoachEndpoints.swift`, `Transport.swift`, `CoachClient.swift` | Pure request builders; `URLSessionTransport`, `ReplayTransport` (bundled recordings), `FallbackTransport`; one typed `async` call per endpoint |
| `CoachSession.swift` | `CoachSession` (port of the web hook `useSisu`), `CoachMessage`, `CoachStep`, `SpeechOutput`, `CoachErrors`, `CoachSamples` |
| `PlanSession.swift` | `PlanSession` (port of `usePlan`) and `PlanView` |
| `CoachPresentation.swift`, `ChartPresentation.swift` | Payload to on-screen text: offers, stage cards, action card, receipts, quiz, futures; charts, steps, plan card, checks |
| `Presentation.swift` | `Money`, `Dates`, baskets, the hero block |

## Live, mock, sample and the fallback

```swift
let session = CoachSession.live(customerId: id, baseURL: url)                 // a real server
let session = CoachSession.sample(customerId: id)                             // bundled recordings, no server
let session = CoachSession.liveWithSampleFallback(customerId: id, baseURL: url) // live until the server is unreachable
```

- `session.dataLabel` is `.sample` (bundled), `.mock` (the server said `mock: true`) or `.live`.
  `CoachText.dataTag(for:)` gives `Sample data`, `Mock data` or nil. Use them in Settings.
- **Fallback.** With `liveWithSampleFallback`, the first request that cannot reach the server switches the client
  to the recordings for good. At that moment `session.fallbackNotice` (also on `PlanSession`) is published once:
  show it where it happens, then call `dismissFallbackNotice()`. `client.fallenBackAt` is the time, for Settings.
  A server that answers with an error is not a fallback. `.live` and `.sample` never switch.
- Use `session.client` for that customer's other calls: in sample mode the transport remembers approvals and
  saved names, and a second client would not see them. `PlanSession(customerId:client:)` takes the same client.
- Sample mode knows the three demo customers. A typed question replays the recorded turn of its kind
  (`ReplayTransport.recordedTurn(for:)`): a cheaper electricity deal, "can I afford a 200 euro bike", payday,
  bills, "where does my money go", "what if I save 50 euros a month", a buffer lesson, restaurant spending, the
  mortgage, "remember … 3500 kWh"; anything else gets the backend's general "safe to spend" answer. Also recorded:
  investigations, voice, the money plan with approve-all, all charts, a 500 euro one-off transfer (with its
  warning), offers, teaching cards, patterns, cash flow, memory, the audit trail, affordability for €50, €200 and
  €1,000. Anything else answers `ReplayTransport.notInSample`.
- Previews: `CoachSamples.reply(turn: "investigate")`, `.research()`, `.action(approved:)`, `.teachingCards()`.

## `CoachSession` (main actor, `ObservableObject`, one per customer)

| Member | Use |
|---|---|
| `open()` | Once when the screen opens: `warm()` then `refresh()` |
| `ask(_:)`, `investigate(_:)`, `sendVoice(audio:…)` | Start a turn. They return at once; the reply fills in |
| `cancel()`, `reset()` | Stop the answer and the voice / also clear the conversation |
| `approve(_:)`, `decline(_:)`, `prepareSwitch(billType:)`, `prepareTransfer(amountEur:oneOff:destination:)` | Action buttons: the action, or nil with the sentence in `notice` |
| `confirmBill(_:name:billType:)`, `setRemembering(_:)`, `forget(itemId:)`, `refresh()` | Memory and reloading |
| `activity` | **New.** `{ state, liito, label, detail }`: drive Liito with `activity.mood`, caption with `activity.label` |
| `status`, `messages`, `actions`, `memory`, `server`, `heardLanguage`, `notice`, `fallbackNotice` | Published state |
| `approvedMonthlySaving` | Euros a month freed by approved switches: the futures chart's bill saving |
| `setRecording(_:)`, `setSpeaking(_:)`, `focusBill`, `speakReplies`, `language`, `speech` | The app reports microphone and speaker; settings |

A `CoachMessage` (assistant) carries: `text` + `pending` (after a `replace` event the text is what still
stands); `steps` (**new**: `StepPresenter.rows`, heading `StepPresenter.heading(pending:)`); `visuals` (**new**:
`ChartPresenter.chart(for:)`); `stages` (`StagePresenter.card`); `research` (`OfferPresenter.rows`, `.headline`,
`.fetchedNote`); `action` (`ActionPresenter.card`, now with `warning`, `confirmation`, `destination`); `teaching`
(`TeachingQuiz`); `remembered`; `grounding` + `facts` (`GroundingPresenter.line`, `CoachText.factValue`);
`tools`, `timings`, `citations` (`ToolPresenter.row`); `filler`, `runningTool`, `startedEarly`; `error`.

## Activity and the mascot

`session.activity` and `plan.view.activity` change only on real events, never on a timer. `activity.mood` is the
`RiveBindings.LiitoMood` to show: the pose's mood (`found-something` is `found`), except that the `thinking` state
gives the mood `thinking` (the three dots). Change the mascot only when `activity.state` changes. In chat:
`listening` while recording; during a turn the step the stream last reported; `speaking` while the app plays
speech; then a short `approved` or `declined`; then an action still waiting (`detail` is its warning); else `idle`.
If you read a stream yourself: `Activity.nextActivity(current, event)` and `Activity.nextPlanActivity(current, event)`.

## The money plan

```swift
@StateObject private var plan = PlanSession(customerId: id, client: session.client)
plan.start()                       // view.phase: idle, running, done, error
// plan.view: act (.scan, .web, .sums), scan, findings, lanes (query, pages, result), checks, calc,
//            actions, projection, summary, plan, activity, approval, approvalError, error
if let card = PlanPresenter.card(plan.view) { /* title, needsNothing, needsSpendingChange, warnings, approveLabel */ }
Button(card.approveLabel ?? "") { Task { await plan.approveAll() } }   // then card.confirmations
```

- Events are played one after another with the web's pauses (`PlanSession.pause(after:queued:)`); inject
  `pause: { _ in }` to play at once. `cancel()` stops, `reset()` clears, `decline()` is "not now".
- **The total never comes without its split.** `PlanTotals` holds `totalYearlyEur`, `effortlessYearlyEur` (needs
  nothing from you) and `spendingChangeYearlyEur` (needs spending to come down); `PlanCardState` has both figures.
- `PlanPresenter.items(plan)` says per item whether it needs nothing or only counts if spending comes down.
- `PlanPresenter.check(lane, timeZone:)` is "What the sources say today" beside the customer's own figure
  (`yoursLabel`, `yoursValue`), with sources, `confirmedNote` and a disclaimer. Never word it as qualifying.
- Show every `card.warnings` entry and each action's `warning`. After approving, `view.activity` is `approved`
  with the pose `proud` when everything was approved, `cheering` when only a part was.

## Charts

`ChartPresenter.chart(for: visual)` gives a `ChartState`: `title`, `caption`, `summary` (use it as the
accessibility label), `legend`, `source`, `footnote`, `resultLabel`/`resultValue`, and a `body`:

| `visual.kind` | `body` | What is ready |
|---|---|---|
| `budget_donut` | `.donut(slices, centerLabel, centerValue)` | each slice's `start`/`end` (0…1 around the ring), `valueText`, `shareText`, colour |
| `peer_bars`, `waterfall`, `offer_bars` | `.bars(groups)` | per group a title, a note (`€64 above`, `saves about €24 a year`), bars with `fraction` 0…1 and `valueText` |
| `month_bars` | `.columns` | `fraction`, `markFraction` (income), `flagged` (cost more than it brought in), `detail`, `showsLabel` |
| `futures_lines` | `.lines(lines, axisLabels)` | points as `x`, `y`, `low`, `high` in 0…1, `hasBand`, `endText`, `rangeText` |

Colours are roles (`ChartColorRole`): `category1`…`category6` in order, `main`, `quiet`, `flagged`. Map them to the
palette; `flagged` is not red (spending is never red). Charts arrive on `message.visuals`; without the agent,
`client.visuals(customerId:)` returns the five account charts at once.

## Which helper makes which text

| On screen | Helper |
|---|---|
| `€1,234.50`; `13 Nov 2026`; `14 Nov 2026, 10:42` | `Money.format`; `Dates.short`; `Dates.shortDateTime(_:language:timeZone:)` |
| `Fetched 14 Nov 2026, 10:42` | `CoachText.fetched(_:language:timeZone:)` |
| `About €24 less a year`, `Spot price, not comparable`, `not stated`, `Nothing cheaper today` | `OfferPresenter` |
| `Simulated, no real switch`, `Sample data`, `Mock data` | `CoachText.simulatedTag()`, `.sampleDataTag()`, `.mockDataTag()` |
| `Waiting for your approval. Nothing has been done.`; an action's warning and confirmation | `ActionPresenter.card`, `.warning(_:)`, `.confirmation(_:)` |
| `All 6 numbers have a source` / `2 of 6 numbers have no source yet` | `GroundingPresenter.line(_:)` |
| `What Sisu is doing` / `What Sisu did`, each step with its state and `1.2 s` | `StepPresenter` |
| `About €1,771 a year`, `€257 a year` · `needs nothing from you` | `PlanPresenter.card(_:)` |
| `Fits comfortably`; `Looks like Electricity`; a calculation line by line | `CoachCardPresenter` |
| The futures chart; `About €121 more after 5 years` | `FuturesPresenter.series(_:)`, `.gain(_:)` |
| A friendly error | `CoachErrors.sentence(for:)` |

Rive values: `RiveBindings.button`, `.heroNumber`, `.basketBar`, `.liito(mood: activity.mood)`, `.tag`, and the rest.

## Endpoints on `CoachClient`

`warm`, `health`, `resetDemo` · `research`, `researchSnapshot` · `memory`, `saveMemory`, `confirmBill`,
`rememberKwh`, `setMemoryConsent`, `forgetMemory` · `prepareAction`, `approveAction`, `declineAction`,
`approveAll` (**new**), `actions`, `audit` · `patterns`, `cashFlow`, `affordability`, `teachingCards`, `mortgage` ·
`visuals` (**new**) · `readBillPhoto` · `voiceOptions`, `transcribe`, `speech` · streams: `ask`, `investigate`,
`voiceTurn`, `plan` (**new**) · the four data routes. Calls throw `SisuError`: `.server(status:message:)` (409: not
looked up yet or already decided; 410: expired; 429: too many), `.offline`, `.invalidResponse`. `approveAll`
returns its `failed` list instead of throwing when the server answers 409.

## Examples

```swift
@StateObject private var sisu = CoachSession.liveWithSampleFallback(customerId: "CUST04974", baseURL: backendURL)

List(sisu.messages) { message in
    Text(message.text)
    ForEach(StepPresenter.rows(message)) { step in Text(step.label) }            // what Sisu is doing
    ForEach(message.visuals) { visual in ChartView(ChartPresenter.chart(for: visual)) }
    if let action = message.action {
        let card = ActionPresenter.card(action, language: .en, timeZone: .current)
        if let warning = card.warning { Text(warning) }                           // never hide it
        if card.canDecide { Button("Approve") { Task { await sisu.approve(action.id) } } }
    }
}
.task { await sisu.open() }
.alert(sisu.fallbackNotice ?? "", isPresented: .constant(sisu.fallbackNotice != nil)) { Button("OK") { sisu.dismissFallbackNotice() } }
// Liito: RiveBindings.liito(mood: sisu.activity.mood), caption sisu.activity.label
```

```swift
@MainActor final class Speaker: SpeechOutput {       // the app owns the audio
    func speak(_ text: String, order: Int) { /* client.speech(SpeechRequest(text: text)), play in order */ }
    func stop() { /* stop the player, drop the queue */ }
}
sisu.speech = speaker; sisu.speakReplies = true
sisu.setRecording(true); sisu.setRecording(false)    // opening the microphone interrupts Sisu
sisu.sendVoice(audio: recording, fileName: "speech.m4a", mimeType: "audio/mp4")
```

## Things to know

- **Threading.** `CoachSession`, `PlanSession` and `SpeechOutput` are main-actor. The client, the transports and
  every presenter are `Sendable` values or pure functions.
- **Cancellation.** A new turn, `cancel()`, `reset()` and `setRecording(true)` abort the stream and call
  `speech.stop()`. What had arrived stays on screen; late events are dropped. Nothing throws: errors are sentences.
- **Numbers.** Show the server's figures and sentences. No helper recomputes a saving; a missing field reads
  `not stated`. The model's text is never the source of a chart's numbers: use the `Visual`.
- **Open enums.** `BillType`, `ActionStatus`, `ActionKind` (now also `.oneOffTransfer`), `StageKind`… keep unknown
  strings: compare with `==` and give every `switch` a `default`. `.unknown` cases mean "newer server".
- **Language.** Server-written text (titles, checklists, step labels, chart summaries) is English. Helpers take
  `SisuLanguage` for the app's own labels, amounts and dates. Time zones are injected.
