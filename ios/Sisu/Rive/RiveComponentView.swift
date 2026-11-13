// One Rive component as a SwiftUI view. This is the only view the screens need from the Rive layer.
import RiveRuntime
import SisuCore
import SwiftUI

/// Shows one artboard of `rive/contract.json` and connects it to SwiftUI state.
///
///     RiveComponentView(.button, values: ["label": .string("Continue")]) { trigger in
///         // trigger == "pressed"
///     }
///
/// - `values`: the artboard's `in` properties by name. They are written when the artboard appears and again
///   whenever a value changes. A property you do not set keeps the Rive file's default, so set them all
///   (`RiveBindings` in SisuCore builds complete sets).
/// - `triggers`: requests to fire `in` triggers. See `RiveTriggerRequest` for the rules; in short,
///   `triggers: ["celebrate#\(count)"]` fires `celebrate` each time `count` changes.
/// - `onTrigger`: called on the main actor with the name of each `out` trigger the artboard fires.
/// - Fallback: when the component's file is missing (the 3D file is optional), its 2D fallback is shown with
///   the same values. When nothing can be shown, a pale-mint placeholder with the component's name is drawn.
///   A placeholder for a component with exactly one `out` trigger fires it when tapped, so a flow still works.
/// - Size: taken from the contract. `fixed` is exactly the design size; `flexibleWidth` fills the width at the
///   design height; `contain` scales to fit the frame it is given and keeps its proportions (in a scroll view,
///   where nothing limits the height, it takes its design size); `fill` fills the frame. So a `.frame` from the
///   parent sizes `contain` and `fill` components and the width of `flexibleWidth` ones. A `fixed` component
///   keeps its size inside the parent's frame: add `.sizing(.contain)` or `.sizing(.fill)` before `.frame`
///   when it should follow the frame instead.
///
/// One thing to know: if you fire a trigger that you also listen to, `onTrigger` hears your own fire.
struct RiveComponentView: View {
    private let component: RiveComponent
    private let values: [String: RiveValue]
    private let triggers: [String]
    private let onTrigger: ((String) -> Void)?
    private var extraOutTriggers: [String] = []
    private var sizingOverride: RiveSizing?

    @StateObject private var model = RiveComponentModel()
    @Environment(\.riveLibrary) private var library

    init(
        _ component: RiveComponent,
        values: [String: RiveValue] = [:],
        triggers: [String] = [],
        onTrigger: ((String) -> Void)? = nil
    ) {
        self.component = component
        self.values = values
        self.triggers = triggers
        self.onTrigger = onTrigger
    }

    /// Also listens to `out` triggers that the contract does not list for this component.
    func listening(to outTriggers: [String]) -> RiveComponentView {
        var copy = self
        copy.extraOutTriggers = outTriggers
        return copy
    }

    /// Uses this sizing instead of the component's own, for example `.sizing(.contain).frame(width: 96, height: 54)`.
    func sizing(_ sizing: RiveSizing) -> RiveComponentView {
        var copy = self
        copy.sizingOverride = sizing
        return copy
    }

    var body: some View {
        let request = RiveComponentRequest(component: component, extraOutTriggers: extraOutTriggers, sizing: sizingOverride)
        let sized = model.sizedAs(request, in: library)
        content
            .modifier(RiveSizingModifier(designSize: sized.contract.designSize, sizing: request.sizing(for: sized)))
            .onChange(of: request, initial: true) { _, new in model.load(new, from: library) }
            .onChange(of: values, initial: true) { _, new in model.setValues(new) }
            .onChange(of: triggers) { old, new in model.fire(RiveTriggerRequest.namesToFire(old: old, new: new)) }
            .onReceive(model.firedTriggers) { name in onTrigger?(name) }
    }

    @ViewBuilder private var content: some View {
        switch model.phase {
        case .ready:
            RiveUIViewRepresentable(rive: model.rive).semantics(.automatic)
        case .loading:
            SwiftUI.Color.clear
        case .unavailable:
            RivePlaceholder(name: component.rawValue, onTap: placeholderTap)
        }
    }

    /// Lets a placeholder stand in for a component with a single `out` trigger (a button, a toggle).
    private var placeholderTap: (() -> Void)? {
        let outTriggers = component.contract.outTriggers
        guard let onTrigger, outTriggers.count == 1, let only = outTriggers.first else { return nil }
        return { onTrigger(only) }
    }
}

extension EnvironmentValues {
    /// Where `RiveComponentView` loads its files from. Nil means `RiveLibrary.shared`.
    /// Tests and previews set it to a library over another bundle: `.environment(\.riveLibrary, library)`.
    var riveLibrary: RiveLibrary? {
        get { self[RiveLibraryKey.self] }
        set { self[RiveLibraryKey.self] = newValue }
    }
}

private struct RiveLibraryKey: EnvironmentKey {
    static let defaultValue: RiveLibrary? = nil
}

/// Applies a component's sizing rule. Ideal sizes are the design size, so a scroll view lays it out sensibly.
private struct RiveSizingModifier: ViewModifier {
    let designSize: CGSize
    let sizing: RiveSizing

    func body(content: Content) -> some View {
        let width = designSize.width
        let height = designSize.height
        if width <= 0 || height <= 0 {
            content.frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            switch sizing {
            case .fixed:
                content.frame(width: width, height: height)
            case .flexibleWidth:
                content.frame(idealWidth: width, maxWidth: .infinity).frame(height: height)
            case .contain:
                content.aspectRatio(width / height, contentMode: .fit).frame(idealWidth: width, idealHeight: height)
            case .fill:
                content.frame(idealWidth: width, maxWidth: .infinity, idealHeight: height, maxHeight: .infinity)
            }
        }
    }
}

/// Drawn when a component cannot be loaded: a rounded pale-mint block with the component's name.
private struct RivePlaceholder: View {
    let name: String
    let onTap: (() -> Void)?

    var body: some View {
        RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous)
            .fill(SisuTheme.Color.green100)
            .overlay {
                Text(name)
                    .font(SisuTheme.Font.caption)
                    .foregroundStyle(SisuTheme.Color.green900)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .padding(.horizontal, SisuTheme.Spacing.grid)
            }
            .contentShape(Rectangle())
            .onTapGesture { onTap?() }
            .allowsHitTesting(onTap != nil)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(name)
            .accessibilityAddTraits(onTap == nil ? [] : .isButton)
    }
}
