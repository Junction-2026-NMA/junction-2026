// The HTTP requests of every coach endpoint in the frontend contract. Pure functions, so they can be tested
// without a network. Bodies hold only what the contract names: transaction rows are never sent anywhere.
import Foundation

/// Builds a `multipart/form-data` body.
public struct MultipartForm: Sendable {
    public let boundary: String
    private var body = Data()

    /// - Parameter boundary: the separator between parts. Inject a fixed one in tests.
    public init(boundary: String = "sisu-" + UUID().uuidString) {
        self.boundary = boundary
    }

    public var contentType: String { "multipart/form-data; boundary=\(boundary)" }

    private static func clean(_ text: String) -> String {
        text.replacingOccurrences(of: "\"", with: "").replacingOccurrences(of: "\r", with: "").replacingOccurrences(of: "\n", with: "")
    }

    /// Adds a text field.
    public mutating func field(_ name: String, _ value: String) {
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(Self.clean(name))\"\r\n\r\n\(value)\r\n".utf8))
    }

    /// Adds a file part.
    public mutating func file(_ name: String, fileName: String, mimeType: String, data: Data) {
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(Self.clean(name))\"; filename=\"\(Self.clean(fileName))\"\r\nContent-Type: \(Self.clean(mimeType))\r\n\r\n".utf8))
        body.append(data)
        body.append(Data("\r\n".utf8))
    }

    /// The finished body, with the closing boundary.
    public var data: Data {
        body + Data("--\(boundary)--\r\n".utf8)
    }
}

public enum CoachEndpoints {
    /// Seconds before each kind of request counts as offline.
    public static let quickTimeout: TimeInterval = 5
    public static let researchTimeout: TimeInterval = 15
    public static let voiceTimeout: TimeInterval = 30
    public static let streamTimeout: TimeInterval = 90

    static func encode<T: Encodable>(_ body: T) -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return (try? encoder.encode(body)) ?? Data("{}".utf8)
    }

    static func get(_ baseURL: URL, _ path: String, query: [(String, String)] = [], timeout: TimeInterval = quickTimeout) -> URLRequest {
        var request = Endpoints.get(Endpoints.url(baseURL, path, query: query))
        request.timeoutInterval = timeout
        return request
    }

    static func post<T: Encodable>(_ baseURL: URL, _ path: String, _ body: T, query: [(String, String)] = [], timeout: TimeInterval = quickTimeout) -> URLRequest {
        var request = Endpoints.postJSON(Endpoints.url(baseURL, path, query: query), body: encode(body))
        request.timeoutInterval = timeout
        return request
    }

    static func stream<T: Encodable>(_ baseURL: URL, _ path: String, _ body: T) -> URLRequest {
        var request = post(baseURL, path, body, timeout: streamTimeout)
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        return request
    }

    /// A number as a query value: `200`, `199.5`.
    static func number(_ value: Double) -> String {
        guard value.isFinite else { return "0" }
        return value == value.rounded() && abs(value) < 1e15 ? String(Int64(value)) : String(value)
    }

    // MARK: Server

    /// `GET {base}/api/agent/warm`. Call when the app opens.
    public static func warm(baseURL: URL) -> URLRequest { get(baseURL, "/api/agent/warm", timeout: researchTimeout) }

    /// `GET {base}/api/health`
    public static func health(baseURL: URL) -> URLRequest { get(baseURL, "/api/health") }

    /// `POST {base}/api/demo/reset`, with the header `x-sisu-reset-token` when a token is given.
    public static func demoReset(baseURL: URL, token: String? = nil) -> URLRequest {
        var request = post(baseURL, "/api/demo/reset", [String: String]())
        if let token, !token.isEmpty { request.setValue(token, forHTTPHeaderField: "x-sisu-reset-token") }
        return request
    }

    // MARK: Research

    /// `POST {base}/api/research` with `{ customerId, billType, wait?, yearlyKwh? }`.
    public static func research(baseURL: URL, _ body: ResearchRequest) -> URLRequest {
        post(baseURL, "/api/research", body, timeout: body.wait == false ? quickTimeout : researchTimeout)
    }

    /// `GET {base}/api/research?customerId=&billType=`: what has been found so far (404 before any research).
    public static func researchSnapshot(baseURL: URL, customerId: String, billType: BillType) -> URLRequest {
        get(baseURL, "/api/research", query: [("customerId", customerId), ("billType", billType.rawValue)])
    }

    // MARK: Memory

    /// `GET {base}/api/memory?customerId=`
    public static func memory(baseURL: URL, customerId: String) -> URLRequest {
        get(baseURL, "/api/memory", query: [("customerId", customerId)])
    }

    /// `POST {base}/api/memory` with `{ customerId, kind, key?, value, billType? }`.
    public static func saveMemory(baseURL: URL, _ body: MemorySaveRequest) -> URLRequest { post(baseURL, "/api/memory", body) }

    /// `POST {base}/api/memory` with `{ customerId, consent }`. `consent: false` erases what was stored.
    public static func memoryConsent(baseURL: URL, _ body: MemoryConsentRequest) -> URLRequest { post(baseURL, "/api/memory", body) }

    /// `DELETE {base}/api/memory?customerId=&itemId=`. Without an item id everything is forgotten.
    public static func forgetMemory(baseURL: URL, customerId: String, itemId: String? = nil) -> URLRequest {
        var query = [("customerId", customerId)]
        if let itemId { query.append(("itemId", itemId)) }
        var request = get(baseURL, "/api/memory", query: query)
        request.httpMethod = "DELETE"
        return request
    }

    // MARK: Actions

    /// `POST {base}/api/actions/prepare` with `{ customerId, kind, billType?, provider?, monthlyAmountEur? }`.
    public static func prepareAction(baseURL: URL, _ body: PrepareActionRequest) -> URLRequest { post(baseURL, "/api/actions/prepare", body) }

    /// `POST {base}/api/actions/{id}/approve` with `{ customerId, confirm: true }`.
    public static func approveAction(baseURL: URL, customerId: String, actionId: String) -> URLRequest {
        post(baseURL, "/api/actions/\(Endpoints.escape(actionId))/approve", ActionDecisionRequest(customerId: customerId, confirm: true))
    }

    /// `POST {base}/api/actions/{id}/decline` with `{ customerId }`.
    public static func declineAction(baseURL: URL, customerId: String, actionId: String) -> URLRequest {
        post(baseURL, "/api/actions/\(Endpoints.escape(actionId))/decline", ActionDecisionRequest(customerId: customerId))
    }

    /// `GET {base}/api/actions?customerId=`: the actions and the audit trail.
    public static func actions(baseURL: URL, customerId: String) -> URLRequest {
        get(baseURL, "/api/actions", query: [("customerId", customerId)])
    }

    /// `GET {base}/api/audit?customerId=`
    public static func audit(baseURL: URL, customerId: String) -> URLRequest {
        get(baseURL, "/api/audit", query: [("customerId", customerId)])
    }

    // MARK: Coach (no model, instant)

    /// `GET {base}/api/coach/patterns?customerId=`
    public static func patterns(baseURL: URL, customerId: String) -> URLRequest {
        get(baseURL, "/api/coach/patterns", query: [("customerId", customerId)])
    }

    /// `GET {base}/api/coach/cash-flow?customerId=`
    public static func cashFlow(baseURL: URL, customerId: String) -> URLRequest {
        get(baseURL, "/api/coach/cash-flow", query: [("customerId", customerId)])
    }

    /// `GET {base}/api/coach/affordability?customerId=&amountEur=`
    public static func affordability(baseURL: URL, customerId: String, amountEur: Double) -> URLRequest {
        get(baseURL, "/api/coach/affordability", query: [("customerId", customerId), ("amountEur", number(amountEur))])
    }

    /// `GET {base}/api/coach/teaching?customerId=&concept=`. Without a concept all seven cards come back.
    public static func teaching(baseURL: URL, customerId: String, concept: ConceptId? = nil) -> URLRequest {
        var query = [("customerId", customerId)]
        if let concept { query.append(("concept", concept.rawValue)) }
        return get(baseURL, "/api/coach/teaching", query: query)
    }

    /// `GET {base}/api/coach/mortgage?customerId=` (404 when the customer has none).
    public static func mortgage(baseURL: URL, customerId: String) -> URLRequest {
        get(baseURL, "/api/coach/mortgage", query: [("customerId", customerId)])
    }

    // MARK: Agent (event streams)

    /// `POST {base}/api/agent/query` with `{ customerId, text, mode, history?, focusBill?, language? }`.
    public static func agentQuery(baseURL: URL, _ body: AgentRequest) -> URLRequest { stream(baseURL, "/api/agent/query", body) }

    /// `POST {base}/api/agent/investigate` with `{ customerId, mode?, text?, language? }`.
    public static func agentInvestigate(baseURL: URL, _ body: InvestigateRequest) -> URLRequest { stream(baseURL, "/api/agent/investigate", body) }

    /// `POST {base}/api/agent/bill-photo`: a multipart form with the fields `image` (PNG, JPEG or WebP, up to
    /// 4 MB; resize phone photos to about 1,500 pixels wide first) and `customerId`.
    public static func billPhoto(baseURL: URL, customerId: String, image: Data, fileName: String = "bill.jpg", mimeType: String = "image/jpeg",
                                 boundary: String? = nil) -> URLRequest {
        var form = boundary.map { MultipartForm(boundary: $0) } ?? MultipartForm()
        form.file("image", fileName: fileName, mimeType: mimeType, data: image)
        form.field("customerId", customerId)
        return multipart(baseURL, "/api/agent/bill-photo", form, timeout: voiceTimeout)
    }

    /// `POST {base}/api/agent/plan` with `{ customerId, fresh?, language? }`: the money plan as an event stream.
    public static func agentPlan(baseURL: URL, _ body: PlanRequest) -> URLRequest { stream(baseURL, "/api/agent/plan", body) }

    /// `GET {base}/api/agent/visuals?customerId=`: every chart for a customer, with no model call.
    public static func visuals(baseURL: URL, customerId: String) -> URLRequest {
        get(baseURL, "/api/agent/visuals", query: [("customerId", customerId)])
    }

    /// `POST {base}/api/actions/approve-all` with `{ customerId, actionIds, confirm: true }`.
    public static func approveAll(baseURL: URL, customerId: String, actionIds: [String]) -> URLRequest {
        post(baseURL, "/api/actions/approve-all", ApproveAllRequest(customerId: customerId, actionIds: actionIds))
    }

    // MARK: Voice

    /// `GET {base}/api/voice/tts`: voices, models and the languages for a picker.
    public static func voiceOptions(baseURL: URL) -> URLRequest { get(baseURL, "/api/voice/tts") }

    /// `POST {base}/api/voice/tts` with `{ text, format?, previousText?, model?, voiceId?, language? }`. Answers with audio bytes.
    public static func textToSpeech(baseURL: URL, _ body: SpeechRequest) -> URLRequest {
        var request = post(baseURL, "/api/voice/tts", body, timeout: voiceTimeout)
        request.setValue("audio/*", forHTTPHeaderField: "Accept")
        return request
    }

    /// `POST {base}/api/voice/stt`: a multipart form with the fields `audio` (the recording) and `language`
    /// (`auto` or an ISO 639-1 code).
    public static func speechToText(baseURL: URL, audio: Data, fileName: String, mimeType: String, language: String = "auto",
                                    boundary: String? = nil) -> URLRequest {
        var form = boundary.map { MultipartForm(boundary: $0) } ?? MultipartForm()
        form.file("audio", fileName: fileName, mimeType: mimeType, data: audio)
        form.field("language", language)
        return multipart(baseURL, "/api/voice/stt", form, timeout: voiceTimeout)
    }

    /// `POST {base}/api/voice/turn`: a multipart form with the fields `audio`, `customerId`, `history` (a JSON
    /// array of `{ role, content }`), `focusBill` (only when set) and `language`. Answers with the event stream.
    public static func voiceTurn(baseURL: URL, customerId: String, audio: Data, fileName: String, mimeType: String, history: [ChatTurn] = [],
                                 focusBill: BillType? = nil, language: String = "auto", boundary: String? = nil) -> URLRequest {
        var form = boundary.map { MultipartForm(boundary: $0) } ?? MultipartForm()
        form.file("audio", fileName: fileName, mimeType: mimeType, data: audio)
        form.field("customerId", customerId)
        form.field("history", String(decoding: encode(history), as: UTF8.self))
        if let focusBill { form.field("focusBill", focusBill.rawValue) }
        form.field("language", language)
        var request = multipart(baseURL, "/api/voice/turn", form, timeout: streamTimeout)
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        return request
    }

    static func multipart(_ baseURL: URL, _ path: String, _ form: MultipartForm, timeout: TimeInterval) -> URLRequest {
        var request = URLRequest(url: Endpoints.url(baseURL, path))
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        request.setValue(form.contentType, forHTTPHeaderField: "Content-Type")
        request.httpBody = form.data
        return request
    }
}
