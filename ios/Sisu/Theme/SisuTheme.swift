// Colours, type, spacing and radii from ios/BRAND.md (light look and glass rules of 2026-11-14). Style the app with these and nothing else.
// Type weights come from the full kit (brand/tokens.json on the brand-kit branch), which BRAND.md summarises.
import SwiftUI
import UIKit

enum SisuTheme {
    /// The palette. The `green…`, `neutral…` and signal colours are fixed; the role colours below them
    /// (`background`, `card`, `text`, …) switch between light and dark mode.
    enum Color {
        static let green900 = SwiftUI.Color(hex: 0x004628)
        static let green700 = SwiftUI.Color(hex: 0x007841)
        static let green500 = SwiftUI.Color(hex: 0x00AA46)
        static let green300 = SwiftUI.Color(hex: 0x99D59F)
        static let green200 = SwiftUI.Color(hex: 0x91FA9B)
        static let green100 = SwiftUI.Color(hex: 0xD2FCD5)
        static let green50 = SwiftUI.Color(hex: 0xEBF7EC)
        static let green25 = SwiftUI.Color(hex: 0xF7FCF7)
        static let white = SwiftUI.Color(hex: 0xFFFFFF)

        static let neutral900 = SwiftUI.Color(hex: 0x1F1F1F)
        static let neutral600 = SwiftUI.Color(hex: 0x666666)
        static let neutral400 = SwiftUI.Color(hex: 0x949494)
        static let neutral200 = SwiftUI.Color(hex: 0xE6E6E6)

        /// Streak flame and heads-up notes only.
        static let amberBackground = SwiftUI.Color(hex: 0xFFF1D8)
        static let amberMark = SwiftUI.Color(hex: 0xCF8300)
        static let amberText = SwiftUI.Color(hex: 0x885600)
        /// Tips.
        static let infoBackground = SwiftUI.Color(hex: 0xE0F4FF)
        static let infoText = SwiftUI.Color(hex: 0x006E87)
        /// Failed actions only. Spending is never red.
        static let errorBackground = SwiftUI.Color(hex: 0xFFEDED)
        static let errorText = SwiftUI.Color(hex: 0xB70000)

        /// Dark mode only.
        static let darkBackground = SwiftUI.Color(hex: 0x00301B)
        static let darkOutline = SwiftUI.Color(hex: 0x1B6B43)

        // Roles: light value, dark value.
        // The light look (2026-11-14): a near-white screen, white cards with a hairline, dark readable text.
        // S-Pankki green is kept for the primary action, selected states, progress and the basket colours.
        /// The screen, sheets and the launch screen: a near-white with a hint of green-grey.
        static let background = SwiftUI.Color(light: 0xF6F8F7, dark: 0x00301B)
        static let card = SwiftUI.Color(light: 0xFFFFFF, dark: 0x004628)
        /// The hairline that separates a white card from the near-white screen. No shadows.
        static let hairline = SwiftUI.Color(light: 0xE3E8E5, dark: 0x1B6B43)
        /// The 4 pt bottom edge of a pressable white card.
        static let pressEdge = SwiftUI.Color(light: 0xDCE3DF, dark: 0x1B6B43)
        /// A text field's fill on a white card.
        static let inputFill = SwiftUI.Color(light: 0xF6F8F7, dark: 0x00301B)
        static let outline = SwiftUI.Color(light: 0x99D59F, dark: 0x1B6B43)
        static let text = SwiftUI.Color(light: 0x18211C, dark: 0xF7FCF7)
        static let textMuted = SwiftUI.Color(light: 0x5E6662, dark: 0x99D59F)
        /// The primary button: deep green with a white label, mint with a dark label in dark mode.
        static let primary = SwiftUI.Color(light: 0x007841, dark: 0x91FA9B)
        static let onPrimary = SwiftUI.Color(light: 0xFFFFFF, dark: 0x00301B)

        // The glass tab bar.
        /// The selected tab's icon and label.
        static let tabSelected = SwiftUI.Color(light: 0x004628, dark: 0x91FA9B)
        /// An unselected tab's icon and label: dark enough to read over scrolling content behind the glass.
        static let tabIdle = SwiftUI.Color(light: 0x3B4440, dark: 0xD2FCD5)
        /// The soft green of the selected-tab pill (glass tint, at a low opacity).
        static let selectionTint = SwiftUI.Color(light: 0x00AA46, dark: 0x91FA9B)
        /// The selected-tab pill where there is no glass (iOS 17 to 25, Reduce Transparency).
        static let selectionFill = SwiftUI.Color(light: 0xDDF3E2, dark: 0x1B6B43)
        /// The bar with Reduce Transparency on: a solid near-white surface.
        static let barSolid = SwiftUI.Color(light: 0xFCFDFC, dark: 0x004628)

        // Baskets, dark to light. Always shown with an icon and a label.
        static let basketFixed = green900
        static let basketCurveballs = green700
        static let basketLeaks = green500
        static let basketJars = green200
    }

    /// Fonts by PostScript name (checked with CoreText against the files in Resources/Fonts).
    /// Sizes are the brand's point sizes and scale with Dynamic Type.
    enum Font {
        static let bricolageExtraBold = "BricolageGrotesque-ExtraBold"
        static let bricolageBold = "BricolageGrotesque-Bold"
        static let figtreeRegular = "Figtree-Regular"
        static let figtreeSemiBold = "Figtree-SemiBold"
        static let figtreeBold = "Figtree-Bold"

        /// Every PostScript name the app uses. All five must be listed under `UIAppFonts` in project.yml.
        static let postScriptNames = [bricolageExtraBold, bricolageBold, figtreeRegular, figtreeSemiBold, figtreeBold]

        static let hero = SwiftUI.Font.custom(bricolageExtraBold, size: 64, relativeTo: .largeTitle)
        static let display = SwiftUI.Font.custom(bricolageExtraBold, size: 40, relativeTo: .largeTitle)
        static let h1 = SwiftUI.Font.custom(bricolageExtraBold, size: 32, relativeTo: .title)
        static let h2 = SwiftUI.Font.custom(bricolageBold, size: 24, relativeTo: .title2)
        static let h3 = SwiftUI.Font.custom(figtreeBold, size: 20, relativeTo: .title3)
        static let bodyLarge = SwiftUI.Font.custom(figtreeRegular, size: 18, relativeTo: .body)
        static let body = SwiftUI.Font.custom(figtreeRegular, size: 16, relativeTo: .body)
        static let label = SwiftUI.Font.custom(figtreeSemiBold, size: 14, relativeTo: .subheadline)
        static let caption = SwiftUI.Font.custom(figtreeSemiBold, size: 12, relativeTo: .caption)
        static let button = SwiftUI.Font.custom(figtreeBold, size: 17, relativeTo: .headline)
    }

    /// Layout distances in points. Everything sits on the 4 pt grid.
    enum Spacing {
        static let grid: CGFloat = 4
        /// Left and right screen margin.
        static let margin: CGFloat = 20
        /// Between two cards.
        static let card: CGFloat = 16
        /// Between two sections.
        static let section: CGFloat = 32
        /// Room under a screen's last row so it scrolls clear of the floating tab bar (added on top of the
        /// safe-area inset the bar already makes).
        static let tabBarClearance: CGFloat = 16
        /// The smallest touch target.
        static let touchTarget: CGFloat = 48
        /// The darker bottom edge of anything pressable.
        static let pressEdge: CGFloat = 4
    }

    /// Corner radii in points. Nothing is square; pills use `Capsule()`.
    enum Radius {
        static let button: CGFloat = 18
        static let card: CGFloat = 24
        static let sheet: CGFloat = 32
        static let hero: CGFloat = 32
    }

    /// The floating glass tab bar: a capsule above the home indicator with a moving selection pill.
    enum TabBar {
        /// The bar's height, pill included.
        static let height: CGFloat = 64
        /// The gap between the bar's edge and the selection pill.
        static let inset: CGFloat = 5
        /// The bar's distance from the screen's sides.
        static let sideMargin: CGFloat = 20
        /// Where the bar's bottom edge sits relative to the bottom safe-area edge. Negative: a little into the home
        /// indicator's band, like the system's floating bar, still about 12 pt above the indicator itself.
        static let lift: CGFloat = -10
        static let icon: CGFloat = 20
        /// Label size: Figtree SemiBold, scales with Dynamic Type up to a cap so the bar keeps its shape.
        static let label = SwiftUI.Font.custom(Font.figtreeSemiBold, size: 12, relativeTo: .caption2)
        static let labelSelected = SwiftUI.Font.custom(Font.figtreeBold, size: 12, relativeTo: .caption2)
    }
}

extension SwiftUI.Color {
    /// A colour from a hex number such as `0x004628`.
    init(hex: UInt32, opacity: Double = 1) {
        self.init(uiColor: UIColor(hex: hex, alpha: opacity))
    }

    /// A colour that follows the light or dark appearance.
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light, alpha: 1)
        })
    }
}

private extension UIColor {
    convenience init(hex: UInt32, alpha: Double) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: CGFloat(alpha)
        )
    }
}
