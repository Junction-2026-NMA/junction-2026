// The profile chooser after the first run ("Switch customer" in settings): the onboarding's profile step on its
// own, with the same demo disclosure. Choosing opens Today straight away.
import SisuCore
import SwiftUI

struct PickerScreen: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ProfileStep(mode: .chooser) { customer in
            Task { await model.choose(customer) }
        }
    }
}

/// A white card with a 4 pt darker bottom edge that moves down when pressed.
struct PressableCardStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        configuration.label
            .background(SisuTheme.Color.card, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous))
            .offset(y: pressed ? SisuTheme.Spacing.pressEdge : 0)
            .background(
                RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous)
                    .fill(SisuTheme.Color.green300)
                    .offset(y: SisuTheme.Spacing.pressEdge)
            )
            .padding(.bottom, SisuTheme.Spacing.pressEdge)
            .animation(SisuMotion.state(reduceMotion: reduceMotion), value: pressed)
    }
}
