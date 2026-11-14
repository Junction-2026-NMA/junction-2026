// The root: the first-run onboarding until it is complete, then the profile chooser while no customer is chosen
// (after "Switch customer"), then the main screen with its tab bar.
import SisuCore
import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum Route: Equatable { case onboarding, chooser, main }

    private var route: Route {
        if model.onboarding.isActive { return .onboarding }
        return model.customer == nil ? .chooser : .main
    }

    var body: some View {
        ZStack {
            SisuTheme.Color.background.ignoresSafeArea()
            switch route {
            case .onboarding:
                // Leaves a little slower than Today arrives on top of it, so the hand-over never shows an
                // empty screen.
                OnboardingView()
                    .zIndex(0)
                    .transition(.asymmetric(insertion: .opacity, removal: .opacity.animation(.easeOut(duration: 0.45))))
            case .chooser:
                PickerScreen()
                    .transition(.opacity)
            case .main:
                MainScreen()
                    .zIndex(1)
                    .transition(reduceMotion ? .opacity : .opacity.combined(with: .scale(scale: 0.98)))
            }
        }
        .animation(SisuMotion.state(reduceMotion: reduceMotion), value: route)
        .animation(SisuMotion.state(reduceMotion: reduceMotion), value: model.customer?.customerId)
        .task { await model.start() }
    }
}
