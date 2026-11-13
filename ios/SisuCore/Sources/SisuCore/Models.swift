// Models that mirror `lib/types.ts`, the team's API contract.
// Generated once for the scaffold. If lib/types.ts changes on main, change this file to match.
import Foundation

/// The three spending baskets from the S-Pankki brief.
public enum BasketId: String, Codable, CaseIterable, Sendable {
    /// Mandatory and regular (rent). Shown as "Fixed".
    case regular
    /// Mandatory and irregular (a broken washing machine). Shown as "Curveballs".
    case irregular
    /// Everyday spending that slips away (coffees). Shown as "Leaks".
    case everyday
}

public enum Confidence: String, Codable, CaseIterable, Sendable { case high, medium, low }

/// The three futures the simulator compares.
public enum BranchId: String, Codable, CaseIterable, Sendable { case nothing, save, invest }

/// One bank transaction row. Mirrors `Transaction` in lib/types.ts.
public struct Transaction: Codable, Equatable, Sendable {
    public var customerId: String
    public var date: String
    public var time: String
    public var category: String
    public var amount: Double
    public var balanceAfter: Double
    public var type: String
    public var merchantId: String?
    public var mcc: String?

    public init(customerId: String, date: String, time: String, category: String, amount: Double, balanceAfter: Double, type: String, merchantId: String? = nil, mcc: String? = nil) {
        self.customerId = customerId
        self.date = date
        self.time = time
        self.category = category
        self.amount = amount
        self.balanceAfter = balanceAfter
        self.type = type
        self.merchantId = merchantId
        self.mcc = mcc
    }
}

/// A demo profile. Names are invented; the dataset has none.
public struct DemoCustomer: Codable, Equatable, Sendable {
    public var customerId: String
    public var displayName: String
    public var age: Int
    public var postalCode: String
    public var area: String

    public init(customerId: String, displayName: String, age: Int, postalCode: String, area: String) {
        self.customerId = customerId
        self.displayName = displayName
        self.age = age
        self.postalCode = postalCode
        self.area = area
    }
}

/// Spending in one category, with the basket it sits in and why.
public struct CategoryTotal: Codable, Equatable, Sendable {
    public var category: String
    public var basket: BasketId
    public var reason: String
    public var monthlyAvg: Double
    public var count: Int
    public var peerMonthlyAvg: Double?

    public init(category: String, basket: BasketId, reason: String, monthlyAvg: Double, count: Int, peerMonthlyAvg: Double? = nil) {
        self.category = category
        self.basket = basket
        self.reason = reason
        self.monthlyAvg = monthlyAvg
        self.count = count
        self.peerMonthlyAvg = peerMonthlyAvg
    }
}

/// One of the three spending baskets.
public struct BasketSummary: Codable, Equatable, Sendable {
    public var id: BasketId
    public var label: String
    public var description: String
    public var monthlyAvg: Double
    public var share: Double
    public var categories: [CategoryTotal]

    public init(id: BasketId, label: String, description: String, monthlyAvg: Double, share: Double, categories: [CategoryTotal]) {
        self.id = id
        self.label = label
        self.description = description
        self.monthlyAvg = monthlyAvg
        self.share = share
        self.categories = categories
    }
}

/// One month of cash flow.
public struct MonthPoint: Codable, Equatable, Sendable {
    public var month: String
    public var income: Double
    public var regular: Double
    public var irregular: Double
    public var everyday: Double
    public var saved: Double
    public var endBalance: Double

    public init(month: String, income: Double, regular: Double, irregular: Double, everyday: Double, saved: Double, endBalance: Double) {
        self.month = month
        self.income = income
        self.regular = regular
        self.irregular = irregular
        self.everyday = everyday
        self.saved = saved
        self.endBalance = endBalance
    }
}

/// A recurring bill Sisu detected. `guessLabel` is a guess the user confirms.
public struct RecurringBill: Codable, Equatable, Sendable {
    public var id: String
    public var category: String
    public var guessLabel: String
    public var monthlyAvg: Double
    public var min: Double
    public var max: Double
    public var typicalDay: Int
    public var monthsSeen: Int
    public var windowMonths: Int
    public var confidence: Confidence
    public var basis: String

    public init(id: String, category: String, guessLabel: String, monthlyAvg: Double, min: Double, max: Double, typicalDay: Int, monthsSeen: Int, windowMonths: Int, confidence: Confidence, basis: String) {
        self.id = id
        self.category = category
        self.guessLabel = guessLabel
        self.monthlyAvg = monthlyAvg
        self.min = min
        self.max = max
        self.typicalDay = typicalDay
        self.monthsSeen = monthsSeen
        self.windowMonths = windowMonths
        self.confidence = confidence
        self.basis = basis
    }
}

/// One line of the safe-to-spend maths.
public struct CalcStep: Codable, Equatable, Sendable {
    public var label: String
    public var amount: Double
    public var basis: String

    public init(label: String, amount: Double, basis: String) {
        self.label = label
        self.amount = amount
        self.basis = basis
    }
}

/// Safe-to-spend figures. `gapPerMonth` > 0 means room left, < 0 means overspending.
public struct SafeToSpend: Codable, Equatable, Sendable {
    public var perWeek: Double
    public var perMonth: Double
    public var steps: [CalcStep]
    public var actualEverydayPerMonth: Double
    public var gapPerMonth: Double

    public init(perWeek: Double, perMonth: Double, steps: [CalcStep], actualEverydayPerMonth: Double, gapPerMonth: Double) {
        self.perWeek = perWeek
        self.perMonth = perMonth
        self.steps = steps
        self.actualEverydayPerMonth = actualEverydayPerMonth
        self.gapPerMonth = gapPerMonth
    }
}

/// Selects the transactions behind a figure.
public struct EvidenceFilter: Codable, Equatable, Sendable {
    public var from: String
    public var to: String
    public var category: String?
    public var basket: BasketId?
    public var mcc: String?
    public var negativeBalance: Bool?

    public init(from: String, to: String, category: String? = nil, basket: BasketId? = nil, mcc: String? = nil, negativeBalance: Bool? = nil) {
        self.from = from
        self.to = to
        self.category = category
        self.basket = basket
        self.mcc = mcc
        self.negativeBalance = negativeBalance
    }
}

/// A finding with the filter that shows its transactions.
public struct Insight: Codable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var body: String
    public var evidence: EvidenceFilter

    public init(id: String, title: String, body: String, evidence: EvidenceFilter) {
        self.id = id
        self.title = title
        self.body = body
        self.evidence = evidence
    }
}

/// Everything the X-ray screen shows for one customer. Every number is computed by the server.
public struct Overview: Codable, Equatable, Sendable {
    public var customerId: String
    public var displayName: String
    public var age: Int
    public var postalCode: String
    public var ageBand: String
    public var peerCount: Int
    public var dataTimestamp: String
    public var currency: String
    public var windowMonths: Int
    public var windowFrom: String
    public var windowTo: String
    public var balance: Double
    public var monthlyIncome: Double
    public var monthlySpending: Double
    public var monthlySaved: Double
    public var monthlyMandatory: Double
    public var monthlyEveryday: Double
    public var runwayMonths: Double
    public var baskets: [BasketSummary]
    public var months: [MonthPoint]
    public var recurringBills: [RecurringBill]
    public var safeToSpend: SafeToSpend
    public var insights: [Insight]
    public var assumptions: [String]

    public init(customerId: String, displayName: String, age: Int, postalCode: String, ageBand: String, peerCount: Int, dataTimestamp: String, currency: String, windowMonths: Int, windowFrom: String, windowTo: String, balance: Double, monthlyIncome: Double, monthlySpending: Double, monthlySaved: Double, monthlyMandatory: Double, monthlyEveryday: Double, runwayMonths: Double, baskets: [BasketSummary], months: [MonthPoint], recurringBills: [RecurringBill], safeToSpend: SafeToSpend, insights: [Insight], assumptions: [String]) {
        self.customerId = customerId
        self.displayName = displayName
        self.age = age
        self.postalCode = postalCode
        self.ageBand = ageBand
        self.peerCount = peerCount
        self.dataTimestamp = dataTimestamp
        self.currency = currency
        self.windowMonths = windowMonths
        self.windowFrom = windowFrom
        self.windowTo = windowTo
        self.balance = balance
        self.monthlyIncome = monthlyIncome
        self.monthlySpending = monthlySpending
        self.monthlySaved = monthlySaved
        self.monthlyMandatory = monthlyMandatory
        self.monthlyEveryday = monthlyEveryday
        self.runwayMonths = runwayMonths
        self.baskets = baskets
        self.months = months
        self.recurringBills = recurringBills
        self.safeToSpend = safeToSpend
        self.insights = insights
        self.assumptions = assumptions
    }
}

/// The rows behind a figure (newest 300).
public struct TransactionList: Codable, Equatable, Sendable {
    public var customerId: String
    public var dataTimestamp: String
    public var currency: String
    public var count: Int
    public var total: Double
    public var truncated: Bool
    public var transactions: [Transaction]

    public init(customerId: String, dataTimestamp: String, currency: String, count: Int, total: Double, truncated: Bool, transactions: [Transaction]) {
        self.customerId = customerId
        self.dataTimestamp = dataTimestamp
        self.currency = currency
        self.count = count
        self.total = total
        self.truncated = truncated
        self.transactions = transactions
    }
}

/// What the user changes in the futures simulator.
public struct ScenarioInput: Codable, Equatable, Sendable {
    public var billSavingPerMonth: Double
    public var everydayCutPct: Double
    public var years: Int

    public init(billSavingPerMonth: Double, everydayCutPct: Double, years: Int) {
        self.billSavingPerMonth = billSavingPerMonth
        self.everydayCutPct = everydayCutPct
        self.years = years
    }
}

/// One month of one future.
public struct BranchPoint: Codable, Equatable, Sendable {
    public var month: Int
    public var cash: Double
    public var invested: Double
    public var total: Double
    public var totalLow: Double
    public var totalHigh: Double

    public init(month: Int, cash: Double, invested: Double, total: Double, totalLow: Double, totalHigh: Double) {
        self.month = month
        self.cash = cash
        self.invested = invested
        self.total = total
        self.totalLow = totalLow
        self.totalHigh = totalHigh
    }
}

/// One of the three futures.
public struct Branch: Codable, Equatable, Sendable {
    public var id: BranchId
    public var label: String
    public var points: [BranchPoint]
    public var endTotal: Double
    public var endLow: Double
    public var endHigh: Double
    public var runwayMonthsAtYear1: Double

    public init(id: BranchId, label: String, points: [BranchPoint], endTotal: Double, endLow: Double, endHigh: Double, runwayMonthsAtYear1: Double) {
        self.id = id
        self.label = label
        self.points = points
        self.endTotal = endTotal
        self.endLow = endLow
        self.endHigh = endHigh
        self.runwayMonthsAtYear1 = runwayMonthsAtYear1
    }
}

/// Answer of `POST /api/scenarios`.
public struct ScenarioResponse: Codable, Equatable, Sendable {
    public var customerId: String
    public var dataTimestamp: String
    public var currency: String
    public var input: ScenarioInput
    public var freedPerMonth: Double
    public var branches: [Branch]
    public var assumptions: [String]

    public init(customerId: String, dataTimestamp: String, currency: String, input: ScenarioInput, freedPerMonth: Double, branches: [Branch], assumptions: [String]) {
        self.customerId = customerId
        self.dataTimestamp = dataTimestamp
        self.currency = currency
        self.input = input
        self.freedPerMonth = freedPerMonth
        self.branches = branches
        self.assumptions = assumptions
    }
}

/// Error body the API returns with a 4xx status.
public struct ApiError: Codable, Equatable, Sendable {
    public var error: String

    public init(error: String) {
        self.error = error
    }
}
