// Small building blocks shared by the screens: the white card, section titles, accessible Rive wrappers and
// the app's motion. Colours, fonts, spacing and radii come from SisuTheme only.
import SisuCore
import SwiftUI

/// A white card with 24 pt corners, no outline and no shadow.
struct SisuCard<Content: View>: View {
    var padding: CGFloat = SisuTheme.Spacing.margin
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 3) { content }
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SisuTheme.Color.card, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous))
    }
}

/// A section heading in Bricolage, with an optional line under it.
struct SectionTitle: View {
    let title: String
    var detail: String?

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
            Text(title)
                .font(SisuTheme.Font.h2)
                .foregroundStyle(SisuTheme.Color.text)
                .accessibilityAddTraits(.isHeader)
            if let detail {
                Text(detail)
                    .font(SisuTheme.Font.body)
                    .foregroundStyle(SisuTheme.Color.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A small muted eyebrow above a figure.
struct Eyebrow: View {
    let text: String
    var body: some View {
        Text(text).font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.textMuted)
    }
}

extension View {
    /// Makes a Rive component one accessibility element with a label, and a button when it acts as one.
    func riveAccessible(_ label: String, isButton: Bool = false, value: String? = nil, action: (() -> Void)? = nil) -> some View {
        accessibilityElement(children: .ignore)
            .accessibilityLabel(label)
            .accessibilityValue(value ?? "")
            .accessibilityAddTraits(isButton ? .isButton : [])
            .accessibilityAction { action?() }
    }
}

/// Springy and quick for state changes; calm when Reduce Motion is on.
enum SisuMotion {
    static func state(reduceMotion: Bool) -> Animation {
        reduceMotion ? .easeInOut(duration: 0.2) : .spring(response: 0.35, dampingFraction: 0.72)
    }
}

/// The "Sample data" tag, shown whenever what is on screen is not live.
struct SampleDataTag: View {
    var body: some View {
        RiveComponentView(.tag, values: RiveValues.tag("Sample data"))
            .riveAccessible("Sample data. These figures are not live.")
    }
}

/// The primary Rive button with an accessibility label.
struct SisuButton: View {
    let label: String
    var style: RiveBindings.ButtonStyle = .primary
    var enabled = true
    var loading = false
    let action: () -> Void

    var body: some View {
        RiveComponentView(.button, values: RiveValues.button(label, style: style, enabled: enabled, loading: loading)) { trigger in
            if trigger == "pressed" { action() }
        }
        .riveAccessible(label, isButton: true, action: action)
    }
}

/// A Liito: the 3D one when the 3D file is there, otherwise the 2D one.
struct LiitoView: View {
    let mood: String
    let label: String

    var body: some View {
        RiveComponentView(.liito3D, values: RiveValues.liito(mood))
            .riveAccessible(label)
    }
}
