// Today: a fixed header, then the safe-to-spend hero, today's three small actions, the baskets, the flagged
// bill, what Sisu noticed, the cash-flow chart, how it was calculated, and one primary button.
import SisuCore
import SwiftUI

struct TodayScreen: View {
    @Environment(AppModel.self) private var model
    @State private var didApplyLaunch = false

    var body: some View {
        @Bindable var model = model
        VStack(spacing: 0) {
            TodayHeader()
            switch model.overviewState {
            case .failed(let message):
                ErrorState(message: message) { Task { await model.retry() } }
            case .loaded:
                if let overview = model.overview { content(overview) }
            default:
                LoadingState()
            }
        }
        .sheet(item: $model.todaySheet) { sheet in
            switch sheet {
            case .maths: if let overview = model.overview { MathsSheet(overview: overview) }
            case .settings: SettingsSheet()
            }
        }
    }

    private func content(_ overview: Overview) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
                    HeroBlock(overview: overview)
                    DailyActionsCard { proxy.scrollTo("bill", anchor: .top) }
                        .padding(.bottom, SisuTheme.Spacing.section - SisuTheme.Spacing.card)

                    BasketsSection(overview: overview)
                        .id("baskets")
                        .padding(.bottom, SisuTheme.Spacing.section - SisuTheme.Spacing.card)

                    if let bill = model.flaggedBill {
                        BillCard(bill: bill) {
                            Task {
                                try? await Task.sleep(for: .milliseconds(350))
                                withAnimation { proxy.scrollTo("bill", anchor: .top) }
                            }
                        }
                            .id("bill")
                            .padding(.bottom, SisuTheme.Spacing.section - SisuTheme.Spacing.card)
                    }

                    InsightsSection(overview: overview)
                        .id("insights")
                        .padding(.bottom, SisuTheme.Spacing.section - SisuTheme.Spacing.card)

                    CashflowSection(overview: overview)
                        .id("cashflow")

                    SisuButton(label: "Look into my finances") { model.startInvestigation() }
                        .padding(.top, SisuTheme.Spacing.card)
                        .id("end")
                }
                .padding(.horizontal, SisuTheme.Spacing.margin)
                .padding(.top, SisuTheme.Spacing.grid * 2)
                .padding(.bottom, SisuTheme.Spacing.section)
            }
            .scrollIndicators(.hidden)
            .task { await applyLaunch(proxy) }
        }
    }

    /// The screenshot harness's launch arguments: scroll to a section or open a sheet.
    private func applyLaunch(_ proxy: ScrollViewProxy) async {
        guard !didApplyLaunch else { return }
        didApplyLaunch = true
        try? await Task.sleep(for: .milliseconds(400))
        if let target = model.launch.scroll {
            proxy.scrollTo(target, anchor: target == "end" ? .bottom : .top)
        }
        switch model.launch.sheet {
        case "maths": model.todaySheet = .maths
        case "settings": model.todaySheet = .settings
        case "transactions":
            if let overview = model.overview, let basket = overview.baskets.first {
                model.evidence = EvidenceRequest(
                    title: "\(basket.id.kind.label(.en)): \(basket.label)",
                    filter: EvidenceFilter(from: overview.windowFrom, to: overview.windowTo, basket: basket.id))
            }
        default: break
        }
    }
}

// MARK: - Header

private struct TodayHeader: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
            HStack(alignment: .center, spacing: SisuTheme.Spacing.grid * 2) {
                Text(TodayPresenter.greeting(name: model.customer?.displayName ?? ""))
                    .font(SisuTheme.Font.h1)
                    .foregroundStyle(SisuTheme.Color.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                RiveComponentView(.statPill, values: RiveValues.statPill("streak", value: model.progress.streakText))
                    .sizing(.contain).frame(width: 72, height: 36)
                    .riveAccessible("Streak", value: "\(model.progress.streakText) days")
                RiveComponentView(.statPill, values: RiveValues.statPill("berries", value: model.berriesText))
                    .sizing(.contain).frame(width: 72, height: 36)
                    .riveAccessible("Berries", value: model.berriesText)
                Button { model.todaySheet = .settings } label: {
                    Image(systemName: "gearshape")
                        .font(SisuTheme.Font.h3)
                        .foregroundStyle(SisuTheme.Color.green700)
                        .frame(width: SisuTheme.Spacing.touchTarget - 8, height: SisuTheme.Spacing.touchTarget - 8)
                        .background(SisuTheme.Color.card, in: Circle())
                }
                .accessibilityLabel("Settings")
            }
            if let overview = model.overview {
                HStack(spacing: SisuTheme.Spacing.grid * 2) {
                    if !model.isLive { SampleDataTag() }
                    Text(TodayPresenter.dataDate(overview))
                        .font(SisuTheme.Font.caption)
                        .foregroundStyle(SisuTheme.Color.textMuted)
                }
            }
        }
        .padding(.horizontal, SisuTheme.Spacing.margin)
        .padding(.top, SisuTheme.Spacing.grid * 2)
        .padding(.bottom, SisuTheme.Spacing.grid * 3)
        .background(SisuTheme.Color.background)
    }
}

// MARK: - Hero

private struct HeroBlock: View {
    @Environment(AppModel.self) private var model
    let overview: Overview

    var body: some View {
        // The Rive hero wraps its context line to two lines, so it gets the full sentence.
        let full = XrayPresenter.hero(for: overview, language: .en)
        let hero = full
        return VStack(spacing: SisuTheme.Spacing.grid) {
            RiveComponentView(.heroNumber, values: RiveValues.hero(hero))
                .onTapGesture { openEveryday() }
                .riveAccessible("\(full.eyebrow) \(full.amount) \(full.unit). \(full.context)", isButton: true, action: openEveryday)
                .accessibilityHint("Shows your everyday payments")
            SisuButton(label: "Show the maths", style: .quiet) { model.todaySheet = .maths }
        }
    }

    private func openEveryday() {
        guard let basket = overview.baskets.first(where: { $0.id == .everyday }) else { return }
        model.evidence = EvidenceRequest(title: "\(basket.id.kind.label(.en)): \(basket.label)",
                                         filter: EvidenceFilter(from: overview.windowFrom, to: overview.windowTo, basket: .everyday))
    }
}

// MARK: - Daily actions

private struct DailyActionsCard: View {
    @Environment(AppModel.self) private var model
    let showBill: () -> Void

    var body: some View {
        SisuCard {
            HStack {
                Text("Today's small steps")
                    .font(SisuTheme.Font.h3)
                    .foregroundStyle(SisuTheme.Color.text)
                Spacer()
                Text(JarsPresenter.berriesCaption(model.berries))
                    .font(SisuTheme.Font.label)
                    .foregroundStyle(SisuTheme.Color.green700)
            }
            RiveComponentView(.progressBar, values: RiveValues.progress(model.todayProgress))
                .riveAccessible("Today's steps", value: NumberText.percent(model.todayProgress))
            VStack(spacing: SisuTheme.Spacing.grid * 2) {
                ForEach(DailyAction.allCases, id: \.self) { action in
                    let done = model.isDone(action)
                    RiveComponentView(.actionRow, values: RiveValues.actionRow(title: action.title, reward: action.rewardText, done: done)) { trigger in
                        if trigger == "pressed" { run(action) }
                    }
                    .riveAccessible(action.title, isButton: !done, value: done ? "Done" : "\(action.rewardText) berries") { run(action) }
                }
            }
        }
    }

    private func run(_ action: DailyAction) {
        switch action {
        case .checkIn: break
        case .confirmBill: showBill()
        case .investigate: model.startInvestigation()
        }
    }
}

// MARK: - States

struct LoadingState: View {
    var body: some View {
        VStack(spacing: SisuTheme.Spacing.card) {
            Spacer()
            ProgressView().tint(SisuTheme.Color.green700)
            Text("Reading your last 12 months")
                .font(SisuTheme.Font.body)
                .foregroundStyle(SisuTheme.Color.textMuted)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

struct ErrorState: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: SisuTheme.Spacing.card) {
            Spacer()
            Text(message)
                .font(SisuTheme.Font.bodyLarge)
                .foregroundStyle(SisuTheme.Color.text)
                .multilineTextAlignment(.center)
            SisuButton(label: "Try again", style: .secondary, action: retry)
            Spacer()
        }
        .padding(.horizontal, SisuTheme.Spacing.margin)
    }
}
