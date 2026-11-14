// Jars: a shelf with the buffer jar, the "Freed by switches" jar and the berries, then the futures simulator:
// one predict-before-reveal question that must be answered before the three futures are shown.
import Charts
import SisuCore
import SwiftUI

struct JarsScreen: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: SisuTheme.Spacing.grid * 2) {
                Text("Jars")
                    .font(SisuTheme.Font.h1)
                    .foregroundStyle(SisuTheme.Color.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
            }
            .padding(.horizontal, SisuTheme.Spacing.margin)
            .padding(.vertical, SisuTheme.Spacing.grid * 2)

            if let overview = model.overview {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
                            Shelf(overview: overview)
                                .padding(.bottom, SisuTheme.Spacing.section - SisuTheme.Spacing.card)
                            FuturesSection(overview: overview)
                        }
                        .padding(.horizontal, SisuTheme.Spacing.margin)
                        .padding(.bottom, SisuTheme.Spacing.section)
                    }
                    .scrollIndicators(.hidden)
                    .task {
                        guard let target = model.launch.scroll else { return }
                        try? await Task.sleep(for: .milliseconds(1200))
                        proxy.scrollTo(target, anchor: .top)
                    }
                }
            } else {
                LoadingState()
            }
        }
    }
}

// MARK: - Shelf

private struct Shelf: View {
    @Environment(AppModel.self) private var model
    let overview: Overview

    var body: some View {
        let bufferFill = JarsPresenter.bufferFill(runwayMonths: overview.runwayMonths)
        let billMonthly = model.flaggedBill?.monthlyAvg ?? 0
        let freedFill = JarsPresenter.freedFill(approvedMonthlySaving: model.approvedMonthlySaving, billMonthly: billMonthly)
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
            HStack(alignment: .top, spacing: SisuTheme.Spacing.card) {
                JarTile(title: "Buffer",
                        figure: JarsPresenter.bufferFigure(runwayMonths: overview.runwayMonths),
                        detail: JarsPresenter.bufferDetail,
                        values: RiveValues.jar(fill: bufferFill, label: "Buffer"),
                        accessibility: "Buffer jar, \(NumberText.percent(bufferFill)) full")
                JarTile(title: "Switches",
                        figure: JarsPresenter.freedFigure(approvedMonthlySaving: model.approvedMonthlySaving),
                        detail: JarsPresenter.freedDetail(approvedMonthlySaving: model.approvedMonthlySaving),
                        values: RiveValues.jar(fill: freedFill, label: "Switches"),
                        triggers: ["celebrate#\(model.approvedMonthlySaving)"],
                        accessibility: "Freed by switches jar, \(NumberText.percent(freedFill)) full")
            }
            SisuCard {
                HStack(spacing: SisuTheme.Spacing.card) {
                    RiveComponentView(.berries, values: RiveValues.berries(count: model.berries),
                                      triggers: ["drop#\(model.berryDrops)"])
                        .frame(width: 128, height: 80)
                        .riveAccessible("Berries", value: model.berriesText)
                    VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
                        Text(JarsPresenter.berriesCaption(model.berries))
                            .font(SisuTheme.Font.h3)
                            .foregroundStyle(SisuTheme.Color.text)
                        Text("Earned by showing up, never taken away.")
                            .font(SisuTheme.Font.label)
                            .foregroundStyle(SisuTheme.Color.textMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }
}

private struct JarTile: View {
    let title: String
    let figure: String
    let detail: String
    let values: [String: RiveValue]
    /// Fires `celebrate` whenever the stamp changes (for the switches jar: when the approved saving changes).
    var triggers: [String] = []
    let accessibility: String

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
            RiveComponentView(.jar, values: values, triggers: triggers)
                .frame(height: 150)
                .frame(maxWidth: .infinity)
                .padding(.bottom, SisuTheme.Spacing.grid * 3)
                .riveAccessible(accessibility)
            Text(figure)
                .font(SisuTheme.Font.h2)
                .foregroundStyle(SisuTheme.Color.text)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(detail)
                .font(SisuTheme.Font.label)
                .foregroundStyle(SisuTheme.Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(SisuTheme.Spacing.card)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .sisuCardSurface()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title): \(figure) \(detail)")
    }
}

// MARK: - Futures

private struct FuturesSection: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let overview: Overview

    @State private var guess: BranchId?
    @State private var billSaving: Double = 15
    @State private var trim: Double = 10
    @State private var years: Double = 5
    @State private var response: ScenarioResponse?
    @State private var failed = false

    private var input: ScenarioInput {
        ScenarioInput(billSavingPerMonth: billSaving.rounded(), everydayCutPct: trim.rounded(), years: Int(years.rounded()))
    }

    var body: some View {
        let branches = response?.branches ?? []
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
            SectionTitle(title: "Three futures", detail: "Predict first, then see what the numbers say.")
            SisuCard {
                Text(FuturesQuiz.question)
                    .font(SisuTheme.Font.h3)
                    .foregroundStyle(SisuTheme.Color.text)
                    .fixedSize(horizontal: false, vertical: true)
                ForEach(FuturesQuiz.choices, id: \.id) { choice in
                    RiveComponentView(.choiceCard, values: RiveValues.choice(choice.label, state: FuturesQuiz.state(of: choice.id, guess: guess, branches: branches))) { trigger in
                        if trigger == "pressed", guess == nil { guess = choice.id }
                    }
                    .riveAccessible(choice.label, isButton: guess == nil) { if guess == nil { guess = choice.id } }
                }
                if let guess {
                    Text(FuturesQuiz.explanation(guess: guess, branches: branches))
                        .font(SisuTheme.Font.body)
                        .foregroundStyle(SisuTheme.Color.text)
                        .fixedSize(horizontal: false, vertical: true)
                        .transition(.opacity)
                }
            }
            .id("question")

            if guess != nil {
                reveal(branches)
                    .id("futures")
                    .transition(SisuMotion.entrance(reduceMotion: reduceMotion))
            }
        }
        .animation(SisuMotion.state(reduceMotion: reduceMotion), value: guess)
        .task(id: input) { await load() }
        .onAppear { if guess == nil, let answer = model.launch.answer { guess = answer } }
    }

    @ViewBuilder private func reveal(_ branches: [Branch]) -> some View {
        SisuCard {
            if let response {
                Text(JarsPresenter.freedPerMonth(response))
                    .font(SisuTheme.Font.label)
                    .foregroundStyle(SisuTheme.Color.green700)
                FuturesChart(branches: branches)
                    .frame(height: 220)
                ForEach(branches, id: \.id) { branch in
                    HStack(alignment: .firstTextBaseline) {
                        Circle().fill(color(branch.id)).frame(width: 10, height: 10)
                        Text(branch.label)
                            .font(SisuTheme.Font.label)
                            .foregroundStyle(SisuTheme.Color.text)
                        Spacer()
                        VStack(alignment: .trailing, spacing: 0) {
                            Text(JarsPresenter.endTotal(branch))
                                .font(SisuTheme.Font.button)
                                .foregroundStyle(SisuTheme.Color.text)
                            if branch.id == .invest {
                                Text(JarsPresenter.endRange(branch))
                                    .font(SisuTheme.Font.caption)
                                    .foregroundStyle(SisuTheme.Color.textMuted)
                            }
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
            } else if failed {
                Text("The futures could not be worked out.")
                    .font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
                SisuButton(label: "Try again", style: .secondary) { Task { await load() } }
            } else {
                ProgressView().tint(SisuTheme.Color.green700).frame(maxWidth: .infinity, minHeight: 220)
            }
        }
        SisuCard {
            SliderRow(title: "Saving from switching a bill", value: $billSaving, range: 0...100, step: 1,
                      text: JarsPresenter.billSavingText(billSaving.rounded()))
            SliderRow(title: "Trim everyday spending by", value: $trim, range: 0...50, step: 1,
                      text: JarsPresenter.trimText(trim))
            SliderRow(title: "Look ahead", value: $years, range: 1...10, step: 1,
                      text: JarsPresenter.yearsText(Int(years.rounded())))
        }
        if let response, !response.assumptions.isEmpty {
            VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
                ForEach(response.assumptions, id: \.self) { line in Text(line) }
            }
            .font(SisuTheme.Font.caption)
            .foregroundStyle(SisuTheme.Color.textMuted)
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func color(_ id: BranchId) -> Color {
        switch id {
        case .nothing: return SisuTheme.Color.neutral400
        case .save: return SisuTheme.Color.green900
        case .invest: return SisuTheme.Color.green500
        }
    }

    private func load() async {
        // Wait for the sliders to settle before asking.
        try? await Task.sleep(for: .milliseconds(250))
        guard !Task.isCancelled else { return }
        do {
            response = try await model.scenario(input)
            failed = false
        } catch {
            if !Task.isCancelled { failed = true }
        }
    }
}

private struct SliderRow: View {
    let title: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
            HStack {
                Text(title).font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.text)
                Spacer()
                Text(text).font(SisuTheme.Font.button).foregroundStyle(SisuTheme.Color.text)
            }
            SisuSlider(value: $value, range: range, step: step)
                .accessibilityLabel(title)
                .accessibilityValue(text)
        }
    }
}

private struct FuturesChart: View {
    let branches: [Branch]

    var body: some View {
        Chart {
            if let invest = branches.first(where: { $0.id == .invest }) {
                ForEach(invest.points, id: \.month) { point in
                    AreaMark(x: .value("Month", point.month),
                             yStart: .value("Low", point.totalLow),
                             yEnd: .value("High", point.totalHigh))
                        .foregroundStyle(SisuTheme.Color.green100)
                }
            }
            ForEach(branches, id: \.id) { branch in
                ForEach(branch.points, id: \.month) { point in
                    LineMark(x: .value("Month", point.month), y: .value("Total", point.total), series: .value("Future", branch.label))
                        .foregroundStyle(by: .value("Future", branch.label))
                        .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round))
                }
            }
        }
        .chartForegroundStyleScale(domain: branches.map(\.label), range: branches.map { color($0.id) })
        .chartLegend(.hidden)
        .chartXScale(domain: 0...JarsPresenter.futuresLastMonth(branches), range: .plotDimension(startPadding: 16, endPadding: 24))
        .chartYScale(domain: 0...JarsPresenter.futuresTop(branches))
        .chartXAxis {
            AxisMarks(values: JarsPresenter.futuresTicks(branches)) { value in
                AxisGridLine().foregroundStyle(SisuTheme.Color.neutral200)
                AxisValueLabel(anchor: .top) {
                    if let month = value.as(Int.self) { Text(JarsPresenter.axisLabel(month: month)) }
                }
                .font(SisuTheme.Font.caption)
                .foregroundStyle(SisuTheme.Color.textMuted)
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in
                AxisGridLine().foregroundStyle(SisuTheme.Color.neutral200)
                AxisValueLabel {
                    if let euros = value.as(Double.self) { Text(JarsPresenter.axisMoney(euros)) }
                }
                .font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.textMuted)
            }
        }
        .accessibilityLabel("Money over time in three futures")
    }

    private func color(_ id: BranchId) -> Color {
        switch id {
        case .nothing: return SisuTheme.Color.neutral400
        case .save: return SisuTheme.Color.green900
        case .invest: return SisuTheme.Color.green500
        }
    }
}

/// The app's slider: a 14 pt rounded pale-mint track, a deep green fill, and a white knob with a deep green ring
/// and the 4 pt darker edge of anything pressable. Adjustable with VoiceOver.
private struct SisuSlider: View {
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double

    private let track: CGFloat = 14
    private let knob: CGFloat = 30

    var body: some View {
        GeometryReader { geometry in
            let width = max(geometry.size.width - knob, 1)
            let span = max(range.upperBound - range.lowerBound, step)
            let fraction = CGFloat((min(max(value, range.lowerBound), range.upperBound) - range.lowerBound) / span)
            ZStack(alignment: .leading) {
                Capsule().fill(SisuTheme.Color.green100).frame(height: track)
                Capsule().fill(SisuTheme.Color.green700).frame(width: knob / 2 + fraction * width, height: track)
                Circle()
                    .fill(SisuTheme.Color.white)
                    .overlay(Circle().strokeBorder(SisuTheme.Color.green700, lineWidth: 4))
                    .background(Circle().fill(SisuTheme.Color.green900).offset(y: SisuTheme.Spacing.pressEdge / 2))
                    .frame(width: knob, height: knob)
                    .offset(x: fraction * width)
            }
            .frame(maxHeight: .infinity)
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { drag in
                let raw = Double((drag.location.x - knob / 2) / width) * span + range.lowerBound
                let stepped = (raw / step).rounded() * step
                value = min(max(stepped, range.lowerBound), range.upperBound)
            })
        }
        .frame(height: SisuTheme.Spacing.touchTarget - 8)
        .accessibilityElement()
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: value = min(value + step, range.upperBound)
            case .decrement: value = max(value - step, range.lowerBound)
            @unknown default: break
            }
        }
    }
}
