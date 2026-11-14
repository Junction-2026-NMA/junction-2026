// The sections of Today below the daily actions. Every figure opens the transactions behind it.
import Charts
import SisuCore
import SwiftUI

// MARK: - Baskets

struct BasketsSection: View {
    @Environment(AppModel.self) private var model
    let overview: Overview

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
            SectionTitle(title: "Where your money goes",
                         detail: "Three baskets, averaged over your last \(overview.windowMonths) months.")
            VStack(spacing: SisuTheme.Spacing.grid * 2) {
                RiveComponentView(.baskets3D, values: RiveValues.baskets(BasketMath.shares(for: overview)))
                    .frame(maxHeight: 200)
                    .frame(maxWidth: .infinity)
                Text(TodayPresenter.basketLegend(overview))
                    .font(SisuTheme.Font.label)
                    .foregroundStyle(SisuTheme.Color.text)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Your spending by basket: \(TodayPresenter.basketLegend(overview))")
            ForEach(overview.baskets, id: \.id) { basket in
                BasketCard(state: TodayPresenter.basket(basket, peerCount: overview.peerCount)) { title, category in
                    model.evidence = EvidenceRequest(
                        title: title,
                        filter: EvidenceFilter(from: overview.windowFrom, to: overview.windowTo,
                                               category: category, basket: category == nil ? basket.id : nil))
                }
            }
        }
    }
}

private struct BasketCard: View {
    let state: BasketCardState
    /// Opens transactions: a title, and a category (nil for the whole basket).
    let open: (String, String?) -> Void

    var body: some View {
        SisuCard {
            RiveComponentView(.basketChip, values: RiveValues.chip(state.kind))
                .riveAccessible("\(state.name) basket")
            Button { open("\(state.name): \(state.subtitle)", nil) } label: {
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
                    Text(state.subtitle)
                        .font(SisuTheme.Font.label)
                        .foregroundStyle(SisuTheme.Color.textMuted)
                    HStack(alignment: .firstTextBaseline) {
                        Text(state.monthly)
                            .font(SisuTheme.Font.h2)
                            .foregroundStyle(SisuTheme.Color.text)
                        Spacer()
                        Text(state.share)
                            .font(SisuTheme.Font.label)
                            .foregroundStyle(SisuTheme.Color.green700)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(state.name), \(state.monthly), \(state.share). Show transactions")

            ForEach(state.categories) { category in
                Divider().overlay(SisuTheme.Color.neutral200)
                Button { open(category.category, category.category) } label: {
                    VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(category.category)
                                .font(SisuTheme.Font.button)
                                .foregroundStyle(SisuTheme.Color.text)
                            Spacer()
                            Text(category.monthly)
                                .font(SisuTheme.Font.button)
                                .foregroundStyle(SisuTheme.Color.text)
                            Image(systemName: "chevron.right")
                                .font(SisuTheme.Font.caption)
                                .foregroundStyle(SisuTheme.Color.green700)
                        }
                        Text(category.reason)
                            .font(SisuTheme.Font.label)
                            .foregroundStyle(SisuTheme.Color.textMuted)
                            .fixedSize(horizontal: false, vertical: true)
                        if let peer = category.peer {
                            Text(peer)
                                .font(SisuTheme.Font.caption)
                                .foregroundStyle(SisuTheme.Color.green700)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityHint("Shows the transactions")
            }
        }
    }
}

// MARK: - Flagged bill

struct BillCard: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let bill: RecurringBill
    /// Called after the name is confirmed or saved, so Today can bring the card back into view.
    var onDone: () -> Void = {}
    @State private var editing = false
    @State private var draft = ""
    @FocusState private var focused: Bool

    var body: some View {
        let state = TodayPresenter.bill(bill, confirmedName: model.confirmedName(for: bill))
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
            SectionTitle(title: "Your biggest bill after rent")
            SisuCard {
                Text(state.headline)
                    .font(SisuTheme.Font.h2)
                    .foregroundStyle(SisuTheme.Color.text)
                Text(state.nameNote)
                    .font(SisuTheme.Font.label)
                    .foregroundStyle(state.isConfirmed ? SisuTheme.Color.green700 : SisuTheme.Color.textMuted)

                Button { openEvidence() } label: {
                    HStack(alignment: .firstTextBaseline, spacing: SisuTheme.Spacing.grid * 2) {
                        Text(state.monthly)
                            .font(SisuTheme.Font.h1)
                            .foregroundStyle(SisuTheme.Color.text)
                        Text(state.monthlyUnit)
                            .font(SisuTheme.Font.body)
                            .foregroundStyle(SisuTheme.Color.textMuted)
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right")
                            .font(SisuTheme.Font.label)
                            .foregroundStyle(SisuTheme.Color.green700)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(state.monthly) \(state.monthlyUnit). Show the payments")

                VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
                    Text(state.range)
                    Text(state.confidence)
                    Text(state.basis).foregroundStyle(SisuTheme.Color.textMuted)
                }
                .font(SisuTheme.Font.label)
                .foregroundStyle(SisuTheme.Color.text)
                .fixedSize(horizontal: false, vertical: true)

                if editing {
                    TextField("What is this bill?", text: $draft)
                        .font(SisuTheme.Font.body)
                        .foregroundStyle(SisuTheme.Color.text)
                        .padding(.horizontal, SisuTheme.Spacing.grid * 4)
                        .frame(height: SisuTheme.Spacing.touchTarget)
                        .background(SisuTheme.Color.green25, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.button, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: SisuTheme.Radius.button, style: .continuous).stroke(SisuTheme.Color.neutral400))
                        .focused($focused)
                        .submitLabel(.done)
                        .onSubmit(save)
                    SisuButton(label: "Save the name", style: .secondary, enabled: !draft.isEmpty, action: save)
                } else if !state.isConfirmed {
                    SisuButton(label: "Yes, that's it", style: .secondary) {
                        model.billConfirmed(bill: bill, name: bill.guessLabel)
                        onDone()
                    }
                    SisuButton(label: "No, change the name", style: .quiet) {
                        draft = bill.guessLabel
                        editing = true
                        focused = true
                    }
                } else {
                    SisuButton(label: "Change the name", style: .quiet) {
                        draft = state.headline
                        editing = true
                        focused = true
                    }
                }
            }
        }
        .animation(SisuMotion.state(reduceMotion: reduceMotion), value: editing)
        .animation(SisuMotion.state(reduceMotion: reduceMotion), value: state.isConfirmed)
    }

    private func save() {
        model.billConfirmed(bill: bill, name: draft)
        editing = false
        focused = false
        onDone()
    }

    private func openEvidence() {
        guard let overview = model.overview else { return }
        model.evidence = EvidenceRequest(title: "\(bill.category) payments",
                                         filter: EvidenceFilter(from: overview.windowFrom, to: overview.windowTo, category: bill.category))
    }
}

// MARK: - Insights

struct InsightsSection: View {
    @Environment(AppModel.self) private var model
    let overview: Overview

    var body: some View {
        if !overview.insights.isEmpty {
            VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
                SectionTitle(title: "What Sisu noticed")
                ForEach(overview.insights, id: \.id) { insight in
                    Button {
                        model.evidence = EvidenceRequest(title: insight.title, filter: insight.evidence)
                    } label: {
                        HStack(alignment: .top, spacing: SisuTheme.Spacing.card) {
                            VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
                                Text(insight.title)
                                    .font(SisuTheme.Font.h3)
                                    .foregroundStyle(SisuTheme.Color.text)
                                Text(insight.body)
                                    .font(SisuTheme.Font.body)
                                    .foregroundStyle(SisuTheme.Color.textMuted)
                            }
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right")
                                .font(SisuTheme.Font.label)
                                .foregroundStyle(SisuTheme.Color.green700)
                                .padding(.top, SisuTheme.Spacing.grid)
                        }
                        .padding(SisuTheme.Spacing.margin)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(PressableCardStyle())
                    .accessibilityElement(children: .combine)
                    .accessibilityHint("Shows the transactions")
                }
            }
        }
    }
}

// MARK: - Cash flow

struct CashflowSection: View {
    let overview: Overview
    @State private var showHow = false

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
            SectionTitle(title: "Money in and out", detail: "Each month, by basket. The line is money in.")
            SisuCard {
                Chart {
                    ForEach(overview.months, id: \.month) { point in
                        BarMark(x: .value("Month", NumberText.monthShort(point.month)), y: .value("Euros", point.regular))
                            .foregroundStyle(by: .value("Basket", "Fixed"))
                        BarMark(x: .value("Month", NumberText.monthShort(point.month)), y: .value("Euros", point.irregular))
                            .foregroundStyle(by: .value("Basket", "Curveballs"))
                        BarMark(x: .value("Month", NumberText.monthShort(point.month)), y: .value("Euros", point.everyday))
                            .foregroundStyle(by: .value("Basket", "Leaks"))
                    }
                    ForEach(overview.months, id: \.month) { point in
                        LineMark(x: .value("Month", NumberText.monthShort(point.month)), y: .value("Money in", point.income))
                            .foregroundStyle(SisuTheme.Color.neutral600)
                            .lineStyle(StrokeStyle(lineWidth: 2, dash: [4, 3]))
                            .interpolationMethod(.monotone)
                    }
                }
                .chartForegroundStyleScale([
                    "Fixed": SisuTheme.Color.basketFixed,
                    "Curveballs": SisuTheme.Color.basketCurveballs,
                    "Leaks": SisuTheme.Color.basketLeaks,
                ])
                .chartLegend(position: .bottom, alignment: .leading)
                .chartYAxis {
                    AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in
                        AxisGridLine().foregroundStyle(SisuTheme.Color.neutral200)
                        AxisValueLabel {
                            if let euros = value.as(Double.self) { Text(JarsPresenter.axisMoney(euros)) }
                        }
                        .font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.textMuted)
                    }
                }
                .chartXAxis {
                    AxisMarks { _ in
                        AxisValueLabel().font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.textMuted)
                    }
                }
                .frame(height: 220)
                .accessibilityLabel("Monthly money in and spending by basket over the last \(overview.windowMonths) months")

                DisclosureGroup(isExpanded: $showHow) {
                    VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
                        ForEach(overview.assumptions, id: \.self) { line in
                            Text(line)
                        }
                        Text(TodayPresenter.dataDate(overview))
                    }
                    .font(SisuTheme.Font.label)
                    .foregroundStyle(SisuTheme.Color.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, SisuTheme.Spacing.grid * 2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                } label: {
                    Text("How Sisu calculated this")
                        .font(SisuTheme.Font.button)
                        .foregroundStyle(SisuTheme.Color.green700)
                }
                .tint(SisuTheme.Color.green700)
            }
        }
    }
}
