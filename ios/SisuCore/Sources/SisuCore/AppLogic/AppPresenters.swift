// What the app's screens say: every figure and every sentence with a number in it is built here, so the
// views only lay text out. English copy (the app is English for now). Money goes through `Money.format`,
// dates through `Dates.short`.
import Foundation

/// Small number formats the screens need besides money.
public enum NumberText {
    /// A 0...1 share as a whole percent: `0.42` → `42%`. Non-finite values count as 0.
    public static func percent(_ share: Double) -> String {
        let value = share.isFinite ? share : 0
        return "\(Int((value * 100).rounded()))%"
    }

    /// A number with one decimal: `1.14` → `1.1`. Non-finite values count as 0.
    public static func oneDecimal(_ value: Double) -> String {
        let safe = value.isFinite ? value : 0
        let tenths = Int((safe * 10).rounded())
        let sign = tenths < 0 ? "\u{2212}" : ""
        let magnitude = abs(tenths)
        return "\(sign)\(magnitude / 10).\(magnitude % 10)"
    }

    /// `2025-10` → `Oct`. Anything else is returned unchanged.
    public static func monthShort(_ yearMonth: String) -> String {
        let names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        let parts = yearMonth.split(separator: "-")
        guard parts.count >= 2, let month = Int(parts[1]), (1...12).contains(month) else { return yearMonth }
        return names[month - 1]
    }
}

/// The figures and copy of the Today screen.
public enum TodayPresenter {
    /// `Hei Aino`.
    public static func greeting(name: String) -> String { "Hei \(name)" }

    /// The hero's context line, short enough for one line of the Rive hero:
    /// `About €12 a month above this` or `About €40 a month of room to save`. The full sentence is
    /// `XrayPresenter.hero(...).context`.
    public static func heroContext(_ overview: Overview) -> String {
        let gap = overview.safeToSpend.gapPerMonth
        let amount = money(abs(gap.isFinite ? gap : 0))
        return gap < 0 ? "About \(amount) a month above this" : "About \(amount) a month of room to save"
    }

    /// `Data up to 30 Sep 2026`.
    public static func dataDate(_ overview: Overview) -> String {
        "Data up to \(Dates.short(overview.dataTimestamp, language: .en))"
    }

    /// The bill Sisu flags: the recurring bill with the largest monthly average outside housing.
    /// Nil when there is none.
    public static func flaggedBill(in overview: Overview) -> RecurringBill? {
        overview.recurringBills
            .filter { $0.category.lowercased() != "housing" }
            .max { $0.monthlyAvg < $1.monthlyAvg }
    }

    /// The safe-to-spend maths, one line per step, then what is left and what is actually spent.
    public static func mathsLines(_ overview: Overview) -> [MathsLine] {
        let s = overview.safeToSpend
        var lines = s.steps.map { MathsLine(label: $0.label, amount: money($0.amount), basis: $0.basis, isResult: false) }
        lines.append(MathsLine(label: "Left for everyday choices", amount: money(s.perMonth),
                               basis: "about \(money(s.perWeek)) a week", isResult: true))
        lines.append(MathsLine(label: "What you actually spend on them", amount: money(s.actualEverydayPerMonth),
                               basis: "average of the last \(overview.windowMonths) months", isResult: false))
        return lines
    }

    /// The legend under the basket picture, left to right: `Fixed 42% · Curveballs 18% · Leaks 40%`.
    public static func basketLegend(_ overview: Overview) -> String {
        overview.baskets.map { "\($0.id.kind.label(.en)) \(NumberText.percent($0.share))" }.joined(separator: " · ")
    }

    /// One basket card.
    public static func basket(_ basket: BasketSummary, peerCount: Int) -> BasketCardState {
        let kind = basket.id.kind
        return BasketCardState(
            id: basket.id,
            kind: kind,
            name: kind.label(.en),
            subtitle: basket.label,
            monthly: "\(money(basket.monthlyAvg)) a month",
            share: "\(NumberText.percent(basket.share)) of spending",
            categories: basket.categories.map { category in
                BasketCategoryState(
                    category: category.category,
                    monthly: "\(money(category.monthlyAvg)) a month",
                    reason: category.reason,
                    peer: category.peerMonthlyAvg.map { "People your age: about \(money($0)) a month" }
                )
            }
        )
    }

    /// The flagged bill's card.
    public static func bill(_ bill: RecurringBill, confirmedName: String?) -> BillCardState {
        let confidence: String
        switch bill.confidence {
        case .high: confidence = "High confidence"
        case .medium: confidence = "Medium confidence"
        case .low: confidence = "Low confidence"
        }
        return BillCardState(
            headline: confirmedName ?? "Looks like \(bill.guessLabel)",
            isConfirmed: confirmedName != nil,
            nameNote: confirmedName == nil ? "The name is Sisu's guess. Confirm it or change it." : "Name confirmed by you.",
            monthly: money(bill.monthlyAvg),
            monthlyUnit: "a month on average",
            range: "Between \(money(bill.min)) and \(money(bill.max))",
            confidence: confidence,
            basis: bill.basis
        )
    }

    /// The figure title and the total line of a transactions sheet.
    public static func transactionsTotal(_ list: TransactionList) -> String {
        let total = list.total.isFinite ? abs(list.total) : 0
        return list.count == 1 ? "\(money(total)) in 1 payment" : "\(money(total)) in \(list.count) payments"
    }

    /// One transaction row.
    public static func transactionRow(_ transaction: Transaction) -> TransactionRowState {
        TransactionRowState(
            date: Dates.short(transaction.date, language: .en),
            category: transaction.category,
            amount: Money.format(transaction.amount, language: .en, decimals: true)
        )
    }

    /// The note under a truncated list.
    public static func truncatedNote(_ list: TransactionList) -> String? {
        guard list.truncated else { return nil }
        if list.transactions.count < list.count {
            return "Showing the newest \(list.transactions.count) of \(list.count)."
        }
        return "Only the newest payments are included, so older ones may be missing."
    }

    static func money(_ amount: Double) -> String { Money.format(amount, language: .en) }
}

public struct MathsLine: Equatable, Sendable, Identifiable {
    public var id: String { label }
    public let label: String
    public let amount: String
    public let basis: String
    public let isResult: Bool
}

public struct BasketCategoryState: Equatable, Sendable, Identifiable {
    public var id: String { category }
    public let category: String
    public let monthly: String
    public let reason: String
    public let peer: String?
}

public struct BasketCardState: Equatable, Sendable, Identifiable {
    public var id: BasketId { idValue }
    private let idValue: BasketId
    public let kind: BasketKind
    public let name: String
    public let subtitle: String
    public let monthly: String
    public let share: String
    public let categories: [BasketCategoryState]

    init(id: BasketId, kind: BasketKind, name: String, subtitle: String, monthly: String, share: String, categories: [BasketCategoryState]) {
        self.idValue = id; self.kind = kind; self.name = name; self.subtitle = subtitle
        self.monthly = monthly; self.share = share; self.categories = categories
    }
}

public struct BillCardState: Equatable, Sendable {
    public let headline: String
    public let isConfirmed: Bool
    public let nameNote: String
    public let monthly: String
    public let monthlyUnit: String
    public let range: String
    public let confidence: String
    public let basis: String
}

public struct TransactionRowState: Equatable, Sendable {
    public let date: String
    public let category: String
    public let amount: String
}

/// The figures and copy of the Jars screen.
public enum JarsPresenter {
    /// The buffer target in months of must-pay costs.
    public static let bufferTargetMonths = 3.0

    /// The buffer jar's fill: `runwayMonths` out of three months, 0...1.
    public static func bufferFill(runwayMonths: Double) -> Double {
        guard runwayMonths.isFinite else { return 0 }
        return min(max(runwayMonths / bufferTargetMonths, 0), 1)
    }

    /// `Your balance covers about 1.1 months of must-pay costs. The goal is 3.`
    public static func bufferCaption(runwayMonths: Double) -> String {
        "Your balance covers about \(NumberText.oneDecimal(runwayMonths)) months of must-pay costs. The goal is 3."
    }

    /// The fill of the "Freed by switches" jar: the approved monthly saving against the flagged bill's average.
    /// 0 when nothing is approved yet.
    public static func freedFill(approvedMonthlySaving: Double, billMonthly: Double) -> Double {
        guard approvedMonthlySaving > 0, billMonthly > 0, approvedMonthlySaving.isFinite else { return 0 }
        return min(approvedMonthlySaving / billMonthly, 1)
    }

    /// `€0 a month so far` / `€12 a month freed`.
    public static func freedCaption(approvedMonthlySaving: Double) -> String {
        approvedMonthlySaving > 0
            ? "\(TodayPresenter.money(approvedMonthlySaving)) a month freed by switches you approved."
            : "Nothing yet. Approve a switch in Ask and it lands here."
    }

    /// `15 berries for effort`.
    public static func berriesCaption(_ berries: Int) -> String {
        berries == 1 ? "1 berry for effort" : "\(berries) berries for effort"
    }

    public static func billSavingText(_ value: Double) -> String { "\(TodayPresenter.money(value)) a month" }
    public static func trimText(_ value: Double) -> String { "\(Int(value.rounded()))%" }
    /// The futures chart's x-axis label for a month index: `Now`, `1 year`, `2 years`.
    public static func axisLabel(month: Int) -> String {
        month <= 0 ? "Now" : yearsText(month / 12)
    }
    /// A euro axis label: `€2,500`.
    public static func axisMoney(_ value: Double) -> String { TodayPresenter.money(value) }
    public static func yearsText(_ value: Int) -> String { value == 1 ? "1 year" : "\(value) years" }
    public static func endTotal(_ branch: Branch) -> String { TodayPresenter.money(branch.endTotal) }
    public static func endRange(_ branch: Branch) -> String {
        "\(TodayPresenter.money(branch.endLow)) to \(TodayPresenter.money(branch.endHigh))"
    }
    public static func freedPerMonth(_ response: ScenarioResponse) -> String {
        "\(TodayPresenter.money(response.freedPerMonth)) a month freed"
    }
}

/// The predict-before-reveal question on the Jars screen: "If your income stopped a year from now, which
/// future keeps you afloat longest?" The answer is the branch with the most runway after one year.
public enum FuturesQuiz {
    public static let question = "If your income stopped a year from now, which future keeps you afloat longest?"

    /// The three choices in order, with their labels.
    public static let choices: [(id: BranchId, label: String)] = [
        (.nothing, "Change nothing"),
        (.save, "Make the change, keep the cash"),
        (.invest, "Make the change, invest it"),
    ]

    /// The branch with the most runway after a year. Nil without branches.
    public static func answer(_ branches: [Branch]) -> BranchId? {
        branches.max { $0.runwayMonthsAtYear1 < $1.runwayMonthsAtYear1 }?.id
    }

    /// The ChoiceCard `state` for a choice: `idle` before a guess; after it, `correct` for the answer,
    /// `wrong` for a different guess, `idle` for the rest. Without branches a guess shows as `selected`.
    public static func state(of choice: BranchId, guess: BranchId?, branches: [Branch]) -> String {
        guard let guess else { return "idle" }
        guard let answer = answer(branches) else { return choice == guess ? "selected" : "idle" }
        if choice == answer { return "correct" }
        return choice == guess ? "wrong" : "idle"
    }

    /// The sentence after the guess.
    public static func explanation(guess: BranchId, branches: [Branch]) -> String {
        guard let answerId = answer(branches), let best = branches.first(where: { $0.id == answerId }) else {
            return "Your futures are loading."
        }
        let lead = guess == answerId ? "Right." : "Good guess, and here is the twist."
        return "\(lead) Cash in the account pays the rent straight away, so \u{201C}\(best.label.lowercased())\u{201D} covers "
            + "must-pay costs for about \(NumberText.oneDecimal(best.runwayMonthsAtYear1)) months."
    }
}
