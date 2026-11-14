// Small building blocks shared by the screens: the white card, section titles, accessible Rive wrappers and
// the app's motion. Colours, fonts, spacing and radii come from SisuTheme only.
import SisuCore
import SwiftUI

/// A white card with 24 pt corners and a hairline that separates it from the near-white screen. No shadow, no
/// glass: money figures, charts and lists always sit on this solid surface.
struct SisuCard<Content: View>: View {
    var padding: CGFloat = SisuTheme.Spacing.margin
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 3) { content }
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .sisuCardSurface()
    }
}

extension View {
    /// The card surface: white, 24 pt continuous corners, a hairline. For cards not built with `SisuCard`.
    func sisuCardSurface(radius: CGFloat = SisuTheme.Radius.card) -> some View {
        background(SisuTheme.Color.card, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous)
                .strokeBorder(SisuTheme.Color.hairline, lineWidth: 1))
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
    /// Springy and quick; nil (instant) when Reduce Motion is on, so nothing slides, grows or bounces.
    static func state(reduceMotion: Bool) -> Animation? {
        reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.72)
    }

    /// How something new comes in: rising into place, or a plain cross-fade when Reduce Motion is on.
    static func entrance(reduceMotion: Bool) -> AnyTransition {
        reduceMotion ? .opacity : .opacity.combined(with: .move(edge: .bottom))
    }
}

/// The "Sample data" tag. Since 2026-11-14 the demo is disclosed once, at profile selection, and the screens no
/// longer repeat it (source and freshness are in Settings > Data and sources). Kept for the picker.
struct SampleDataTag: View {
    var body: some View {
        RiveComponentView(.tag, values: RiveValues.tag("Sample data"))
            .hugging(width: RiveHug.sampleTag)
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

/// Liito, the 2D Rive mascot.
struct LiitoView: View {
    let mood: String
    let label: String

    var body: some View {
        RiveComponentView(.liito, values: RiveValues.liito(mood))
            .riveAccessible(label)
    }
}

/// The Rive pills and tags hug their text and sit at the leading edge of their artboard, so a frame at the full
/// design width leaves an empty gap after them. These are the widths they draw at, so they can be laid out
/// tightly (measured from sisu_ui.riv on 2026-11-14).
enum RiveHug {
    /// The "Sample data" tag.
    static let sampleTag: CGFloat = 92
    /// A StatPill: icon and padding, plus about 10 pt per character of its value. The berries icon is wider
    /// than the flame.
    static func statPill(_ value: String, kind: String = "streak") -> CGFloat {
        let base: CGFloat = kind == "berries" ? 58 : 52
        return min(base + CGFloat(max(value.count - 1, 0)) * 10, 96)
    }
}

extension RiveComponentView {
    /// Shows only the leading `width` points of the artboard at its design height, at full scale.
    func hugging(width: CGFloat) -> some View {
        frame(width: max(width, 1), alignment: .leading)
            .clipped()
    }
}

/// A round Rive `IconButton` (48 x 48) with an accessibility label and the button trait.
struct SisuIconButton: View {
    let icon: RiveBindings.IconKind
    var style: RiveBindings.IconStyle = .plain
    let label: String
    let action: () -> Void

    var body: some View {
        RiveComponentView(.iconButton, values: RiveBindings.iconButton(icon: icon, style: style)) { trigger in
            if trigger == "pressed" { action() }
        }
        .riveAccessible(label, isButton: true, action: action)
    }
}

/// A short notice said once, in place, at the moment something changes: for example when the app falls back from
/// live to demo data because the backend cannot be reached. It shows for a few seconds (VoiceOver reads it out),
/// then fades; a tap dismisses it. Each `id` is said once per launch. Never a permanent badge.
struct TransientNotice: View {
    let id: String
    let text: String
    var seconds: Double = 8
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var visible = false

    var body: some View {
        Group {
            if visible {
                HStack(alignment: .firstTextBaseline, spacing: SisuTheme.Spacing.grid * 2) {
                    Image(systemName: "info.circle")
                        .accessibilityHidden(true)
                    Text(text)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
                .font(SisuTheme.Font.label)
                .foregroundStyle(SisuTheme.Color.infoText)
                .padding(.horizontal, SisuTheme.Spacing.grid * 3)
                .padding(.vertical, SisuTheme.Spacing.grid * 2)
                .background(SisuTheme.Color.infoBackground, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.button, style: .continuous))
                .contentShape(Rectangle())
                .onTapGesture { hide() }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isStaticText)
                .accessibilityIdentifier("notice.\(id)")
                .transition(SisuMotion.entrance(reduceMotion: reduceMotion))
            }
        }
        .animation(SisuMotion.state(reduceMotion: reduceMotion) ?? .easeInOut(duration: 0.2), value: visible)
        .task(id: id) {
            guard NoticeLedger.shared.claim(id) else { return }
            visible = true
            UIAccessibility.post(notification: .announcement, argument: text)
            try? await Task.sleep(for: .seconds(seconds))
            hide()
        }
    }

    private func hide() { visible = false }
}

/// Which transient notices were already said in this launch.
@MainActor
final class NoticeLedger {
    static let shared = NoticeLedger()
    private var said: Set<String> = []

    /// True the first time an id is claimed.
    func claim(_ id: String) -> Bool { said.insert(id).inserted }
}

/// When the screens last received data, for Settings > Data and sources. AppModel does not record a fetch time
/// yet, so Today notes it when an overview finishes loading.
@MainActor
@Observable
final class DataFreshness {
    static let shared = DataFreshness()
    private(set) var overviewFetchedAt: Date?
    private var overviewTimestamp: String?

    func overviewLoaded(_ overview: Overview?) {
        guard let overview else { return }
        let stamp = "\(overview.customerId)|\(overview.dataTimestamp)"
        if stamp != overviewTimestamp || overviewFetchedAt == nil {
            overviewTimestamp = stamp
            overviewFetchedAt = Date()
        }
    }
}

/// A pressable white card for the light look: hairline border and a 4 pt neutral bottom edge that it moves down
/// onto when pressed (the brand's press rule, without the pale-green edge).
struct SisuPressableCardStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        let shape = RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous)
        configuration.label
            .background(SisuTheme.Color.card, in: shape)
            .overlay(shape.strokeBorder(SisuTheme.Color.hairline, lineWidth: 1))
            .offset(y: pressed ? SisuTheme.Spacing.pressEdge : 0)
            .background(shape.fill(SisuTheme.Color.pressEdge).offset(y: SisuTheme.Spacing.pressEdge))
            .padding(.bottom, SisuTheme.Spacing.pressEdge)
            .animation(SisuMotion.state(reduceMotion: reduceMotion), value: pressed)
    }
}
