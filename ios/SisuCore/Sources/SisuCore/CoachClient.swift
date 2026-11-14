// The typed client of every endpoint in the frontend contract, on top of a `SisuTransport`.
import Foundation

/// Calls the team backend (or the bundled recordings) and decodes the answers.
///
/// Errors, for every call:
/// - a non-2xx answer throws `SisuError.server(status:message:)`, where `message` is the body's `error`
///   sentence (empty when there is none). Keep the status: 409 means "offers not looked up yet" or "already
///   decided", 410 means the action expired, 429 means too many requests.
/// - a body that does not decode throws `SisuError.invalidResponse`.
/// - a failure to reach the server throws `SisuError.offline`.
///
/// The client is a value: copy it freely and call it from any task.
public struct CoachClient: Sendable {
    public let baseURL: URL
    public let transport: SisuTransport

    public init(baseURL: URL, transport: SisuTransport) {
        self.baseURL = baseURL
        self.transport = transport
    }

    /// A client of a real server, for example `CoachClient.live(baseURL: URL(string: "http://localhost:3000")!)`.
    public static func live(baseURL: URL, session: URLSession = .shared) -> CoachClient {
        CoachClient(baseURL: baseURL, transport: URLSessionTransport(session: session))
    }

    /// A client of the recordings bundled with the package: no server, everything is sample data.
    /// - Parameter eventDelay: seconds between two replayed stream messages (0 in tests).
    public static func sample(eventDelay: TimeInterval = 0.02) -> CoachClient {
        CoachClient(baseURL: sampleBaseURL, transport: ReplayTransport(eventDelay: eventDelay))
    }

    /// A client of a real server that switches to the bundled sample, for good, the first time the server
    /// cannot be reached. Sessions built on it publish `fallbackNotice` at that moment.
    public static func liveWithSampleFallback(baseURL: URL, session: URLSession = .shared, eventDelay: TimeInterval = 0.02,
                                              now: @escaping @Sendable () -> Date = { Date() }) -> CoachClient {
        CoachClient(baseURL: baseURL, transport: FallbackTransport(primary: URLSessionTransport(session: session),
                                                                   sample: ReplayTransport(eventDelay: eventDelay), now: now))
    }

    /// The sentence to show once when this client has fallen back from the live server to the bundled sample;
    /// nil while it is live (and for a client that was a sample from the start, which is disclosed up front).
    public var fallbackNotice: String? {
        guard let fallback = transport as? FallbackTransport, fallback.fallenBackAt != nil else { return nil }
        return Self.fallbackSentence
    }

    /// When this client fell back to the sample, for the freshness line in Settings. Nil while it is live.
    public var fallenBackAt: Date? { (transport as? FallbackTransport)?.fallenBackAt }

    public static let fallbackSentence = "The server could not be reached. Showing sample data recorded on 14 Nov 2026."

    /// The placeholder address of the sample client. Nothing is ever sent to it.
    public static let sampleBaseURL = URL(string: "https://sample.invalid")!

    /// `.live` for a real server, `.bundledSample` for the recordings ("Sample data").
    public var kind: DataSourceKind { transport.kind }

    // MARK: Plumbing

    static func errorMessage(_ body: Data) -> String {
        (try? JSONDecoder().decode(ApiError.self, from: body))?.error ?? ""
    }

    func response(_ request: URLRequest) async throws -> TransportResponse {
        let response = try await transport.send(request)
        guard (200..<300).contains(response.status) else {
            throw SisuError.server(status: response.status, message: Self.errorMessage(response.body))
        }
        return response
    }

    func call<T: Decodable>(_ request: URLRequest, as type: T.Type) async throws -> T {
        let response = try await response(request)
        do {
            return try JSONDecoder().decode(T.self, from: response.body)
        } catch {
            throw SisuError.invalidResponse
        }
    }

    /// Opens an agent stream and gives its events as they arrive. An HTTP error or a dropped connection ends
    /// the stream by throwing (`SisuError.server` or `.offline`). Cancel the task that reads it to abort the turn.
    public func events(for request: URLRequest) -> AsyncThrowingStream<SisuEvent, Error> {
        messages(for: request) { SisuEvent.decode($0) }
    }

    /// Opens the money plan's stream and gives its events as they arrive. Errors as for `events(for:)`.
    public func planEvents(for request: URLRequest) -> AsyncThrowingStream<PlanEvent, Error> {
        messages(for: request) { PlanEvent.decode($0) }
    }

    func messages<Event: Sendable>(for request: URLRequest, decode: @escaping @Sendable (Data) -> Event?) -> AsyncThrowingStream<Event, Error> {
        let transport = self.transport
        return AsyncThrowingStream<Event, Error> { continuation in
            let task = Task {
                do {
                    let stream = try await transport.open(request)
                    guard (200..<300).contains(stream.status) else {
                        var body = Data()
                        for try await chunk in stream.chunks { body.append(chunk) }
                        throw SisuError.server(status: stream.status, message: Self.errorMessage(body))
                    }
                    var parser = SSEParser()
                    for try await chunk in stream.chunks {
                        for message in parser.feed(chunk) {
                            if let event = decode(Data(message.data.utf8)) { continuation.yield(event) }
                        }
                    }
                    for message in parser.finish() {
                        if let event = decode(Data(message.data.utf8)) { continuation.yield(event) }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    // MARK: Server

    /// `GET /api/agent/warm`: opens the server's connections and says whether it is in mock mode.
    public func warm() async throws -> WarmResponse { try await call(CoachEndpoints.warm(baseURL: baseURL), as: WarmResponse.self) }

    /// `GET /api/health`
    public func health() async throws -> HealthReport { try await call(CoachEndpoints.health(baseURL: baseURL), as: HealthReport.self) }

    /// `POST /api/demo/reset`: clears actions, memory and the audit log of the three demo customers.
    @discardableResult
    public func resetDemo(token: String? = nil) async throws -> DemoResetResult {
        try await call(CoachEndpoints.demoReset(baseURL: baseURL, token: token), as: DemoResetResult.self)
    }

    // MARK: Research

    /// `POST /api/research`. With `wait: false` it returns at once (often with `status` `running`) while the
    /// offers load in the background; otherwise it waits up to about nine seconds for usable offers.
    public func research(customerId: String, billType: BillType, wait: Bool = true, yearlyKwh: Double? = nil) async throws -> ResearchResult {
        let body = ResearchRequest(customerId: customerId, billType: billType, wait: wait ? nil : false, yearlyKwh: yearlyKwh)
        return try await call(CoachEndpoints.research(baseURL: baseURL, body), as: ResearchResult.self)
    }

    /// `GET /api/research`: what has been found so far. Throws `.server(status: 404, …)` before any research.
    public func researchSnapshot(customerId: String, billType: BillType) async throws -> ResearchResult {
        try await call(CoachEndpoints.researchSnapshot(baseURL: baseURL, customerId: customerId, billType: billType), as: ResearchResult.self)
    }

    // MARK: Memory

    /// `GET /api/memory`
    public func memory(customerId: String) async throws -> CustomerMemory {
        try await call(CoachEndpoints.memory(baseURL: baseURL, customerId: customerId), as: CustomerMemory.self)
    }

    /// `POST /api/memory`: saves one item and returns the whole memory.
    public func saveMemory(_ body: MemorySaveRequest) async throws -> CustomerMemory {
        try await call(CoachEndpoints.saveMemory(baseURL: baseURL, body), as: CustomerMemory.self)
    }

    /// Saves the name the user confirmed for a bill. With a bill type the server also starts offer research.
    public func confirmBill(customerId: String, billId: String, name: String, billType: BillType? = nil) async throws -> CustomerMemory {
        try await saveMemory(MemorySaveRequest(customerId: customerId, kind: .billName, key: billId, value: name, billType: billType))
    }

    /// Saves the yearly electricity use the user stated or confirmed from a bill.
    public func rememberKwh(customerId: String, yearlyKwh: Double) async throws -> CustomerMemory {
        try await saveMemory(MemorySaveRequest(customerId: customerId, kind: .yearlyKwh, value: CoachEndpoints.number(yearlyKwh)))
    }

    /// `POST /api/memory` with `consent`. `false` switches remembering off and erases what was stored.
    public func setMemoryConsent(customerId: String, consent: Bool) async throws -> CustomerMemory {
        try await call(CoachEndpoints.memoryConsent(baseURL: baseURL, MemoryConsentRequest(customerId: customerId, consent: consent)), as: CustomerMemory.self)
    }

    /// `DELETE /api/memory`: forgets one item, or everything when `itemId` is nil.
    public func forgetMemory(customerId: String, itemId: String? = nil) async throws -> CustomerMemory {
        try await call(CoachEndpoints.forgetMemory(baseURL: baseURL, customerId: customerId, itemId: itemId), as: CustomerMemory.self)
    }

    // MARK: Actions

    /// `POST /api/actions/prepare`. Throws `.server(status: 409, …)` when offers have not been looked up yet or
    /// no offer is cheaper.
    public func prepareAction(_ body: PrepareActionRequest) async throws -> AgentAction {
        try await call(CoachEndpoints.prepareAction(baseURL: baseURL, body), as: ActionEnvelope.self).action
    }

    /// `POST /api/actions/:id/approve` with `confirm: true`. The answer has `impact` filled in.
    /// Throws `.server` with 404 (not this customer's), 409 (already decided) or 410 (expired).
    public func approveAction(customerId: String, actionId: String) async throws -> AgentAction {
        try await call(CoachEndpoints.approveAction(baseURL: baseURL, customerId: customerId, actionId: actionId), as: ActionEnvelope.self).action
    }

    /// `POST /api/actions/:id/decline`. Errors as for `approveAction`.
    public func declineAction(customerId: String, actionId: String) async throws -> AgentAction {
        try await call(CoachEndpoints.declineAction(baseURL: baseURL, customerId: customerId, actionId: actionId), as: ActionEnvelope.self).action
    }

    /// `GET /api/actions`: every action of the customer, newest first, with the audit trail.
    public func actions(customerId: String) async throws -> ActionList {
        try await call(CoachEndpoints.actions(baseURL: baseURL, customerId: customerId), as: ActionList.self)
    }

    /// `GET /api/audit`
    public func audit(customerId: String) async throws -> AuditLog {
        try await call(CoachEndpoints.audit(baseURL: baseURL, customerId: customerId), as: AuditLog.self)
    }

    // MARK: Coach (no model, instant)

    /// `GET /api/coach/patterns`: what stands out, ranked by yearly euros.
    public func patterns(customerId: String) async throws -> [Pattern] {
        try await call(CoachEndpoints.patterns(baseURL: baseURL, customerId: customerId), as: PatternList.self).patterns
    }

    /// `GET /api/coach/cash-flow`
    public func cashFlow(customerId: String) async throws -> CashFlow {
        try await call(CoachEndpoints.cashFlow(baseURL: baseURL, customerId: customerId), as: CashFlow.self)
    }

    /// `GET /api/coach/affordability`
    public func affordability(customerId: String, amountEur: Double) async throws -> Affordability {
        try await call(CoachEndpoints.affordability(baseURL: baseURL, customerId: customerId, amountEur: amountEur), as: Affordability.self)
    }

    /// `GET /api/coach/teaching`: one card for a concept, or all seven when `concept` is nil.
    public func teachingCards(customerId: String, concept: ConceptId? = nil) async throws -> [TeachingCard] {
        try await call(CoachEndpoints.teaching(baseURL: baseURL, customerId: customerId, concept: concept), as: TeachingCardList.self).cards
    }

    /// `GET /api/coach/mortgage`. Nil when the customer has no application on record (the server's 404).
    public func mortgage(customerId: String) async throws -> MortgageApplication? {
        do {
            return try await call(CoachEndpoints.mortgage(baseURL: baseURL, customerId: customerId), as: MortgageApplication.self)
        } catch SisuError.server(status: 404, message: let message) where message != ReplayTransport.notInSample {
            return nil
        }
    }

    // MARK: Agent

    /// `POST /api/agent/query` as a stream of events.
    public func ask(_ body: AgentRequest) -> AsyncThrowingStream<SisuEvent, Error> {
        events(for: CoachEndpoints.agentQuery(baseURL: baseURL, body))
    }

    /// `POST /api/agent/investigate` as a stream of events.
    public func investigate(_ body: InvestigateRequest) -> AsyncThrowingStream<SisuEvent, Error> {
        events(for: CoachEndpoints.agentInvestigate(baseURL: baseURL, body))
    }

    /// `POST /api/agent/bill-photo`: the figures printed on a photographed bill. Nothing is saved: show
    /// `toConfirm`, and when the user agrees call `rememberKwh` with `reading.yearlyKwh`.
    public func readBillPhoto(customerId: String, image: Data, fileName: String = "bill.jpg", mimeType: String = "image/jpeg") async throws -> BillPhotoResult {
        try await call(CoachEndpoints.billPhoto(baseURL: baseURL, customerId: customerId, image: image, fileName: fileName, mimeType: mimeType), as: BillPhotoResult.self)
    }

    // MARK: The money plan and charts

    /// `POST /api/agent/plan` as a stream of events, one per real step of the server's work.
    /// - Parameter fresh: false reuses a recent search instead of searching now.
    public func plan(customerId: String, fresh: Bool? = nil, language: String? = nil) -> AsyncThrowingStream<PlanEvent, Error> {
        planEvents(for: CoachEndpoints.agentPlan(baseURL: baseURL, PlanRequest(customerId: customerId, fresh: fresh, language: language)))
    }

    /// `POST /api/actions/approve-all`: one tap approves everything the plan set up (one to six actions).
    /// The server answers 409 when none could be approved; that answer still comes back here, with the reasons
    /// in `failed`, and is not thrown. Other errors as for every call.
    public func approveAll(customerId: String, actionIds: [String]) async throws -> ApproveAllResult {
        let response = try await transport.send(CoachEndpoints.approveAll(baseURL: baseURL, customerId: customerId, actionIds: actionIds))
        if let result = try? JSONDecoder().decode(ApproveAllResult.self, from: response.body) { return result }
        guard (200..<300).contains(response.status) else {
            throw SisuError.server(status: response.status, message: Self.errorMessage(response.body))
        }
        throw SisuError.invalidResponse
    }

    /// `GET /api/agent/visuals`: every chart for a customer at once, with no model call.
    public func visuals(customerId: String) async throws -> [Visual] {
        try await call(CoachEndpoints.visuals(baseURL: baseURL, customerId: customerId), as: VisualList.self).visuals
    }

    // MARK: Voice

    /// `GET /api/voice/tts`: the languages for a picker.
    public func voiceOptions() async throws -> VoiceOptions {
        try await call(CoachEndpoints.voiceOptions(baseURL: baseURL), as: VoiceOptions.self)
    }

    /// `POST /api/voice/stt`: the words of a recording.
    public func transcribe(audio: Data, fileName: String, mimeType: String, language: String = "auto") async throws -> Transcript {
        try await call(CoachEndpoints.speechToText(baseURL: baseURL, audio: audio, fileName: fileName, mimeType: mimeType, language: language), as: Transcript.self)
    }

    /// `POST /api/voice/tts`: the audio of one sentence. Ask for `format: "mp3"` to play it with AVAudioPlayer.
    public func speech(_ body: SpeechRequest) async throws -> SpeechAudio {
        let response = try await response(CoachEndpoints.textToSpeech(baseURL: baseURL, body))
        return SpeechAudio(data: response.body, contentType: response.contentType ?? "application/octet-stream")
    }

    /// `POST /api/voice/turn` as a stream of events. It starts with `transcript` (what was heard).
    public func voiceTurn(customerId: String, audio: Data, fileName: String, mimeType: String, history: [ChatTurn] = [],
                          focusBill: BillType? = nil, language: String = "auto") -> AsyncThrowingStream<SisuEvent, Error> {
        events(for: CoachEndpoints.voiceTurn(baseURL: baseURL, customerId: customerId, audio: audio, fileName: fileName, mimeType: mimeType,
                                             history: history, focusBill: focusBill, language: language))
    }
}

/// The four data routes through the same transport, so one client serves every screen.
extension CoachClient: SisuAPI {
    public func demoCustomers() async throws -> [DemoCustomer] {
        try await call(timed(Endpoints.demoCustomers(baseURL: baseURL)), as: [DemoCustomer].self)
    }

    public func overview(customerId: String) async throws -> Overview {
        try await mapUnknown(customerId) { try await call(timed(Endpoints.overview(baseURL: baseURL, customerId: customerId)), as: Overview.self) }
    }

    public func transactions(customerId: String, filter: EvidenceFilter?) async throws -> TransactionList {
        try await mapUnknown(customerId) {
            try await call(timed(Endpoints.transactions(baseURL: baseURL, customerId: customerId, filter: filter)), as: TransactionList.self)
        }
    }

    public func scenario(customerId: String, input: ScenarioInput) async throws -> ScenarioResponse {
        try await call(timed(Endpoints.scenario(baseURL: baseURL, customerId: customerId, input: input)), as: ScenarioResponse.self)
    }

    private func timed(_ request: URLRequest) -> URLRequest {
        var request = request
        request.timeoutInterval = CoachEndpoints.quickTimeout
        return request
    }

    /// In sample mode a customer outside the recordings is `.unknownCustomer`, as with `FixtureAPI`.
    private func mapUnknown<T>(_ customerId: String, _ work: () async throws -> T) async throws -> T {
        do {
            return try await work()
        } catch SisuError.server(status: 404, message: let message) where message == ReplayTransport.notInSample {
            throw SisuError.unknownCustomer(customerId)
        }
    }
}
