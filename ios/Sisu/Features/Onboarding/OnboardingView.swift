// The first run: Welcome, the three baskets, choosing a demo profile (with the demo disclosure), and a sorting
// moment that lasts exactly as long as the profile's overview takes to load. Then RootView shows Today.
// The state is SisuCore's OnboardingFlow on AppModel; this file only lays it out and passes on taps.
// Shaped by .handoff/onboarding-research.md (Monefy's short intro, Copilot's demo path and three types,
// Fleur's selected card with a check).
import SisuCore
import SwiftUI

struct OnboardingView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Whether the last move went forward, so screens slide in from the right and out to the left.
    @State private var forward = true

    private var flow: OnboardingFlow { model.onboarding }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            ZStack {
                screen(flow.step)
                    .id(flow.step)
                    .transition(transition)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()
        }
        .background(SisuTheme.Color.background.ignoresSafeArea())
    }

    @ViewBuilder
    private func screen(_ step: OnboardingStep) -> some View {
        switch step {
        case .welcome: WelcomeStep { move(forward: true, model.onboardingContinue) }
        case .promise: PromiseStep { move(forward: true, model.onboardingContinue) }
        case .profile: ProfileStep(mode: .onboarding) { customer in
            move(forward: true) { model.chooseInOnboarding(customer) }
        }
        case .reading: ReadingStep()
        }
    }

    // MARK: Top bar: back, progress, skip

    private var topBar: some View {
        HStack(spacing: SisuTheme.Spacing.grid * 3) {
            ZStack {
                if flow.canGoBack {
                    SisuIconButton(icon: .back, style: .plain, label: OnboardingCopy.back) {
                        move(forward: false, model.onboardingBack)
                    }
                    .transition(.opacity)
                }
            }
            .frame(width: SisuTheme.Spacing.touchTarget, height: SisuTheme.Spacing.touchTarget)

            RiveComponentView(.progressBar, values: RiveValues.progress(flow.progress))
                .riveAccessible("First run", value: "Step \(flow.step.number) of \(OnboardingFlow.stepCount)")

            ZStack {
                if flow.canSkip {
                    Button {
                        move(forward: true, model.onboardingSkip)
                    } label: {
                        Text(OnboardingCopy.skip)
                            .font(SisuTheme.Font.button)
                            .foregroundStyle(SisuTheme.Color.primary)
                            .frame(minWidth: SisuTheme.Spacing.touchTarget, minHeight: SisuTheme.Spacing.touchTarget)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Goes straight to choosing a profile")
                    .transition(.opacity)
                }
            }
            .frame(width: SisuTheme.Spacing.touchTarget + SisuTheme.Spacing.grid * 2, height: SisuTheme.Spacing.touchTarget)
        }
        .padding(.horizontal, SisuTheme.Spacing.margin - SisuTheme.Spacing.grid * 2)
        .padding(.top, SisuTheme.Spacing.grid)
        .opacity(flow.step == .reading ? 0 : 1)
    }

    // MARK: Motion

    private var transition: AnyTransition {
        if reduceMotion { return .opacity }
        return .asymmetric(
            insertion: .move(edge: forward ? .trailing : .leading).combined(with: .opacity),
            removal: .move(edge: forward ? .leading : .trailing).combined(with: .opacity))
    }

    private func move(forward: Bool, _ change: @escaping () -> Void) {
        let animation = OnboardingMotion.page(reduceMotion: reduceMotion, scale: model.launch.motionScale)
        let delay = model.launch.motionDelay
        guard delay > 0 else {
            self.forward = forward
            withAnimation(animation) { change() }
            return
        }
        Task {
            try? await Task.sleep(for: .milliseconds(Int(delay * 1000)))
            self.forward = forward
            withAnimation(animation) { change() }
        }
    }
}

/// The first run's timings. `scale` is the `-sisu.motionScale` launch argument (1 normally).
enum OnboardingMotion {
    static func page(reduceMotion: Bool, scale: Double) -> Animation? {
        reduceMotion ? nil : .spring(response: 0.5 * scale, dampingFraction: 0.86)
    }

    /// How an element that arrives after its screen comes in: `index` staggers rows.
    static func arrival(reduceMotion: Bool, scale: Double, index: Int) -> Animation? {
        reduceMotion ? nil : .spring(response: 0.45 * scale, dampingFraction: 0.8).delay(Double(index) * 0.12 * scale)
    }
}

// MARK: - 1. Welcome

private struct WelcomeStep: View {
    let next: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
            Spacer(minLength: 0)
            LiitoView(mood: "cheering", label: "Liito the flying squirrel waves hello")
                .frame(width: 240, height: 240)
                .frame(maxWidth: .infinity)
            Text("sisu")
                .font(SisuTheme.Font.h2)
                .foregroundStyle(SisuTheme.Color.primary)
                .accessibilityLabel("Sisu")
            Text(OnboardingCopy.welcomeTitle)
                .font(SisuTheme.Font.h1)
                .foregroundStyle(SisuTheme.Color.text)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(OnboardingCopy.welcomeBody)
                .font(SisuTheme.Font.bodyLarge)
                .foregroundStyle(SisuTheme.Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: SisuTheme.Spacing.section)
            SisuButton(label: OnboardingCopy.welcomeButton, action: next)
        }
        .padding(.horizontal, SisuTheme.Spacing.margin)
        .padding(.bottom, SisuTheme.Spacing.card)
    }
}

// MARK: - 2. Three baskets, then what Sisu does

private struct PromiseStep: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let next: () -> Void
    /// How many rows have arrived: the baskets, then the "Then Sisu" block.
    @State private var shown = 0

    var body: some View {
        VStack(spacing: SisuTheme.Spacing.card) {
            ScrollView {
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
                    Text(OnboardingCopy.promiseTitle)
                        .font(SisuTheme.Font.h1)
                        .foregroundStyle(SisuTheme.Color.text)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                        .padding(.top, SisuTheme.Spacing.card)

                    SisuCard {
                        ForEach(Array(OnboardingCopy.promiseBaskets.enumerated()), id: \.element.id) { index, row in
                            if index > 0 { Divider().overlay(SisuTheme.Color.neutral200) }
                            BasketRow(row: row)
                                .arriving(index < shown)
                        }
                    }

                    VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 3) {
                        Text(OnboardingCopy.promiseThenTitle)
                            .font(SisuTheme.Font.h3)
                            .foregroundStyle(SisuTheme.Color.text)
                        ForEach(Array(OnboardingCopy.promiseThen.enumerated()), id: \.offset) { _, line in
                            HStack(spacing: SisuTheme.Spacing.grid * 3) {
                                Image(systemName: "checkmark")
                                    .font(SisuTheme.Font.caption)
                                    .foregroundStyle(SisuTheme.Color.onPrimary)
                                    .frame(width: 24, height: 24)
                                    .background(SisuTheme.Color.primary, in: Circle())
                                    .accessibilityHidden(true)
                                Text(line)
                                    .font(SisuTheme.Font.bodyLarge)
                                    .foregroundStyle(SisuTheme.Color.text)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    .padding(.horizontal, SisuTheme.Spacing.grid)
                    .arriving(shown > OnboardingCopy.promiseBaskets.count)
                }
                .padding(.horizontal, SisuTheme.Spacing.margin)
            }
            .scrollIndicators(.hidden)
            .scrollBounceBehavior(.basedOnSize)

            SisuButton(label: OnboardingCopy.promiseButton, action: next)
                .padding(.horizontal, SisuTheme.Spacing.margin)
        }
        .padding(.bottom, SisuTheme.Spacing.card)
        .task {
            let total = OnboardingCopy.promiseBaskets.count + 1
            if reduceMotion { shown = total; return }
            // The rows come in one at a time once the page has slid in.
            let scale = model.launch.motionScale
            try? await Task.sleep(for: .milliseconds(Int(220 * scale)))
            for index in 0..<total {
                withAnimation(OnboardingMotion.arrival(reduceMotion: reduceMotion, scale: scale, index: 0)) { shown = index + 1 }
                try? await Task.sleep(for: .milliseconds(Int(140 * scale)))
            }
        }
    }
}

private struct BasketRow: View {
    let row: OnboardingBasketRow

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
            RiveComponentView(.basketChip, values: RiveValues.chip(row.kind))
                .riveAccessible("\(row.kind.label(.en)) basket")
            Text(row.examples)
                .font(SisuTheme.Font.h3)
                .foregroundStyle(SisuTheme.Color.text)
            Text(row.meaning)
                .font(SisuTheme.Font.label)
                .foregroundStyle(SisuTheme.Color.textMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

private extension View {
    /// Hidden and a little lower until it has arrived.
    func arriving(_ arrived: Bool) -> some View {
        opacity(arrived ? 1 : 0)
            .offset(y: arrived ? 0 : 12)
    }
}

// MARK: - 4. The sorting moment

/// Lasts exactly as long as the overview takes to load: when it is loaded the flow finishes and Today shows.
private struct ReadingStep: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: SisuTheme.Spacing.card) {
            Spacer(minLength: 0)
            if case .failed(let message) = model.overviewState {
                Text(message)
                    .font(SisuTheme.Font.bodyLarge)
                    .foregroundStyle(SisuTheme.Color.text)
                    .multilineTextAlignment(.center)
                Spacer(minLength: 0)
                SisuButton(label: OnboardingReading.failedButton, style: .secondary) { model.onboardingReadingFailed() }
            } else {
                LiitoView(mood: "thinking", label: "Liito is reading")
                    .frame(width: 200, height: 200)
                Text(OnboardingReading.loadingTitle(name: model.customer?.displayName ?? "this profile"))
                    .font(SisuTheme.Font.h2)
                    .foregroundStyle(SisuTheme.Color.text)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text(OnboardingReading.loadingDetail)
                    .font(SisuTheme.Font.body)
                    .foregroundStyle(SisuTheme.Color.textMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                RiveComponentView(.typingDots, values: ["active": .bool(true)])
                    .accessibilityHidden(true)
                Spacer(minLength: 0)
            }
        }
        .padding(.horizontal, SisuTheme.Spacing.margin)
        .padding(.bottom, SisuTheme.Spacing.card)
        .task(id: model.overviewState) {
            if model.overviewState == .loaded, model.overview?.customerId == model.customer?.customerId {
                model.finishOnboarding()
            }
        }
    }
}
