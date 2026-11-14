// PLACEHOLDER for the coach (ask, research, approval, voice). The next engineer replaces the body.
// Seams: watch `model.investigationRequests` (bumped by startInvestigation()) to start a run; set
// `model.approvedMonthlySaving` when the user approves a switch. See AppModel.swift for every hook.
import SisuCore
import SwiftUI

struct AskScreen: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        PlaceholderScreen(
            title: "Ask",
            mood: model.investigationRequests > 0 ? "curious" : "idle",
            line: model.investigationRequests > 0
                ? "Liito is getting ready to look into your bills. The coach arrives here next."
                : "Ask Sisu anything about your money. The coach arrives here next."
        )
    }
}

/// Liito and one friendly sentence, for the tabs still being built.
struct PlaceholderScreen: View {
    @Environment(AppModel.self) private var model
    let title: String
    let mood: String
    let line: String

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
            HStack {
                Text(title).font(SisuTheme.Font.h1).foregroundStyle(SisuTheme.Color.text)
                Spacer()
                if !model.isLive { SampleDataTag() }
            }
            Spacer()
            LiitoView(mood: mood, label: "Liito the flying squirrel")
                .frame(width: 240, height: 240)
                .frame(maxWidth: .infinity)
            Text(line)
                .font(SisuTheme.Font.bodyLarge)
                .foregroundStyle(SisuTheme.Color.text)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
        }
        .padding(.horizontal, SisuTheme.Spacing.margin)
        .padding(.top, SisuTheme.Spacing.card)
    }
}
