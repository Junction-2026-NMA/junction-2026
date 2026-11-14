// Models added on 14 Nov: charts the agent sends (`Visual`), what Sisu is doing right now (`SisuActivity`),
// and the money plan (`PlanEvent`, `MoneyPlan`). They mirror lib/types.ts of the team backend.
import Foundation

// MARK: - Charts

/// A chart built in code on the server. Every number in it has a receipt in `facts`; `summary` is a
/// code-written sentence to use as the accessibility text. Draw it with `ChartPresenter.chart(for:)`.
public struct Visual: Codable, Equatable, Sendable, Identifiable {
    public struct Slice: Codable, Equatable, Sendable {
        public var label: String
        public var value: Double
        /// 0...100.
        public var share: Double
    }
    public struct PeerRow: Codable, Equatable, Sendable {
        public var label: String
        public var you: Double
        public var peers: Double
    }
    public struct Month: Codable, Equatable, Sendable {
        public var month: String
        public var label: String
        public var income: Double
        public var spending: Double
    }
    public struct FuturePoint: Codable, Equatable, Sendable {
        public var year: Double
        public var value: Double
        public var low: Double
        public var high: Double
    }
    public struct FutureSeries: Codable, Equatable, Sendable {
        /// `nothing`, `save` or `invest`.
        public var id: String
        public var label: String
        public var points: [FuturePoint]
    }
    public struct OfferBar: Codable, Equatable, Sendable {
        public var provider: String
        public var plan: String?
        public var monthlyEur: Double
        public var yearlySavingEur: Double
        public var url: String
    }

    /// What the chart holds, by kind.
    public enum Content: Equatable, Sendable {
        case budgetDonut(slices: [Slice], total: Double, centerLabel: String)
        case peerBars(peerGroup: String, rows: [PeerRow])
        case monthBars(months: [Month])
        case waterfall(steps: [CalcStep], resultLabel: String, resultValue: Double)
        case futuresLines(years: Double, series: [FutureSeries])
        case offerBars(currentMonthlyEur: Double, offers: [OfferBar], mock: Bool)
        /// A kind this version of the app does not know: show `title`, `caption` and `summary` only.
        case unknown
    }

    public var id: String
    /// `budget_donut`, `peer_bars`, `month_bars`, `waterfall`, `futures_lines` or `offer_bars`.
    public var kind: String
    public var title: String
    public var caption: String
    public var summary: String
    public var source: String
    public var facts: [Fact]
    public var content: Content

    enum CodingKeys: String, CodingKey {
        case id, kind, title, caption, summary, source, facts, slices, total, centerLabel, peerGroup, rows, months, steps, resultLabel, resultValue,
             years, series, currentMonthlyEur, offers, mock
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        let kindValue = try c.decode(String.self, forKey: .kind)
        kind = kindValue
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        caption = try c.decodeIfPresent(String.self, forKey: .caption) ?? ""
        summary = try c.decodeIfPresent(String.self, forKey: .summary) ?? ""
        source = try c.decodeIfPresent(String.self, forKey: .source) ?? ""
        facts = (try? c.decodeIfPresent([Fact].self, forKey: .facts)) ?? []
        func decodeContent() throws -> Content {
            switch kindValue {
            case "budget_donut":
                return .budgetDonut(slices: try c.decode([Slice].self, forKey: .slices), total: try c.decode(Double.self, forKey: .total),
                                    centerLabel: try c.decodeIfPresent(String.self, forKey: .centerLabel) ?? "")
            case "peer_bars":
                return .peerBars(peerGroup: try c.decodeIfPresent(String.self, forKey: .peerGroup) ?? "", rows: try c.decode([PeerRow].self, forKey: .rows))
            case "month_bars": return .monthBars(months: try c.decode([Month].self, forKey: .months))
            case "waterfall":
                return .waterfall(steps: try c.decode([CalcStep].self, forKey: .steps), resultLabel: try c.decodeIfPresent(String.self, forKey: .resultLabel) ?? "",
                                  resultValue: try c.decode(Double.self, forKey: .resultValue))
            case "futures_lines":
                return .futuresLines(years: try c.decodeIfPresent(Double.self, forKey: .years) ?? 0, series: try c.decode([FutureSeries].self, forKey: .series))
            case "offer_bars":
                return .offerBars(currentMonthlyEur: try c.decode(Double.self, forKey: .currentMonthlyEur), offers: try c.decode([OfferBar].self, forKey: .offers),
                                  mock: try c.decodeIfPresent(Bool.self, forKey: .mock) ?? false)
            default: return .unknown
            }
        }
        self.content = (try? decodeContent()) ?? .unknown
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id); try c.encode(kind, forKey: .kind); try c.encode(title, forKey: .title)
        try c.encode(caption, forKey: .caption); try c.encode(summary, forKey: .summary); try c.encode(source, forKey: .source)
        try c.encode(facts, forKey: .facts)
        switch content {
        case .budgetDonut(let slices, let total, let centerLabel):
            try c.encode(slices, forKey: .slices); try c.encode(total, forKey: .total); try c.encode(centerLabel, forKey: .centerLabel)
        case .peerBars(let peerGroup, let rows): try c.encode(peerGroup, forKey: .peerGroup); try c.encode(rows, forKey: .rows)
        case .monthBars(let months): try c.encode(months, forKey: .months)
        case .waterfall(let steps, let resultLabel, let resultValue):
            try c.encode(steps, forKey: .steps); try c.encode(resultLabel, forKey: .resultLabel); try c.encode(resultValue, forKey: .resultValue)
        case .futuresLines(let years, let series): try c.encode(years, forKey: .years); try c.encode(series, forKey: .series)
        case .offerBars(let current, let offers, let mock):
            try c.encode(current, forKey: .currentMonthlyEur); try c.encode(offers, forKey: .offers); try c.encode(mock, forKey: .mock)
        case .unknown: break
        }
    }
}

/// Answer of `GET /api/agent/visuals`: every chart for a customer, with no model call.
public struct VisualList: Codable, Equatable, Sendable {
    public var customerId: String?
    public var visuals: [Visual]
}

// MARK: - The money plan

/// The plan's yearly total, which never travels without its split: the part that needs nothing from the
/// customer, and the part that is only real if spending comes down. Always show the two parts with the total.
public struct PlanTotals: Codable, Equatable, Sendable {
    /// Everything found, a year.
    public var totalYearlyEur: Double
    /// The part that needs nothing from the customer (switches).
    public var effortlessYearlyEur: Double

    /// The part that is saved only if the customer really spends less (habits). Never below zero.
    public var spendingChangeYearlyEur: Double { max(totalYearlyEur - effortlessYearlyEur, 0) }
}

/// One thing the plan found.
public struct PlanItem: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    /// `switch` or `habit`.
    public var kind: String
    public var title: String
    public var detail: String
    public var yearlyEur: Double
    public var monthlyEur: Double
    /// `nothing` (a switch saves money as it is) or `spending-change` (saves only if the spending comes down).
    public var needs: String
    /// The action set up for it, if one could be.
    public var actionId: String?
    public var sources: [Citation]
    public var facts: [Fact]

    /// True when the saving is real only if the customer spends less: say so next to the item.
    public var needsSpendingChange: Bool { needs != "nothing" }
}

public struct PlanSearch: Codable, Equatable, Sendable {
    public var billType: BillType
    public var query: String
    public var pagesRead: Double
    public var pagesFound: Double
    public var offersFound: Double
    public var tookMs: Double?
    public var retrievedAt: String?
    public var live: Bool?
    public var mock: Bool
}

/// Something outside the account that the customer's own figures make worth checking. It is what sources say
/// today, never a decision about the customer's case.
public struct PlanCheck: Codable, Equatable, Sendable, Identifiable {
    public struct Yours: Codable, Equatable, Sendable {
        public var label: String
        public var value: Double
        public var unit: String
    }

    public var id: String
    public var title: String
    public var query: String
    public var ok: Bool
    public var finding: String?
    /// True when every number in the finding also appears in the excerpts taken from the pages.
    public var figuresConfirmed: Bool
    public var sources: [Citation]
    /// The customer's own figure to show beside the finding.
    public var yours: Yours?
    public var tookMs: Double?
    public var mock: Bool
}

public struct PlanProjection: Codable, Equatable, Sendable {
    public var years: Double
    public var freedPerMonthEur: Double
    public var nothingEur: Double
    public var keptEur: Double
    public var investedEur: Double
    public var investedLowEur: Double
    public var investedHighEur: Double
    public var gainKeptEur: Double
    public var assumptions: [String]
}

/// The finished plan (the `plan_done` event).
public struct MoneyPlan: Codable, Equatable, Sendable, Identifiable {
    public struct Scanned: Codable, Equatable, Sendable {
        public var transactions: Double
        public var months: Double
    }
    public struct Notice: Codable, Equatable, Sendable {
        public var title: String
        public var detail: String
    }

    public var id: String
    public var customerId: String
    public var createdAt: String
    public var scanned: Scanned
    public var items: [PlanItem]
    /// Worth knowing, with no honest euro figure.
    public var notices: [Notice]
    public var checks: [PlanCheck]
    /// Set up and waiting for approval.
    public var actions: [AgentAction]
    /// The yearly total with its split. There is no way to read the total alone.
    public var totals: PlanTotals
    public var projection: PlanProjection?
    public var searches: [PlanSearch]
    public var summary: String
    /// Who worded the summary: `nemotron` or `code`. Its numbers are checked either way.
    public var summaryBy: String
    public var facts: [Fact]
    /// Real time on the server, start to finish.
    public var tookMs: Double?

    enum CodingKeys: String, CodingKey {
        case id, customerId, createdAt, scanned, items, notices, checks, actions, projection, searches, summary, summaryBy, facts, tookMs
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        customerId = try c.decodeIfPresent(String.self, forKey: .customerId) ?? ""
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        scanned = try c.decode(Scanned.self, forKey: .scanned)
        items = try c.decodeIfPresent([PlanItem].self, forKey: .items) ?? []
        notices = try c.decodeIfPresent([Notice].self, forKey: .notices) ?? []
        checks = try c.decodeIfPresent([PlanCheck].self, forKey: .checks) ?? []
        actions = try c.decodeIfPresent([AgentAction].self, forKey: .actions) ?? []
        totals = try PlanTotals(from: decoder)
        projection = try c.decodeIfPresent(PlanProjection.self, forKey: .projection)
        searches = try c.decodeIfPresent([PlanSearch].self, forKey: .searches) ?? []
        summary = try c.decodeIfPresent(String.self, forKey: .summary) ?? ""
        summaryBy = try c.decodeIfPresent(String.self, forKey: .summaryBy) ?? "code"
        facts = try c.decodeIfPresent([Fact].self, forKey: .facts) ?? []
        tookMs = try c.decodeIfPresent(Double.self, forKey: .tookMs)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id); try c.encode(customerId, forKey: .customerId); try c.encode(createdAt, forKey: .createdAt)
        try c.encode(scanned, forKey: .scanned); try c.encode(items, forKey: .items); try c.encode(notices, forKey: .notices)
        try c.encode(checks, forKey: .checks); try c.encode(actions, forKey: .actions); try totals.encode(to: encoder)
        try c.encodeIfPresent(projection, forKey: .projection); try c.encode(searches, forKey: .searches)
        try c.encode(summary, forKey: .summary); try c.encode(summaryBy, forKey: .summaryBy); try c.encode(facts, forKey: .facts)
        try c.encodeIfPresent(tookMs, forKey: .tookMs)
    }
}

/// The account being read: counts, the rows to run past and the top categories.
public struct PlanScan: Codable, Equatable, Sendable {
    public struct Row: Codable, Equatable, Sendable {
        public var date: String
        public var category: String
        public var amount: Double
    }
    public struct Category: Codable, Equatable, Sendable {
        public var category: String
        public var monthlyEur: Double
    }
    public var transactions: Int
    public var months: Int
    public var from: String
    public var to: String
    public var rows: [Row]
    public var categories: [Category]
    public var tookMs: Double?
}

/// One pattern the plan found. `role` is `habit` (has `yearlyEur`), `notice` (no euro figure) or `bill` (a
/// search follows; the screen does not list it).
public struct PlanFinding: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var role: String
    public var title: String
    public var detail: String
    public var yearlyEur: Double?
}

public struct PlanPage: Codable, Equatable, Sendable {
    public var url: String
    public var host: String
    public var title: String
}

public struct PlanPageRead: Codable, Equatable, Sendable {
    public var billType: BillType
    public var url: String
    public var host: String
    public var ok: Bool
    public var offers: Double
    /// `context.dev` or `exa` (Exa reads a page when Context.dev cannot).
    public var reader: String
    /// How old the copy of the page was, when it was not read this second.
    public var ageMs: Double?
    public var tookMs: Double?
}

public struct PlanOffers: Codable, Equatable, Sendable {
    public var billType: BillType
    public var ok: Bool
    public var best: Offer?
    public var yearlySavingEur: Double?
    public var currentMonthlyEur: Double?
    public var offersFound: Double
    public var live: Bool?
    /// Set when nothing is cheaper.
    public var note: String?
}

/// One event of `POST /api/agent/plan`, one per real step of the server's work.
public enum PlanEvent: Decodable, Equatable, Sendable {
    case planStart(planId: String, customerName: String, provider: String, model: String, mock: Bool)
    case scan(PlanScan)
    case finding(PlanFinding)
    case searchStart(billType: BillType, query: String, engine: String)
    case searchPages(billType: BillType, pages: [PlanPage])
    case pageRead(PlanPageRead)
    case offers(PlanOffers)
    case checkStart(id: String, title: String, query: String)
    case checkDone(PlanCheck)
    /// Everything added up: the steps and the total with its split.
    case calc(steps: [CalcStep], totals: PlanTotals)
    case action(AgentAction)
    case projection(PlanProjection)
    case summary(text: String, by: String)
    case planDone(MoneyPlan)
    case error(message: String)
    /// An event type this version of the app does not know. Ignore it.
    case unknown(type: String)

    enum CodingKeys: String, CodingKey {
        case type, planId, customerName, provider, model, mock, billType, query, engine, pages, id, title, check, steps, action, projection, text, by, plan, message
    }

    /// The `type` string of the event as the server sends it.
    public var type: String {
        switch self {
        case .planStart: return "plan_start"
        case .scan: return "scan"
        case .finding: return "finding"
        case .searchStart: return "search_start"
        case .searchPages: return "search_pages"
        case .pageRead: return "page_read"
        case .offers: return "offers"
        case .checkStart: return "check_start"
        case .checkDone: return "check_done"
        case .calc: return "calc"
        case .action: return "action"
        case .projection: return "projection"
        case .summary: return "summary"
        case .planDone: return "plan_done"
        case .error: return "error"
        case .unknown(let type): return type
        }
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let type = try c.decode(String.self, forKey: .type)
        switch type {
        case "plan_start":
            self = .planStart(planId: try c.decodeIfPresent(String.self, forKey: .planId) ?? "",
                              customerName: try c.decodeIfPresent(String.self, forKey: .customerName) ?? "",
                              provider: try c.decodeIfPresent(String.self, forKey: .provider) ?? "",
                              model: try c.decodeIfPresent(String.self, forKey: .model) ?? "",
                              mock: try c.decodeIfPresent(Bool.self, forKey: .mock) ?? false)
        case "scan": self = .scan(try PlanScan(from: decoder))
        case "finding": self = .finding(try PlanFinding(from: decoder))
        case "search_start":
            self = .searchStart(billType: try c.decode(BillType.self, forKey: .billType), query: try c.decodeIfPresent(String.self, forKey: .query) ?? "",
                                engine: try c.decodeIfPresent(String.self, forKey: .engine) ?? "exa")
        case "search_pages":
            self = .searchPages(billType: try c.decode(BillType.self, forKey: .billType), pages: try c.decodeIfPresent([PlanPage].self, forKey: .pages) ?? [])
        case "page_read": self = .pageRead(try PlanPageRead(from: decoder))
        case "offers": self = .offers(try PlanOffers(from: decoder))
        case "check_start":
            self = .checkStart(id: try c.decode(String.self, forKey: .id), title: try c.decodeIfPresent(String.self, forKey: .title) ?? "",
                               query: try c.decodeIfPresent(String.self, forKey: .query) ?? "")
        case "check_done": self = .checkDone(try c.decode(PlanCheck.self, forKey: .check))
        case "calc": self = .calc(steps: try c.decodeIfPresent([CalcStep].self, forKey: .steps) ?? [], totals: try PlanTotals(from: decoder))
        case "action": self = .action(try c.decode(AgentAction.self, forKey: .action))
        case "projection": self = .projection(try c.decode(PlanProjection.self, forKey: .projection))
        case "summary": self = .summary(text: try c.decodeIfPresent(String.self, forKey: .text) ?? "", by: try c.decodeIfPresent(String.self, forKey: .by) ?? "code")
        case "plan_done": self = .planDone(try c.decode(MoneyPlan.self, forKey: .plan))
        case "error": self = .error(message: try c.decodeIfPresent(String.self, forKey: .message) ?? "")
        default: self = .unknown(type: type)
        }
    }

    /// Decodes the `data` of one server-sent message. Never throws: a known event whose payload does not
    /// decode, or an unknown one, comes back as `.unknown(type:)`; text that is not an event gives nil.
    public static func decode(_ data: Data) -> PlanEvent? {
        if let event = try? JSONDecoder().decode(PlanEvent.self, from: data) { return event }
        struct TypeOnly: Decodable { let type: String }
        if let only = try? JSONDecoder().decode(TypeOnly.self, from: data) { return .unknown(type: only.type) }
        return nil
    }

    /// Parses a whole recorded plan stream at once.
    public static func events(in data: Data) -> [PlanEvent] {
        var parser = SSEParser()
        return (parser.feed(data) + parser.finish()).compactMap { decode(Data($0.data.utf8)) }
    }
}

/// Body of `POST /api/agent/plan`. `fresh: false` reuses a recent search instead of searching now.
public struct PlanRequest: Codable, Equatable, Sendable {
    public var customerId: String
    public var fresh: Bool?
    public var language: String?

    public init(customerId: String, fresh: Bool? = nil, language: String? = nil) {
        self.customerId = customerId; self.fresh = fresh; self.language = language
    }
}

/// Body of `POST /api/actions/approve-all` (`confirm` is always true; between one and six action ids).
public struct ApproveAllRequest: Codable, Equatable, Sendable {
    public var customerId: String
    public var actionIds: [String]
    public var confirm: Bool

    public init(customerId: String, actionIds: [String]) {
        self.customerId = customerId; self.actionIds = actionIds; self.confirm = true
    }
}

/// Answer of `POST /api/actions/approve-all`: each action is approved, simulated and logged on its own.
public struct ApproveAllResult: Codable, Equatable, Sendable {
    public struct Failure: Codable, Equatable, Sendable {
        public var actionId: String?
        public var reason: String
    }
    public var approved: [AgentAction]
    public var failed: [Failure]
}
