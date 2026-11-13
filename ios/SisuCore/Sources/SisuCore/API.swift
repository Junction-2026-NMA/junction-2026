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
    /// `GET {base}/api/customers/demo`
    public static func demoCustomers(baseURL: URL) -> URLRequest {
        URLRequest(url: baseURL) // scaffold stub
    }

    /// `GET {base}/api/customers/{id}/overview`. The id is percent-encoded as a path segment.
    public static func overview(baseURL: URL, customerId: String) -> URLRequest {
        URLRequest(url: baseURL) // scaffold stub
    }

    /// `GET {base}/api/customers/{id}/transactions` with one query item per non-nil filter field,
    /// in this order: `from`, `to`, `category`, `basket`, `mcc`, `negativeBalance` (`true` or `false`).
    /// A nil filter adds no query at all.
    public static func transactions(baseURL: URL, customerId: String, filter: EvidenceFilter?) -> URLRequest {
        URLRequest(url: baseURL) // scaffold stub
    }

    /// `POST {base}/api/scenarios` with header `Content-Type: application/json` and a JSON body holding
    /// exactly the keys `customerId`, `billSavingPerMonth`, `everydayCutPct` and `years`.
    public static func scenario(baseURL: URL, customerId: String, input: ScenarioInput) -> URLRequest {
        URLRequest(url: baseURL) // scaffold stub
    }
}

/// Talks to the team backend over HTTP.
///
/// - A 2xx answer is decoded into the model. A body that does not decode throws `.invalidResponse`.
/// - A non-2xx answer throws `.server(status:message:)`, with `message` taken from the body's `error` field
///   (an `ApiError`), or an empty string when the body has none.
/// - A transport failure (no connection, timeout) throws `.offline`.
/// - `kind` is `.live`.
public struct LiveAPI: SisuAPI {
    public let baseURL: URL
    public let session: URLSession

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    public var kind: DataSourceKind { .live }

    public func demoCustomers() async throws -> [DemoCustomer] { throw SisuError.notImplemented("LiveAPI.demoCustomers") }
    public func overview(customerId: String) async throws -> Overview { throw SisuError.notImplemented("LiveAPI.overview") }
    public func transactions(customerId: String, filter: EvidenceFilter?) async throws -> TransactionList { throw SisuError.notImplemented("LiveAPI.transactions") }
    public func scenario(customerId: String, input: ScenarioInput) async throws -> ScenarioResponse { throw SisuError.notImplemented("LiveAPI.scenario") }
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
    /// The limits the server clamps to: bill saving 0...500 a month, everyday cut 0...50 percent, 1...10 years
    /// (years are rounded to a whole number after clamping).
    public static func clean(_ input: ScenarioInput) -> ScenarioInput {
        input // scaffold stub
    }

    public static func run(overview: Overview, input: ScenarioInput) -> ScenarioResponse {
        // scaffold stub: no futures yet
        ScenarioResponse(customerId: overview.customerId, dataTimestamp: overview.dataTimestamp, currency: overview.currency,
                         input: input, freedPerMonth: 0, branches: [], assumptions: [])
    }
}
