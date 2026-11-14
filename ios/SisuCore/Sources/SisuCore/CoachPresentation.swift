// Pure helpers that turn coach payloads into the exact strings and numbers a screen shows, so views hold no
// arithmetic and no formatting. Copy rules are those of ios/BRAND.md: number first, no blame, "about" for
// estimates. Every figure comes from the payload; nothing here recomputes a saving.
import Foundation

// MARK: - Fixed labels

public enum CoachText {
    static func pick(_ language: SisuLanguage, _ en: String, _ fi: String) -> String { language == .en ? en : fi }

    /// The tag every action card carries: `Simulated, no real switch`.
    public static func simulatedTag(_ language: SisuLanguage = .en) -> String {
        pick(language, "Simulated, no real switch", "Simuloitu, ei oikeaa vaihtoa")
    }

    /// `Sample data`: for anything served from the bundled recordings.
    public static func sampleDataTag(_ language: SisuLanguage = .en) -> String { pick(language, "Sample data", "Esimerkkidata") }

    /// `Mock data`: for anything a server marked `mock: true`.
    public static func mockDataTag(_ language: SisuLanguage = .en) -> String { pick(language, "Mock data", "Testidata") }

    /// The tag the screen owes the user for a session's data: nil when it is live.
    public static func dataTag(for label: CoachDataLabel, language: SisuLanguage = .en) -> String? {
        switch label {
        case .live: return nil
        case .mock: return mockDataTag(language)
        case .sample: return sampleDataTag(language)
        }
    }

    /// What stands in for a field the source did not give: `not stated`.
    public static func notStated(_ language: SisuLanguage = .en) -> String { pick(language, "not stated", "ei ilmoitettu") }

    /// `Fetched 14 Nov 2026, 10:42` (fi `Haettu 14.11.2026 klo 10.42`) for an ISO moment, shown in `timeZone`.
    public static func fetched(_ iso: String, language: SisuLanguage = .en, timeZone: TimeZone) -> String {
        pick(language, "Fetched ", "Haettu ") + Dates.shortDateTime(iso, language: language, timeZone: timeZone)
    }

    /// Where a number came from, for a `Fact.source`, `Stage.source` or `ToolTrace.source`.
    public static func sourceLabel(_ source: String, language: SisuLanguage = .en) -> String {
        switch source {
        case "bank-data", "finance": return pick(language, "Your bank data", "Tilitietosi")
        case "exa": return pick(language, "Web search", "Verkkohaku")
        case "context.dev": return pick(language, "Offer pages", "Tarjoussivut")
        case "exa+context.dev": return pick(language, "Web search and offer pages", "Verkkohaku ja tarjoussivut")
        case "calculation": return pick(language, "Calculation", "Laskelma")
        case "assumption": return pick(language, "Assumption", "Oletus")
        case "customer-stated": return pick(language, "You told Sisu", "Kerroit Sisulle")
        case "nemotron": return pick(language, "Sisu's model", "Sisun malli")
        default: return source
        }
    }

    /// A number with at most `places` decimals and no trailing zeros: `8.9`, `24`, fi `8,9`.
    static func number(_ value: Double, places: Int = 2, language: SisuLanguage) -> String {
        guard value.isFinite else { return "—" }
        var scale = 1.0
        for _ in 0..<places { scale *= 10 }
        let rounded = (abs(value) * scale).rounded(.toNearestOrAwayFromZero)
        guard rounded < 9.0e15 else { return "—" }
        let units = UInt64(rounded)
        let whole = units / UInt64(scale)
        var fraction = String(units % UInt64(scale))
        while fraction.count < places { fraction = "0" + fraction }
        while fraction.hasSuffix("0") { fraction.removeLast() }
        let sign = value < 0 && units > 0 ? Money.minus : ""
        let grouped = Money.group(String(whole), separator: language == .en ? "," : Money.nbsp)
        return sign + grouped + (fraction.isEmpty ? "" : (language == .en ? "." : ",") + fraction)
    }

    /// A fact's value with its unit: `€39.83 a month`, `4,573 kWh a year`, `8.9 c/kWh`, `65%`, `3`.
    public static func factValue(_ fact: Fact, language: SisuLanguage = .en) -> String {
        value(fact.value, unit: fact.unit, language: language)
    }

    /// A value with one of the server's units (`EUR`, `EUR/month`, `EUR/year`, `kWh/year`, `c/kWh`, `months`,
    /// `count`, `percent`, `years`, `days`). An unknown unit is shown after the number as it came.
    public static func value(_ value: Double, unit: String, language: SisuLanguage = .en) -> String {
        let money = Money.format(value, language: language, decimals: value != value.rounded())
        let plain = number(value, language: language)
        switch unit {
        case "EUR": return money
        case "EUR/month": return money + pick(language, " a month", " kuukaudessa")
        case "EUR/year": return money + pick(language, " a year", " vuodessa")
        case "kWh/year": return plain + pick(language, " kWh a year", " kWh vuodessa")
        case "c/kWh": return plain + " c/kWh"
        case "months": return plain + pick(language, value == 1 ? " month" : " months", " kk")
        case "years": return plain + pick(language, value == 1 ? " year" : " years", " v")
        case "days": return plain + pick(language, value == 1 ? " day" : " days", " pv")
        case "percent": return plain + (language == .en ? "%" : Money.nbsp + "%")
        case "count", "": return plain
        default: return plain + " " + unit
        }
    }
}

// MARK: - Offers

/// One row of the offer table.
public struct OfferRow: Equatable, Sendable, Identifiable {
    public var id: String
    public var provider: String
    /// The plan's name, or `not stated`.
    public var plan: String
    /// `€3.90 a month + 8.9 c/kWh`, one of the two, or `not stated`.
    public var price: String
    /// `24 months`, or `not stated`.
    public var contract: String
    /// `About €38 a month`, or `not stated`. The server's estimate for this customer's use.
    public var estimatedMonthlyCost: String
    /// `About €24 less a year`, `About €24 more a year`, `About the same as now`, `Spot price, not comparable`,
    /// `Not comparable` or `not stated`. From the server's `estimatedYearlySavingEur`, never recomputed.
    public var saving: String
    /// False for offers whose price cannot be compared fairly (spot contracts): show them, do not rank them.
    public var comparable: Bool
    /// True for the offer the server picked as best.
    public var isBest: Bool
    public var sourceUrl: String
}

public enum OfferPresenter {
    static func monthly(_ language: SisuLanguage) -> String { CoachText.pick(language, " a month", " kuukaudessa") }

    /// The saving line of one offer (see `OfferRow.saving`).
    public static func savingText(_ offer: Offer, language: SisuLanguage = .en) -> String {
        guard offer.comparable else {
            return offer.contractType?.lowercased() == "spot"
                ? CoachText.pick(language, "Spot price, not comparable", "Pörssisähkö, ei vertailukelpoinen")
                : CoachText.pick(language, "Not comparable", "Ei vertailukelpoinen")
        }
        guard let saving = offer.estimatedYearlySavingEur, saving.isFinite else { return CoachText.notStated(language) }
        return yearly(saving, language: language)
    }

    /// `About €24 less a year` for a positive yearly saving, `About €24 more a year` for a negative one.
    public static func yearly(_ saving: Double, language: SisuLanguage = .en) -> String {
        guard saving.isFinite else { return CoachText.notStated(language) }
        let whole = saving.rounded(.toNearestOrAwayFromZero)
        let amount = Money.format(abs(saving), language: language)
        if whole == 0 { return CoachText.pick(language, "About the same as now", "Suunnilleen sama kuin nyt") }
        return whole > 0
            ? CoachText.pick(language, "About \(amount) less a year", "Noin \(amount) vähemmän vuodessa")
            : CoachText.pick(language, "About \(amount) more a year", "Noin \(amount) enemmän vuodessa")
    }

    public static func row(_ offer: Offer, isBest: Bool = false, language: SisuLanguage = .en) -> OfferRow {
        var priceParts: [String] = []
        if let monthlyPrice = offer.monthlyPriceEur { priceParts.append(Money.format(monthlyPrice, language: language, decimals: true) + monthly(language)) }
        if let energy = offer.energyPriceCentsPerKwh { priceParts.append(CoachText.number(energy, language: language) + " c/kWh") }
        let contract = offer.contractMonths.map { CoachText.value($0, unit: "months", language: language) } ?? CoachText.notStated(language)
        let cost = offer.estimatedMonthlyCostEur.map {
            CoachText.pick(language, "About ", "Noin ") + Money.format($0, language: language) + monthly(language)
        } ?? CoachText.notStated(language)
        return OfferRow(
            id: offer.provider + "|" + (offer.plan ?? ""),
            provider: offer.provider,
            plan: offer.plan ?? CoachText.notStated(language),
            price: priceParts.isEmpty ? CoachText.notStated(language) : priceParts.joined(separator: " + "),
            contract: contract,
            estimatedMonthlyCost: cost,
            saving: savingText(offer, language: language),
            comparable: offer.comparable,
            isBest: isBest,
            sourceUrl: offer.sourceUrl
        )
    }

    /// The offer table, in the server's order. The best offer is flagged.
    public static func rows(_ research: ResearchResult, language: SisuLanguage = .en) -> [OfferRow] {
        research.offers.map { row($0, isBest: research.best == $0, language: language) }
    }

    /// The line above the table: `About €24 less a year with Example Energia`, or `Nothing cheaper today`
    /// when the server found no better offer.
    public static func headline(_ research: ResearchResult, language: SisuLanguage = .en) -> String {
        guard let best = research.best, let saving = best.estimatedYearlySavingEur, saving.rounded(.toNearestOrAwayFromZero) > 0 else {
            return CoachText.pick(language, "Nothing cheaper today", "Ei halvempaa tänään")
        }
        return yearly(saving, language: language) + CoachText.pick(language, " with \(best.provider)", " – \(best.provider)")
    }

    /// `Your bill now: about €40 a month`, or nil when the server has no baseline.
    public static func baseline(_ research: ResearchResult, language: SisuLanguage = .en) -> String? {
        guard let baseline = research.baselineMonthlyEur else { return nil }
        let amount = Money.format(baseline, language: language) + monthly(language)
        return CoachText.pick(language, "Your bill now: about \(amount)", "Laskusi nyt: noin \(amount)")
    }

    /// The note under the table: when the offers were fetched, and that they are example data when they are.
    public static func fetchedNote(_ research: ResearchResult, language: SisuLanguage = .en, timeZone: TimeZone) -> String {
        let time = CoachText.fetched(research.finishedAt ?? research.startedAt, language: language, timeZone: timeZone)
        return research.mock ? time + " · " + CoachText.mockDataTag(language) : time
    }

    /// The monthly bill saving to feed the futures chart: the best offer's yearly saving spread over twelve
    /// months (the rule in the backend's frontend guide). Nil when nothing is cheaper.
    public static func monthlyBillSaving(_ research: ResearchResult) -> Double? {
        guard let saving = research.best?.estimatedYearlySavingEur, saving > 0 else { return nil }
        return saving / 12
    }
}

// MARK: - Stage cards

/// One line of a card: a label, an optional value on the right and an optional small detail under it.
public struct CardLine: Equatable, Sendable {
    public var label: String
    public var value: String?
    public var detail: String?

    public init(label: String, value: String? = nil, detail: String? = nil) {
        self.label = label; self.value = value; self.detail = detail
    }
}

/// What a stage card shows.
public struct StageCard: Equatable, Sendable, Identifiable {
    public var id: String
    public var kind: StageKind
    public var title: String
    public var summary: String
    /// Where the card's numbers come from, for example `Your bank data`.
    public var source: String
    public var lines: [CardLine]
    /// `Fetched 14 Nov 2026, 11:25` for web research; nil otherwise.
    public var footnote: String?
    /// True when the stage holds example data: add the "Mock data" tag.
    public var isMock: Bool
}

public enum StagePresenter {
    /// The working of a calculation, line by line: the label, the signed amount and how it was worked out.
    public static func lines(_ steps: [CalcStep], language: SisuLanguage = .en) -> [CardLine] {
        steps.map { CardLine(label: $0.label, value: Money.format($0.amount, language: language, decimals: true), detail: $0.basis) }
    }

    public static func card(_ stage: Stage, language: SisuLanguage = .en, timeZone: TimeZone) -> StageCard {
        var lines: [CardLine] = []
        var footnote: String?
        var isMock = false
        switch stage.data {
        case .lead(let patterns):
            lines = patterns.map { pattern in
                let value = pattern.yearlyImpactEur.map { CoachText.pick(language, "About ", "Noin ") + CoachText.value($0.rounded(.toNearestOrAwayFromZero), unit: "EUR/year", language: language) }
                return CardLine(label: pattern.title, value: value, detail: pattern.detail)
            }
        case .evidence(let evidence):
            lines = [CardLine(label: CoachText.pick(language, evidence.count == 1 ? "1 transaction" : "\(evidence.count) transactions", "\(evidence.count) tapahtumaa"),
                              value: Money.format(evidence.totalEur, language: language, decimals: true))]
            lines += evidence.largest.map {
                CardLine(label: Dates.short($0.date, language: language) + " · " + $0.category, value: Money.format($0.amount, language: language, decimals: true),
                         detail: $0.merchantType)
            }
        case .research(let research):
            lines = [CardLine(label: CoachText.pick(language, "Searched for", "Haettu hakusanoilla"), detail: research.query)]
            lines += research.pages.map { CardLine(label: $0.title, detail: $0.url) }
            footnote = CoachText.fetched(research.retrievedAt, language: language, timeZone: timeZone)
            isMock = research.mock
        case .extraction(let extraction):
            lines = [CardLine(label: CoachText.pick(language, "Pages read", "Luetut sivut"),
                              value: CoachText.pick(language, "\(extraction.pagesRead) of \(extraction.pagesTotal)", "\(extraction.pagesRead)/\(extraction.pagesTotal)"))]
            lines += extraction.offers.map { offer in
                CardLine(label: [offer.provider, offer.plan].compactMap { $0 }.joined(separator: " · "), value: OfferPresenter.savingText(offer, language: language))
            }
            lines += extraction.problems.map { CardLine(label: CoachText.pick(language, "Could not be read", "Ei voitu lukea"), detail: $0) }
        case .calculation(let calculation):
            lines = Self.lines(calculation.steps, language: language)
        case .teaching(let card):
            lines = [CardLine(label: card.question)]
        case .action(let action):
            lines = [CardLine(label: action.title, value: ActionPresenter.statusSentence(action.status, language: language))]
        case .impact(let impact):
            lines = FuturesPresenter.series(impact, language: language).map { CardLine(label: $0.label, value: $0.endLabel, detail: $0.rangeLabel) }
        case .memory(let item):
            lines = [CardLine(label: CoachText.pick(language, "Sisu will remember", "Sisu muistaa"), value: item.value)]
        case .unknown:
            break
        }
        return StageCard(id: stage.id, kind: stage.kind, title: stage.title, summary: stage.summary,
                         source: CoachText.sourceLabel(stage.source, language: language), lines: lines, footnote: footnote, isMock: isMock)
    }

    /// The live research stage for the `StageIndicator` component, from what a reply holds so far. Nil when
    /// the reply has nothing to do with research.
    public static func researchStage(of message: CoachMessage) -> ResearchStage? {
        let kinds = Set(message.stages.map(\.kind))
        if kinds.contains(.calculation) { return .done }
        if let status = message.research?.status, status == .done || status == .partial || status == .failed { return .done }
        if kinds.contains(.extraction) { return .comparing }
        if kinds.contains(.research) { return .reading }
        if message.startedEarly != nil || message.runningTool == "search_offers" || message.research != nil { return .searching }
        return nil
    }
}

// MARK: - Action card

/// What the approval card shows.
public struct ActionCardState: Equatable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var summary: String
    /// The steps a real switch would take.
    public var checklist: [String]
    /// Show these near the saving. They are part of the honest answer.
    public var assumptions: [String]
    /// `€2.01 a month`: what the action frees, from the server.
    public var monthly: String
    /// `Waiting for your approval. Nothing has been done.` and so on, by status.
    public var statusSentence: String
    /// Always `Simulated, no real switch`.
    public var simulatedTag: String
    /// True while Approve and Decline make sense (the action is awaiting approval).
    public var canDecide: Bool
    /// After approval: `About €121 more after 5 years if the saving is simply kept.` (the server's sentence).
    public var impactSummary: String?
    /// `Valid until 14 Nov 2026, 11:56` while it waits (the server keeps a prepared action for 30 minutes,
    /// because prices may change); nil afterwards. A plain fact, not a countdown.
    public var validUntil: String?
    /// The text Sisu drafted for the provider. Never sent.
    public var draftMessage: String?
    /// What going ahead would do, and the safer amount. Show it prominently whenever it is set; never hide it.
    public var warning: String?
    /// After approval: `Done (simulation). Reference SIM-1A2B3C4D.`
    public var confirmation: String?
    /// `To your savings` or `To your investments` for a transfer.
    public var destination: String?
}

public enum ActionPresenter {
    public static func statusSentence(_ status: ActionStatus, language: SisuLanguage = .en) -> String {
        switch status {
        case .awaitingApproval:
            return CoachText.pick(language, "Waiting for your approval. Nothing has been done.", "Odottaa hyväksyntääsi. Mitään ei ole tehty.")
        case .executedSimulated:
            return CoachText.pick(language, "Approved. Simulated, no real switch was made.", "Hyväksytty. Simuloitu, oikeaa vaihtoa ei tehty.")
        case .declined:
            return CoachText.pick(language, "Declined. Nothing was done.", "Hylätty. Mitään ei tehty.")
        case .expired:
            return CoachText.pick(language, "Expired. Prices may have changed. Ask Sisu to prepare it again.",
                                  "Vanhentunut. Hinnat ovat voineet muuttua. Pyydä Sisua valmistelemaan se uudelleen.")
        default:
            return status.rawValue
        }
    }

    public static func card(_ action: AgentAction, language: SisuLanguage = .en, timeZone: TimeZone) -> ActionCardState {
        let waiting = action.status == .awaitingApproval
        return ActionCardState(
            id: action.id,
            title: action.title,
            summary: action.summary,
            checklist: action.checklist,
            assumptions: action.assumptions,
            monthly: CoachText.value(action.monthlyAmountEur, unit: "EUR/month", language: language),
            statusSentence: statusSentence(action.status, language: language),
            simulatedTag: CoachText.simulatedTag(language),
            canDecide: waiting,
            impactSummary: action.impact?.summary,
            validUntil: waiting ? CoachText.pick(language, "Valid until ", "Voimassa: ") + Dates.shortDateTime(action.expiresAt, language: language, timeZone: timeZone) : nil,
            draftMessage: action.draftMessage,
            warning: action.warning?.isEmpty == false ? action.warning : nil,
            confirmation: action.confirmation?.isEmpty == false ? action.confirmation : nil,
            destination: action.destination == "savings" ? CoachText.pick(language, "To your savings", "Säästöihisi")
                : action.destination == "investments" ? CoachText.pick(language, "To your investments", "Sijoituksiisi") : nil
        )
    }

    /// One row of the "history" drawer: `Approved by you · 14 Nov 2026, 11:26`.
    public static func auditLine(_ event: AuditEvent, language: SisuLanguage = .en, timeZone: TimeZone) -> CardLine {
        let what: String
        switch event.type {
        case "action_prepared": what = CoachText.pick(language, "Prepared", "Valmisteltu")
        case "action_approved": what = CoachText.pick(language, "Approved", "Hyväksytty")
        case "action_executed_simulated": what = CoachText.pick(language, "Carried out as a simulation", "Toteutettu simulaationa")
        case "action_declined": what = CoachText.pick(language, "Declined", "Hylätty")
        case "action_expired": what = CoachText.pick(language, "Expired", "Vanhentunut")
        case "memory_saved": what = CoachText.pick(language, "Remembered", "Tallennettu muistiin")
        case "memory_forgotten": what = CoachText.pick(language, "Forgotten", "Unohdettu")
        case "consent_changed": what = CoachText.pick(language, "Remembering changed", "Muistamisen asetus muutettu")
        case "demo_reset": what = CoachText.pick(language, "Demo reset", "Demo nollattu")
        default: what = event.type
        }
        let who: String
        switch event.actor {
        case "user": who = CoachText.pick(language, "by you", "sinä")
        case "sisu-agent": who = CoachText.pick(language, "by Sisu", "Sisu")
        case "system": who = CoachText.pick(language, "by the system", "järjestelmä")
        default: who = event.actor
        }
        return CardLine(label: what + " " + who, value: Dates.shortDateTime(event.at, language: language, timeZone: timeZone), detail: event.detail)
    }
}

// MARK: - Receipts

/// The line under an answer that says whether its numbers have sources.
public struct GroundingLine: Equatable, Sendable {
    public var text: String
    /// True when at least one number has no source: show it as a warning chip.
    public var isWarning: Bool
}

public enum GroundingPresenter {
    /// `All 6 numbers have a source`, or `2 of 6 numbers have no source yet` as a warning. Nil when the answer
    /// holds no numbers to check.
    public static func line(_ grounding: Grounding, language: SisuLanguage = .en) -> GroundingLine? {
        let missing = max(grounding.unverified.count, grounding.numbers.filter { $0.status == "unverified" }.count)
        if grounding.ok && missing == 0 {
            guard grounding.checked > 0 else { return nil }
            let text = grounding.checked == 1
                ? CoachText.pick(language, "The 1 number has a source", "Luvulla on lähde")
                : CoachText.pick(language, "All \(grounding.checked) numbers have a source", "Kaikilla \(grounding.checked) luvulla on lähde")
            return GroundingLine(text: text, isWarning: false)
        }
        let total = max(grounding.checked, missing)
        let count = max(missing, 1)
        let text = CoachText.pick(language, "\(count) of \(total) numbers \(count == 1 ? "has" : "have") no source yet",
                                  "\(count)/\(total) luvulta puuttuu vielä lähde")
        return GroundingLine(text: text, isWarning: true)
    }
}

// MARK: - Tool trace

/// One row of the trace drawer.
public struct ToolRow: Equatable, Sendable, Identifiable {
    public var id: String
    /// `Search offers` for `search_offers`.
    public var name: String
    /// One line a person can read (the server's).
    public var summary: String
    /// `1.2 s`, or `under 0.1 s`.
    public var duration: String
    /// `Your bank data`, `Web search and offer pages`…
    public var source: String
    public var ok: Bool
}

public enum ToolPresenter {
    /// `1.2 s` for 1,234 ms; `under 0.1 s` below 50 ms. Finnish uses a decimal comma.
    public static func duration(ms: Double, language: SisuLanguage = .en) -> String {
        guard ms.isFinite, ms >= 50 else { return CoachText.pick(language, "under 0.1 s", "alle 0,1 s") }
        let tenths = (ms / 100).rounded(.toNearestOrAwayFromZero)
        guard tenths < 9.0e15 else { return "—" }
        let value = UInt64(tenths)
        return "\(value / 10)\(language == .en ? "." : ",")\(value % 10) s"
    }

    /// `Find patterns` for `find_patterns`.
    public static func name(_ raw: String) -> String {
        let words = raw.replacingOccurrences(of: "_", with: " ").replacingOccurrences(of: "-", with: " ")
        guard let first = words.first else { return raw }
        return first.uppercased() + words.dropFirst()
    }

    public static func row(_ trace: ToolTrace, language: SisuLanguage = .en) -> ToolRow {
        ToolRow(id: trace.id, name: name(trace.name), summary: trace.summary, duration: duration(ms: trace.tookMs, language: language),
                source: CoachText.sourceLabel(trace.source, language: language), ok: trace.ok)
    }

    /// `Answered in 4.8 s` for a finished turn, with `backup model` added when the backup answered.
    public static func timingLine(_ timings: TurnTimings, language: SisuLanguage = .en) -> String {
        let base = CoachText.pick(language, "Answered in ", "Vastattu ajassa ") + duration(ms: timings.totalMs, language: language)
        return timings.usedBackup ? base + " · " + CoachText.pick(language, "backup model", "varamalli") : base
    }
}

// MARK: - Teaching quiz

/// The predict-then-reveal state of one teaching card: show the question and the options, and only after the
/// user has chosen show which one is right and the reveal text.
public struct TeachingQuiz: Equatable, Sendable {
    public let card: TeachingCard
    /// The option the user tapped. Nil until then.
    public private(set) var selectedIndex: Int?

    public init(card: TeachingCard) {
        self.card = card
    }

    /// Records the user's choice. Only the first valid choice counts.
    public mutating func choose(_ index: Int) {
        guard selectedIndex == nil, card.options.indices.contains(index) else { return }
        selectedIndex = index
    }

    public var isRevealed: Bool { selectedIndex != nil }

    /// Nil before the user has chosen.
    public var isCorrect: Bool? { selectedIndex.map { $0 == card.correctIndex } }

    /// The state of one option for the `ChoiceCard` component: all `idle` before the choice; afterwards the
    /// right one is `correct`, a wrong pick is `wrong`, the rest stay `idle`.
    public func state(of index: Int) -> RiveBindings.ChoiceState {
        guard let selectedIndex else { return .idle }
        if index == card.correctIndex { return .correct }
        return index == selectedIndex ? .wrong : .idle
    }

    /// The `ChoiceCard` values of every option, in order.
    public var choices: [[String: RiveValue]] {
        card.options.indices.map { RiveBindings.choiceCard(label: card.options[$0], state: state(of: $0)) }
    }

    /// The card's reveal text, once the user has chosen.
    public var reveal: String? { isRevealed ? card.reveal : nil }

    /// A short line above the reveal. It praises the guess and never shames a miss.
    public func feedback(_ language: SisuLanguage = .en) -> String? {
        guard let isCorrect else { return nil }
        return isCorrect
            ? CoachText.pick(language, "Spot on.", "Juuri niin.")
            : CoachText.pick(language, "Good guess. Here is the real figure.", "Hyvä arvaus. Tässä oikea luku.")
    }
}

// MARK: - Futures chart

public struct FuturesPoint: Equatable, Sendable {
    /// Months from today.
    public var month: Int
    public var total: Double
    public var low: Double
    public var high: Double
}

/// One line of the futures chart.
public struct FuturesSeries: Equatable, Sendable, Identifiable {
    /// `nothing`, `save` or `invest`.
    public var id: String
    public var label: String
    /// A whole curve from a scenario; only the end point from an action's impact.
    public var points: [FuturesPoint]
    /// `€611`: where the line ends.
    public var endLabel: String
    /// `€614 to €639` when the end has a range (invested money); nil otherwise.
    public var rangeLabel: String?
}

public enum FuturesPresenter {
    static func range(low: Double, high: Double, language: SisuLanguage) -> String? {
        let lowText = Money.format(low, language: language), highText = Money.format(high, language: language)
        guard lowText != highText else { return nil }
        return CoachText.pick(language, "\(lowText) to \(highText)", "\(lowText)–\(highText)")
    }

    /// The three futures of `POST /api/scenarios` (or of `ScenarioEngine` offline), one series each.
    public static func series(_ scenario: ScenarioResponse, language: SisuLanguage = .en) -> [FuturesSeries] {
        scenario.branches.map { branch in
            FuturesSeries(id: branch.id.rawValue, label: branch.label,
                          points: branch.points.map { FuturesPoint(month: $0.month, total: $0.total, low: $0.totalLow, high: $0.totalHigh) },
                          endLabel: Money.format(branch.endTotal, language: language),
                          rangeLabel: range(low: branch.endLow, high: branch.endHigh, language: language))
        }
    }

    /// Where the three futures end after an approved action. Each series holds its end point only.
    public static func series(_ impact: ActionImpact, language: SisuLanguage = .en) -> [FuturesSeries] {
        let month = impact.horizonYears.isFinite ? Int((min(max(impact.horizonYears, 0), 100) * 12).rounded()) : 0
        return impact.branches.map { branch in
            FuturesSeries(id: branch.id, label: branch.label,
                          points: [FuturesPoint(month: month, total: branch.endTotal, low: branch.endLow, high: branch.endHigh)],
                          endLabel: Money.format(branch.endTotal, language: language),
                          rangeLabel: range(low: branch.endLow, high: branch.endHigh, language: language))
        }
    }

    /// `About €121 more after 5 years` from the server's `gainVsNothingEur` and `horizonYears`.
    public static func gain(_ impact: ActionImpact, language: SisuLanguage = .en) -> String {
        let amount = Money.format(impact.gainVsNothingEur, language: language)
        let years = CoachText.number(impact.horizonYears, places: 1, language: language)
        return CoachText.pick(language, "About \(amount) more after \(years) \(impact.horizonYears == 1 ? "year" : "years")", "Noin \(amount) enemmän \(years) vuoden jälkeen")
    }
}

// MARK: - Coach cards without the agent

public enum CoachCardPresenter {
    /// `Fits comfortably`, `Possible, but tight` or `Not yet` for an affordability verdict.
    public static func verdict(_ verdict: AffordabilityVerdict, language: SisuLanguage = .en) -> String {
        switch verdict {
        case .comfortable: return CoachText.pick(language, "Fits comfortably", "Mahtuu hyvin")
        case .tight: return CoachText.pick(language, "Possible, but tight", "Onnistuu, mutta tiukasti")
        case .notYet: return CoachText.pick(language, "Not yet", "Ei vielä")
        default: return verdict.rawValue
        }
    }

    /// The working of an affordability answer or a cash-flow forecast, line by line.
    public static func lines(_ steps: [CalcStep], language: SisuLanguage = .en) -> [CardLine] {
        StagePresenter.lines(steps, language: language)
    }

    /// A bill's headline: the confirmed name, or `Looks like <guess>` while the name is still Sisu's guess.
    public static func billName(_ bill: RecurringBill, memory: CustomerMemory?, language: SisuLanguage = .en) -> String {
        if let name = memory?.confirmedBillName(billId: bill.id) { return name }
        return CoachText.pick(language, "Looks like \(bill.guessLabel)", "Näyttää tältä: \(bill.guessLabel)")
    }

    /// The talk button's state for a session status (the names are the same).
    public static func voiceState(_ status: CoachStatus) -> RiveBindings.VoiceState {
        switch status {
        case .idle: return .idle
        case .recording: return .recording
        case .thinking: return .thinking
        case .speaking: return .speaking
        }
    }
}
