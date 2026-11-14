// The teaching path: a fixed header (title, streak and berries, the data tag, progress), then a winding path
// of seven lessons built from the customer's own numbers. Every lesson opens in any order; the path only
// suggests the next one. With `-sisu.voicelab 1` this tab shows the voice lab instead.
import SisuCore
import SwiftUI

struct PathScreen: View {
    var body: some View {
        if VoiceLaunch.current.voiceLab {
            VoiceLabScreen()
        } else {
            LessonPathScreen()
        }
    }
}

private struct LessonPathScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var path = PathModel()
    @State private var didApplyLaunch = false
    /// Screenshots: the option to pick in the lesson the launch arguments opened.
    @State private var autoAnswer: Int?

    private var customerId: String { model.customer?.customerId ?? FixtureAPI.customerIds.first ?? "CUST04974" }
    private var loadKey: String { "\(customerId)|\(model.isLive)|\(model.customersState == .loaded)" }

    var body: some View {
        @Bindable var path = path
        ZStack {
            VStack(spacing: 0) {
                PathHeader(path: path)
                switch path.state {
                case .failed(let message):
                    ErrorState(message: message) { Task { await reload() } }
                case .empty:
                    ErrorState(message: LessonPathPresenter.emptyText) { Task { await reload() } }
                case .loaded:
                    PathTrail(path: path) { path.openLesson = OpenLesson(card: $0) }
                default:
                    PathLoading()
                }
            }
            .background(SisuTheme.Color.background)

            if let party = path.celebration {
                PathCelebration(headline: party.headline, detail: party.detail) { path.celebration = nil }
                    .transition(.opacity)
                    .zIndex(1)
            }
        }
        .animation(SisuMotion.state(reduceMotion: reduceMotion), value: path.celebration?.headline)
        .sheet(item: $path.openLesson) { lesson in
            LessonSheet(card: lesson.card, path: path, autoAnswer: autoAnswer)
                .onDisappear { autoAnswer = nil }
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(SisuTheme.Radius.sheet)
                .presentationBackground(SisuTheme.Color.background)
        }
        .task(id: loadKey) {
            guard model.customersState == .loaded || model.customersState == .idle || model.sampleOnly else { return }
            await path.load(customerId: customerId, live: model.isLive, baseURL: model.baseURLString, defaults: model.launch.defaults)
            await applyLaunch()
        }
    }

    private func reload() async {
        await path.retry(customerId: customerId, live: model.isLive, baseURL: model.baseURLString, defaults: model.launch.defaults)
    }

    /// The screenshot harness: lessons already done, a lesson open.
    private func applyLaunch() async {
        guard !didApplyLaunch, path.state == .loaded else { return }
        let launch = VoiceLaunch.current
        if let done = launch.lessonsDone, model.launch.screenshots { path.pretendDone(done) }
        if let lesson = launch.lesson, path.cards.indices.contains(lesson - 1) {
            try? await Task.sleep(for: .milliseconds(400))
            autoAnswer = launch.lessonAnswer
            path.openLesson = OpenLesson(card: path.cards[lesson - 1])
        }
        didApplyLaunch = true
    }
}


// MARK: - Header

private struct PathHeader: View {
    @Environment(AppModel.self) private var model
    let path: PathModel

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 3) {
            HStack(alignment: .center, spacing: SisuTheme.Spacing.grid * 2) {
                Text("Your path")
                    .font(SisuTheme.Font.h1)
                    .foregroundStyle(SisuTheme.Color.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                // The same tight pills as Today's header: each hugs its text, side by side.
                let berries = LessonPathPresenter.berriesText(daily: model.progress, lessons: path.progress)
                HStack(spacing: SisuTheme.Spacing.grid * 2) {
                    RiveComponentView(.statPill, values: RiveValues.statPill("streak", value: model.progress.streakText))
                        .hugging(width: RiveHug.statPill(model.progress.streakText))
                        .riveAccessible("Streak", value: "\(model.progress.streakText) days")
                    RiveComponentView(.statPill, values: RiveValues.statPill("berries", value: berries))
                        .hugging(width: RiveHug.statPill(berries, kind: "berries"))
                        .riveAccessible("Berries", value: berries)
                }
            }
            if path.state == .loaded {
                // Where the lessons come from is in Settings > Data and sources; no badge here.
                Text(LessonPathPresenter.subtitle(path.cards, progress: path.progress))
                    .font(SisuTheme.Font.caption)
                    .foregroundStyle(SisuTheme.Color.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
                    let text = LessonPathPresenter.progressText(path.cards, progress: path.progress)
                    RiveComponentView(.progressBar, values: RiveBindings.progressBar(progress: LessonPathPresenter.fraction(path.cards, progress: path.progress)))
                        .riveAccessible("Lessons", value: text)
                    Text(text)
                        .font(SisuTheme.Font.label)
                        .foregroundStyle(SisuTheme.Color.text)
                        .accessibilityHidden(true)
                }
            }
        }
        .padding(.horizontal, SisuTheme.Spacing.margin)
        .padding(.top, SisuTheme.Spacing.grid * 2)
        .padding(.bottom, SisuTheme.Spacing.grid * 3)
        .background(SisuTheme.Color.background)
    }
}

private struct PathLoading: View {
    var body: some View {
        VStack(spacing: SisuTheme.Spacing.card) {
            Spacer()
            ProgressView().tint(SisuTheme.Color.green700)
            Text("Building lessons from your numbers")
                .font(SisuTheme.Font.body)
                .foregroundStyle(SisuTheme.Color.textMuted)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - The path

private struct PathTrail: View {
    let path: PathModel
    let open: (TeachingCard) -> Void

    /// How far a node swings left or right at the widest point of the curve.
    private let swing: CGFloat = 84

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: SisuTheme.Spacing.grid * 2) {
                    ForEach(path.nodes) { node in
                        if let card = path.cards.first(where: { $0.concept == node.concept }) {
                            LessonNodeView(node: node, total: path.cards.count, swing: swing) { open(card) }
                                .offset(x: CGFloat(node.sway) * swing)
                                .id(node.id)
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, SisuTheme.Spacing.margin)
                .padding(.top, SisuTheme.Spacing.grid * 4)
                .padding(.bottom, SisuTheme.Spacing.section * 2)
            }
            .scrollIndicators(.hidden)
            .task {
                if let current = path.nodes.first(where: { $0.state == .current }), current.index > 2 {
                    proxy.scrollTo(current.id, anchor: .center)
                }
            }
        }
    }
}

private struct LessonNodeView: View {
    let node: LessonNode
    let total: Int
    let swing: CGFloat
    let open: () -> Void

    private let size: CGFloat = 96

    var body: some View {
        VStack(spacing: SisuTheme.Spacing.grid * 2) {
            if node.state == .current {
                RiveComponentView(.tag, values: RiveBindings.tag(text: "Start", tone: .neutral))
                    .accessibilityHidden(true)
            }
            ZStack(alignment: .topTrailing) {
                RiveComponentView(.sticker, values: RiveBindings.sticker(kind: .lesson, label: node.badge))
                    .sizing(.contain)
                    .frame(width: size, height: size)
                    .padding(SisuTheme.Spacing.grid * 2)
                    .background {
                        if node.state == .current {
                            Circle().stroke(SisuTheme.Color.green500, lineWidth: SisuTheme.Spacing.grid * 1.5)
                        }
                    }
                    .opacity(node.state == .upcoming ? 0.55 : 1)
                if node.state == .done {
                    Image(systemName: "checkmark")
                        .font(SisuTheme.Font.label)
                        .foregroundStyle(SisuTheme.Color.white)
                        .frame(width: 28, height: 28)
                        .background(SisuTheme.Color.green700, in: Circle())
                        .accessibilityHidden(true)
                }
            }
            .overlay(alignment: node.sway > 0 ? .leading : .trailing) {
                if node.state == .current {
                    RiveComponentView(.liito, values: RiveBindings.liito(mood: .cheering))
                        .sizing(.contain)
                        .frame(width: 104, height: 104)
                        .offset(x: node.sway > 0 ? -116 : 116)
                        .accessibilityLabel("Liito cheers you on")
                }
            }
            Text(node.title)
                .font(node.state == .current ? SisuTheme.Font.button : SisuTheme.Font.label)
                .foregroundStyle(node.state == .upcoming ? SisuTheme.Color.textMuted : SisuTheme.Color.text)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .frame(width: 150)
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: open)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(node.accessibilityLabel(total: total))
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { open() }
        .accessibilityIdentifier("lesson.\(node.index + 1)")
    }
}

// MARK: - Celebration

/// The full-screen Rive celebration after the last lesson: on screen first, then `fire`; gone on `done`, a tap,
/// or after 4 seconds at the latest.
private struct PathCelebration: View {
    let headline: String
    let detail: String
    let dismiss: () -> Void
    @State private var fired = false

    var body: some View {
        RiveComponentView(.celebration,
                          values: RiveBindings.celebration(headline: headline, detail: detail),
                          triggers: fired ? ["fire#1"] : []) { trigger in
            if trigger == "done" { dismiss() }
        }
        .ignoresSafeArea()
        .contentShape(Rectangle())
        .onTapGesture(perform: dismiss)
        .riveAccessible("\(headline) \(detail)", isButton: true, action: dismiss)
        .task {
            try? await Task.sleep(for: .milliseconds(150))
            fired = true
            try? await Task.sleep(for: .seconds(4))
            dismiss()
        }
    }
}
