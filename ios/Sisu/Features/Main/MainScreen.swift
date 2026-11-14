// The main screen: the four tabs above the Rive tab bar.
import SisuCore
import SwiftUI

struct MainScreen: View {
    @Environment(AppModel.self) private var model
    /// The tab bar steps aside while the keyboard is up, so it never floats above the keys.
    @State private var keyboardShown = false

    var body: some View {
        @Bindable var model = model
        VStack(spacing: 0) {
            Group {
                switch model.tab {
                case .today: TodayScreen()
                case .ask: AskScreen()
                case .jars: JarsScreen()
                case .path: PathScreen()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if !keyboardShown { tabBar }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in keyboardShown = true }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in keyboardShown = false }
        .sheet(item: $model.evidence) { request in
            TransactionsSheet(request: request)
        }
        .overlay {
            if let party = model.celebration {
                CelebrationOverlay(headline: party.headline, detail: party.detail) { model.celebration = nil }
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: model.celebration?.headline)
    }

    private var tabBar: some View {
            RiveComponentView(.tabBar, values: RiveValues.tabBar(selected: model.tab.rawValue)) { trigger in
                if let index = Int(trigger.dropFirst(3)), trigger.hasPrefix("tap"), let tab = AppTab(rawValue: index) {
                    model.tab = tab
                }
            }
            .accessibilityElement(children: .contain)
            .overlay { tabAccessibility }
            .background(SisuTheme.Color.card.ignoresSafeArea(edges: .bottom))
    }

    /// Four invisible accessibility buttons over the Rive tab bar, one per tab.
    private var tabAccessibility: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases) { tab in
                Color.clear
                    .contentShape(Rectangle())
                    .allowsHitTesting(false)
                    .accessibilityElement()
                    .accessibilityLabel(["Today", "Ask", "Jars", "Path"][tab.rawValue])
                    .accessibilityAddTraits(model.tab == tab ? [.isButton, .isSelected] : .isButton)
                    .accessibilityAction { model.tab = tab }
            }
        }
    }
}

/// The full-screen Rive celebration. It fires `fire` once it is on screen and goes away on `done`, on a tap,
/// or after a few seconds if `done` never arrives.
private struct CelebrationOverlay: View {
    let headline: String
    let detail: String
    let dismiss: () -> Void
    @State private var fired = false

    var body: some View {
        RiveComponentView(.celebration,
                          values: RiveValues.celebration(headline: headline, detail: detail),
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
