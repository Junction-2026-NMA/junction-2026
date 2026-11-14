// Charts and the new card content of 14 Nov, as exactly what a view needs: fractions already scaled, texts
// already formatted, colours named by role. Nothing here recomputes a figure the server sent.
import Foundation

/// A colour by role. The app maps roles to its palette; keep the six category colours in their order.
public enum ChartColorRole: String, CaseIterable, Sendable {
    case category1, category2, category3, category4, category5, category6
    /// The customer's own series.
    case main
    /// The comparison series (peers, the current bill, amounts taken away).
    case quiet
    /// A mark to point out (a month that cost more than it brought in). Not red: spending is never red.
    case flagged

    /// The role of the nth category (0-based), cycling after six.
    public static func category(_ index: Int) -> ChartColorRole {
        [.category1, .category2, .category3, .category4, .category5, .category6][((index % 6) + 6) % 6]
    }
}

public struct ChartLegendEntry: Equatable, Sendable {
    public var label: String
    public var color: ChartColorRole
    /// True for a legend entry drawn as a line (the income mark), false for a swatch.
    public var isLine: Bool
}

/// One horizontal bar: its label, the value text at its tip and its length as a fraction of the longest bar.
public struct ChartBar: Equatable, Sendable, Identifiable {
    public var id: String
    public var label: String
    public var valueText: String
    /// 0...1 of the chart's width.
    public var fraction: Double
    public var color: ChartColorRole
    /// A short note beside the label: `€64 above`, `saves about €24 a year`.
    public var note: String?
    public var url: String?
}

public struct ChartSlice: Equatable, Sendable, Identifiable {
    public var id: String
    public var label: String
    public var valueText: String
    /// `38%`.
    public var shareText: String
    /// Where the slice starts and ends around the ring, 0...1.
    public var start: Double
    public var end: Double
    public var color: ChartColorRole
}

public struct ChartColumn: Equatable, Sendable, Identifiable {
    public var id: String
    public var label: String
    /// True for the months whose label is printed on the axis (every third, and the last).
    public var showsLabel: Bool
    /// The column's height, 0...1.
    public var fraction: Double
    /// Where the income mark sits, 0...1.
    public var markFraction: Double
    /// True when the month cost more than it brought in.
    public var flagged: Bool
    public var color: ChartColorRole
    /// `Oct: €1,783 in, €1,901 out, €118 more out than in`.
    public var detail: String
}

public struct ChartLinePoint: Equatable, Sendable {
    /// 0...1 along the years.
    public var x: Double
    /// 0...1 of the chart's height (0 is the lowest value shown).
    public var y: Double
    public var low: Double
    public var high: Double
}

public struct ChartLine: Equatable, Sendable, Identifiable {
    public var id: String
    public var label: String
    public var color: ChartColorRole
    public var points: [ChartLinePoint]
    /// True when the line has a range to draw as a band (invested money).
    public var hasBand: Bool
    /// `€10,516` at the end of the line.
    public var endText: String
    /// `€9,528 to €11,348`, when there is a range.
    public var rangeText: String?
}

/// What a chart view draws.
public struct ChartState: Equatable, Sendable, Identifiable {
    public enum Body: Equatable, Sendable {
        /// A ring: slices in order, the text in its centre (label and total).
        case donut(slices: [ChartSlice], centerLabel: String, centerValue: String)
        /// Rows of bars. Each group has a title and one or two bars.
        case bars(groups: [BarGroup])
        /// Columns per month with an income mark across each.
        case columns([ChartColumn])
        /// Lines over the years. `axisLabels` are the years to print.
        case lines([ChartLine], axisLabels: [String])
        /// A kind this version does not know: show title, caption and summary only.
        case none
    }
    public struct BarGroup: Equatable, Sendable, Identifiable {
        public var id: String
        public var title: String
        public var note: String?
        public var bars: [ChartBar]
        public var url: String?
    }

    public var id: String
    public var kind: String
    public var title: String
    public var caption: String
    /// The code-written sentence that says what the picture shows: use it as the accessibility label.
    public var summary: String
    public var legend: [ChartLegendEntry]
    public var body: Body
    /// A result line under the chart (`Safe to spend a week` and `€164`), when the chart has one.
    public var resultLabel: String?
    public var resultValue: String?
    /// A note under the chart: what the flagged marks mean, or that offers are example data.
    public var footnote: String?
    /// Where the numbers come from: `Your bank data`.
    public var source: String
}

public enum ChartPresenter {
    static func euro(_ value: Double, _ language: SisuLanguage) -> String { Money.format(value, language: language) }

    static func fraction(_ value: Double, of maximum: Double) -> Double {
        guard value.isFinite, maximum.isFinite, maximum > 0 else { return 0 }
        return min(max(value / maximum, 0), 1)
    }

    /// Everything a chart view needs for one `Visual`.
    public static func chart(for visual: Visual, language: SisuLanguage = .en) -> ChartState {
        var state = ChartState(id: visual.id, kind: visual.kind, title: visual.title, caption: visual.caption, summary: visual.summary, legend: [],
                               body: .none, resultLabel: nil, resultValue: nil, footnote: nil, source: CoachText.sourceLabel(visual.source, language: language))
        switch visual.content {
        case .budgetDonut(let slices, let total, let centerLabel):
            let sum = slices.reduce(0) { $0 + ($1.share.isFinite ? max($1.share, 0) : 0) }
            var cursor = 0.0
            var out: [ChartSlice] = []
            for (index, slice) in slices.enumerated() {
                let share = sum > 0 && slice.share.isFinite ? max(slice.share, 0) / sum : 0
                out.append(ChartSlice(id: "\(index)-\(slice.label)", label: slice.label, valueText: euro(slice.value, language),
                                      shareText: CoachText.value(slice.share.rounded(.toNearestOrAwayFromZero), unit: "percent", language: language),
                                      start: cursor, end: min(cursor + share, 1), color: .category(index)))
                cursor = min(cursor + share, 1)
            }
            state.body = .donut(slices: out, centerLabel: centerLabel, centerValue: euro(total, language))
            state.legend = out.map { ChartLegendEntry(label: $0.label, color: $0.color, isLine: false) }
        case .peerBars(let peerGroup, let rows):
            let maximum = rows.flatMap { [$0.you, $0.peers] }.filter(\.isFinite).max() ?? 0
            state.legend = [ChartLegendEntry(label: CoachText.pick(language, "You", "Sinä"), color: .main, isLine: false),
                            ChartLegendEntry(label: CoachText.pick(language, "People \(peerGroup)", "Muut \(peerGroup)"), color: .quiet, isLine: false)]
            state.body = .bars(groups: rows.enumerated().map { index, row in
                let gap = (row.you - row.peers).rounded(.toNearestOrAwayFromZero)
                let note = gap > 0 ? CoachText.pick(language, "\(euro(row.you - row.peers, language)) above", "\(euro(row.you - row.peers, language)) yli")
                    : gap < 0 ? CoachText.pick(language, "\(euro(row.peers - row.you, language)) below", "\(euro(row.peers - row.you, language)) alle")
                    : CoachText.pick(language, "about the same", "suunnilleen sama")
                return ChartState.BarGroup(id: "\(index)-\(row.label)", title: row.label, note: note, bars: [
                    ChartBar(id: "you", label: state.legend[0].label, valueText: euro(row.you, language), fraction: fraction(row.you, of: maximum), color: .main),
                    ChartBar(id: "peers", label: state.legend[1].label, valueText: euro(row.peers, language), fraction: fraction(row.peers, of: maximum), color: .quiet),
                ], url: nil)
            })
        case .monthBars(let months):
            let maximum = max(months.flatMap { [$0.income, $0.spending] }.filter(\.isFinite).max() ?? 0, 1)
            state.legend = [ChartLegendEntry(label: CoachText.pick(language, "Spending", "Menot"), color: .main, isLine: false),
                            ChartLegendEntry(label: CoachText.pick(language, "Income", "Tulot"), color: .quiet, isLine: true)]
            let columns = months.enumerated().map { index, month -> ChartColumn in
                let over = month.spending > month.income
                var detail = CoachText.pick(language, "\(month.label): \(euro(month.income, language)) in, \(euro(month.spending, language)) out",
                                            "\(month.label): \(euro(month.income, language)) sisään, \(euro(month.spending, language)) ulos")
                if over {
                    detail += CoachText.pick(language, ", \(euro(month.spending - month.income, language)) more out than in",
                                             ", \(euro(month.spending - month.income, language)) enemmän ulos kuin sisään")
                }
                return ChartColumn(id: month.month, label: month.label, showsLabel: index % 3 == 0 || index == months.count - 1,
                                   fraction: fraction(month.spending, of: maximum), markFraction: fraction(month.income, of: maximum),
                                   flagged: over, color: over ? .flagged : .main, detail: detail)
            }
            state.body = .columns(columns)
            if columns.contains(where: \.flagged) {
                state.footnote = CoachText.pick(language, "Marked months cost more than they brought in.", "Merkityt kuukaudet maksoivat enemmän kuin toivat.")
            }
        case .waterfall(let steps, let resultLabel, let resultValue):
            let shown = steps.filter { $0.amount.isFinite && $0.amount.rounded(.toNearestOrAwayFromZero) != 0 }
            let maximum = shown.map { abs($0.amount) }.max() ?? 0
            state.body = .bars(groups: shown.enumerated().map { index, step in
                ChartState.BarGroup(id: "\(index)-\(step.label)", title: step.label, note: step.basis, bars: [
                    ChartBar(id: "amount", label: step.label, valueText: euro(step.amount, language), fraction: fraction(abs(step.amount), of: maximum),
                             color: step.amount < 0 ? .quiet : .main),
                ], url: nil)
            })
            state.resultLabel = resultLabel
            state.resultValue = euro(resultValue, language)
        case .futuresLines(let years, let series):
            let all = series.flatMap(\.points)
            let lowest = all.flatMap { [$0.value, $0.low] }.filter(\.isFinite).min() ?? 0
            let highest = all.flatMap { [$0.value, $0.high] }.filter(\.isFinite).max() ?? 0
            let span = highest - lowest
            let lastYear = max(all.map(\.year).filter(\.isFinite).max() ?? years, 0)
            func y(_ value: Double) -> Double { span > 0 && value.isFinite ? min(max((value - lowest) / span, 0), 1) : 0 }
            let lines = series.enumerated().map { index, one -> ChartLine in
                let color: ChartColorRole = one.id == "nothing" ? .quiet : one.id == "invest" ? .main : .category(index)
                let end = one.points.last
                let hasBand = one.points.contains { Money.format($0.low, language: language) != Money.format($0.high, language: language) }
                return ChartLine(id: one.id, label: one.label, color: color,
                                 points: one.points.map { ChartLinePoint(x: lastYear > 0 ? fraction($0.year, of: lastYear) : 0, y: y($0.value), low: y($0.low), high: y($0.high)) },
                                 hasBand: hasBand, endText: end.map { euro($0.value, language) } ?? "",
                                 rangeText: end.flatMap { FuturesPresenter.range(low: $0.low, high: $0.high, language: language) })
            }
            let whole = lastYear.isFinite ? Int(min(lastYear, 100).rounded()) : 0
            state.body = .lines(lines, axisLabels: (0...max(whole, 0)).map { String($0) })
            state.legend = lines.map { ChartLegendEntry(label: $0.label, color: $0.color, isLine: true) }
        case .offerBars(let current, let offers, let mock):
            let maximum = ([current] + offers.map(\.monthlyEur)).filter(\.isFinite).max() ?? 0
            var groups = [ChartState.BarGroup(id: "current", title: CoachText.pick(language, "Your bill now", "Laskusi nyt"), note: nil, bars: [
                ChartBar(id: "current", label: CoachText.pick(language, "Your bill now", "Laskusi nyt"), valueText: euro(current, language),
                         fraction: fraction(current, of: maximum), color: .quiet),
            ], url: nil)]
            groups += offers.enumerated().map { index, offer in
                let note = offer.yearlySavingEur > 0
                    ? CoachText.pick(language, "saves about \(euro(offer.yearlySavingEur, language)) a year", "säästää noin \(euro(offer.yearlySavingEur, language)) vuodessa")
                    : CoachText.pick(language, "not cheaper", "ei halvempi")
                return ChartState.BarGroup(id: "\(index)-\(offer.provider)", title: [offer.provider, offer.plan].compactMap { $0 }.joined(separator: " · "), note: note, bars: [
                    ChartBar(id: "offer", label: offer.provider, valueText: euro(offer.monthlyEur, language), fraction: fraction(offer.monthlyEur, of: maximum), color: .main, url: offer.url),
                ], url: offer.url)
            }
            state.body = .bars(groups: groups)
            if mock { state.footnote = CoachText.pick(language, "Example data, not a live search.", "Esimerkkidataa, ei oikea haku.") }
        case .unknown:
            break
        }
        return state
    }
}

// MARK: - The steps list

/// One row of "What Sisu is doing" (while the reply is pending) and "What Sisu did" (afterwards).
public struct StepRow: Equatable, Sendable, Identifiable {
    public enum State: String, Sendable { case running, done, failed }

    public var id: String
    public var label: String
    public var state: State
    /// `1.2 s`, once it has finished.
    public var duration: String?
    /// One line on what came back.
    public var result: String?
}

public enum StepPresenter {
    /// The heading of the list: `What Sisu is doing` while the reply is pending, `What Sisu did` afterwards.
    public static func heading(pending: Bool, language: SisuLanguage = .en) -> String {
        pending ? CoachText.pick(language, "What Sisu is doing", "Mitä Sisu tekee") : CoachText.pick(language, "What Sisu did", "Mitä Sisu teki")
    }

    /// The rows of a reply's steps. A step still running when the reply has ended (a cancelled turn) is not
    /// shown as running.
    public static func rows(_ message: CoachMessage, language: SisuLanguage = .en) -> [StepRow] {
        message.steps.map { step in
            let state: StepRow.State = !step.ok ? .failed : step.done || !message.pending ? .done : .running
            return StepRow(id: step.id, label: step.label, state: state,
                           duration: step.tookMs.map { ToolPresenter.duration(ms: $0, language: language) }, result: step.result)
        }
    }
}

// MARK: - The money plan

/// One of the two parts of the plan's total.
public struct PlanSplitFigure: Equatable, Sendable {
    /// `€257 a year`.
    public var amount: String
    /// `needs nothing from you` or `needs spending to come down`.
    public var label: String
}

/// The card that sums the plan up. The total is only here together with its two parts.
public struct PlanCardState: Equatable, Sendable {
    /// `About €1,771 a year`.
    public var title: String
    public var needsNothing: PlanSplitFigure
    public var needsSpendingChange: PlanSplitFigure
    /// The server's own summary sentence, when it has arrived.
    public var summary: String?
    /// `Approve all 4`, or nil when nothing waits.
    public var approveLabel: String?
    /// What approving does, in plain words, with the simulation said out loud.
    public var approveNote: String
    /// Always `Simulated, no real switch`.
    public var simulatedTag: String
    /// The warnings of the actions that have one. Show every one of them.
    public var warnings: [String]
    /// After approval: one confirmation per approved action (`Done (simulation). Reference SIM-1A2B3C4D.`).
    public var confirmations: [String]
}

/// One row of the plan's list.
public struct PlanItemRow: Equatable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var detail: String
    /// `About €768 a year`.
    public var amount: String
    /// `Needs nothing from you`, or `Only if this spending really comes down`.
    public var needsNote: String
    public var needsSpendingChange: Bool
}

/// What sources say today about something worth checking, beside the customer's own figure. Never a decision
/// about the customer's case.
public struct PlanCheckCard: Equatable, Sendable, Identifiable {
    public var id: String
    public var title: String
    /// `What the sources say today`.
    public var heading: String
    /// The finding, or a line saying the research found nothing to report or is still running.
    public var finding: String
    /// `Your income, as it arrives in your account` and `€1,783.33 a month`: the customer's own figure.
    public var yoursLabel: String?
    public var yoursValue: String?
    /// Whether the figures were found in the pages' own text.
    public var confirmedNote: String?
    public var sources: [CardLine]
    /// `This is general information, not a decision about your case.`
    public var disclaimer: String
    public var isRunning: Bool
    public var isMock: Bool
}

public enum PlanPresenter {
    static func yearly(_ value: Double, _ language: SisuLanguage) -> String {
        Money.format(value, language: language) + CoachText.pick(language, " a year", " vuodessa")
    }

    /// The summary card, from the totals (always with their split) and the actions set up so far.
    /// Nil until the sums have arrived.
    public static func card(_ view: PlanView, language: SisuLanguage = .en) -> PlanCardState? {
        guard let totals = view.calc?.totals ?? view.plan?.totals else { return nil }
        let waiting = view.waitingActions.count
        return PlanCardState(
            title: CoachText.pick(language, "About ", "Noin ") + yearly(totals.totalYearlyEur, language),
            needsNothing: PlanSplitFigure(amount: yearly(totals.effortlessYearlyEur, language),
                                          label: CoachText.pick(language, "needs nothing from you", "ei vaadi sinulta mitään")),
            needsSpendingChange: PlanSplitFigure(amount: yearly(totals.spendingChangeYearlyEur, language),
                                                 label: CoachText.pick(language, "needs spending to come down", "vaatii menojen pienenemistä")),
            summary: view.summary?.text ?? view.plan?.summary,
            approveLabel: waiting > 0 ? CoachText.pick(language, "Approve all \(waiting)", "Hyväksy kaikki \(waiting)") : nil,
            approveNote: CoachText.pick(language, "Approving sets these up as a simulation. No contract is switched and no money moves.",
                                        "Hyväksyntä tekee nämä simulaationa. Sopimuksia ei vaihdeta eikä rahaa siirry."),
            simulatedTag: CoachText.simulatedTag(language),
            warnings: view.actions.compactMap { $0.warning?.isEmpty == false ? $0.warning : nil },
            confirmations: view.actions.compactMap { $0.confirmation?.isEmpty == false ? $0.confirmation : nil }
        )
    }

    /// The plan's items as rows, once the plan is done.
    public static func items(_ plan: MoneyPlan, language: SisuLanguage = .en) -> [PlanItemRow] {
        plan.items.map { item in
            PlanItemRow(id: item.id, title: item.title, detail: item.detail,
                        amount: CoachText.pick(language, "About ", "Noin ") + yearly(item.yearlyEur, language),
                        needsNote: item.needsSpendingChange
                            ? CoachText.pick(language, "Only if this spending really comes down", "Vain jos nämä menot todella pienenevät")
                            : CoachText.pick(language, "Needs nothing from you", "Ei vaadi sinulta mitään"),
                        needsSpendingChange: item.needsSpendingChange)
        }
    }

    /// A check as a card: what the sources say today, the customer's own figure beside it, and the sources.
    public static func check(_ lane: PlanCheckLane, language: SisuLanguage = .en, timeZone: TimeZone) -> PlanCheckCard {
        let check = lane.check
        let finding: String
        if let check {
            finding = check.finding?.isEmpty == false ? check.finding ?? "" : CoachText.pick(language, "The sources had nothing clear to report today.", "Lähteistä ei löytynyt tänään selvää tietoa.")
        } else {
            finding = CoachText.pick(language, "Looking this up now.", "Tarkistetaan parhaillaan.")
        }
        let confirmed: String? = check.map {
            $0.figuresConfirmed
                ? CoachText.pick(language, "The figures were found in the pages' own text.", "Luvut löytyivät sivujen omasta tekstistä.")
                : CoachText.pick(language, "The figures could not be found in the pages' own text. Check the sources.", "Lukuja ei löytynyt sivujen omasta tekstistä. Tarkista lähteet.")
        }
        return PlanCheckCard(
            id: lane.id, title: lane.title,
            heading: CoachText.pick(language, "What the sources say today", "Mitä lähteet sanovat tänään"),
            finding: finding,
            yoursLabel: check?.yours?.label,
            yoursValue: check?.yours.map { CoachText.value($0.value, unit: $0.unit, language: language) },
            confirmedNote: confirmed,
            sources: (check?.sources ?? []).map { CardLine(label: $0.title, value: CoachText.fetched($0.retrievedAt, language: language, timeZone: timeZone), detail: $0.url) },
            disclaimer: CoachText.pick(language, "This is general information, not a decision about your case.", "Tämä on yleistä tietoa, ei päätös sinun asiastasi."),
            isRunning: check == nil,
            isMock: check?.mock ?? false
        )
    }
}

public extension ActionPresenter {
    /// The warning to show prominently on an action card (what going ahead would do, and the safer amount).
    /// Nil when the action has none. Never hide it.
    static func warning(_ action: AgentAction) -> String? {
        action.warning?.isEmpty == false ? action.warning : nil
    }

    /// The confirmation to show after approval: `Done (simulation). Reference SIM-1A2B3C4D.`
    static func confirmation(_ action: AgentAction) -> String? {
        action.confirmation?.isEmpty == false ? action.confirmation : nil
    }

    /// `To your savings` or `To your investments` for a transfer; nil for anything else.
    static func destination(_ action: AgentAction, language: SisuLanguage = .en) -> String? {
        switch action.destination {
        case "savings": return CoachText.pick(language, "To your savings", "Säästöihisi")
        case "investments": return CoachText.pick(language, "To your investments", "Sijoituksiisi")
        default: return nil
        }
    }
}
