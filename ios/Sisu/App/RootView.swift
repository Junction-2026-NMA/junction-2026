// The root: the customer picker until a customer is chosen, then the main screen with its tab bar.
import SisuCore
import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            SisuTheme.Color.background.ignoresSafeArea()
            if model.customer == nil {
                PickerScreen()
                    .transition(.opacity)
            } else {
                MainScreen()
                    .transition(.opacity)
            }
        }
        .animation(SisuMotion.state(reduceMotion: reduceMotion), value: model.customer?.customerId)
        .task { await model.start() }
    }
}
