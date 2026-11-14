# SisuCore: guide for the screens

Pure Swift, no dependencies, no UIKit or SwiftUI. Everything a screen shows comes from here: the models, the
network, the conversation with Sisu, and the helpers that turn payloads into on-screen text. The doc comments in
the source are the reference; this file is the map. Tests: `sh ios/scripts/test-core.sh` (from the repository root).

## Files

| File | What it holds |
|---|---|
| `Models.swift` | The four data routes: `Overview`, `TransactionList`, `ScenarioResponse`, `DemoCustomer`… |
| `API.swift` | `SisuAPI` (protocol), `LiveAPI`, `FixtureAPI`, `Endpoints`, `ScenarioEngine` (offline futures), `SisuError` |
| `CoachModels.swift` | The coach contract: `SisuEvent`, `Stage`/`StageData`, `AgentAction`, `ResearchResult`, `Offer`, `Fact`, `Grounding`, `TeachingCard`, `CustomerMemory`, `Pattern`, `CashFlow`, `Affordability`, `HealthReport`, request bodies |
| `ServerSentEvents.swift` | `SSEParser`, `SisuEventStreamParser` |
| `CoachEndpoints.swift` | One pure request builder per endpoint, `MultipartForm` |
| `Transport.swift` | `SisuTransport`, `URLSessionTransport` (live), `ReplayTransport` (bundled recordings) |
| `CoachClient.swift` | One typed `async` call per endpoint. It is also a `SisuAPI` |
| `CoachSession.swift` | `CoachSession` (the port of the web hook `useSisu`), `CoachMessage`, `SpeechOutput`, `CoachErrors` |
| `CoachPresentation.swift` | Payload to on-screen text: offers, stage cards, action card, receipts, quiz, futures |
| `Presentation.swift`, `RiveContract.swift` | `Money`, `Dates`, baskets, the hero block; `RiveComponent`, `RiveBindings` |

## Live, mock and sample

```swift
let session = CoachSession.live(customerId: id, baseURL: URL(string: "http://localhost:3000")!)
// or: CoachSession.sample(customerId: id)                // no server: bundled recordings
if let tag = CoachText.dataTag(for: session.dataLabel) {  // nil when live, else "Mock data" or "Sample data"
    RiveBindings.tag(text: tag, tone: .info)
}
```

`session.dataLabel` is `.sample` for the recordings, `.mock` when the server said `mock: true`, else `.live`.
`CoachClient.live(baseURL:)` and `CoachClient.sample()` give the same choice without a conversation; both also
serve the four data routes (`demoCustomers`, `overview`, `transactions`, `scenario`).

Sample mode knows the three demo customers (`FixtureAPI.customerIds`). A typed question replays the recorded
turn of its kind, chosen by the mock backend's own rules (`ReplayTransport.recordedTurn(for:)`): "a cheaper
electricity deal", "can I afford a 200 euro bike", "will I run out before payday", "which bills have gone up",
"where does my money go", "what if I save 50 euros a month", "explain why a buffer comes first", "how much do I
spend on restaurants", "how is my mortgage application going", "remember that my electricity use is 3500 kWh";
anything else gets the backend's general "safe to spend" answer. Investigations, voice turns, offers for all
three bill types, the bill photo, teaching cards, patterns, cash flow, memory, actions (prepare, approve,
decline) and the audit trail work; affordability works for €50, €200 and €1,000. A request outside the
recordings (another amount, another lesson) fails with the sentence `ReplayTransport.notInSample`.

For previews and for building a screen before its data flows: `CoachSamples.reply(turn: "investigate")` is a
finished assistant message with every card; also `CoachSamples.research()`, `.action(approved:)`, `.teachingCards()`.

## The session

`CoachSession` is `@MainActor` and an `ObservableObject`: hold it in `@StateObject`, one per customer.

| Member | Use |
|---|---|
| `open()` | Call once when the screen opens: `warm()` then `refresh()` |
| `ask(_:)`, `investigate(_:)`, `sendVoice(audio:fileName:mimeType:language:)` | Start a turn. They return at once; the reply fills in |
| `cancel()`, `reset()` | Stop the answer and the voice / also clear the conversation |
| `approve(_:)`, `decline(_:)`, `prepareSwitch(billType:provider:)` | The action buttons. Return the action, or nil with the sentence in `notice` |
| `confirmBill(_:name:billType:)` | Saves the bill's name and starts offer research without waiting |
| `setRemembering(_:)`, `forget(itemId:)`, `refresh()` | Memory consent, forgetting, reloading `actions` and `memory` |
| `status` | `.idle`, `.recording`, `.thinking`, `.speaking`. `CoachCardPresenter.voiceState(status)` gives the `VoiceButton` state |
| `messages`, `actions`, `memory`, `server`, `heardLanguage`, `notice` | Published state |
| `approvedMonthlySaving` | Euros a month freed by approved switches: the futures chart's bill saving |
| `focusBill`, `speakReplies`, `language`, `speech` | Settings. Set `focusBill` while a bill card is open |
| `setRecording(_:)`, `setSpeaking(_:)` | The app reports the microphone and the speaker; recording interrupts Sisu |

### What is in a `CoachMessage` (assistant)

| Field | Draw it as |
|---|---|
| `text`, `pending` | The answer, growing while `pending`. After the turn it is the server's checked text |
| `filler`, `runningTool`, `startedEarly` | "Let me check…" and a progress line. `StagePresenter.researchStage(of:)` feeds `StageIndicator` |
| `stages` | One card per step: `StagePresenter.card(_:language:timeZone:)` |
| `research` | The offer table: `OfferPresenter.rows`, `.headline`, `.baseline`, `.fetchedNote`; show `research.assumptions` |
| `action` | The approval card: `ActionPresenter.card(_:language:timeZone:)` |
| `teaching` | The quiz: `TeachingQuiz(card:)` |
| `remembered` | "Sisu will remember…" |
| `grounding`, `facts` | `GroundingPresenter.line(_:)`; a fact's figure with `CoachText.factValue(_:)`; `fact.evidence` opens the rows |
| `tools`, `timings`, `citations` | The trace drawer: `ToolPresenter.row(_:)`, `ToolPresenter.timingLine(_:)`; source links |
| `error` | A sentence to show. Never a crash |

## Which helper makes which text

| On screen | Helper |
|---|---|
| `€1,234.50`, `1 234,50 €` | `Money.format(_:language:decimals:)` |
| `13 Nov 2026`; `14 Nov 2026, 10:42` | `Dates.short`; `Dates.shortDateTime(_:language:timeZone:)` |
| `Fetched 14 Nov 2026, 10:42` | `CoachText.fetched(_:language:timeZone:)` |
| `About €24 less a year`, `Spot price, not comparable`, `not stated` | `OfferPresenter.savingText(_:)` / `OfferRow.saving` |
| `Nothing cheaper today` | `OfferPresenter.headline(_:)` |
| `Simulated, no real switch`, `Sample data`, `Mock data` | `CoachText.simulatedTag()`, `.sampleDataTag()`, `.mockDataTag()` |
| `Waiting for your approval. Nothing has been done.` | `ActionCardState.statusSentence` |
| `All 6 numbers have a source` / `2 of 6 numbers have no source yet` | `GroundingPresenter.line(_:)` (`isWarning`) |
| `Search offers`, `1.2 s`, `Web search and offer pages` | `ToolPresenter.row(_:)` |
| `Fits comfortably`, `Possible, but tight`, `Not yet` | `CoachCardPresenter.verdict(_:)` |
| `Looks like Electricity` until the user confirms the name | `CoachCardPresenter.billName(_:memory:)` |
| A calculation, line by line | `StagePresenter.lines(_:)`, `CoachCardPresenter.lines(_:)` |
| The futures chart | `FuturesPresenter.series(_:)` for a `ScenarioResponse` (curves) or an `ActionImpact` (end points) |
| `About €121 more after 5 years` | `FuturesPresenter.gain(_:)`, or the server's own `impact.summary` |
| A friendly error | `CoachErrors.sentence(for:)` |

Rive values never need a hand-built dictionary: `RiveBindings.button`, `.heroNumber`, `.basketBar`, `.basketChip`,
`.progressBar`, `.stageIndicator`, `.jar`, `.tabBar`, `.actionRow`, `.choiceCard`, `.voiceButton`, `.liito`,
`.statPill`, `.tag`, `.toggle`, `.sticker`, `.celebration`, `.berries`. `RiveComponent` has `file`, `fallback`,
`designSize`, `sizing`, `outTriggers` and `inTriggers`.

## Endpoints on `CoachClient`

`warm`, `health`, `resetDemo(token:)` · `research(customerId:billType:wait:)`, `researchSnapshot` · `memory`,
`saveMemory`, `confirmBill`, `rememberKwh`, `setMemoryConsent`, `forgetMemory` · `prepareAction`, `approveAction`,
`declineAction`, `actions`, `audit` · `patterns`, `cashFlow`, `affordability`, `teachingCards(customerId:concept:)`,
`mortgage` (nil when there is none) · `readBillPhoto` · `voiceOptions`, `transcribe`, `speech` (audio bytes) ·
streams: `ask`, `investigate`, `voiceTurn` (`AsyncThrowingStream<SisuEvent, Error>`).

Every call throws `SisuError`: `.server(status:message:)` with the server's sentence (409: offers not looked up
yet, or already decided; 410: expired; 429: too many requests), `.offline`, `.invalidResponse`.

## Examples

A conversation:

```swift
@StateObject private var sisu = CoachSession.live(customerId: "CUST04974", baseURL: backendURL)

var body: some View {
    List(sisu.messages) { message in
        Text(message.text)
        if let error = message.error { Text(error) }
        if let grounding = message.grounding, let line = GroundingPresenter.line(grounding) { Text(line.text) }
    }
    .task { await sisu.open() }
    .safeAreaInset(edge: .bottom) { Button("Ask") { sisu.ask("How much can I safely spend this week?") } }
}
```

An investigation with its cards and the approval:

```swift
sisu.investigate()                                   // or sisu.investigate("my mobile bill")
ForEach(message.stages) { stage in
    let card = StagePresenter.card(stage, language: .en, timeZone: .current)   // title, summary, lines
}
if let action = message.action {
    let card = ActionPresenter.card(action, language: .en, timeZone: .current)
    // show card.simulatedTag, card.summary, card.checklist, card.assumptions, card.statusSentence
    if card.canDecide {
        Button("Approve") { Task { await sisu.approve(action.id) } }   // then action.impact is filled in
        Button("Not now") { Task { await sisu.decline(action.id) } }
    }
}
// FuturesCard(monthlyBillSaving: sisu.approvedMonthlySaving)
```

Voice (the app owns the audio):

```swift
@MainActor final class Speaker: SpeechOutput {
    func speak(_ text: String, order: Int) { /* client.speech(SpeechRequest(text: text)), play in order */ }
    func stop() { /* stop the player, drop the queue */ }
}
sisu.speech = speaker; sisu.speakReplies = true
sisu.setRecording(true)                               // the microphone opened: Sisu stops talking
sisu.setRecording(false)
sisu.sendVoice(audio: recording, fileName: "speech.m4a", mimeType: "audio/mp4")
```

## Things to know

- **Threading.** `CoachSession` and `SpeechOutput` are main-actor. `CoachClient`, the transports and every
  presenter are `Sendable` values or pure functions: use them from any task.
- **One client per customer.** Use `session.client` for that customer's other calls (cards, audit, bill photo).
  In sample mode the transport remembers approvals and saved names, and a second client would not see them.
- **Cancellation.** A new turn, `cancel()`, `reset()` and `setRecording(true)` abort the running stream and call
  `speech.stop()`. What had arrived stays on screen; late events are dropped.
- **Speech order.** `speak(_:order:)` is called for the `filler` and then each `sentence`, `order` counting from 0
  in each turn. Fillers exist in English, Finnish, Swedish and German only.
- **Numbers.** Show the server's figures and sentences. No helper here recomputes a saving, and a missing field
  reads `not stated`. `OfferPresenter.monthlyBillSaving` is the one documented division (yearly saving over 12).
- **Open enums.** `BillType`, `ActionStatus`, `StageKind`… keep unknown strings: compare with `==`, and give every
  `switch` a `default`. `StageData.unknown` and `SisuEvent.unknown` mean "newer server": draw title and summary only.
- **Language.** Server-written card text (titles, checklists, options) is English. Helpers take `SisuLanguage`
  for the app's own labels, amounts and dates.
- **Time zones** are injected (`timeZone:`); tests never read the clock.
