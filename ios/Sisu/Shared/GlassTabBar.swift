// The floating tab bar: one translucent capsule for Today, Ask, Jars and Path, with a softly green-tinted pill
// under the selected tab that springs to the new tab. Liquid Glass on iOS 26 (glassEffect, a
// GlassEffectContainer and glassEffectID for the moving pill); a system-material capsule on iOS 17 to 25; a
// solid near-white capsule with a hairline when Reduce Transparency is on.
//
// Why not the system TabView: on iOS 26 it floats as a glass capsule too, but its selection lens is a neutral
// grey highlight that cannot be tinted green (`.tint` only colours the selected icon and label), its labels
// cannot use Figtree, and on iOS 17 to 25 it is the old flat full-width bar. Routing stays on `AppModel.tab`.
import SwiftUI

struct GlassTabBar: View {
    @Binding var selection: AppTab

    @Namespace private var pillSpace
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    static let titles: [AppTab: String] = [.today: "Today", .ask: "Ask", .jars: "Jars", .path: "Path"]

    var body: some View {
        surface
            .frame(height: SisuTheme.TabBar.height)
            .padding(.horizontal, SisuTheme.TabBar.sideMargin)
            .dynamicTypeSize(...DynamicTypeSize.xLarge)
            .onChange(of: selection) { _, tab in
                withAnimation(motion) { pillIndex = tab.rawValue }
            }
            .sensoryFeedback(.selection, trigger: selection)
            .accessibilityElement(children: .contain)
            .accessibilityAddTraits(.isTabBar)
            .accessibilityLabel("Tabs")
            .accessibilityIdentifier("tabbar")
    }

    /// The pill's position: follows `selection` inside an explicit animation, whoever changes the tab.
    @State private var pillIndex: Int

    init(selection: Binding<AppTab>) {
        _selection = selection
        _pillIndex = State(initialValue: selection.wrappedValue.rawValue)
    }

    /// The pill springs to the new tab; with Reduce Motion it slides there without the spring.
    private var motion: Animation {
        let scale = TabMotionLaunch.scale
        return reduceMotion ? .easeInOut(duration: 0.2 * scale) : .spring(response: 0.4 * scale, dampingFraction: 0.74)
    }

    // MARK: Surfaces

    @ViewBuilder private var surface: some View {
        if reduceTransparency || TabMotionLaunch.solid {
            ZStack { pills { SolidPill() }; labels }
                .padding(SisuTheme.TabBar.inset)
                .background(SisuTheme.Color.barSolid, in: Capsule())
                .overlay(Capsule().strokeBorder(SisuTheme.Color.hairline, lineWidth: 1))
        } else if #available(iOS 26.0, *) {
            ZStack {
                // The pill's glass is composited by its container: keep the labels outside it, on top, so the
                // glass never blurs the selected tab's icon and label.
                GlassEffectContainer(spacing: 0) { pills { GlassPill(namespace: pillSpace) } }
                labels
            }
            .padding(SisuTheme.TabBar.inset)
            .background {
                // The bar's own glass sits under the pill's container, so the pill does not melt into it.
                Capsule().fill(.clear).glassEffect(.regular, in: Capsule())
            }
        } else {
            ZStack { pills { SolidPill() }; labels }
                .padding(SisuTheme.TabBar.inset)
                .background(.regularMaterial, in: Capsule())
                .overlay(Capsule().strokeBorder(SisuTheme.Color.hairline.opacity(0.8), lineWidth: 0.5))
                .shadow(color: SisuTheme.Color.text.opacity(0.08), radius: 16, y: 6)
        }
    }

    /// The one pill, slid under the selected tab. A single view that moves (rather than one per tab that
    /// appears and disappears) keeps the motion a plain, interruptible spring.
    private func pills<Pill: View>(@ViewBuilder pill: @escaping () -> Pill) -> some View {
        GeometryReader { geometry in
            let width = geometry.size.width / CGFloat(AppTab.allCases.count)
            pill()
                .frame(width: width, height: geometry.size.height)
                .offset(x: width * CGFloat(pillIndex))
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private var labels: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases) { tab in
                TabItem(tab: tab, title: Self.titles[tab] ?? "", selected: selection == tab,
                        highlighted: pillIndex == tab.rawValue) { select(tab) }
            }
        }
    }

    private func select(_ tab: AppTab) {
        guard tab != selection else { return }
        let delay = TabMotionLaunch.delay
        if delay > 0 {
            // Screenshot harness only: switch a moment after the tap, so the test can film the pill moving
            // (XCUITest waits for every animation to end before a tap returns).
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(delay))
                selection = tab
            }
        } else {
            selection = tab
        }
    }
}

// MARK: - One tab

private struct TabItem: View {
    let tab: AppTab
    let title: String
    /// Selected for VoiceOver: follows the tab at once.
    let selected: Bool
    /// Drawn as selected: follows the pill, so the colours change as it arrives.
    let highlighted: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                TabIcon(tab: tab, selected: highlighted)
                    .frame(width: 28, height: 26)
                Text(title)
                    .font(highlighted ? SisuTheme.TabBar.labelSelected : SisuTheme.TabBar.label)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(highlighted ? SisuTheme.Color.tabSelected : SisuTheme.Color.tabIdle)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier("tab.\(title.lowercased())")
        .accessibilityShowsLargeContentViewer {
            TabIcon(tab: tab, selected: selected)
            Text(title)
        }
    }
}

/// SF Symbols for Today, Ask and Path (outline when idle, filled when selected), and a drawn jar for Jars,
/// because SF Symbols has no jar and the jar is the brand's own savings picture.
private struct TabIcon: View {
    let tab: AppTab
    let selected: Bool

    var body: some View {
        switch tab {
        case .today: symbol("sun.max")
        case .ask: symbol("bubble.left")
        case .jars: JarGlyph(filled: selected).frame(width: 18, height: 21)
        case .path: symbol("flag")
        }
    }

    private func symbol(_ name: String) -> some View {
        Image(systemName: selected ? name + ".fill" : name)
            .font(.system(size: SisuTheme.TabBar.icon, weight: .semibold))
            .imageScale(.medium)
            .accessibilityHidden(true)
    }
}

/// A jar with a lid, drawn to sit with the SF Symbols at the same weight.
private struct JarGlyph: View {
    let filled: Bool

    var body: some View {
        GeometryReader { geometry in
            let w = geometry.size.width, h = geometry.size.height
            let line: CGFloat = 2
            let lid = CGRect(x: w * 0.16, y: 0, width: w * 0.68, height: h * 0.2)
            let jar = CGRect(x: 0, y: h * 0.28, width: w, height: h * 0.72)
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: lid.height / 2, style: .continuous)
                    .fill(.foreground)
                    .frame(width: lid.width, height: lid.height)
                    .offset(x: lid.minX, y: lid.minY)
                Group {
                    if filled {
                        RoundedRectangle(cornerRadius: w * 0.3, style: .continuous).fill(.foreground)
                    } else {
                        RoundedRectangle(cornerRadius: w * 0.3, style: .continuous)
                            .strokeBorder(.foreground, lineWidth: line)
                    }
                }
                .frame(width: jar.width, height: jar.height)
                .offset(x: jar.minX, y: jar.minY)
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Pills

/// iOS 26: a green-tinted, interactive glass pill. Its glassEffectID keeps its identity in the container while
/// it slides from tab to tab.
@available(iOS 26.0, *)
private struct GlassPill: View {
    let namespace: Namespace.ID

    var body: some View {
        Capsule()
            .fill(.clear)
            .glassEffect(.regular.tint(SisuTheme.Color.selectionTint.opacity(0.28)).interactive(), in: Capsule())
            .glassEffectID("tab-pill", in: namespace)
    }
}

/// iOS 17 to 25 and Reduce Transparency: a solid soft-green pill that slides from tab to tab.
private struct SolidPill: View {
    var body: some View {
        Capsule().fill(SisuTheme.Color.selectionFill)
    }
}

// MARK: - Screenshot harness hooks

/// Launch arguments for filming the pill (GlassScreenshotTests.testTabPillMotionFrames):
///   -sisu.tabMotion <scale>   multiplies the pill's animation time (slow motion for frame capture)
///   -sisu.tabDelay <seconds>  applies a tapped tab this long after the tap
///   -sisu.solidBar 1          draws the bar as with Reduce Transparency (which a UI test cannot switch on)
enum TabMotionLaunch {
    static let solid: Bool = value("-sisu.solidBar") == 1
    static let scale: Double = value("-sisu.tabMotion").map { max($0, 0.1) } ?? 1
    static let delay: Double = value("-sisu.tabDelay").map { max($0, 0) } ?? 0

    private static func value(_ name: String) -> Double? {
        let arguments = ProcessInfo.processInfo.arguments
        guard let index = arguments.firstIndex(of: name), index + 1 < arguments.count else { return nil }
        return Double(arguments[index + 1])
    }
}
