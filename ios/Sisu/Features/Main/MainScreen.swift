// The main screen: the four tabs under the floating glass tab bar (Shared/GlassTabBar.swift).
import SisuCore
import SwiftUI

struct MainScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// The tab bar steps aside while the keyboard is up, so it never floats above the keys.
    @State private var keyboardShown = false

    var body: some View {
        @Bindable var model = model
        Group {
            switch model.tab {
            case .today: TodayScreen()
            case .ask: AskScreen()
            case .jars: JarsScreen()
            case .path: PathScreen()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // The bar floats over the screens: the inset lifts every screen's safe area by the bar's height, so
        // each scroll view runs under the glass and its last row still scrolls clear of the bar.
        .modifier(BottomBar {
            if !keyboardShown {
                GlassTabBar(selection: $model.tab)
                    .padding(.top, SisuTheme.Spacing.grid * 2)
                    .padding(.bottom, SisuTheme.TabBar.lift)
                    .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
            }
        })
        .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: keyboardShown)
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
}

/// Puts the tab bar at the bottom as a safe-area bar. On iOS 26 `safeAreaBar` also gives the scroll views
/// under it the system's soft scroll-edge blur, so text scrolling behind the glass fades instead of colliding
/// with the labels; earlier systems use a plain `safeAreaInset`.
private struct BottomBar<Bar: View>: ViewModifier {
    @ViewBuilder var bar: () -> Bar

    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.safeAreaBar(edge: .bottom, spacing: 0, content: bar)
        } else {
            content.safeAreaInset(edge: .bottom, spacing: 0, content: bar)
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
