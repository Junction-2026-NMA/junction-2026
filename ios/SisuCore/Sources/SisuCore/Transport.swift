// The network, behind a small protocol: `URLSessionTransport` for live use, `ReplayTransport` for tests and for
// the offline sample mode (it answers from the recordings bundled under Fixtures/coach).
import Foundation

/// A whole HTTP answer.
public struct TransportResponse: Sendable {
    public var status: Int
    public var headers: [String: String]
    public var body: Data

    public init(status: Int, headers: [String: String] = [:], body: Data) {
        self.status = status; self.headers = headers; self.body = body
    }

    public var contentType: String? {
        headers.first { $0.key.lowercased() == "content-type" }?.value
    }
}

/// An HTTP answer whose body arrives in pieces. Stop reading (or cancel the reading task) to close it.
public struct TransportStream: Sendable {
    public var status: Int
    public var headers: [String: String]
    public var chunks: AsyncThrowingStream<Data, Error>

    public init(status: Int, headers: [String: String] = [:], chunks: AsyncThrowingStream<Data, Error>) {
        self.status = status; self.headers = headers; self.chunks = chunks
    }
}

/// Sends requests. A failure to reach the server is thrown as `SisuError.offline`; an HTTP error status is
/// not a failure here (the caller reads `status`).
public protocol SisuTransport: Sendable {
    /// `.live` for a real server, `.bundledSample` for the recordings.
    var kind: DataSourceKind { get }
    /// Sends a request and waits for the whole answer.
    func send(_ request: URLRequest) async throws -> TransportResponse
    /// Sends a request and gives the body as it arrives.
    func open(_ request: URLRequest) async throws -> TransportStream
}

/// The live transport.
public struct URLSessionTransport: SisuTransport {
    public let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public var kind: DataSourceKind { .live }

    static func headers(_ response: HTTPURLResponse) -> [String: String] {
        var out: [String: String] = [:]
        for (key, value) in response.allHeaderFields {
            out[String(describing: key)] = String(describing: value)
        }
        return out
    }

    static func map(_ error: Error) -> Error {
        if error is CancellationError { return error }
        if let urlError = error as? URLError, urlError.code == .cancelled { return CancellationError() }
        return SisuError.offline
    }

    public func send(_ request: URLRequest) async throws -> TransportResponse {
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw SisuError.invalidResponse }
            return TransportResponse(status: http.statusCode, headers: Self.headers(http), body: data)
        } catch let error as SisuError {
            throw error
        } catch {
            throw Self.map(error)
        }
    }

    public func open(_ request: URLRequest) async throws -> TransportStream {
        do {
            let (bytes, response) = try await session.bytes(for: request)
            guard let http = response as? HTTPURLResponse else { throw SisuError.invalidResponse }
            let chunks = AsyncThrowingStream<Data, Error> { continuation in
                let task = Task {
                    do {
                        var buffer = Data()
                        for try await byte in bytes {
                            buffer.append(byte)
                            if byte == 0x0A {
                                continuation.yield(buffer)
                                buffer.removeAll(keepingCapacity: true)
                            }
                        }
                        if !buffer.isEmpty { continuation.yield(buffer) }
                        continuation.finish()
                    } catch {
                        continuation.finish(throwing: Self.map(error))
                    }
                }
                continuation.onTermination = { _ in task.cancel() }
            }
            return TransportStream(status: http.statusCode, headers: Self.headers(http), chunks: chunks)
        } catch let error as SisuError {
            throw error
        } catch {
            throw Self.map(error)
        }
    }
}

/// Answers every request from the recordings bundled with the package, so the whole app works with no
/// backend. Everything it serves is sample data: label it "Sample data".
///
/// - The recordings were made against the team backend in mock mode on 14 Nov 2026 for the three demo
///   customers. A typed question is answered by the recorded turn of the same kind (`recordedTurn`), chosen
///   the way the mock backend itself chooses: a cheaper electricity deal, "can I afford €200", payday, bills,
///   "where does my money go", "what if I save €50 a month", a buffer lesson, restaurant spending, the
///   mortgage, "remember 3500 kWh", and for anything else the backend's general "safe to spend" answer.
/// - Streams are replayed message by message with `eventDelay` seconds between them (0 in tests).
/// - It remembers what happened in this session, so lists stay consistent: an approved or declined action
///   shows in `GET /api/actions`, a saved bill name shows in `GET /api/memory`. `POST /api/demo/reset` clears it.
/// - A request that was not recorded answers with status 404 and the sentence `notInSample`, never a crash.
public final class ReplayTransport: SisuTransport, @unchecked Sendable {
    /// The sentence a request outside the recordings answers with.
    public static let notInSample = "That is not in the sample data. Connect to the server to try it."

    /// Seconds between two replayed stream messages.
    public let eventDelay: TimeInterval

    private let lock = NSLock()
    private var actionLists: [String: String] = [:]
    private var memories: [String: Data] = [:]
    private var decided: Set<String> = []

    public init(eventDelay: TimeInterval = 0.02) {
        self.eventDelay = eventDelay
    }

    public var kind: DataSourceKind { .bundledSample }

    // MARK: Files

    /// The bytes of a bundled recording, for example `fixture("coach/warm.json")`.
    public static func fixture(_ path: String) -> Data? {
        let parts = path.split(separator: "/").map(String.init)
        guard let file = parts.last else { return nil }
        let folder = (["Fixtures"] + parts.dropLast()).joined(separator: "/")
        let name = (file as NSString).deletingPathExtension
        let ext = (file as NSString).pathExtension
        guard let url = Bundle.module.url(forResource: name, withExtension: ext, subdirectory: folder) else { return nil }
        return try? Data(contentsOf: url)
    }

    // MARK: Answers

    enum Answer {
        case body(status: Int, data: Data, contentType: String)
        case stream(Data)
    }

    static func error(_ status: Int, _ message: String) -> Answer {
        let data = (try? JSONSerialization.data(withJSONObject: ["error": message])) ?? Data()
        return .body(status: status, data: data, contentType: "application/json")
    }

    static let missing = error(404, notInSample)

    static func json(_ path: String, status: Int = 200) -> Answer {
        guard let data = fixture(path) else { return missing }
        return .body(status: status, data: data, contentType: "application/json")
    }

    static func object(_ data: Data?) -> [String: Any]? {
        guard let data else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    static func encode(_ object: Any, status: Int = 200) -> Answer {
        guard let data = try? JSONSerialization.data(withJSONObject: object) else { return missing }
        return .body(status: status, data: data, contentType: "application/json")
    }

    /// The value of a text field of a multipart body.
    static func multipartField(_ name: String, in body: Data?) -> String? {
        guard let body else { return nil }
        let text = String(decoding: body, as: UTF8.self)
        guard let start = text.range(of: "name=\"\(name)\"\r\n\r\n") else { return nil }
        let rest = text[start.upperBound...]
        guard let end = rest.range(of: "\r\n") else { return nil }
        return String(rest[rest.startIndex..<end.lowerBound])
    }

    static func matches(_ text: String, _ pattern: String) -> Bool {
        text.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }

    /// The first number in a question, as the mock backend reads it (`1,500` and `1 500` are 1500).
    static func firstNumber(_ text: String) -> Double? {
        let joined = text.replacingOccurrences(of: #"(\d)[ ,](\d{3})\b"#, with: "$1$2", options: .regularExpression)
        guard let range = joined.range(of: #"\d[\d,.]*"#, options: .regularExpression) else { return nil }
        var digits = String(joined[range])
        while let last = digits.last, last == "." || last == "," { digits.removeLast() }
        return Double(digits.replacingOccurrences(of: ",", with: ""))
    }

    /// The name of the recorded turn that answers a typed question (`electricity`, `afford`, `remember`,
    /// `mortgage`, `payday`, `bills`, `patterns`, `whatif`, `teach`, `category` or `spending`), or nil when the
    /// question needs an answer that was not recorded (another amount, another bill type, another lesson).
    ///
    /// The rules and their order are those of the mock backend (lib/agent/mock-model.ts and speculate.ts), so
    /// a question gets the kind of answer the backend would give. A question that fits no rule gets the
    /// backend's general answer, the recorded `spending` turn.
    public static func recordedTurn(for question: String, focusBill: String? = nil) -> String? {
        let q = question.lowercased()
        let intent = #"\b(cheap|cheaper|cheapest|deal|deals|offer|offers|switch|compare|alternative|alternatives|save|saving|better price|too much|overpay\w*)\b|halv|vertaa|tarjou|kilpailu"#
        if matches(q, intent) {
            if matches(q, #"\b(electric|electricity|power bill|energy|kwh)\b|sähkö"#) { return "electricity" }
            if matches(q, #"\b(mobile|phone plan|phone bill|sim|data plan)\b|liittymä|puhelin"#) { return nil }
            if matches(q, #"\b(internet|broadband|wi-?fi|fib(er|re))\b|laajakaista|netti"#) { return nil }
            if let focusBill, matches(q, #"\b(this|that|it|my) (bill|contract|plan|one)\b|\bthis\b|\bit\b"#) {
                return focusBill == "electricity" ? "electricity" : nil
            }
        }
        let number = firstNumber(q)
        if matches(q, #"afford|unexpected|sent me a bill|bill for \d"#), let number { return number == 200 ? "afford" : nil }
        if matches(q, "remember|kwh"), let number { return number == 3500 ? "remember" : nil }
        if matches(q, #"mortgage|apartment|buy a (home|house|flat)"#) { return "mortgage" }
        if matches(q, "payday|run out|end of the month|short") { return "payday" }
        if matches(q, #"bills?\b|subscription|gone up"#) { return "bills" }
        if matches(q, #"where (is|does) my money|what should i change|how (can|could) i save|unusual|stands? out"#) { return "patterns" }
        if matches(q, #"what if|if i (save|cut)|years?"#) {
            return q.contains("save") && !q.contains("cut") && (number == nil || number == 50) ? "whatif" : nil
        }
        if matches(q, #"explain|teach|what (is|are)|why"#) {
            return !matches(q, "fixed|spot") && matches(q, "buffer|emergency") ? "teach" : nil
        }
        if matches(q, #"spen[dt]|cost"#), matches(q, "restaurant|grocer|transport|entertain|health|travel") {
            return q.contains("restaurant") ? "category" : nil
        }
        return "spending"
    }

    func answer(_ request: URLRequest) -> Answer {
        guard let url = request.url, let apiRange = url.path.range(of: "/api/") else { return Self.missing }
        let path = String(url.path[apiRange.lowerBound...])
        let method = (request.httpMethod ?? "GET").uppercased()
        var query: [String: String] = [:]
        for item in URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? [] { query[item.name] = item.value ?? "" }
        let body = Self.object(request.httpBody) ?? [:]
        let parts = path.split(separator: "/").map(String.init) // ["api", ...]
        let customer = (query["customerId"] ?? body["customerId"] as? String ?? "").filter { $0.isLetter || $0.isNumber }

        switch (method, path) {
        case ("GET", "/api/customers/demo"): return Self.json("demo-customers.json")
        case ("GET", "/api/agent/warm"): return Self.json("coach/warm.json")
        case ("GET", "/api/health"): return Self.json("coach/health.json")
        case ("GET", "/api/voice/tts"): return Self.json("coach/voice-options.json")
        case ("POST", "/api/voice/stt"): return Self.json("coach/voice-stt.json")
        case ("POST", "/api/voice/tts"):
            guard let data = Self.fixture("coach/voice-tts.wav") else { return Self.missing }
            return .body(status: 200, data: data, contentType: "audio/wav")
        case ("GET", "/api/coach/patterns"): return Self.json("coach/patterns-\(customer).json")
        case ("GET", "/api/coach/cash-flow"): return Self.json("coach/cash-flow-\(customer).json")
        case ("GET", "/api/coach/affordability"):
            let amount = Double(query["amountEur"] ?? "").map(CoachEndpoints.number) ?? ""
            return Self.json("coach/affordability-\(customer)-\(amount).json")
        case ("GET", "/api/coach/teaching"): return teaching(customer, concept: query["concept"])
        case ("GET", "/api/coach/mortgage"):
            let status = Self.object(Self.fixture("coach/mortgage-\(customer).json"))?["error"] == nil ? 200 : 404
            return Self.json("coach/mortgage-\(customer).json", status: status)
        case ("GET", "/api/memory"): return memory(customer)
        case ("POST", "/api/memory"): return saveMemory(customer, body)
        case ("DELETE", "/api/memory"): return forget(customer, itemId: query["itemId"])
        case ("GET", "/api/actions"): return Self.json("coach/\(actionList(customer)).json")
        case ("GET", "/api/audit"):
            guard let list = Self.object(Self.fixture("coach/\(actionList(customer)).json")) else { return Self.missing }
            return Self.encode(["customerId": customer, "events": list["audit"] ?? [], "chainValid": list["auditChainValid"] ?? true])
        case ("GET", "/api/research"):
            return Self.json("coach/research-\(customer)-\((query["billType"] ?? "").filter(\.isLetter)).json")
        case ("POST", "/api/research"):
            let billType = (body["billType"] as? String ?? "").filter(\.isLetter)
            if body["wait"] as? Bool == false, Self.fixture("coach/research-\(customer)-\(billType)-nowait.json") != nil {
                return Self.json("coach/research-\(customer)-\(billType)-nowait.json")
            }
            return Self.json("coach/research-\(customer)-\(billType).json")
        case ("POST", "/api/scenarios"): return scenario(customer, body)
        case ("POST", "/api/demo/reset"):
            lock.lock(); actionLists = [:]; memories = [:]; decided = []; lock.unlock()
            return Self.encode(["ok": true, "cleared": ["actions": 0, "memoryItems": 0]])
        case ("POST", "/api/actions/prepare"):
            guard body["kind"] as? String == "switch_contract", body["billType"] as? String == "electricity",
                  Self.fixture("coach/action-prepare-\(customer).json") != nil else { return Self.missing }
            setActionList(customer, "actions-\(customer)-prepare-pending")
            return Self.json("coach/action-prepare-\(customer).json", status: 201)
        case ("POST", "/api/agent/query"):
            guard let kind = Self.recordedTurn(for: body["text"] as? String ?? "", focusBill: body["focusBill"] as? String),
                  Self.fixture("coach/stream-\(kind)-\(customer).sse") != nil else { return Self.missing }
            if kind == "remember", let remembered = Self.fixture("coach/memory-\(customer)-remembered.json") {
                lock.lock(); memories[customer] = remembered; lock.unlock()
            }
            return stream("coach/stream-\(kind)-\(customer).sse")
        case ("POST", "/api/agent/investigate"):
            guard Self.fixture("coach/stream-investigate-\(customer).sse") != nil else { return Self.missing }
            setActionList(customer, "actions-\(customer)-investigate-pending")
            return stream("coach/stream-investigate-\(customer).sse")
        case ("POST", "/api/agent/bill-photo"):
            let id = (Self.multipartField("customerId", in: request.httpBody) ?? "").filter { $0.isLetter || $0.isNumber }
            return Self.json("coach/bill-photo-\(id).json")
        case ("POST", "/api/voice/turn"):
            let id = (Self.multipartField("customerId", in: request.httpBody) ?? "").filter { $0.isLetter || $0.isNumber }
            return stream("coach/stream-voice-\(id).sse")
        default: break
        }

        if method == "GET", parts.count == 4, parts[1] == "customers" {
            let id = parts[2].filter { $0.isLetter || $0.isNumber }
            if parts[3] == "overview" { return Self.json("overview-\(id).json") }
            if parts[3] == "transactions" {
                let basket = BasketId(rawValue: query["basket"] ?? "")?.rawValue ?? "all"
                return Self.json("transactions-\(id)-\(basket).json")
            }
        }
        if method == "POST", parts.count == 4, parts[1] == "actions", parts[3] == "approve" || parts[3] == "decline" {
            return decide(customer, actionId: parts[2], approve: parts[3] == "approve", confirm: body["confirm"] as? Bool == true)
        }
        return Self.missing
    }

    private func stream(_ path: String) -> Answer {
        guard let data = Self.fixture(path) else { return Self.missing }
        return .stream(data)
    }

    private func actionList(_ customer: String) -> String {
        lock.lock(); defer { lock.unlock() }
        return actionLists[customer] ?? "actions-\(customer)"
    }

    private func setActionList(_ customer: String, _ name: String) {
        lock.lock(); actionLists[customer] = name; lock.unlock()
    }

    private func teaching(_ customer: String, concept: String?) -> Answer {
        guard let concept, !concept.isEmpty else { return Self.json("coach/teaching-\(customer).json") }
        guard var list = Self.object(Self.fixture("coach/teaching-\(customer).json")), let cards = list["cards"] as? [[String: Any]] else { return Self.missing }
        let wanted = cards.filter { $0["concept"] as? String == concept }
        guard !wanted.isEmpty else {
            return Self.error(400, "Unknown concept. Use one of: \(ConceptId.all.map(\.rawValue).joined(separator: ", ")).")
        }
        list["cards"] = wanted
        return Self.encode(list)
    }

    private func currentMemory(_ customer: String) -> Data? {
        lock.lock(); defer { lock.unlock() }
        return memories[customer] ?? Self.fixture("coach/memory-\(customer).json")
    }

    private func store(_ customer: String, memory: Data?) -> Answer {
        guard let memory else { return Self.missing }
        lock.lock(); memories[customer] = memory; lock.unlock()
        return .body(status: 200, data: memory, contentType: "application/json")
    }

    private func memory(_ customer: String) -> Answer {
        guard let data = currentMemory(customer) else { return Self.missing }
        return .body(status: 200, data: data, contentType: "application/json")
    }

    private func saveMemory(_ customer: String, _ body: [String: Any]) -> Answer {
        if let consent = body["consent"] as? Bool {
            if !consent { return store(customer, memory: Self.fixture("coach/memory-\(customer)-consent-off.json")) }
            guard var memory = Self.object(currentMemory(customer)) else { return Self.missing }
            memory["consent"] = true
            return store(customer, memory: try? JSONSerialization.data(withJSONObject: memory))
        }
        // A saved item is the recorded one with the key, value and bill type of this request, so the name the
        // user typed is the name shown.
        guard var memory = Self.object(currentMemory(customer)),
              let recorded = Self.object(Self.fixture("coach/memory-\(customer)-saved.json")),
              var item = (recorded["items"] as? [[String: Any]])?.first,
              let kind = body["kind"] as? String else { return Self.missing }
        let value = (body["value"] as? String) ?? (body["value"] as? NSNumber)?.stringValue ?? ""
        guard !value.trimmingCharacters(in: .whitespaces).isEmpty else {
            return Self.error(400, "Send a kind (bill_name, yearly_kwh, preference or goal) and a value.")
        }
        guard memory["consent"] as? Bool != false else { return Self.missing }
        let key = (body["key"] as? String) ?? (kind == "yearly_kwh" ? "electricity" : value)
        item["kind"] = kind
        item["key"] = key
        item["value"] = value
        if let billType = body["billType"] as? String { item["billType"] = billType } else { item["billType"] = NSNull() }
        item["id"] = "sample-\(kind)-\(key)"
        var items = (memory["items"] as? [[String: Any]] ?? []).filter { !($0["kind"] as? String == kind && $0["key"] as? String == key) }
        items.append(item)
        memory["items"] = items
        return store(customer, memory: try? JSONSerialization.data(withJSONObject: memory))
    }

    private func forget(_ customer: String, itemId: String?) -> Answer {
        guard let itemId, !itemId.isEmpty else { return store(customer, memory: Self.fixture("coach/memory-\(customer)-forgotten.json")) }
        guard var memory = Self.object(currentMemory(customer)) else { return Self.missing }
        memory["items"] = (memory["items"] as? [[String: Any]] ?? []).filter { $0["id"] as? String != itemId }
        return store(customer, memory: try? JSONSerialization.data(withJSONObject: memory))
    }

    private func scenario(_ customer: String, _ body: [String: Any]) -> Answer {
        guard let overview = try? FixtureAPI.load("overview-\(customer)", as: Overview.self) else {
            return Self.error(404, "We could not find that customer.")
        }
        guard let bill = (body["billSavingPerMonth"] as? NSNumber)?.doubleValue, let cut = (body["everydayCutPct"] as? NSNumber)?.doubleValue,
              let years = (body["years"] as? NSNumber)?.doubleValue, bill.isFinite, cut.isFinite, years.isFinite else {
            return Self.error(400, "Scenario values must be numbers.")
        }
        let input = ScenarioInput(billSavingPerMonth: bill, everydayCutPct: cut, years: Int(min(max(years, 1), 10).rounded()))
        guard let data = try? JSONEncoder().encode(ScenarioEngine.run(overview: overview, input: input)) else { return Self.missing }
        return .body(status: 200, data: data, contentType: "application/json")
    }

    private func decide(_ customer: String, actionId: String, approve: Bool, confirm: Bool) -> Answer {
        if approve && !confirm { return Self.error(400, "Approval needs confirm: true. Nothing was done.") }
        let verb = approve ? "approve" : "decline"
        for origin in ["investigate", "prepare"] {
            let path = "coach/action-\(origin)-\(customer)-\(verb).json"
            guard let recorded = Self.object(Self.fixture(path)), let action = recorded["action"] as? [String: Any],
                  action["id"] as? String == actionId else { continue }
            lock.lock()
            let already = decided.contains(actionId)
            if !already {
                decided.insert(actionId)
                actionLists[customer] = "actions-\(customer)-\(origin)-\(approve ? "approved" : "declined")"
            }
            lock.unlock()
            return already ? Self.json("coach/error-409-already-decided.json", status: 409) : Self.json(path)
        }
        return Self.json("coach/error-404-unknown-action.json", status: 404)
    }

    // MARK: SisuTransport

    public func send(_ request: URLRequest) async throws -> TransportResponse {
        switch answer(request) {
        case .body(let status, let data, let contentType):
            return TransportResponse(status: status, headers: ["Content-Type": contentType], body: data)
        case .stream(let data):
            return TransportResponse(status: 200, headers: ["Content-Type": "text/event-stream"], body: data)
        }
    }

    public func open(_ request: URLRequest) async throws -> TransportStream {
        switch answer(request) {
        case .body(let status, let data, let contentType):
            let chunks = AsyncThrowingStream<Data, Error> { continuation in
                continuation.yield(data)
                continuation.finish()
            }
            return TransportStream(status: status, headers: ["Content-Type": contentType], chunks: chunks)
        case .stream(let data):
            return TransportStream(status: 200, headers: ["Content-Type": "text/event-stream"],
                                   chunks: Self.replay(data, delay: eventDelay))
        }
    }

    /// The messages of a recorded stream, one chunk each, with `delay` seconds between them.
    public static func replay(_ data: Data, delay: TimeInterval) -> AsyncThrowingStream<Data, Error> {
        let text = String(decoding: data, as: UTF8.self)
        let messages = text.components(separatedBy: "\n\n").filter { !$0.isEmpty }.map { Data(($0 + "\n\n").utf8) }
        return AsyncThrowingStream<Data, Error> { continuation in
            let task = Task {
                for (index, message) in messages.enumerated() {
                    if Task.isCancelled { break }
                    if index > 0, delay > 0 {
                        try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                        if Task.isCancelled { break }
                    }
                    continuation.yield(message)
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}
