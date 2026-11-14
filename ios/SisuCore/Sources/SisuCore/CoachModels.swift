// The coach contract of the team backend ("Agent, research and voice" and everything below it in
// lib/types.ts, as described in docs/FRONTEND_INTEGRATION_CONTRACT.md).
//
// Decoding is lenient on purpose: fields the TypeScript marks nullable or optional are optional here, extra
// keys are ignored, and enum-like strings the screen only shows or compares are kept as raw strings (the
// "open enum" types below), so a new value from the server never breaks decoding.
import Foundation

// MARK: - Open enums

/// A string from the server with named known values. An unknown value is kept as it came.
public protocol OpenEnum: RawRepresentable, Codable, Hashable, Sendable, CustomStringConvertible where RawValue == String {
    init(rawValue: String)
}

public extension OpenEnum {
    var description: String { rawValue }
}

/// `electricity`, `mobile` or `internet`.
public struct BillType: OpenEnum {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
    public static let electricity = BillType(rawValue: "electricity")
    public static let mobile = BillType(rawValue: "mobile")
    public static let internet = BillType(rawValue: "internet")
    public static let allKnown: [BillType] = [.electricity, .mobile, .internet]
}

/// `running`, `partial`, `done` or `failed`.
public struct ResearchStatus: OpenEnum {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
    public static let running = ResearchStatus(rawValue: "running")
    public static let partial = ResearchStatus(rawValue: "partial")
    public static let done = ResearchStatus(rawValue: "done")
    public static let failed = ResearchStatus(rawValue: "failed")
}

/// `switch_contract` or `standing_transfer`.
public struct ActionKind: OpenEnum {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
    public static let switchContract = ActionKind(rawValue: "switch_contract")
    public static let standingTransfer = ActionKind(rawValue: "standing_transfer")
}

/// `awaiting_approval`, `executed_simulated`, `declined` or `expired`.
public struct ActionStatus: OpenEnum {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
    public static let awaitingApproval = ActionStatus(rawValue: "awaiting_approval")
    public static let executedSimulated = ActionStatus(rawValue: "executed_simulated")
    public static let declined = ActionStatus(rawValue: "declined")
    public static let expired = ActionStatus(rawValue: "expired")
}

/// `bill_name`, `yearly_kwh`, `preference` or `goal`.
public struct MemoryKind: OpenEnum {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
    public static let billName = MemoryKind(rawValue: "bill_name")
    public static let yearlyKwh = MemoryKind(rawValue: "yearly_kwh")
    public static let preference = MemoryKind(rawValue: "preference")
    public static let goal = MemoryKind(rawValue: "goal")
}

/// The kind of a `Stage`: `lead`, `evidence`, `research`, `extraction`, `calculation`, `teaching`, `action`,
/// `impact` or `memory`.
public struct StageKind: OpenEnum {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
    public static let lead = StageKind(rawValue: "lead")
    public static let evidence = StageKind(rawValue: "evidence")
    public static let research = StageKind(rawValue: "research")
    public static let extraction = StageKind(rawValue: "extraction")
    public static let calculation = StageKind(rawValue: "calculation")
    public static let teaching = StageKind(rawValue: "teaching")
    public static let action = StageKind(rawValue: "action")
    public static let impact = StageKind(rawValue: "impact")
    public static let memory = StageKind(rawValue: "memory")
    /// The order an investigation fills its stages in.
    public static let investigationOrder: [StageKind] = [.lead, .research, .extraction, .calculation, .impact, .teaching, .action]
}

/// A teaching concept: `three-baskets`, `safe-to-spend`, `fixed-vs-spot`, `buffer-first`, `compound-growth`,
/// `switching-bills` or `pay-yourself-first`.
public struct ConceptId: OpenEnum {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
    public static let threeBaskets = ConceptId(rawValue: "three-baskets")
    public static let safeToSpend = ConceptId(rawValue: "safe-to-spend")
    public static let fixedVsSpot = ConceptId(rawValue: "fixed-vs-spot")
    public static let bufferFirst = ConceptId(rawValue: "buffer-first")
    public static let compoundGrowth = ConceptId(rawValue: "compound-growth")
    public static let switchingBills = ConceptId(rawValue: "switching-bills")
    public static let payYourselfFirst = ConceptId(rawValue: "pay-yourself-first")
    public static let all: [ConceptId] = [.threeBaskets, .safeToSpend, .fixedVsSpot, .bufferFirst, .compoundGrowth, .switchingBills, .payYourselfFirst]
}

/// `comfortable`, `tight` or `not-yet`.
public struct AffordabilityVerdict: OpenEnum {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
    public static let comfortable = AffordabilityVerdict(rawValue: "comfortable")
    public static let tight = AffordabilityVerdict(rawValue: "tight")
    public static let notYet = AffordabilityVerdict(rawValue: "not-yet")
}

// MARK: - Loose JSON

/// Any JSON value. Used for tool arguments, which have no fixed shape.
public enum JSONValue: Codable, Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([JSONValue].self) { self = .array(value) }
        else { self = .object(try container.decode([String: JSONValue].self)) }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }
}

// MARK: - Research

/// A web page an answer rests on. `retrievedAt` is the ISO time it was fetched.
public struct Citation: Codable, Equatable, Sendable {
    public var title: String
    public var url: String
    public var retrievedAt: String
    /// How old the provider's cached copy was in milliseconds, when it said.
    public var cacheAgeMs: Double?

    public init(title: String, url: String, retrievedAt: String, cacheAgeMs: Double? = nil) {
        self.title = title; self.url = url; self.retrievedAt = retrievedAt; self.cacheAgeMs = cacheAgeMs
    }
}

/// One offer read from a provider's page. Every estimate is computed by the server; never recompute it.
public struct Offer: Codable, Equatable, Sendable {
    public var provider: String
    public var plan: String?
    /// For example `fixed` or `spot`.
    public var contractType: String?
    public var contractMonths: Double?
    /// Fixed monthly price or base fee.
    public var monthlyPriceEur: Double?
    /// Electricity only.
    public var energyPriceCentsPerKwh: Double?
    public var setupFeeEur: Double?
    public var sourceUrl: String
    /// False when the price cannot be compared fairly (for example spot contracts).
    public var comparable: Bool
    public var estimatedMonthlyCostEur: Double?
    /// Against the customer's current bill.
    public var estimatedYearlySavingEur: Double?

    public init(provider: String, plan: String? = nil, contractType: String? = nil, contractMonths: Double? = nil, monthlyPriceEur: Double? = nil,
                energyPriceCentsPerKwh: Double? = nil, setupFeeEur: Double? = nil, sourceUrl: String, comparable: Bool,
                estimatedMonthlyCostEur: Double? = nil, estimatedYearlySavingEur: Double? = nil) {
        self.provider = provider; self.plan = plan; self.contractType = contractType; self.contractMonths = contractMonths
        self.monthlyPriceEur = monthlyPriceEur; self.energyPriceCentsPerKwh = energyPriceCentsPerKwh; self.setupFeeEur = setupFeeEur
        self.sourceUrl = sourceUrl; self.comparable = comparable
        self.estimatedMonthlyCostEur = estimatedMonthlyCostEur; self.estimatedYearlySavingEur = estimatedYearlySavingEur
    }
}

/// Offer research for one bill type in one city. `mock` true means example data: label it.
public struct ResearchResult: Codable, Equatable, Sendable {
    public var key: String
    public var billType: BillType
    public var city: String
    public var status: ResearchStatus
    public var mock: Bool
    public var query: String
    public var startedAt: String
    public var finishedAt: String?
    public var tookMs: Double
    public var pagesDone: Int
    public var pagesTotal: Int
    /// The customer's current bill, from the finance engine.
    public var baselineMonthlyEur: Double?
    /// Electricity only: the use the comparison is based on.
    public var assumedYearlyKwh: Double?
    /// `stated`, `estimated-from-bill` or `default`.
    public var usageSource: String?
    public var offers: [Offer]
    /// Nil when nothing is cheaper today.
    public var best: Offer?
    public var citations: [Citation]
    public var assumptions: [String]
    public var errors: [String]
}

// MARK: - A turn

/// One earlier line of the conversation, sent back as history. `role` is `user` or `assistant`.
public struct ChatTurn: Codable, Equatable, Sendable {
    public var role: String
    public var content: String

    public init(role: String, content: String) {
        self.role = role; self.content = content
    }
}

/// One tool call of a turn, for the trace drawer.
public struct ToolTrace: Codable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var args: JSONValue?
    /// `finance`, `exa+context.dev` or `exa`.
    public var source: String
    public var startedAtMs: Double
    public var tookMs: Double
    public var ok: Bool
    /// One line a person can read.
    public var summary: String
    /// True when research was already running or cached.
    public var joinedPrefetch: Bool?
}

/// Milliseconds for each part of a turn.
public struct TurnTimings: Codable, Equatable, Sendable {
    public struct ModelStep: Codable, Equatable, Sendable {
        public var model: String
        public var provider: String
        /// True when the main model failed and the backup answered: show a small "backup model" tag.
        public var usedBackup: Bool
        public var firstTokenMs: Double?
        public var totalMs: Double
    }

    public var sttMs: Double?
    public var firstTokenMs: Double?
    public var firstSentenceMs: Double?
    public var totalMs: Double
    public var modelSteps: [ModelStep]

    /// True when any step of the turn was answered by the backup model.
    public var usedBackup: Bool { modelSteps.contains { $0.usedBackup } }
}

// MARK: - Receipts

/// One receipt: a number Sisu is allowed to say, where it came from and how to open the rows behind it.
public struct Fact: Codable, Equatable, Sendable {
    public var id: String
    public var label: String
    public var value: Double
    /// `EUR`, `EUR/month`, `EUR/year`, `kWh/year`, `c/kWh`, `months`, `count`, `percent`, `years` or `days`.
    public var unit: String
    /// `bank-data`, `exa`, `context.dev`, `assumption`, `customer-stated` or `calculation`.
    public var source: String
    /// One line: how it was worked out.
    public var basis: String
    /// Pass to the transactions endpoint to show the rows.
    public var evidence: EvidenceFilter?
    /// For web facts.
    public var url: String?
}

/// One number of the final answer and whether it has a source.
public struct NumberCheck: Codable, Equatable, Sendable {
    public var value: Double
    /// `receipt`, `context`, `trivial` or `unverified`.
    public var status: String
    public var factId: String?
}

/// A figure the model copied almost right; Sisu replaced it with the receipt's value.
public struct NumberCorrection: Codable, Equatable, Sendable {
    public var said: Double
    public var corrected: Double
    public var factId: String
}

public struct NameCorrection: Codable, Equatable, Sendable {
    public var said: String
    public var corrected: String
}

/// The result of checking every number in the answer against the receipts.
public struct Grounding: Codable, Equatable, Sendable {
    /// False if any number in the answer has no source.
    public var ok: Bool
    public var checked: Int
    public var unverified: [Double]
    public var numbers: [NumberCheck]
    public var corrections: [NumberCorrection]
    public var nameCorrections: [NameCorrection]?
}

// MARK: - Coach endpoints

/// Something worth looking into, found by code in the customer's own history.
public struct Pattern: Codable, Equatable, Sendable {
    public var id: String
    /// `bill-opportunity`, `bill-creep`, `overdraft-risk`, `payday-spike`, `category-drift`, `peer-gap`,
    /// `small-purchases`, `lumpy-costs` or `idle-cash`.
    public var kind: String
    public var title: String
    public var detail: String
    /// Nil when no honest euro figure exists.
    public var yearlyImpactEur: Double?
    /// `high`, `medium` or `low`.
    public var confidence: String
    /// Set when live offer research can follow.
    public var billType: BillType?
    public var evidence: EvidenceFilter
    public var facts: [Fact]
    public var nextSteps: [String]
}

/// Answer of `GET /api/coach/patterns`.
public struct PatternList: Codable, Equatable, Sendable {
    public var customerId: String?
    public var dataTimestamp: String?
    public var patterns: [Pattern]
}

public struct PayCycle: Codable, Equatable, Sendable {
    public var payday: String
    public var income: Double
    public var lowestBalance: Double
    public var lowestOn: String
    public var daysToLowest: Double
    public var spentInFirstWeek: Double
    public var spentInCycle: Double
}

/// Answer of `GET /api/coach/cash-flow`: payday, bills due before it and the expected low point.
public struct CashFlow: Codable, Equatable, Sendable {
    public struct BillDue: Codable, Equatable, Sendable {
        public var billId: String
        public var label: String
        public var amount: Double
        public var expectedOn: String
    }

    public var customerId: String
    public var dataTimestamp: String
    /// Day of the month.
    public var typicalPayday: Double?
    public var nextPayday: String?
    public var daysToNextPayday: Double?
    /// Most recent last.
    public var cycles: [PayCycle]
    public var averageDailyEverydayEur: Double
    public var billsDueBeforePayday: [BillDue]
    /// Balance expected just before the next payday.
    public var projectedLowPointEur: Double?
    public var firstWeekShare: Double?
    public var negativeMonths: Double
    public var steps: [CalcStep]
    public var assumptions: [String]
}

/// Answer of `GET /api/coach/affordability`.
public struct Affordability: Codable, Equatable, Sendable {
    public var customerId: String?
    public var dataTimestamp: String?
    public var amountEur: Double
    public var verdict: AffordabilityVerdict
    public var balanceAfterEur: Double
    public var projectedLowPointEur: Double?
    /// Months of must-pay costs still covered by the balance afterwards.
    public var bufferMonthsAfter: Double
    /// If not affordable now: months of current surplus needed.
    public var monthsToSaveUp: Double?
    public var steps: [CalcStep]
    public var assumptions: [String]
}

/// A teaching moment built from the customer's own numbers. Ask `question` before showing `reveal`.
public struct TeachingCard: Codable, Equatable, Sendable {
    public var id: String
    public var concept: ConceptId
    public var title: String
    public var explanation: String
    public var question: String
    public var options: [String]
    public var correctIndex: Int
    public var reveal: String
    public var facts: [Fact]
}

/// Answer of `GET /api/coach/teaching`.
public struct TeachingCardList: Codable, Equatable, Sendable {
    public var customerId: String?
    public var dataTimestamp: String?
    public var cards: [TeachingCard]
}

/// Answer of `GET /api/coach/mortgage` (only some customers have one; the others get a 404).
public struct MortgageApplication: Codable, Equatable, Sendable {
    public struct Fee: Codable, Equatable, Sendable {
        public var type: String
        public var amountEur: Double
        public var on: String
    }
    public struct TimelineEntry: Codable, Equatable, Sendable {
        public var on: String
        public var event: String
    }

    public var customerId: String
    public var decision: String
    public var startedOn: String
    public var decidedOn: String?
    public var propertyType: String?
    public var propertyPriceEur: Double
    public var loanEur: Double
    public var ownMoneyEur: Double
    public var collateralValueEur: Double
    public var loanToValuePct: Double
    public var requiredMonthlyIncomeEur: Double
    public var monthlyIncomeEur: Double
    public var incomeMarginEur: Double
    public var balanceEur: Double
    public var ownMoneyStillNeededEur: Double
    public var fees: [Fee]
    public var timeline: [TimelineEntry]
    public var steps: [CalcStep]
    public var assumptions: [String]
}

// MARK: - Actions

/// What an approved action adds up to. The three branches end the futures chart.
public struct ActionImpact: Codable, Equatable, Sendable {
    public struct ImpactBranch: Codable, Equatable, Sendable {
        /// `nothing`, `save` or `invest`.
        public var id: String
        public var label: String
        public var endTotal: Double
        public var endLow: Double
        public var endHigh: Double

        /// The branch as the futures simulator names it, when it is one of the three known ones.
        public var branchId: BranchId? { BranchId(rawValue: id) }
    }

    public var monthlyEur: Double
    public var yearlyEur: Double
    public var horizonYears: Double
    public var branches: [ImpactBranch]
    /// "Keep the cash" against "change nothing" at the horizon.
    public var gainVsNothingEur: Double
    public var summary: String
}

/// A prepared action. Nothing happens until the user approves it, and even then it is a simulation:
/// label the card "Simulated, no real switch".
public struct AgentAction: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var customerId: String?
    public var kind: ActionKind
    public var status: ActionStatus
    public var simulated: Bool
    public var title: String
    public var summary: String
    /// The steps a real switch would take.
    public var checklist: [String]
    /// Text Sisu drafted for the provider. Never sent.
    public var draftMessage: String?
    public var billType: BillType?
    public var offer: Offer?
    public var monthlyAmountEur: Double
    public var facts: [Fact]
    public var sources: [Citation]
    public var assumptions: [String]
    /// `sisu-agent` or `user`.
    public var preparedBy: String?
    public var createdAt: String?
    /// 30 minutes after it was prepared.
    public var expiresAt: String
    public var decidedAt: String?
    /// Filled in when approved.
    public var impact: ActionImpact?
}

/// One entry of the tamper-evident audit log.
public struct AuditEvent: Codable, Equatable, Sendable {
    public var seq: Int
    public var at: String
    public var customerId: String
    /// `action_prepared`, `action_approved`, `action_executed_simulated`, `action_declined`, `action_expired`,
    /// `memory_saved`, `memory_forgotten`, `consent_changed` or `demo_reset`.
    public var type: String
    /// `user`, `sisu-agent` or `system`.
    public var actor: String
    public var actionId: String?
    public var detail: String
    public var prevHash: String
    public var hash: String
}

/// Answer of `GET /api/actions`: every action of the customer, newest first, with the audit trail.
public struct ActionList: Codable, Equatable, Sendable {
    public var customerId: String
    public var actions: [AgentAction]
    public var audit: [AuditEvent]
    public var auditChainValid: Bool
}

/// Answer of `GET /api/audit`.
public struct AuditLog: Codable, Equatable, Sendable {
    public var customerId: String?
    public var events: [AuditEvent]
    public var chainValid: Bool
}

/// The `{ action }` envelope of prepare, approve and decline.
public struct ActionEnvelope: Codable, Equatable, Sendable {
    public var action: AgentAction
}

// MARK: - Memory

public struct MemoryItem: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var kind: MemoryKind
    /// The bill id for `bill_name`, otherwise a short label.
    public var key: String
    public var value: String
    /// `bill_name` only: which kind of bill the user says it is.
    public var billType: BillType?
    /// `user-confirmed-in-app` or `user-said-in-chat`.
    public var source: String
    public var savedAt: String
}

/// What Sisu remembers about one customer.
public struct CustomerMemory: Codable, Equatable, Sendable {
    public var customerId: String
    public var consent: Bool
    public var items: [MemoryItem]

    /// The name the user confirmed for a bill, or nil while the name is still Sisu's guess.
    public func confirmedBillName(billId: String) -> String? {
        items.first { $0.kind == .billName && $0.key == billId }?.value
    }
}

// MARK: - Stages

/// One step of Sisu's work, typed so the screen can draw a card for it.
public struct Stage: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var kind: StageKind
    public var title: String
    public var summary: String
    /// `bank-data`, `exa`, `context.dev`, `calculation`, `assumption`, `customer-stated` or `nemotron`.
    public var source: String
    /// Matches `ToolTrace.id` in the message's `tools`.
    public var toolCallId: String?
    /// Milliseconds since the turn started.
    public var atMs: Double
    public var facts: [Fact]
    public var data: StageData

    enum CodingKeys: String, CodingKey { case id, kind, title, summary, source, toolCallId, atMs, facts, data }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        kind = try c.decode(StageKind.self, forKey: .kind)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        summary = try c.decodeIfPresent(String.self, forKey: .summary) ?? ""
        source = try c.decodeIfPresent(String.self, forKey: .source) ?? ""
        toolCallId = try c.decodeIfPresent(String.self, forKey: .toolCallId)
        atMs = try c.decodeIfPresent(Double.self, forKey: .atMs) ?? 0
        facts = try c.decodeIfPresent([Fact].self, forKey: .facts) ?? []
        data = (try? c.decode(StageData.self, forKey: .data)) ?? .unknown(kind: kind.rawValue)
    }

    public init(id: String, kind: StageKind, title: String, summary: String, source: String, toolCallId: String? = nil, atMs: Double = 0,
                facts: [Fact] = [], data: StageData) {
        self.id = id; self.kind = kind; self.title = title; self.summary = summary; self.source = source
        self.toolCallId = toolCallId; self.atMs = atMs; self.facts = facts; self.data = data
    }
}

/// What a stage holds, by kind.
public enum StageData: Codable, Equatable, Sendable {
    public struct Evidence: Codable, Equatable, Sendable {
        public struct Row: Codable, Equatable, Sendable {
            public var date: String
            public var amount: Double
            public var category: String
            public var merchantType: String?
        }
        public var filter: EvidenceFilter
        public var count: Int
        public var totalEur: Double
        public var largest: [Row]
    }
    public struct Research: Codable, Equatable, Sendable {
        public var query: String
        public var searchedWith: String?
        public var pages: [Citation]
        public var retrievedAt: String
        public var mock: Bool
    }
    public struct Extraction: Codable, Equatable, Sendable {
        public var extractedWith: String?
        public var pagesRead: Int
        public var pagesTotal: Int
        public var offers: [Offer]
        public var problems: [String]
    }
    public struct Calculation: Codable, Equatable, Sendable {
        public var steps: [CalcStep]
        public var resultLabel: String
        public var resultValue: Double
        public var unit: String
        public var assumptions: [String]
    }

    case lead(patterns: [Pattern])
    case evidence(Evidence)
    case research(Research)
    case extraction(Extraction)
    case calculation(Calculation)
    case teaching(TeachingCard)
    case action(AgentAction)
    case impact(ActionImpact)
    case memory(MemoryItem)
    /// A kind this version of the app does not know. Draw the stage's `title` and `summary` only.
    case unknown(kind: String)

    enum CodingKeys: String, CodingKey { case kind, patterns, card, action, impact, item }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let kind = try c.decode(String.self, forKey: .kind)
        switch kind {
        case "lead": self = .lead(patterns: try c.decode([Pattern].self, forKey: .patterns))
        case "evidence": self = .evidence(try Evidence(from: decoder))
        case "research": self = .research(try Research(from: decoder))
        case "extraction": self = .extraction(try Extraction(from: decoder))
        case "calculation": self = .calculation(try Calculation(from: decoder))
        case "teaching": self = .teaching(try c.decode(TeachingCard.self, forKey: .card))
        case "action": self = .action(try c.decode(AgentAction.self, forKey: .action))
        case "impact": self = .impact(try c.decode(ActionImpact.self, forKey: .impact))
        case "memory": self = .memory(try c.decode(MemoryItem.self, forKey: .item))
        default: self = .unknown(kind: kind)
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .lead(let patterns): try c.encode("lead", forKey: .kind); try c.encode(patterns, forKey: .patterns)
        case .evidence(let value): try value.encode(to: encoder); try c.encode("evidence", forKey: .kind)
        case .research(let value): try value.encode(to: encoder); try c.encode("research", forKey: .kind)
        case .extraction(let value): try value.encode(to: encoder); try c.encode("extraction", forKey: .kind)
        case .calculation(let value): try value.encode(to: encoder); try c.encode("calculation", forKey: .kind)
        case .teaching(let card): try c.encode("teaching", forKey: .kind); try c.encode(card, forKey: .card)
        case .action(let action): try c.encode("action", forKey: .kind); try c.encode(action, forKey: .action)
        case .impact(let impact): try c.encode("impact", forKey: .kind); try c.encode(impact, forKey: .impact)
        case .memory(let item): try c.encode("memory", forKey: .kind); try c.encode(item, forKey: .item)
        case .unknown(let kind): try c.encode(kind, forKey: .kind)
        }
    }
}

// MARK: - The event stream

/// One event of the server-sent stream of `POST /api/agent/query`, `/api/agent/investigate` and
/// `/api/voice/turn` (section 11 of the frontend contract).
///
/// Order in one turn: `start`, (`transcript`), (`speculation`), (`filler`), then any mix of `toolStart`,
/// `toolEnd`, `research`, `stage`, `teaching`, `action`, `memory`, `delta`, `sentence`, then `grounding`, then
/// `done`. Or `error` at any point. On a voice turn the server sends `transcript` before `start`.
public enum SisuEvent: Codable, Equatable, Sendable {
    case start(turnId: String, provider: String, model: String, mock: Bool)
    /// What was heard. `language` is ISO 639-1 when it was recognised.
    case transcript(text: String, tookMs: Double, language: String?, languageProbability: Double?)
    /// The server began research before the model asked for it.
    case speculation(billType: BillType, reason: String)
    case toolStart(id: String, name: String, args: JSONValue?)
    case toolEnd(ToolTrace)
    /// A sentence to show and say while research runs.
    case filler(String)
    case research(ResearchResult)
    /// Text as it arrives.
    case delta(String)
    /// A whole sentence, for speech.
    case sentence(index: Int, text: String)
    case stage(Stage)
    case action(AgentAction)
    case teaching(TeachingCard)
    case memory(MemoryItem)
    /// Sent just before `done`.
    case grounding(Grounding, facts: [Fact])
    /// `text` is the checked final answer: use it instead of the collected deltas.
    case done(text: String, citations: [Citation], timings: TurnTimings?)
    case error(message: String)
    /// An event type this version of the app does not know. Ignore it.
    case unknown(type: String)

    enum CodingKeys: String, CodingKey {
        case type, turnId, provider, model, mock, text, tookMs, language, languageProbability, billType, reason, id, name, args, trace,
             result, index, stage, action, card, item, grounding, facts, citations, timings, message
    }

    /// The `type` string of the event as the server sends it.
    public var type: String {
        switch self {
        case .start: return "start"
        case .transcript: return "transcript"
        case .speculation: return "speculation"
        case .toolStart: return "tool_start"
        case .toolEnd: return "tool_end"
        case .filler: return "filler"
        case .research: return "research"
        case .delta: return "delta"
        case .sentence: return "sentence"
        case .stage: return "stage"
        case .action: return "action"
        case .teaching: return "teaching"
        case .memory: return "memory"
        case .grounding: return "grounding"
        case .done: return "done"
        case .error: return "error"
        case .unknown(let type): return type
        }
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let type = try c.decode(String.self, forKey: .type)
        switch type {
        case "start":
            self = .start(turnId: try c.decodeIfPresent(String.self, forKey: .turnId) ?? "",
                          provider: try c.decodeIfPresent(String.self, forKey: .provider) ?? "",
                          model: try c.decodeIfPresent(String.self, forKey: .model) ?? "",
                          mock: try c.decodeIfPresent(Bool.self, forKey: .mock) ?? false)
        case "transcript":
            self = .transcript(text: try c.decodeIfPresent(String.self, forKey: .text) ?? "",
                               tookMs: try c.decodeIfPresent(Double.self, forKey: .tookMs) ?? 0,
                               language: try c.decodeIfPresent(String.self, forKey: .language),
                               languageProbability: try c.decodeIfPresent(Double.self, forKey: .languageProbability))
        case "speculation":
            self = .speculation(billType: try c.decode(BillType.self, forKey: .billType),
                                reason: try c.decodeIfPresent(String.self, forKey: .reason) ?? "")
        case "tool_start":
            self = .toolStart(id: try c.decodeIfPresent(String.self, forKey: .id) ?? "",
                              name: try c.decodeIfPresent(String.self, forKey: .name) ?? "",
                              args: try c.decodeIfPresent(JSONValue.self, forKey: .args))
        case "tool_end": self = .toolEnd(try c.decode(ToolTrace.self, forKey: .trace))
        case "filler": self = .filler(try c.decodeIfPresent(String.self, forKey: .text) ?? "")
        case "research": self = .research(try c.decode(ResearchResult.self, forKey: .result))
        case "delta": self = .delta(try c.decodeIfPresent(String.self, forKey: .text) ?? "")
        case "sentence":
            self = .sentence(index: try c.decodeIfPresent(Int.self, forKey: .index) ?? 0,
                             text: try c.decodeIfPresent(String.self, forKey: .text) ?? "")
        case "stage": self = .stage(try c.decode(Stage.self, forKey: .stage))
        case "action": self = .action(try c.decode(AgentAction.self, forKey: .action))
        case "teaching": self = .teaching(try c.decode(TeachingCard.self, forKey: .card))
        case "memory": self = .memory(try c.decode(MemoryItem.self, forKey: .item))
        case "grounding":
            self = .grounding(try c.decode(Grounding.self, forKey: .grounding), facts: try c.decodeIfPresent([Fact].self, forKey: .facts) ?? [])
        case "done":
            self = .done(text: try c.decodeIfPresent(String.self, forKey: .text) ?? "",
                         citations: (try? c.decodeIfPresent([Citation].self, forKey: .citations)) ?? [],
                         timings: try? c.decodeIfPresent(TurnTimings.self, forKey: .timings))
        case "error": self = .error(message: try c.decodeIfPresent(String.self, forKey: .message) ?? "")
        default: self = .unknown(type: type)
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(type, forKey: .type)
        switch self {
        case .start(let turnId, let provider, let model, let mock):
            try c.encode(turnId, forKey: .turnId); try c.encode(provider, forKey: .provider)
            try c.encode(model, forKey: .model); try c.encode(mock, forKey: .mock)
        case .transcript(let text, let tookMs, let language, let probability):
            try c.encode(text, forKey: .text); try c.encode(tookMs, forKey: .tookMs)
            try c.encodeIfPresent(language, forKey: .language); try c.encodeIfPresent(probability, forKey: .languageProbability)
        case .speculation(let billType, let reason): try c.encode(billType, forKey: .billType); try c.encode(reason, forKey: .reason)
        case .toolStart(let id, let name, let args):
            try c.encode(id, forKey: .id); try c.encode(name, forKey: .name); try c.encodeIfPresent(args, forKey: .args)
        case .toolEnd(let trace): try c.encode(trace, forKey: .trace)
        case .filler(let text), .delta(let text): try c.encode(text, forKey: .text)
        case .research(let result): try c.encode(result, forKey: .result)
        case .sentence(let index, let text): try c.encode(index, forKey: .index); try c.encode(text, forKey: .text)
        case .stage(let stage): try c.encode(stage, forKey: .stage)
        case .action(let action): try c.encode(action, forKey: .action)
        case .teaching(let card): try c.encode(card, forKey: .card)
        case .memory(let item): try c.encode(item, forKey: .item)
        case .grounding(let grounding, let facts): try c.encode(grounding, forKey: .grounding); try c.encode(facts, forKey: .facts)
        case .done(let text, let citations, let timings):
            try c.encode(text, forKey: .text); try c.encode(citations, forKey: .citations); try c.encodeIfPresent(timings, forKey: .timings)
        case .error(let message): try c.encode(message, forKey: .message)
        case .unknown: break
        }
    }

    /// Decodes the `data` of one server-sent message. Never throws: a known event whose payload does not
    /// decode, or an unknown event, comes back as `.unknown(type:)`; text that is not a JSON object with a
    /// `type` gives nil.
    public static func decode(_ data: Data) -> SisuEvent? {
        if let event = try? JSONDecoder().decode(SisuEvent.self, from: data) { return event }
        struct TypeOnly: Decodable { let type: String }
        if let only = try? JSONDecoder().decode(TypeOnly.self, from: data) { return .unknown(type: only.type) }
        return nil
    }

    public static func decode(_ text: String) -> SisuEvent? { decode(Data(text.utf8)) }
}

// MARK: - Server information

/// Which model answers and whether it is example data. Show a "Mock data" label when `mock` is true.
public struct ServerInfo: Codable, Equatable, Sendable {
    public var mock: Bool
    public var provider: String
    public var model: String

    public init(mock: Bool, provider: String, model: String) {
        self.mock = mock; self.provider = provider; self.model = model
    }
}

/// Answer of `GET /api/agent/warm`.
public struct WarmResponse: Codable, Equatable, Sendable {
    public var ok: Bool?
    public var provider: String
    public var mock: Bool
    public var model: String
    public var backup: String?
    public var tookMs: Double?

    public var server: ServerInfo { ServerInfo(mock: mock, provider: provider, model: model) }
}

/// Answer of `GET /api/health`.
public struct HealthReport: Codable, Equatable, Sendable {
    public struct Model: Codable, Equatable, Sendable {
        public var provider: String
        public var name: String
        public var host: String?
        public var region: String?
        public var reachable: Bool?
        public var latencyMs: Double?
    }
    public struct Backup: Codable, Equatable, Sendable {
        public var provider: String
        public var name: String
        /// The main model failed recently, so the backup is answering.
        public var inUseNow: Bool?
    }
    public struct Services: Codable, Equatable, Sendable {
        public var exa: Bool?
        public var contextDev: Bool?
        public var elevenLabs: Bool?
    }
    public struct Store: Codable, Equatable, Sendable {
        public var persistent: Bool?
        public var path: String?
    }

    public var ok: Bool
    public var mock: Bool
    public var model: Model
    public var backup: Backup?
    public var services: Services?
    public var dataBoundary: [String]
    public var store: Store?
    public var checkedAt: String?
}

/// Answer of `POST /api/demo/reset`.
public struct DemoResetResult: Codable, Equatable, Sendable {
    public struct Cleared: Codable, Equatable, Sendable {
        public var actions: Int?
        public var memoryItems: Int?
    }
    public var ok: Bool
    public var cleared: Cleared?
}

// MARK: - Voice

/// Answer of `POST /api/voice/stt`.
public struct Transcript: Codable, Equatable, Sendable {
    public var text: String
    public var tookMs: Double?
    public var mock: Bool?
    public var language: String?
    public var languageProbability: Double?
}

/// A language Sisu hears and speaks.
public struct VoiceLanguage: Codable, Equatable, Sendable {
    public var code: String
    public var name: String
    public var nativeName: String
}

/// Answer of `GET /api/voice/tts`: what the language picker offers.
public struct VoiceOptions: Codable, Equatable, Sendable {
    public struct Voice: Codable, Equatable, Sendable {
        public var id: String
        public var name: String
        public var accent: String?
        public var style: String?
    }
    public var voices: [Voice]?
    public var models: [String]?
    public var languages: [VoiceLanguage]
}

/// Audio from `POST /api/voice/tts`. `contentType` says what the bytes are (`audio/mpeg`, `audio/wav`, or raw
/// 24 kHz 16-bit mono samples for `pcm`).
public struct SpeechAudio: Equatable, Sendable {
    public var data: Data
    public var contentType: String

    public init(data: Data, contentType: String) {
        self.data = data; self.contentType = contentType
    }
}

// MARK: - Bill photo

/// What the model read from a photo of the customer's own bill. Every field can be nil: the model leaves out
/// what it cannot see. Nothing is saved until the user confirms it.
public struct BillReading: Codable, Equatable, Sendable {
    public struct ReadBy: Codable, Equatable, Sendable {
        public var provider: String
        public var model: String
        public var tookMs: Double?
    }

    public var billType: BillType?
    public var provider: String?
    public var plan: String?
    public var contractType: String?
    /// `YYYY-MM-DD`.
    public var contractEndsOn: String?
    public var yearlyKwh: Double?
    public var energyPriceCentsPerKwh: Double?
    public var monthlyFeeEur: Double?
    public var billTotalEur: Double?
    public var mock: Bool
    public var readBy: ReadBy?
    /// Fields that were dropped because they were implausible.
    public var problems: [String]
}

/// Answer of `POST /api/agent/bill-photo`.
public struct BillPhotoResult: Codable, Equatable, Sendable {
    public var customerId: String
    public var reading: BillReading
    /// The figures read, as receipts with source `customer-stated`.
    public var facts: [Fact]
    /// Today's offers compared using the bill's real kWh, when research is ready.
    public var comparison: ResearchResult?
    /// The sentence to show the user before saving anything.
    public var toConfirm: String
}

// MARK: - Request bodies

/// Body of `POST /api/agent/query`. `mode` is `voice` (short answers meant to be spoken) or `text`.
public struct AgentRequest: Codable, Equatable, Sendable {
    public var customerId: String
    public var text: String
    public var mode: String
    public var history: [ChatTurn]?
    /// The bill the user has open on screen, if any.
    public var focusBill: BillType?
    /// ISO 639-1 code to answer in, or `auto`. Nil lets the server answer in the language of the text.
    public var language: String?

    public init(customerId: String, text: String, mode: String = "text", history: [ChatTurn]? = nil, focusBill: BillType? = nil, language: String? = nil) {
        self.customerId = customerId; self.text = text; self.mode = mode; self.history = history; self.focusBill = focusBill; self.language = language
    }
}

/// Body of `POST /api/agent/investigate`. `text` is an optional focus, for example `my mobile bill`.
public struct InvestigateRequest: Codable, Equatable, Sendable {
    public var customerId: String
    public var mode: String?
    public var text: String?
    public var language: String?

    public init(customerId: String, mode: String? = "text", text: String? = nil, language: String? = nil) {
        self.customerId = customerId; self.mode = mode; self.text = text; self.language = language
    }
}

/// Body of `POST /api/research`. `wait: false` returns at once while offers load in the background.
public struct ResearchRequest: Codable, Equatable, Sendable {
    public var customerId: String
    public var billType: BillType
    public var wait: Bool?
    public var yearlyKwh: Double?

    public init(customerId: String, billType: BillType, wait: Bool? = nil, yearlyKwh: Double? = nil) {
        self.customerId = customerId; self.billType = billType; self.wait = wait; self.yearlyKwh = yearlyKwh
    }
}

/// Body of `POST /api/memory` that saves one item.
public struct MemorySaveRequest: Codable, Equatable, Sendable {
    public var customerId: String
    public var kind: MemoryKind
    public var key: String?
    public var value: String
    public var billType: BillType?

    public init(customerId: String, kind: MemoryKind, key: String? = nil, value: String, billType: BillType? = nil) {
        self.customerId = customerId; self.kind = kind; self.key = key; self.value = value; self.billType = billType
    }
}

/// Body of `POST /api/memory` that switches remembering on or off (off erases what was stored).
public struct MemoryConsentRequest: Codable, Equatable, Sendable {
    public var customerId: String
    public var consent: Bool

    public init(customerId: String, consent: Bool) {
        self.customerId = customerId; self.consent = consent
    }
}

/// Body of `POST /api/actions/prepare`.
public struct PrepareActionRequest: Codable, Equatable, Sendable {
    public var customerId: String
    public var kind: ActionKind
    public var billType: BillType?
    /// Optional: the default is the best offer.
    public var provider: String?
    /// For `standing_transfer`.
    public var monthlyAmountEur: Double?

    public init(customerId: String, kind: ActionKind, billType: BillType? = nil, provider: String? = nil, monthlyAmountEur: Double? = nil) {
        self.customerId = customerId; self.kind = kind; self.billType = billType; self.provider = provider; self.monthlyAmountEur = monthlyAmountEur
    }
}

/// Body of `POST /api/actions/:id/approve` (`confirm` is always true) and of `/decline` (no `confirm`).
public struct ActionDecisionRequest: Codable, Equatable, Sendable {
    public var customerId: String
    public var confirm: Bool?

    public init(customerId: String, confirm: Bool? = nil) {
        self.customerId = customerId; self.confirm = confirm
    }
}

/// Body of `POST /api/voice/tts`. `format` is `mp3` (`audio/mpeg`) or `pcm` (raw 24 kHz 16-bit mono samples).
/// `text` may hold up to 600 characters: send one sentence at a time. A mock server answers with a short
/// `audio/wav` tone whatever the format, so play by the answer's content type.
public struct SpeechRequest: Codable, Equatable, Sendable {
    public var text: String
    public var format: String?
    public var previousText: String?
    public var model: String?
    public var voiceId: String?
    public var language: String?

    public init(text: String, format: String? = "mp3", previousText: String? = nil, model: String? = nil, voiceId: String? = nil, language: String? = nil) {
        self.text = text; self.format = format; self.previousText = previousText; self.model = model; self.voiceId = voiceId; self.language = language
    }
}
