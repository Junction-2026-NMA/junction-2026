// The live API of the team backend (lib/types.ts), plus the bundled-sample implementation.
import Foundation

/// Errors the app turns into friendly messages.
public enum SisuError: Error, Equatable, Sendable {
    /// A scaffold stub that has not been built yet.
    case notImplemented(String)
    /// The API answered with a non-2xx status. `message` is the `error` text of the body when there is one.
    case server(status: Int, message: String)
    /// The request could not reach the server or timed out.
    case offline
    /// The body could not be decoded.
    case invalidResponse
    /// No such customer in this data source.
    case unknownCustomer(String)
    /// A step was attempted out of order (for example approving an action that was never prepared).
    case invalidState(String)
}

/// Where the data on screen came from. The UI must label everything that is not `.live` as "Sample data".
public enum DataSourceKind: String, Codable, CaseIterable, Sendable {
    case live
    case bundledSample
}

/// The endpoints that are live on the team backend. Every number the app shows comes from these payloads.
public protocol SisuAPI: Sendable {
    var kind: DataSourceKind { get }
    /// `GET /api/customers/demo`
    func demoCustomers() async throws -> [DemoCustomer]
    /// `GET /api/customers/:id/overview`
    func overview(customerId: String) async throws -> Overview
    /// `GET /api/customers/:id/transactions`. A nil filter asks for the default window.
    func transactions(customerId: String, filter: EvidenceFilter?) async throws -> TransactionList
    /// `POST /api/scenarios`
    func scenario(customerId: String, input: ScenarioInput) async throws -> ScenarioResponse
}

/// Builds the HTTP requests for the live API. Pure, so it can be tested without a network.
public enum Endpoints {
    /// Characters that never need escaping in a path segment or a query value (RFC 3986 "unreserved").
    static let unreserved = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")

    static func escape(_ text: String) -> String {
        text.addingPercentEncoding(withAllowedCharacters: unreserved) ?? text
    }

    /// `{base}{path}?{query}`: the base keeps its own path prefix, a trailing slash on it is dropped, and
    /// query names and values are percent-encoded.
    static func url(_ baseURL: URL, _ path: String, query: [(String, String)] = []) -> URL {
        var text = baseURL.absoluteString
        while text.hasSuffix("/") { text.removeLast() }
        text += path
        if !query.isEmpty {
            text += "?" + query.map { "\(escape($0.0))=\(escape($0.1))" }.joined(separator: "&")
        }
        return URL(string: text) ?? baseURL
    }

    static func get(_ url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return request
    }

    static func postJSON(_ url: URL, body: Data) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = body
        return request
    }

    /// `GET {base}/api/customers/demo`
    public static func demoCustomers(baseURL: URL) -> URLRequest {
        get(url(baseURL, "/api/customers/demo"))
    }

    /// `GET {base}/api/customers/{id}/overview`. The id is percent-encoded as a path segment.
    public static func overview(baseURL: URL, customerId: String) -> URLRequest {
        get(url(baseURL, "/api/customers/\(escape(customerId))/overview"))
    }

    /// `GET {base}/api/customers/{id}/transactions` with one query item per non-nil filter field,
    /// in this order: `from`, `to`, `category`, `basket`, `mcc`, `negativeBalance` (`true` or `false`).
    /// A nil filter adds no query at all.
    public static func transactions(baseURL: URL, customerId: String, filter: EvidenceFilter?) -> URLRequest {
        var query: [(String, String)] = []
        if let filter {
            query.append(("from", filter.from))
            query.append(("to", filter.to))
            if let category = filter.category { query.append(("category", category)) }
            if let basket = filter.basket { query.append(("basket", basket.rawValue)) }
            if let mcc = filter.mcc { query.append(("mcc", mcc)) }
            if let negative = filter.negativeBalance { query.append(("negativeBalance", negative ? "true" : "false")) }
        }
        return get(url(baseURL, "/api/customers/\(escape(customerId))/transactions", query: query))
    }

    /// `POST {base}/api/scenarios` with header `Content-Type: application/json` and a JSON body holding
    /// exactly the keys `customerId`, `billSavingPerMonth`, `everydayCutPct` and `years`
    /// (and `oneOffEur`, only when the input has a lump sum above zero).
    public static func scenario(baseURL: URL, customerId: String, input: ScenarioInput) -> URLRequest {
        struct Body: Encodable {
            let customerId: String
            let billSavingPerMonth: Double
            let everydayCutPct: Double
            let years: Int
            let oneOffEur: Double?
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let finite: (Double) -> Double = { $0.isFinite ? $0 : 0 }
        let body = Body(customerId: customerId, billSavingPerMonth: finite(input.billSavingPerMonth),
                        everydayCutPct: finite(input.everydayCutPct), years: input.years,
                        oneOffEur: input.oneOffEur.isFinite && input.oneOffEur > 0 ? input.oneOffEur : nil)
        return postJSON(url(baseURL, "/api/scenarios"), body: (try? encoder.encode(body)) ?? Data("{}".utf8))
    }
}

/// Talks to the team backend over HTTP.
///
/// - A 2xx answer is decoded into the model. A body that does not decode throws `.invalidResponse`.
/// - A non-2xx answer throws `.server(status:message:)`, with `message` taken from the body's `error` field
///   (an `ApiError`), or an empty string when the body has none.
/// - A transport failure (no connection, timeout) throws `.offline`.
/// - `kind` is `.live`.
/// - Every request times out after `timeout` seconds (5 by default).
public struct LiveAPI: SisuAPI {
    public let baseURL: URL
    public let session: URLSession
    /// Seconds before a request counts as offline.
    public var timeout: TimeInterval = 5

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    public var kind: DataSourceKind { .live }

    /// Sends one request and maps the answer as the type's doc comment says.
    func send<T: Decodable>(_ request: URLRequest, as type: T.Type) async throws -> T {
        var request = request
        request.timeoutInterval = timeout
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw SisuError.offline
        }
        return try Self.decode(data: data, response: response, as: type)
    }

    /// The pure half of `send`: status and body in, model or `SisuError` out.
    static func decode<T: Decodable>(data: Data, response: URLResponse, as type: T.Type) throws -> T {
        guard let http = response as? HTTPURLResponse else { throw SisuError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(ApiError.self, from: data))?.error ?? ""
            throw SisuError.server(status: http.statusCode, message: message)
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw SisuError.invalidResponse
        }
    }

    public func demoCustomers() async throws -> [DemoCustomer] {
        try await send(Endpoints.demoCustomers(baseURL: baseURL), as: [DemoCustomer].self)
    }

    public func overview(customerId: String) async throws -> Overview {
        try await send(Endpoints.overview(baseURL: baseURL, customerId: customerId), as: Overview.self)
    }

    public func transactions(customerId: String, filter: EvidenceFilter?) async throws -> TransactionList {
        try await send(Endpoints.transactions(baseURL: baseURL, customerId: customerId, filter: filter), as: TransactionList.self)
    }

    public func scenario(customerId: String, input: ScenarioInput) async throws -> ScenarioResponse {
        try await send(Endpoints.scenario(baseURL: baseURL, customerId: customerId, input: input), as: ScenarioResponse.self)
    }
}

/// Serves the JSON captured from the team backend on 14 Nov 2026 and bundled with this package.
/// Used for the offline demo mode and for tests. `kind` is `.bundledSample`.
///
/// - `transactions`: a filter with a `basket` returns that basket's bundled file. Any other filter, or nil,
///   returns the bundled default list. Rows are not filtered further.
/// - `scenario`: computed by `ScenarioEngine` from the bundled overview, so sliders work offline.
/// - An id that is not one of the three demo customers throws `.unknownCustomer(id)`.
public struct FixtureAPI: SisuAPI {
    public init() {}

    public var kind: DataSourceKind { .bundledSample }

    public static let customerIds = ["CUST04974", "CUST04414", "CUST02003"]

    static func load<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures") else {
            throw SisuError.invalidResponse
        }
        do {
            return try JSONDecoder().decode(T.self, from: Data(contentsOf: url))
        } catch {
            throw SisuError.invalidResponse
        }
    }

    private func check(_ customerId: String) throws {
        guard Self.customerIds.contains(customerId) else { throw SisuError.unknownCustomer(customerId) }
    }

    public func demoCustomers() async throws -> [DemoCustomer] {
        try Self.load("demo-customers", as: [DemoCustomer].self)
    }

    public func overview(customerId: String) async throws -> Overview {
        try check(customerId)
        return try Self.load("overview-\(customerId)", as: Overview.self)
    }

    public func transactions(customerId: String, filter: EvidenceFilter?) async throws -> TransactionList {
        try check(customerId)
        let name = filter?.basket?.rawValue ?? "all"
        return try Self.load("transactions-\(customerId)-\(name)", as: TransactionList.self)
    }

    public func scenario(customerId: String, input: ScenarioInput) async throws -> ScenarioResponse {
        let overview = try await overview(customerId: customerId)
        return ScenarioEngine.run(overview: overview, input: input)
    }
}

/// A Swift port of `lib/finance/scenario.ts` (`cleanInput` and `runScenario`), used only when the app is offline.
/// Online, the futures come from `POST /api/scenarios`.
///
/// `run` must reproduce the server's answer: for each bundled `scenario-<id>-default.json` and
/// `scenario-<id>-nothing.json`, calling `run` with that file's `input` and the bundled overview of the same
/// customer returns the same `input`, `freedPerMonth`, branch ids, labels and order, `assumptions`, and every
/// number of every branch and point to within 0.01.
public enum ScenarioEngine {
    /// Yearly return scenarios (before inflation, after the fund fee) and the fee, as on the server.
    static let returnLow = 0.01, returnMid = 0.05, returnHigh = 0.08
    static let fundFee = 0.002

    /// The limits the server clamps to: bill saving 0...500 a month, everyday cut 0...50 percent, 1...10 years
    /// (years are rounded to a whole number after clamping), a lump sum 0...100,000 rounded to cents.
    public static func clean(_ input: ScenarioInput) -> ScenarioInput {
        func clamp(_ value: Double, _ lo: Double, _ hi: Double) -> Double {
            Swift.min(Swift.max(value.isFinite ? value : lo, lo), hi)
        }
        return ScenarioInput(billSavingPerMonth: clamp(input.billSavingPerMonth, 0, 500),
                             everydayCutPct: clamp(input.everydayCutPct, 0, 50),
                             years: Swift.min(Swift.max(input.years, 1), 10),
                             oneOffEur: round2(clamp(input.oneOffEur, 0, 100_000)))
    }

    /// JavaScript's `Math.round(x * 100) / 100` (halves go up).
    static func round2(_ x: Double) -> Double {
        guard x.isFinite else { return 0 }
        return (x * 100 + 0.5).rounded(.down) / 100
    }

    static func label(_ id: BranchId) -> String {
        switch id {
        case .nothing: return "Change nothing"
        case .save: return "Make the change, keep the cash"
        case .invest: return "Make the change, invest it"
        }
    }

    /// `invested` is money already in investments on day one (a lump sum the customer moves there).
    static func project(_ id: BranchId, overview: Overview, toCash: Double, toInvested: Double, months: Int, invested: Double = 0) -> Branch {
        func grow(_ invested: Double, _ yearlyReturn: Double) -> Double {
            (invested + toInvested) * (1 + (yearlyReturn - fundFee) / 12)
        }
        let balance = overview.balance
        var cash = balance - invested, low = invested, mid = invested, high = invested
        var points = [BranchPoint(month: 0, cash: cash, invested: invested, total: balance, totalLow: balance, totalHigh: balance)]
        for month in 0..<Swift.max(months, 0) {
            cash += toCash
            low = grow(low, returnLow)
            mid = grow(mid, returnMid)
            high = grow(high, returnHigh)
            points.append(BranchPoint(month: month + 1, cash: round2(cash), invested: round2(mid), total: round2(cash + mid),
                                      totalLow: round2(cash + low), totalHigh: round2(cash + high)))
        }
        let end = points[points.count - 1]
        let atYear1 = points[Swift.min(12, points.count - 1)]
        let runway = overview.monthlyMandatory > 0 ? round2(Swift.max(atYear1.cash, 0) / overview.monthlyMandatory) : 0
        return Branch(id: id, label: label(id), points: points, endTotal: end.total, endLow: end.totalLow, endHigh: end.totalHigh,
                      runwayMonthsAtYear1: runway)
    }

    /// The number as JavaScript prints it in the assumption sentences: `5`, `0.2`.
    static func percent(_ fraction: Double) -> String {
        let value = (fraction * 100 * 1_000_000).rounded() / 1_000_000
        return value == value.rounded() ? String(Int(value)) : String(value)
    }

    public static func run(overview: Overview, input: ScenarioInput) -> ScenarioResponse {
        let input = clean(input)
        let freed = round2(input.billSavingPerMonth + (overview.monthlyEveryday * input.everydayCutPct) / 100)
        let netToCash = overview.monthlyIncome - overview.monthlySpending - overview.monthlySaved
        let months = input.years * 12
        let saved = overview.monthlySaved
        return ScenarioResponse(
            customerId: overview.customerId, dataTimestamp: overview.dataTimestamp, currency: "EUR", input: input,
            freedPerMonth: freed,
            branches: [
                project(.nothing, overview: overview, toCash: netToCash, toInvested: saved, months: months),
                project(.save, overview: overview, toCash: netToCash + freed, toInvested: saved, months: months),
                project(.invest, overview: overview, toCash: netToCash, toInvested: saved + freed, months: months, invested: input.oneOffEur),
            ],
            assumptions: [
                "Income and spending stay at their last-12-month averages. Real life will differ.",
                "Invested money is shown at \(percent(returnMid))% a year, with a range from \(percent(returnLow))% to \(percent(returnHigh))%. These are scenarios, not predictions; investments can lose value.",
                "A fund fee of \(percent(fundFee))% a year is taken off. Taxes and inflation are not included.",
                "Investments already held elsewhere are not visible in the bank data, so the invested pot starts at €0.",
                "Cash in the account earns no interest here.",
            ] + (input.oneOffEur != 0
                ? ["In the \"invest it\" future, €\(Int(input.oneOffEur.rounded(.toNearestOrAwayFromZero))) is moved from the account into investments on day one. In the other two it stays in the account."]
                : [])
        )
    }
}
