// The first useful moment: on the first visit to Today after the first run, Liito points at the flagged bill and
// links to the transactions behind it. Spotlit for about a second on arrival (a green ring that pulses once and
// a light haptic), then it stays until the user taps it away. TodayScreen places it with one line at the top of
// its content; it draws nothing once dismissed. Text and figures come from SisuCore's FirstInsightPresenter.
import SisuCore
import SwiftUI

struct FirstInsightCallout: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if model.onboarding.firstInsightPending, let overview = model.overview,
           let state = FirstInsightPresenter.state(for: overview, confirmedName: model.flaggedBill.flatMap(model.confirmedName(for:))) {
            FirstInsightCard(state: state)
                .transition(.opacity.combined(with: .scale(scale: 0.96, anchor: .top)))
        }
    }
}

private struct FirstInsightCard: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let state: FirstInsightState
    @State private var arrived = false
    @State private var spotlight = false

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
            HStack(alignment: .center, spacing: SisuTheme.Spacing.grid * 2) {
                LiitoView(mood: "found", label: "Liito points at what Sisu found")
                    .frame(width: 56, height: 56)
                    .padding(.leading, -SisuTheme.Spacing.grid)
                Text(state.eyebrow)
                    .font(SisuTheme.Font.label)
                    .foregroundStyle(SisuTheme.Color.primary)
                Spacer(minLength: 0)
                SisuIconButton(icon: .close, style: .plain, label: "\(state.dismissLabel), hide this") { dismiss() }
                    .padding(.trailing, -SisuTheme.Spacing.grid * 2)
            }
            Text(state.headline)
                .font(SisuTheme.Font.h3)
                .foregroundStyle(SisuTheme.Color.text)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(state.detail)
                .font(SisuTheme.Font.body)
                .foregroundStyle(SisuTheme.Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)
            Divider().overlay(SisuTheme.Color.neutral200)
                .padding(.top, SisuTheme.Spacing.grid)
            Button(action: openEvidence) {
                HStack(spacing: SisuTheme.Spacing.grid * 2) {
                    Text(state.source)
                        .font(SisuTheme.Font.label)
                        .foregroundStyle(SisuTheme.Color.textMuted)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Spacer(minLength: SisuTheme.Spacing.grid * 2)
                    Text(state.seeLabel)
                        .font(SisuTheme.Font.button)
                        .foregroundStyle(SisuTheme.Color.primary)
                    Image(systemName: "chevron.right")
                        .font(SisuTheme.Font.label)
                        .foregroundStyle(SisuTheme.Color.primary)
                }
                .frame(minHeight: SisuTheme.Spacing.touchTarget)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(state.linkLabel)
            .accessibilityHint("Shows the transactions behind this")
        }
        .padding(.horizontal, SisuTheme.Spacing.margin)
        .padding(.top, SisuTheme.Spacing.grid * 2)
        .padding(.bottom, SisuTheme.Spacing.grid)
        .background(SisuTheme.Color.card, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous)
                .strokeBorder(SisuTheme.Color.primary, lineWidth: 2)
        )
        // The spotlight: a soft green ring that grows out and fades once.
        .background(
            RoundedRectangle(cornerRadius: SisuTheme.Radius.card + 6, style: .continuous)
                .fill(SisuTheme.Color.green100)
                .padding(-6)
                .opacity(spotlight ? 1 : 0)
        )
        .opacity(arrived ? 1 : 0)
        .offset(y: arrived ? 0 : 16)
        .sensoryFeedback(.impact(weight: .light), trigger: arrived)
        .task { await arrive() }
    }

    private func arrive() async {
        guard !arrived else { return }
        if reduceMotion { arrived = true; return }
        let scale = model.launch.motionScale
        try? await Task.sleep(for: .milliseconds(Int(250 * scale)))
        withAnimation(.spring(response: 0.45 * scale, dampingFraction: 0.78)) { arrived = true; spotlight = true }
        try? await Task.sleep(for: .milliseconds(Int(1000 * scale)))
        withAnimation(.easeOut(duration: 0.6 * scale)) { spotlight = false }
    }

    private func openEvidence() {
        model.evidence = EvidenceRequest(title: state.evidenceTitle, filter: state.evidence)
    }

    private func dismiss() {
        withAnimation(SisuMotion.state(reduceMotion: reduceMotion)) { model.dismissFirstInsight() }
    }
}
