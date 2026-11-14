// The cards of one answer from Sisu: the text, the stage cards in arrival order, the offer table, the quiz,
// the approval card, the grounding line and the "How Sisu worked this out" drawer.
// Every figure and sentence comes from the payload or a SisuCore presenter.
import Charts
import SisuCore
import SwiftUI

private let language = SisuLanguage.en

/// Approve / decline with berries and the celebration.
@MainActor
enum AnswerActions {
    static func decide(_ action: AgentAction, approve: Bool, store: CoachStore, model: AppModel) async {
        guard let decided = await store.decide(action.id, approve: approve) else { return }
        model.coachMoment(.actionDecided, id: action.id)
        if approve, decided.status == .executedSimulated {
            let card = ActionPresenter.card(decided, language: language, timeZone: .current)
            model.celebration = (headline: "Approved.", detail: "\(card.monthly) freed. \(card.simulatedTag).")
        }
    }
}

struct AssistantAnswer: View {
    let message: CoachMessage
    @ObservedObject var session: CoachSession
    let store: CoachStore
    let retry: () -> Void

    private var stageKinds: Set<StageKind> { Set(message.stages.map(\.kind)) }
    private var hasExtraction: Bool { stageKinds.contains(.extraction) }

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
            textCard
            if message.pending, let stage = StagePresenter.researchStage(of: message), stage != .done {
                RiveComponentView(.stageIndicator, values: RiveBindings.stageIndicator(stage, language: language))
                    .riveAccessible(RiveBindings.stageLabel(stage, language: language))
                    .id(message.id + "-indicator")
            }
            ForEach(message.stages) { stage in
                StageView(stage: stage, message: message, session: session, store: store)
                    .id(message.id + "-" + stage.kind.rawValue)
            }
            if let research = message.research, !hasExtraction {
                ResearchCard(research: research)
                    .id(message.id + "-offers")
            }
            if let card = message.teaching, !message.stages.contains(where: { $0.teachingValue?.id == card.id }) {
                QuizCard(card: card, store: store)
                    .id(message.id + "-quiz")
            }
            if let action = message.action, !message.stages.contains(where: { $0.actionValue?.id == action.id }) {
                ActionCard(action: action, store: store)
                    .id(message.id + "-action")
            }
            if !message.remembered.isEmpty, !stageKinds.contains(.memory) {
                ForEach(message.remembered) { item in
                    MemoryCard(text: item.value)
                }
            }
            if !message.pending { receipts }
        }
    }

    // MARK: Text

    private var textCard: some View {
        SisuCard {
            if !message.text.isEmpty {
                Text(message.text)
                    .font(SisuTheme.Font.bodyLarge)
                    .foregroundStyle(SisuTheme.Color.text)
                    .fixedSize(horizontal: false, vertical: true)
            } else if message.pending {
                Text(message.filler ?? "Sisu is thinking…")
                    .font(SisuTheme.Font.bodyLarge)
                    .foregroundStyle(SisuTheme.Color.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if message.pending, !message.text.isEmpty, let filler = message.filler, message.runningTool != nil {
                Text(filler)
                    .font(SisuTheme.Font.label)
                    .foregroundStyle(SisuTheme.Color.textMuted)
            }
            if let error = message.error, !error.isEmpty {
                Text(error)
                    .font(SisuTheme.Font.body)
                    .foregroundStyle(SisuTheme.Color.text)
                    .fixedSize(horizontal: false, vertical: true)
                SisuButton(label: "Try again", style: .secondary, action: retry)
            }
        }
        .accessibilityElement(children: .contain)
    }

    // MARK: Receipts

    @ViewBuilder
    private var receipts: some View {
        let grounding = message.grounding.flatMap { GroundingPresenter.line($0, language: language) }
        let hasTrace = !message.tools.isEmpty || !message.citations.isEmpty
        if grounding != nil || hasTrace {
            VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
                if let grounding {
                    Text(grounding.text)
                        .font(SisuTheme.Font.label)
                        .foregroundStyle(grounding.isWarning ? SisuTheme.Color.amberText : SisuTheme.Color.text)
                        .padding(.horizontal, SisuTheme.Spacing.grid * 3)
                        .padding(.vertical, SisuTheme.Spacing.grid * 1.5)
                        .background(grounding.isWarning ? SisuTheme.Color.amberBackground : SisuTheme.Color.green100, in: Capsule())
                }
                if hasTrace { TraceDrawer(message: message) }
            }
        }
    }
}

// MARK: - Stage cards

private struct StageView: View {
    let stage: Stage
    let message: CoachMessage
    @ObservedObject var session: CoachSession
    let store: CoachStore
    @Environment(AppModel.self) private var model

    var body: some View {
        switch stage.data {
        case .teaching(let card):
            QuizCard(card: card, store: store)
        case .action(let action):
            ActionCard(action: session.actions.first { $0.id == action.id } ?? action, store: store)
        default:
            let card = StagePresenter.card(stage, language: language, timeZone: .current)
            SisuCard {
                StageHeader(eyebrow: eyebrow, card: card, showSummary: stage.kind != .memory)
                content(card)
            }
        }
    }

    private var eyebrow: String {
        switch stage.data {
        case .lead: return CoachText.sourceLabel(stage.source, language: language)
        case .evidence: return "From your transactions"
        case .research(let research): return "Searched with " + CoachProviderName.display(research.searchedWith ?? "exa")
        case .extraction(let extraction): return "Read with " + CoachProviderName.display(extraction.extractedWith ?? "context.dev")
        case .calculation: return "The working"
        case .impact: return "Your futures"
        case .memory: return "Memory"
        default: return CoachText.sourceLabel(stage.source, language: language)
        }
    }

    @ViewBuilder
    private func content(_ card: StageCard) -> some View {
        switch stage.data {
        case .evidence(let evidence):
            if let first = card.lines.first {
                HStack(alignment: .firstTextBaseline) {
                    Text(first.value ?? "").font(SisuTheme.Font.h2).foregroundStyle(SisuTheme.Color.text)
                    Text(first.label).font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.textMuted)
                }
            }
            LinesView(lines: Array(card.lines.dropFirst()))
            SisuButton(label: "Show transactions", style: .secondary) {
                model.evidence = EvidenceRequest(title: stage.title, filter: evidence.filter)
            }
        case .research(let research):
            VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
                ForEach(research.pages, id: \.url) { page in
                    SourceLink(title: page.title, url: page.url)
                }
            }
            if let footnote = card.footnote { Footnote(text: footnote) }
        case .extraction(let extraction):
            OfferTable(rows: extraction.offers.map { OfferPresenter.row($0, isBest: message.research?.best == $0, language: language) })
            Footnote(text: "Pages read: \(extraction.pagesRead) of \(extraction.pagesTotal)")
            if !extraction.problems.isEmpty {
                Note(text: "Some pages could not be read, so a few offers may be missing.", lines: extraction.problems)
            }
            if let research = message.research {
                ResearchFooter(research: research)
            }
        case .calculation(let calculation):
            LinesView(lines: card.lines)
            Divider().overlay(SisuTheme.Color.neutral200)
            HStack(alignment: .firstTextBaseline) {
                Text(calculation.resultLabel).font(SisuTheme.Font.h3).foregroundStyle(SisuTheme.Color.text)
                Spacer(minLength: SisuTheme.Spacing.grid * 2)
                Text(CoachText.value(calculation.resultValue, unit: calculation.unit, language: language))
                    .font(SisuTheme.Font.h3).foregroundStyle(SisuTheme.Color.text)
            }
            Assumptions(items: calculation.assumptions)
        case .impact(let impact):
            ImpactChart(series: FuturesPresenter.series(impact, language: language))
            Text(impact.summary).font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
                .fixedSize(horizontal: false, vertical: true)
        case .memory(let item):
            MemoryLine(text: card.summary.isEmpty ? item.value : card.summary)
        default:
            LinesView(lines: card.lines)
        }
        if card.isMock {
            RiveComponentView(.tag, values: RiveBindings.tag(text: CoachText.mockDataTag(language), tone: .amber))
                .riveAccessible("Mock data. These pages are example data.")
        }
    }
}

private struct StageHeader: View {
    let eyebrow: String
    let card: StageCard
    var showSummary = true

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
            Eyebrow(text: eyebrow)
            if !card.title.isEmpty, card.title != eyebrow {
                Text(card.title).font(SisuTheme.Font.h3).foregroundStyle(SisuTheme.Color.text)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if showSummary, !card.summary.isEmpty, !card.lines.contains(where: { $0.label == card.summary }), card.summary != card.title {
                Text(card.summary).font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Label on the left, value on the right, detail under the label.
private struct LinesView: View {
    let lines: [CardLine]

    var body: some View {
        if !lines.isEmpty {
            VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 3) {
                ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                    HStack(alignment: .firstTextBaseline, spacing: SisuTheme.Spacing.grid * 3) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(line.label).font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
                                .fixedSize(horizontal: false, vertical: true)
                            if let detail = line.detail, !detail.isEmpty {
                                Text(detail).font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.textMuted)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        Spacer(minLength: 0)
                        if let value = line.value {
                            Text(value).font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.text)
                                .multilineTextAlignment(.trailing)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }
}

private struct Footnote: View {
    let text: String
    var body: some View {
        Text(text).font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.textMuted)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// A heads-up note (amber), with optional detail lines.
private struct Note: View {
    let text: String
    var lines: [String] = []

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
            Text(text).font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.amberText)
            ForEach(lines, id: \.self) { line in
                Text(line).font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.amberText)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(SisuTheme.Spacing.grid * 3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SisuTheme.Color.amberBackground, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.button, style: .continuous))
    }
}

private struct Assumptions: View {
    let items: [String]
    var body: some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
                Text("Assumptions").font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.text)
                ForEach(items, id: \.self) { item in
                    Text("· " + item).font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }
}

private struct SourceLink: View {
    let title: String
    let url: String

    var body: some View {
        if let link = URL(string: url) {
            Link(destination: link) { label }
        } else {
            label
        }
    }

    private var label: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.primary)
                .fixedSize(horizontal: false, vertical: true)
            Text(url).font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.textMuted).lineLimit(1).truncationMode(.middle)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Offers

private struct OfferTable: View {
    let rows: [OfferRow]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                if index > 0 { Divider().overlay(SisuTheme.Color.neutral200) }
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
                    HStack(alignment: .firstTextBaseline, spacing: SisuTheme.Spacing.grid * 2) {
                        Text(row.provider).font(SisuTheme.Font.button).foregroundStyle(SisuTheme.Color.text)
                        Spacer(minLength: 0)
                        Text(row.saving)
                            .font(row.isBest ? SisuTheme.Font.button : SisuTheme.Font.label)
                            .foregroundStyle(row.comparable ? SisuTheme.Color.text : SisuTheme.Color.textMuted)
                            .multilineTextAlignment(.trailing)
                    }
                    Text(row.plan + " · " + row.price)
                        .font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                    if row.isBest {
                        RiveComponentView(.tag, values: RiveBindings.tag(text: "Best offer", tone: .neutral))
                            .riveAccessible("Best offer")
                    }
                }
                .padding(.vertical, SisuTheme.Spacing.grid * 3)
                .accessibilityElement(children: .combine)
            }
        }
    }
}

/// Offer research from a typed question (no extraction stage): the headline, the table and its notes.
private struct ResearchCard: View {
    let research: ResearchResult

    var body: some View {
        SisuCard {
            Eyebrow(text: "Offers Sisu found")
            Text(OfferPresenter.headline(research, language: language))
                .font(SisuTheme.Font.h3).foregroundStyle(SisuTheme.Color.text)
                .fixedSize(horizontal: false, vertical: true)
            if let baseline = OfferPresenter.baseline(research, language: language) {
                Text(baseline).font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.textMuted)
            }
            OfferTable(rows: OfferPresenter.rows(research, language: language))
            ResearchFooter(research: research)
            if research.mock {
                RiveComponentView(.tag, values: RiveBindings.tag(text: CoachText.mockDataTag(language), tone: .amber))
                    .riveAccessible("Mock data. These offers are example data.")
            }
        }
    }
}

/// Assumptions, partial failure and the fetched time, under any offer table.
private struct ResearchFooter: View {
    let research: ResearchResult

    var body: some View {
        if research.best == nil {
            Text(OfferPresenter.headline(research, language: language) + ". Your current deal holds up.")
                .font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
        }
        if research.status == .partial || research.status == .failed || !research.errors.isEmpty {
            Note(text: "Some offer pages could not be read. These are the offers Sisu could check.", lines: research.errors)
        }
        Assumptions(items: research.assumptions)
        Footnote(text: OfferPresenter.fetchedNote(research, language: language, timeZone: .current))
    }
}

// MARK: - Quiz

private struct QuizCard: View {
    let card: TeachingCard
    let store: CoachStore
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let quiz = store.quiz(for: card)
        SisuCard {
            HStack(alignment: .firstTextBaseline) {
                Eyebrow(text: "Guess first")
                Spacer()
                if !quiz.isRevealed {
                    Text(CoachRewards.rewardText(.quizAnswered) + " berries").font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.textMuted)
                }
            }
            Text(card.question).font(SisuTheme.Font.h3).foregroundStyle(SisuTheme.Color.text)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            ForEach(Array(quiz.choices.enumerated()), id: \.offset) { index, values in
                RiveComponentView(.choiceCard, values: values) { trigger in
                    if trigger == "pressed" { choose(index) }
                }
                .riveAccessible(card.options[index], isButton: !quiz.isRevealed, value: quiz.isRevealed ? quiz.state(of: index).rawValue : nil) {
                    choose(index)
                }
                .allowsHitTesting(!quiz.isRevealed)
            }
            if let reveal = quiz.reveal {
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
                    if let feedback = quiz.feedback(language) {
                        Text(feedback).font(SisuTheme.Font.button).foregroundStyle(SisuTheme.Color.text)
                    }
                    Text(reveal).font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(SisuTheme.Spacing.grid * 3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(SisuTheme.Color.green100, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.button, style: .continuous))
                .transition(reduceMotion ? .opacity : .opacity.combined(with: .scale(scale: 0.96, anchor: .top)))
            }
        }
        .animation(SisuMotion.state(reduceMotion: reduceMotion), value: quiz.isRevealed)
    }

    private func choose(_ index: Int) {
        if store.choose(index, on: card) { model.coachMoment(.quizAnswered, id: card.id) }
    }
}

// MARK: - Action

private struct ActionCard: View {
    let action: AgentAction
    let store: CoachStore
    @Environment(AppModel.self) private var model

    var body: some View {
        let card = ActionPresenter.card(action, language: language, timeZone: .current)
        let busy = store.deciding.contains(action.id)
        SisuCard {
            RiveComponentView(.tag, values: RiveBindings.tag(text: card.simulatedTag, tone: .amber))
                .riveAccessible(card.simulatedTag)
            Text(card.title).font(SisuTheme.Font.h2).foregroundStyle(SisuTheme.Color.text)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(card.summary).font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
                .fixedSize(horizontal: false, vertical: true)
            HStack(alignment: .firstTextBaseline) {
                Text(card.monthly).font(SisuTheme.Font.h3).foregroundStyle(SisuTheme.Color.text)
                Text("freed").font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.textMuted)
            }
            Assumptions(items: card.assumptions)
            if !action.sources.isEmpty {
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
                    Text("Sources").font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.text)
                    ForEach(action.sources, id: \.url) { source in
                        SourceLink(title: source.title, url: source.url)
                        Footnote(text: CoachText.fetched(source.retrievedAt, language: language, timeZone: .current))
                    }
                }
            }
            if !card.checklist.isEmpty {
                // The Rive row holds one short line, so it names the list; the steps themselves are text that wraps.
                RiveComponentView(.actionRow, values: RiveBindings.actionRow(title: "What a real switch takes", reward: "\(card.checklist.count) steps", done: false))
                    .riveAccessible("What a real switch takes, \(card.checklist.count) steps")
                    .allowsHitTesting(false)
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
                    ForEach(Array(card.checklist.enumerated()), id: \.offset) { index, step in
                        HStack(alignment: .firstTextBaseline, spacing: SisuTheme.Spacing.grid * 2) {
                            Text("\(index + 1).").font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.primary)
                            Text(step).font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                .padding(.horizontal, SisuTheme.Spacing.grid * 2)
            }
            Text(card.statusSentence).font(SisuTheme.Font.button).foregroundStyle(SisuTheme.Color.text)
                .fixedSize(horizontal: false, vertical: true)
            if let notice = store.decisionNotices[action.id] {
                Note(text: notice)
            }
            if let validUntil = card.validUntil { Footnote(text: validUntil) }
            if card.canDecide {
                SisuButton(label: "Approve", style: .primary, enabled: !busy, loading: busy) { decide(approve: true) }
                SisuButton(label: "Decline", style: .secondary, enabled: !busy) { decide(approve: false) }
            }
            if let impact = action.impact {
                ImpactChart(series: FuturesPresenter.series(impact, language: language))
                Text(card.impactSummary ?? impact.summary).font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func decide(approve: Bool) {
        Task { await AnswerActions.decide(action, approve: approve, store: store, model: model) }
    }
}

// MARK: - Futures

/// Where the three futures end: one bar each, labelled by the presenter.
private struct ImpactChart: View {
    let series: [FuturesSeries]

    var body: some View {
        if !series.isEmpty {
            Chart(series) { line in
                if let end = line.points.last {
                    BarMark(x: .value("Future", line.label), y: .value("Total", end.total))
                        .foregroundStyle(color(line.id))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .annotation(position: .top) {
                            Text(line.endLabel).font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.text)
                        }
                }
            }
            .chartYAxis(.hidden)
            .chartXAxis(.hidden)
            .frame(height: 140)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(series.map { "\($0.label): \($0.endLabel)" }.joined(separator: ", "))
            VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
                ForEach(series) { line in
                    HStack(alignment: .firstTextBaseline, spacing: SisuTheme.Spacing.grid * 2) {
                        Circle().fill(color(line.id)).frame(width: 10, height: 10)
                        Text(line.label).font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: SisuTheme.Spacing.grid * 2)
                        Text(line.rangeLabel ?? line.endLabel).font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.text)
                    }
                }
            }
            .accessibilityHidden(true)
        }
    }

    private func color(_ id: String) -> Color {
        switch id {
        case "nothing": return SisuTheme.Color.green300
        case "save": return SisuTheme.Color.green500
        default: return SisuTheme.Color.green700
        }
    }
}

// MARK: - Memory

private struct MemoryLine: View {
    let text: String
    var body: some View {
        Text("Sisu will remember: \(text)")
            .font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
            .fixedSize(horizontal: false, vertical: true)
    }
}

private struct MemoryCard: View {
    let text: String
    var body: some View {
        SisuCard {
            Eyebrow(text: "Memory")
            MemoryLine(text: text)
        }
    }
}

// MARK: - Trace

private struct TraceDrawer: View {
    let message: CoachMessage
    @State private var open = false

    var body: some View {
        DisclosureGroup(isExpanded: $open) {
            VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 3) {
                ForEach(message.tools, id: \.id) { trace in
                    let row = ToolPresenter.row(trace, language: language)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(row.name).font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.text)
                            Spacer()
                            Text(row.duration).font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.textMuted)
                        }
                        Text(row.summary).font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.text)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(row.source + (row.ok ? "" : " · did not finish"))
                            .font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.textMuted)
                    }
                    .accessibilityElement(children: .combine)
                }
                if !message.citations.isEmpty {
                    Text("Sources").font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.text)
                    ForEach(message.citations, id: \.url) { citation in
                        SourceLink(title: citation.title, url: citation.url)
                        Footnote(text: CoachText.fetched(citation.retrievedAt, language: language, timeZone: .current))
                    }
                }
                if let timings = message.timings {
                    Footnote(text: ToolPresenter.timingLine(timings, language: language))
                }
            }
            .padding(.top, SisuTheme.Spacing.grid * 2)
        } label: {
            Text("How Sisu worked this out").font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.primary)
        }
        .tint(SisuTheme.Color.primary)
        .padding(SisuTheme.Spacing.card)
        .background(SisuTheme.Color.green25, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous))
    }
}
