// Pure presentation helpers: formatting, basket shares and what the hero block says.
import Foundation

public enum SisuLanguage: String, Codable, CaseIterable, Sendable {
    case en, fi
}

/// Formats euro amounts the way the brand asks.
///
/// English: symbol first, comma groups, dot decimals: `€64`, `€1,234`, `€1,234.50`.
/// Finnish: number first, a no-break space (U+00A0) between groups and before the sign, comma decimals:
/// `64 €`, `1 234 €`, `1 234,50 €` (the spaces shown here are U+00A0).
/// Negative amounts start with a real minus sign (U+2212), before the symbol in English: `−€12`, `−12 €`.
/// With `decimals: false` the amount is rounded to whole euros, halves away from zero. With `decimals: true`
/// it always shows two decimals. A value that rounds to zero is never shown as negative.
public enum Money {
    public static func format(_ amount: Double, language: SisuLanguage, decimals: Bool = false) -> String {
        "" // scaffold stub
    }
}

/// Formats an ISO date (`2026-11-13`, or a date-time that starts with one) for display.
/// English: `13 Nov 2026`. Finnish: `13.11.2026`. Anything that does not start with a valid date is returned
/// unchanged.
public enum Dates {
    public static func short(_ iso: String, language: SisuLanguage) -> String {
        iso // scaffold stub
    }
}

/// The four things the basket bar shows: the three spending baskets and savings ("Jars").
public enum BasketKind: String, Codable, CaseIterable, Sendable {
    case fixed, curveballs, leaks, jars

    /// The display name. English: Fixed, Curveballs, Leaks, Jars. Finnish: Kiinteät, Yllärit, Vuodot, Purkit.
    public func label(_ language: SisuLanguage) -> String {
        rawValue // scaffold stub
    }
}

public extension BasketId {
    /// `regular` is Fixed, `irregular` is Curveballs, `everyday` is Leaks.
    var kind: BasketKind {
        switch self {
        case .regular: return .fixed
        case .irregular: return .curveballs
        case .everyday: return .leaks
        }
    }
}

/// Shares of the basket bar, each 0...1.
public struct BasketShares: Equatable, Sendable {
    public var fixed: Double
    public var curveballs: Double
    public var leaks: Double
    public var jars: Double

    public init(fixed: Double, curveballs: Double, leaks: Double, jars: Double) {
        self.fixed = fixed; self.curveballs = curveballs; self.leaks = leaks; self.jars = jars
    }

    public static let zero = BasketShares(fixed: 0, curveballs: 0, leaks: 0, jars: 0)
}

public enum BasketMath {
    /// The bar's shares for a customer: the `monthlyAvg` of each of the three baskets and `monthlySaved` as
    /// Jars, each divided by their sum. Negative or non-finite amounts count as 0, and a missing basket counts
    /// as 0. When the sum is 0 the result is `.zero`. Otherwise the four shares add up to 1.
    public static func shares(for overview: Overview) -> BasketShares {
        .zero // scaffold stub
    }
}

/// What the hero block on the X-ray screen says.
public struct HeroViewState: Equatable, Sendable {
    public enum Tone: String, Sendable { case room, above }

    public var eyebrow: String
    public var amount: String
    public var unit: String
    public var context: String
    public var tone: Tone

    public init(eyebrow: String, amount: String, unit: String, context: String, tone: Tone) {
        self.eyebrow = eyebrow; self.amount = amount; self.unit = unit; self.context = context; self.tone = tone
    }
}

public enum XrayPresenter {
    /// The safe-to-spend hero for a customer.
    ///
    /// - `eyebrow`: `Safe to spend` (fi `Käytettävissä`).
    /// - `amount`: `safeToSpend.perWeek` as whole euros with `Money.format`.
    /// - `unit`: `a week` (fi `viikossa`).
    /// - When `safeToSpend.gapPerMonth` is 0 or more, `tone` is `.room` and `context` is
    ///   `About <gap> a month under this. That is room to save.`
    ///   (fi `Noin <gap> kuukaudessa tämän alle. Siinä on tilaa säästää.`).
    /// - When it is below 0, `tone` is `.above` and `context` is
    ///   `About <gap> a month above this on everyday choices.`
    ///   (fi `Noin <gap> kuukaudessa tämän yli arjen valinnoissa.`).
    /// - `<gap>` is the absolute value of `gapPerMonth` as whole euros with `Money.format`. The copy never
    ///   blames: no "overspent" and no "too much".
    public static func hero(for overview: Overview, language: SisuLanguage) -> HeroViewState {
        HeroViewState(eyebrow: "", amount: "", unit: "", context: "", tone: .room) // scaffold stub
    }
}
