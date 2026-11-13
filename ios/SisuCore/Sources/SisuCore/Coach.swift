// The coach endpoints that lanes B and C are still building (agent, research, actions, reset).
// PROVISIONAL: these Swift types are the frontend's working copy. When `lib/types.ts` on main gains the
// real types, change this file to match and note it in the team context log.
import Foundation

/// One step the agent took. Shown in the "How Sisu worked this out" drawer.
public struct ToolCall: Codable, Equatable, Sendable {
    public var id: String
    /// The deterministic tool that ran, for example `spendingByBasket`.
    public var tool: String
    /// Why it ran, in plain words.
    public var why: String
    public var durationMs: Int
    /// What it returned, in one line.
    public var summary: String

    public init(id: String, tool: String, why: String, durationMs: Int, summary: String) {
        self.id = id; self.tool = tool; self.why = why; self.durationMs = durationMs; self.summary = summary
    }
}

/// A source behind a claim.
public struct Citation: Codable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var url: String
    /// ISO 8601 time the page was really fetched.
    public var retrievedAt: String

    public init(id: String, title: String, url: String, retrievedAt: String) {
        self.id = id; self.title = title; self.url = url; self.retrievedAt = retrievedAt
    }
}

/// Answer of `POST /api/agent/query`.
public struct AgentAnswer: Codable, Equatable, Sendable {
    public var answer: String
    public var toolCalls: [ToolCall]
    public var citations: [Citation]
    public var source: DataSourceKind
    /// ISO 8601.
    public var generatedAt: String

    public init(answer: String, toolCalls: [ToolCall], citations: [Citation], source: DataSourceKind, generatedAt: String) {
        self.answer = answer; self.toolCalls = toolCalls; self.citations = citations; self.source = source; self.generatedAt = generatedAt
    }
}

/// One offer found by live research. Missing fields stay nil; they are never guessed.
public struct Offer: Codable, Equatable, Sendable {
    public var id: String
    public var provider: String
    public var plan: String
    public var monthlyPrice: Double?
    public var contractMonths: Int?
    public var setupFee: Double?
    public var cancellationTerms: String?
    public var sourceTitle: String
    public var sourceURL: String
    /// ISO 8601 time the page was really fetched.
    public var retrievedAt: String

    public init(id: String, provider: String, plan: String, monthlyPrice: Double?, contractMonths: Int? = nil, setupFee: Double? = nil,
                cancellationTerms: String? = nil, sourceTitle: String, sourceURL: String, retrievedAt: String) {
        self.id = id; self.provider = provider; self.plan = plan; self.monthlyPrice = monthlyPrice; self.contractMonths = contractMonths
        self.setupFee = setupFee; self.cancellationTerms = cancellationTerms; self.sourceTitle = sourceTitle; self.sourceURL = sourceURL
        self.retrievedAt = retrievedAt
    }
}

/// Answer of `POST /api/research`.
public struct ResearchResult: Codable, Equatable, Sendable {
    public var billId: String
    public var offers: [Offer]
    /// ISO 8601 time of the research run.
    public var retrievedAt: String
    public var source: DataSourceKind

    public init(billId: String, offers: [Offer], retrievedAt: String, source: DataSourceKind) {
        self.billId = billId; self.offers = offers; self.retrievedAt = retrievedAt; self.source = source
    }
}

/// How one offer compares with the bill the customer pays now. Computed in code, never by a model.
public struct OfferComparison: Equatable, Sendable {
    public var offerId: String
    /// `bill.monthlyAvg - offer.monthlyPrice`. Nil when the offer has no monthly price.
    public var monthlySaving: Double?
    /// `monthlySaving * 12 - (setupFee ?? 0)`. Nil when `monthlySaving` is nil.
    public var yearlySaving: Double?
    /// `setupFee / monthlySaving` when there is a setup fee above 0 and `monthlySaving` is above 0.
    /// 0 when there is no setup fee and `monthlySaving` is above 0. Nil otherwise.
    public var monthsToBreakEven: Double?
    /// The names of the offer fields that are missing, in this order: `monthlyPrice`, `contractMonths`,
    /// `setupFee`, `cancellationTerms`.
    public var missing: [String]

    public init(offerId: String, monthlySaving: Double?, yearlySaving: Double?, monthsToBreakEven: Double?, missing: [String]) {
        self.offerId = offerId; self.monthlySaving = monthlySaving; self.yearlySaving = yearlySaving
        self.monthsToBreakEven = monthsToBreakEven; self.missing = missing
    }
}

/// The saving maths for offers. All results are rounded to 2 decimals.
public enum OfferMath {
    /// One comparison per offer, in the same order as `offers`.
    public static func compare(bill: RecurringBill, offers: [Offer]) -> [OfferComparison] {
        [] // scaffold stub
    }

    /// The id of the offer with the highest `yearlySaving`, counting only offers whose `yearlySaving` is above 0.
    /// Ties go to the offer that comes first in `offers`. Nil when no offer saves money.
    public static func best(bill: RecurringBill, offers: [Offer]) -> String? {
        nil // scaffold stub
    }
}

public enum ActionStatus: String, Codable, CaseIterable, Sendable {
    case none, drafted, approved, declined
}

/// A prepared action waiting for the user's approval. Nothing executes without an approval event.
public struct DraftAction: Codable, Equatable, Sendable {
    public var id: String
    public var customerId: String
    public var billId: String
    public var offerId: String
    public var title: String
    /// The switch checklist, one step per entry.
    public var checklist: [String]
    /// Always true: Sisu never performs a real switch.
    public var simulated: Bool
    public var status: ActionStatus
    /// The monthly saving this action would bring, from `OfferMath`. 0 when unknown.
    public var savingPerMonth: Double
    /// ISO 8601.
    public var createdAt: String

    public init(id: String, customerId: String, billId: String, offerId: String, title: String, checklist: [String], simulated: Bool = true,
                status: ActionStatus, savingPerMonth: Double, createdAt: String) {
        self.id = id; self.customerId = customerId; self.billId = billId; self.offerId = offerId; self.title = title
        self.checklist = checklist; self.simulated = simulated; self.status = status; self.savingPerMonth = savingPerMonth
        self.createdAt = createdAt
    }
}

public enum AuditKind: String, Codable, CaseIterable, Sendable {
    case prepared, approved, declined
}

/// One line of the audit log.
public struct AuditEvent: Codable, Equatable, Sendable {
    public var id: String
    public var actionId: String
    public var customerId: String
    public var kind: AuditKind
    /// ISO 8601.
    public var at: String
    public var detail: String

    public init(id: String, actionId: String, customerId: String, kind: AuditKind, at: String, detail: String) {
        self.id = id; self.actionId = actionId; self.customerId = customerId; self.kind = kind; self.at = at; self.detail = detail
    }
}

/// The coach endpoints. `POST /api/agent/query`, `/api/research`, `/api/actions/prepare`,
/// `/api/actions/:id/approve` and `/api/demo/reset` in the team build plan.
public protocol CoachBackend: Sendable {
    var kind: DataSourceKind { get }
    func ask(customerId: String, question: String) async throws -> AgentAnswer
    /// Research never receives customer data: only the bill's category and a city.
    func research(bill: RecurringBill, city: String) async throws -> ResearchResult
    func prepareAction(customerId: String, bill: RecurringBill, offer: Offer) async throws -> DraftAction
    func approve(actionId: String) async throws -> DraftAction
    func decline(actionId: String) async throws -> DraftAction
    /// Oldest first.
    func auditLog(customerId: String) async throws -> [AuditEvent]
    func resetDemo() async throws
}

/// An in-memory, deterministic stand-in for the coach endpoints that are not live yet.
/// Everything it returns has `source == .bundledSample` (its `kind`), so the UI labels it "Sample data".
///
/// - `now` supplies the clock, so tests can pin time. Times are written as ISO 8601 strings in UTC with seconds
///   and a trailing `Z`, for example `2026-11-14T09:30:00Z`.
/// - `ask`: returns a non-empty `answer`, at least one `ToolCall`, and no citations. The same question for the
///   same customer always gives the same answer. A question that is empty after trimming whitespace throws
///   `.invalidState`.
/// - `research`: returns exactly three offers for the bill, with ids `"<bill.id>-offer-1"` to `-3`, in that
///   order. Offer 1 costs 15 percent less a month than `bill.monthlyAvg` and has no setup fee. Offer 2 costs
///   25 percent less and has a setup fee of 30. Offer 3 has a nil `monthlyPrice` (a page whose price could not
///   be read). Monthly prices are rounded to 2 decimals. `billId` is the bill's id and `retrievedAt` is `now()`.
/// - `prepareAction`: returns a new action with status `.drafted`, `simulated == true`, a checklist of at least
///   three steps, `savingPerMonth` equal to `OfferMath`'s `monthlySaving` for that offer (0 when nil or
///   negative), and a unique id. Appends a `.prepared` audit event.
/// - `approve` and `decline`: only for an action that is `.drafted`; they set the status and append an
///   `.approved` or `.declined` audit event. An unknown id, or an action that is not `.drafted`, throws
///   `.invalidState`.
/// - `auditLog`: that customer's events, oldest first.
/// - `resetDemo`: forgets every action and audit event.
public actor SampleCoachBackend: CoachBackend {
    private let now: @Sendable () -> Date

    public init(now: @escaping @Sendable () -> Date = { Date() }) {
        self.now = now
    }

    public nonisolated var kind: DataSourceKind { .bundledSample }

    public func ask(customerId: String, question: String) async throws -> AgentAnswer { throw SisuError.notImplemented("SampleCoachBackend.ask") }
    public func research(bill: RecurringBill, city: String) async throws -> ResearchResult { throw SisuError.notImplemented("SampleCoachBackend.research") }
    public func prepareAction(customerId: String, bill: RecurringBill, offer: Offer) async throws -> DraftAction { throw SisuError.notImplemented("SampleCoachBackend.prepareAction") }
    public func approve(actionId: String) async throws -> DraftAction { throw SisuError.notImplemented("SampleCoachBackend.approve") }
    public func decline(actionId: String) async throws -> DraftAction { throw SisuError.notImplemented("SampleCoachBackend.decline") }
    public func auditLog(customerId: String) async throws -> [AuditEvent] { throw SisuError.notImplemented("SampleCoachBackend.auditLog") }
    public func resetDemo() async throws { throw SisuError.notImplemented("SampleCoachBackend.resetDemo") }
}
