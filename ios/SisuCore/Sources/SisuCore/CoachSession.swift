// `CoachSession`: the Swift port of the web hook `useSisu` (lib/agent/useSisu.ts). One per customer.
import Combine
import Foundation

/// Plays Sisu's voice. The app implements it (for example with `CoachClient.speech` and AVAudioPlayer);
/// this package has no audio code.
@MainActor
public protocol SpeechOutput: AnyObject {
    /// Queue one sentence. `order` counts up from 0 within a turn: play the sentences in that order, starting
    /// each when the one before it has finished.
    func speak(_ text: String, order: Int)
    /// Drop everything queued and stop the sound now. Called when the user interrupts or asks again.
    func stop()
}

/// What the talk button shows.
public enum CoachStatus: String, CaseIterable, Sendable {
    case idle, recording, thinking, speaking
}

/// Which label the screen owes the user.
public enum CoachDataLabel: String, CaseIterable, Sendable {
    /// A real server with a real model: no label.
    case live
    /// A real server that says `mock: true`: show "Mock data".
    case mock
    /// The recordings bundled with the app, no server: show "Sample data".
    case sample
}

/// One line of the conversation. An assistant message fills in while `pending` is true.
public struct CoachMessage: Identifiable, Equatable, Sendable {
    public enum Role: String, Sendable { case user, assistant }

    public var id: String
    public var role: Role
    /// The question, or the answer growing word by word. After `done` it is the server's checked text.
    public var text: String
    /// Still being heard or written.
    public var pending: Bool
    /// The "let me check" line, shown while research runs.
    public var filler: String?
    /// Set when the server began research before the model asked for it.
    public var startedEarly: BillType?
    /// The tool that is running right now, for a progress line. Nil between tools.
    public var runningTool: String?
    /// The trace drawer: one row per finished tool call.
    public var tools: [ToolTrace]
    /// The offer table.
    public var research: ResearchResult?
    /// Source links.
    public var citations: [Citation]
    public var timings: TurnTimings?
    /// A sentence to show instead of (or under) the answer.
    public var error: String?
    /// One card per step of Sisu's work.
    public var stages: [Stage]
    /// An action awaiting approval: show Approve and Decline.
    public var action: AgentAction?
    /// A predict-then-reveal question.
    public var teaching: TeachingCard?
    /// Things Sisu saved this turn ("Sisu will remember…").
    public var remembered: [MemoryItem]
    /// Whether every number in the answer has a source.
    public var grounding: Grounding?
    /// The receipts behind the numbers.
    public var facts: [Fact]

    public init(id: String, role: Role, text: String = "", pending: Bool = false, filler: String? = nil, startedEarly: BillType? = nil,
                runningTool: String? = nil, tools: [ToolTrace] = [], research: ResearchResult? = nil, citations: [Citation] = [],
                timings: TurnTimings? = nil, error: String? = nil, stages: [Stage] = [], action: AgentAction? = nil,
                teaching: TeachingCard? = nil, remembered: [MemoryItem] = [], grounding: Grounding? = nil, facts: [Fact] = []) {
        self.id = id; self.role = role; self.text = text; self.pending = pending; self.filler = filler; self.startedEarly = startedEarly
        self.runningTool = runningTool; self.tools = tools; self.research = research; self.citations = citations; self.timings = timings
        self.error = error; self.stages = stages; self.action = action; self.teaching = teaching; self.remembered = remembered
        self.grounding = grounding; self.facts = facts
    }
}

public extension CoachMessage {
    /// Folds one stream event into an assistant message: the part of a turn that only changes the reply.
    /// (`start`, `transcript` and `sentence` change nothing here; the session handles them.)
    mutating func apply(_ event: SisuEvent) {
        switch event {
        case .speculation(let billType, _): startedEarly = billType
        case .filler(let line): filler = line
        case .delta(let piece): text += piece
        case .toolStart(_, let name, _): runningTool = name
        case .toolEnd(let trace): tools.append(trace); runningTool = nil
        case .research(let result): research = result
        case .stage(let stage): stages.append(stage)
        case .action(let prepared): action = prepared
        case .teaching(let card): teaching = card
        case .memory(let item): remembered.append(item)
        case .grounding(let check, let receipts): grounding = check; facts = receipts
        case .done(let final, let sources, let took):
            if !final.isEmpty { text = final }
            pending = false
            runningTool = nil
            citations = sources
            timings = took
        case .error(let message):
            pending = false
            runningTool = nil
            error = message.isEmpty ? CoachErrors.generic : message
        case .start, .transcript, .sentence, .unknown:
            break
        }
    }
}

/// Recorded payloads for previews and for building screens before a backend is there. Everything comes from
/// the bundled recordings (mock backend, 14 Nov 2026): label it "Sample data".
public enum CoachSamples {
    /// The recorded turns: `spending`, `electricity`, `investigate`, `voice`, `afford`, `mortgage`, `payday`,
    /// `bills`, `patterns`, `whatif`, `teach`, `category`, `remember`.
    public static let turns = ["spending", "electricity", "investigate", "voice", "afford", "mortgage", "payday", "bills", "patterns", "whatif",
                               "teach", "category", "remember"]

    /// The events of one recorded turn, in order. Empty for a name or customer that was not recorded.
    public static func events(turn: String, customerId: String = "CUST04974") -> [SisuEvent] {
        SisuEventStreamParser.events(in: ReplayTransport.fixture("coach/stream-\(turn)-\(customerId).sse") ?? Data())
    }

    /// The finished assistant message of one recorded turn (all its stages, cards and receipts).
    public static func reply(turn: String, customerId: String = "CUST04974") -> CoachMessage {
        var message = CoachMessage(id: "sample-\(turn)-\(customerId)", role: .assistant, pending: true)
        for event in events(turn: turn, customerId: customerId) { message.apply(event) }
        message.pending = false
        return message
    }

    static func load<T: Decodable>(_ name: String, as type: T.Type) -> T? {
        guard let data = ReplayTransport.fixture("coach/\(name)") else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    /// Recorded offer research (`electricity`, `mobile` or `internet`).
    public static func research(customerId: String = "CUST04974", billType: BillType = .electricity) -> ResearchResult? {
        load("research-\(customerId)-\(billType.rawValue).json", as: ResearchResult.self)
    }

    /// The action an investigation prepared: awaiting approval, or as it came back approved (with `impact`).
    public static func action(customerId: String = "CUST04974", approved: Bool = false) -> AgentAction? {
        approved
            ? load("action-investigate-\(customerId)-approve.json", as: ActionEnvelope.self)?.action
            : load("actions-\(customerId)-investigate-pending.json", as: ActionList.self)?.actions.first
    }

    /// All seven teaching cards of a customer.
    public static func teachingCards(customerId: String = "CUST04974") -> [TeachingCard] {
        load("teaching-\(customerId).json", as: TeachingCardList.self)?.cards ?? []
    }
}

/// The conversation with Sisu for one customer. Screens observe it (`@StateObject` / `@ObservedObject`).
///
/// Everything happens on the main actor. `ask`, `investigate` and `sendVoice` return at once; the reply
/// message then fills in as events arrive (they also return the running task, which tests can await).
/// A new question, `cancel()` or `reset()` aborts the running turn and stops speech; an event that arrives
/// late from an aborted or older turn changes nothing. Errors become a sentence on the reply message
/// (`error`) or in `notice`; nothing here throws.
@MainActor
public final class CoachSession: ObservableObject {
    /// The sentence shown as the user's message when an investigation starts.
    public static let investigateText = "Look into my finances and find the best thing I can do."

    public let customerId: String
    public let client: CoachClient

    /// The conversation, oldest first.
    @Published public private(set) var messages: [CoachMessage] = []
    /// Which model answers. Nil until `warm()` or the first turn has answered.
    @Published public private(set) var server: ServerInfo?
    /// Every action of this customer, newest first.
    @Published public private(set) var actions: [AgentAction] = []
    /// What Sisu remembers about this customer. Nil until `refresh()` has answered.
    @Published public private(set) var memory: CustomerMemory?
    /// True while a turn is running.
    @Published public private(set) var isThinking = false
    /// True while the app records. Set it with `setRecording`.
    @Published public private(set) var isRecording = false
    /// True while the app plays speech. Set it with `setSpeaking`.
    @Published public private(set) var isSpeaking = false
    /// The language of the last spoken question (`fi`, `de`…), when it was recognised.
    @Published public private(set) var heardLanguage: String?
    /// The sentence of the last failed `approve`, `decline`, `confirmBill`, `setRemembering` or `forget`.
    /// Cleared by the next one that works.
    @Published public private(set) var notice: String?

    /// The bill card the user has open, if any. Sent with each question.
    public var focusBill: BillType?
    /// True: answers are short and meant to be spoken, and `speech` gets every `filler` and `sentence`.
    public var speakReplies: Bool
    /// `auto` (answer in the language asked in) or an ISO 639-1 code such as `fi`.
    public var language: String
    /// Where sentences go when `speakReplies` is true. The session keeps it alive, so a speech output that
    /// needs the session (to call `setSpeaking`) should hold it weakly.
    public var speech: SpeechOutput?

    private var history: [ChatTurn] = []
    private var turnTask: Task<Void, Never>?
    private var turnToken = 0
    private let makeId: () -> String

    /// - Parameters:
    ///   - speakReplies: defaults to true when a `speech` output is given, false otherwise.
    ///   - makeId: makes message ids. Inject a counter in tests.
    public init(customerId: String, client: CoachClient, speech: SpeechOutput? = nil, speakReplies: Bool? = nil, language: String = "auto",
                focusBill: BillType? = nil, makeId: @escaping () -> String = { UUID().uuidString }) {
        self.customerId = customerId
        self.client = client
        self.speech = speech
        self.speakReplies = speakReplies ?? (speech != nil)
        self.language = language
        self.focusBill = focusBill
        self.makeId = makeId
    }

    /// A session against a real server.
    public static func live(customerId: String, baseURL: URL, session: URLSession = .shared, speech: SpeechOutput? = nil) -> CoachSession {
        CoachSession(customerId: customerId, client: .live(baseURL: baseURL, session: session), speech: speech)
    }

    /// A session against the recordings bundled with the package. No server; label everything "Sample data".
    public static func sample(customerId: String, eventDelay: TimeInterval = 0.02, speech: SpeechOutput? = nil) -> CoachSession {
        CoachSession(customerId: customerId, client: .sample(eventDelay: eventDelay), speech: speech)
    }

    // MARK: Derived state

    /// `recording` wins over `thinking`, which wins over `speaking`.
    public var status: CoachStatus {
        isRecording ? .recording : isThinking ? .thinking : isSpeaking ? .speaking : .idle
    }

    /// Euros a month freed by approved switches. Feed it to the futures chart as the monthly bill saving.
    public var approvedMonthlySaving: Double {
        actions.filter { $0.status == .executedSimulated && $0.kind == .switchContract }.reduce(0) { $0 + $1.monthlyAmountEur }
    }

    /// `.sample` for the bundled recordings, `.mock` when the server says `mock: true`, otherwise `.live`.
    public var dataLabel: CoachDataLabel {
        if client.kind == .bundledSample { return .sample }
        return server?.mock == true ? .mock : .live
    }

    /// True when this session answers from the bundled recordings.
    public var isSample: Bool { client.kind == .bundledSample }

    // MARK: Turns

    /// Sends a typed question. Blank text does nothing (and returns nil). The server takes up to 500
    /// characters; a longer question comes back as a sentence in the reply's `error`.
    @discardableResult
    public func ask(_ text: String) -> Task<Void, Never>? {
        let question = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty else { return nil }
        return runTurn(.typed(question))
    }

    /// Sisu works through a whole case on its own: watch `stages` on the reply fill in.
    /// - Parameter focus: optional, for example `my mobile bill`.
    @discardableResult
    public func investigate(_ focus: String? = nil) -> Task<Void, Never> {
        let trimmed = focus?.trimmingCharacters(in: .whitespacesAndNewlines)
        return runTurn(.investigate(trimmed?.isEmpty == false ? trimmed : nil))
    }

    /// Sends a recording to `/api/voice/turn` (up to 5 MB, so keep it under a minute). The stream starts with
    /// what was heard, which becomes the user message; the rest is handled like a typed turn.
    /// - Parameter language: `auto` or an ISO 639-1 code to listen for. Nil uses the session's `language`.
    @discardableResult
    public func sendVoice(audio: Data, fileName: String = "speech.m4a", mimeType: String = "audio/mp4", language: String? = nil) -> Task<Void, Never> {
        runTurn(.voice(audio: audio, fileName: fileName, mimeType: mimeType, language: language ?? self.language))
    }

    /// Stops whatever Sisu is doing: aborts the stream, stops speech, and leaves what has arrived on screen.
    public func cancel() {
        turnToken += 1
        turnTask?.cancel()
        turnTask = nil
        speech?.stop()
        if isThinking { isThinking = false }
        for index in messages.indices where messages[index].pending { messages[index].pending = false }
    }

    /// Clears the conversation. Actions and memory belong to the customer and stay.
    public func reset() {
        cancel()
        history = []
        messages = []
    }

    /// Call when the microphone opens and closes. Opening it interrupts Sisu, as pressing the talk button does.
    public func setRecording(_ recording: Bool) {
        if recording { cancel() }
        if isRecording != recording { isRecording = recording }
    }

    /// Call from the `SpeechOutput` when sound starts and stops.
    public func setSpeaking(_ speaking: Bool) {
        if isSpeaking != speaking { isSpeaking = speaking }
    }

    private enum TurnInput {
        case typed(String)
        case investigate(String?)
        case voice(audio: Data, fileName: String, mimeType: String, language: String)
    }

    private func runTurn(_ input: TurnInput) -> Task<Void, Never> {
        cancel()
        turnToken += 1
        let token = turnToken
        let spoken = speakReplies
        let mode = spoken ? "voice" : "text"
        let chosen = language == "auto" || language.isEmpty ? nil : language

        let userText: String
        let stream: AsyncThrowingStream<SisuEvent, Error>
        switch input {
        case .typed(let text):
            userText = text
            stream = client.ask(AgentRequest(customerId: customerId, text: text, mode: mode, history: history, focusBill: focusBill, language: chosen))
        case .investigate(let focus):
            userText = Self.investigateText
            stream = client.investigate(InvestigateRequest(customerId: customerId, mode: mode, text: focus, language: chosen))
        case .voice(let audio, let fileName, let mimeType, let heard):
            userText = ""
            stream = client.voiceTurn(customerId: customerId, audio: audio, fileName: fileName, mimeType: mimeType, history: history,
                                      focusBill: focusBill, language: heard.isEmpty ? "auto" : heard)
        }

        let userId = makeId()
        let replyId = makeId()
        messages.append(CoachMessage(id: userId, role: .user, text: userText, pending: userText.isEmpty))
        messages.append(CoachMessage(id: replyId, role: .assistant, pending: true))
        isThinking = true

        let task = Task { [weak self] in
            var turn = TurnProgress(question: userText)
            do {
                for try await event in stream {
                    guard let self, self.turnToken == token, !Task.isCancelled else { return }
                    self.apply(event, userId: userId, replyId: replyId, spoken: spoken, turn: &turn)
                }
            } catch {
                guard let self, self.turnToken == token, !Task.isCancelled else { return }
                self.patch(userId) { $0.pending = false }
                self.patch(replyId) { $0.pending = false; $0.error = CoachErrors.sentence(for: error) }
            }
            guard let self, self.turnToken == token else { return }
            self.turnTask = nil
            self.isThinking = false
            for index in self.messages.indices where self.messages[index].pending { self.messages[index].pending = false }
        }
        turnTask = task
        return task
    }

    private struct TurnProgress {
        var question: String
        var spokenOrder = 0
    }

    private func patch(_ id: String, _ change: (inout CoachMessage) -> Void) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        var message = messages[index]
        change(&message)
        if message != messages[index] { messages[index] = message }
    }

    private func say(_ text: String, spoken: Bool, turn: inout TurnProgress) {
        guard spoken, let speech, !text.isEmpty else { return }
        speech.speak(text, order: turn.spokenOrder)
        turn.spokenOrder += 1
    }

    private func apply(_ event: SisuEvent, userId: String, replyId: String, spoken: Bool, turn: inout TurnProgress) {
        // What only concerns the reply message.
        patch(replyId) { $0.apply(event) }
        // What concerns the session.
        switch event {
        case .start(_, let provider, let model, let mock):
            let info = ServerInfo(mock: mock, provider: provider, model: model)
            if server != info { server = info }
        case .transcript(let text, _, let language, _):
            turn.question = text
            patch(userId) { $0.text = text.isEmpty ? "(nothing heard)" : text; $0.pending = false }
            if let language, !language.isEmpty { heardLanguage = language }
        case .filler(let text), .sentence(_, let text):
            say(text, spoken: spoken, turn: &turn)
        case .action(let action):
            actions = [action] + actions.filter { $0.id != action.id }
        case .memory:
            Task { [weak self] in await self?.refresh() }
        case .done(let text, _, _):
            history = Array((history + [ChatTurn(role: "user", content: turn.question), ChatTurn(role: "assistant", content: text)]).suffix(12))
        case .error:
            patch(userId) { $0.pending = false }
        case .speculation, .delta, .toolStart, .toolEnd, .research, .stage, .teaching, .grounding, .unknown:
            break
        }
    }

    // MARK: Actions

    /// The Approve button. Approval is the only thing that carries an action out, and it is a simulation.
    /// Returns the action with `impact` filled in, or nil when it failed (the sentence is in `notice`).
    @discardableResult
    public func approve(_ actionId: String) async -> AgentAction? {
        await decide { try await $0.approveAction(customerId: $1, actionId: actionId) }
    }

    /// The Decline button. Returns the updated action, or nil when it failed (the sentence is in `notice`).
    @discardableResult
    public func decline(_ actionId: String) async -> AgentAction? {
        await decide { try await $0.declineAction(customerId: $1, actionId: actionId) }
    }

    /// Prepares a contract switch from a button (not from the conversation). The action then waits for
    /// approval in `actions`. Returns nil when it failed, for example because offers have not been looked up
    /// yet (the sentence is in `notice`).
    /// - Parameter provider: optional; the default is the best offer.
    @discardableResult
    public func prepareSwitch(billType: BillType, provider: String? = nil) async -> AgentAction? {
        await decide { try await $0.prepareAction(PrepareActionRequest(customerId: $1, kind: .switchContract, billType: billType, provider: provider)) }
    }

    private func decide(_ call: @Sendable (CoachClient, String) async throws -> AgentAction) async -> AgentAction? {
        do {
            let action = try await call(client, customerId)
            put(action)
            notice = nil
            return action
        } catch {
            notice = CoachErrors.sentence(for: error)
            // Already decided or expired: the server knows the real state.
            if case SisuError.server(let status, _) = error, status == 409 || status == 410 { await refresh() }
            return nil
        }
    }

    private func put(_ action: AgentAction) {
        actions = [action] + actions.filter { $0.id != action.id }
        sync([action])
    }

    /// Keeps the copies of an action inside messages (the card and its stage) equal to the newest one.
    private func sync(_ fresh: [AgentAction]) {
        let byId = Dictionary(fresh.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        for index in messages.indices {
            var message = messages[index]
            if let id = message.action?.id, let action = byId[id] { message.action = action }
            for stageIndex in message.stages.indices {
                if case .action(let old) = message.stages[stageIndex].data, let action = byId[old.id] {
                    message.stages[stageIndex].data = .action(action)
                }
            }
            if message != messages[index] { messages[index] = message }
        }
    }

    // MARK: Memory and loading

    /// The user confirms or corrects a bill's name: saves it, then starts offer research for that kind of bill
    /// (without waiting for it), so offers are ready before the user asks.
    public func confirmBill(_ billId: String, name: String, billType: BillType? = nil) async {
        do {
            memory = try await client.confirmBill(customerId: customerId, billId: billId, name: name, billType: billType)
            notice = nil
        } catch {
            notice = CoachErrors.sentence(for: error)
            return
        }
        if let billType {
            _ = try? await client.research(customerId: customerId, billType: billType, wait: false)
        }
    }

    /// Switches remembering on or off. Off erases what was stored.
    public func setRemembering(_ on: Bool) async {
        do {
            memory = try await client.setMemoryConsent(customerId: customerId, consent: on)
            notice = nil
        } catch {
            notice = CoachErrors.sentence(for: error)
        }
    }

    /// Forgets one remembered item, or everything when `itemId` is nil.
    public func forget(itemId: String? = nil) async {
        do {
            memory = try await client.forgetMemory(customerId: customerId, itemId: itemId)
            notice = nil
        } catch {
            notice = CoachErrors.sentence(for: error)
        }
    }

    /// Reloads `actions` and `memory` from the server. A failed half keeps what was there.
    public func refresh() async {
        let client = self.client
        let customerId = self.customerId
        async let list = try? await client.actions(customerId: customerId)
        async let remembered = try? await client.memory(customerId: customerId)
        let (loadedList, loadedMemory) = await (list, remembered)
        if let loadedList {
            if actions != loadedList.actions { actions = loadedList.actions }
            sync(loadedList.actions)
        }
        if let loadedMemory, memory != loadedMemory { memory = loadedMemory }
    }

    /// Call when the app opens: opens the server's connections and learns whether it is in mock mode.
    /// Returns nil when the server could not be reached.
    @discardableResult
    public func warm() async -> ServerInfo? {
        guard let answer = try? await client.warm() else { return nil }
        if server != answer.server { server = answer.server }
        return answer.server
    }

    /// `warm()` and `refresh()` together: call it once when the customer's screen opens.
    public func open() async {
        await warm()
        await refresh()
    }
}

/// Friendly sentences for errors. Number first is not possible here, so: calm, one next step, no blame.
public enum CoachErrors {
    public static let generic = "Sisu could not answer just now. Please try again."
    public static let offline = "The connection dropped. Please try again."
    public static let expired = "Prices may have changed. Ask Sisu to prepare it again."
    public static let alreadyDecided = "That has already been decided."
    public static let tooMany = "Sisu is getting a lot of questions. Please wait a moment and try again."
    public static let unreadable = "Sisu sent an answer the app could not read. Please try again."
    public static let unknownCustomer = "We could not find that customer."

    /// The sentence to show for an error from `CoachClient` or `SisuAPI`.
    /// A server error shows the server's own sentence when it sent one, except 410 (expired), which always
    /// shows `expired`. Without a sentence: 409 gives `alreadyDecided`, 429 `tooMany`, anything else `generic`.
    public static func sentence(for error: Error) -> String {
        guard let error = error as? SisuError else { return error is CancellationError ? "" : generic }
        switch error {
        case .server(let status, let message):
            if status == 410 { return expired }
            if !message.isEmpty { return message }
            if status == 409 { return alreadyDecided }
            if status == 429 { return tooMany }
            return generic
        case .offline: return offline
        case .invalidResponse: return unreadable
        case .unknownCustomer: return unknownCustomer
        case .notImplemented, .invalidState: return generic
        }
    }
}
