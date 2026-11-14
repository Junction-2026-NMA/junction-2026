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
/// A value that is not a finite number gives a dash (`—`), never a crash.
public enum Money {
    static let minus = "\u{2212}"
    static let nbsp = "\u{00A0}"

    public static func format(_ amount: Double, language: SisuLanguage, decimals: Bool = false) -> String {
        guard amount.isFinite else { return "—" }
        let scaled = (abs(amount) * (decimals ? 100 : 1)).rounded(.toNearestOrAwayFromZero)
        guard scaled < 9.0e18 else { return "—" }
        let units = UInt64(scaled)
        let whole = decimals ? units / 100 : units
        let cents = units % 100
        let negative = amount < 0 && units > 0

        let groupSeparator = language == .en ? "," : nbsp
        var number = group(String(whole), separator: groupSeparator)
        if decimals {
            number += (language == .en ? "." : ",") + (cents < 10 ? "0\(cents)" : "\(cents)")
        }
        let sign = negative ? minus : ""
        switch language {
        case .en: return sign + "€" + number
        case .fi: return sign + number + nbsp + "€"
        }
    }

    /// The same as `format`, with a leading `+` for amounts above zero (for deltas such as `+€12`).
    public static func signed(_ amount: Double, language: SisuLanguage, decimals: Bool = false) -> String {
        let text = format(amount, language: language, decimals: decimals)
        return amount > 0 && !text.hasPrefix(minus) && text != format(0, language: language, decimals: decimals) ? "+" + text : text
    }

    static func group(_ digits: String, separator: String) -> String {
        var out = ""
        let chars = Array(digits)
        for (index, char) in chars.enumerated() {
            if index > 0 && (chars.count - index) % 3 == 0 { out += separator }
            out.append(char)
        }
        return out
    }
}

/// Formats an ISO date (`2026-11-13`, or a date-time that starts with one) for display.
/// English: `13 Nov 2026`. Finnish: `13.11.2026`. Anything that does not start with a valid date is returned
/// unchanged.
public enum Dates {
    static let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    public static func short(_ iso: String, language: SisuLanguage) -> String {
        guard let date = parseDate(Array(iso.unicodeScalars)) else { return iso }
        return text(year: date.year, month: date.month, day: date.day, language: language)
    }

    /// Formats an ISO 8601 moment (`2026-11-14T09:30:00Z`, with or without a fraction of a second, ending in
    /// `Z` or an offset such as `+02:00`) in the given time zone.
    /// English: `14 Nov 2026, 09:30`. Finnish: `14.11.2026 klo 9.30`. Any other text is returned unchanged.
    public static func shortDateTime(_ iso: String, language: SisuLanguage, timeZone: TimeZone) -> String {
        guard let moment = parseMoment(iso) else { return iso }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let parts = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: moment)
        guard let year = parts.year, let month = parts.month, let day = parts.day, let hour = parts.hour, let minute = parts.minute else { return iso }
        let date = text(year: year, month: month, day: day, language: language)
        let mm = minute < 10 ? "0\(minute)" : "\(minute)"
        switch language {
        case .en: return "\(date), \(hour < 10 ? "0\(hour)" : "\(hour)"):\(mm)"
        case .fi: return "\(date) klo \(hour).\(mm)"
        }
    }

    /// The moment an ISO 8601 date-time names, or nil when the text is not one.
    public static func parseMoment(_ iso: String) -> Date? {
        let s = Array(iso.unicodeScalars)
        guard let date = parseDate(s), s.count >= 20, s[10] == "T" || s[10] == "t",
              let hour = number(s, 11, 2), s[13] == ":", let minute = number(s, 14, 2), s[16] == ":", let second = number(s, 17, 2),
              hour <= 23, minute <= 59, second <= 60 else { return nil }
        var index = 19
        if s[index] == "." || s[index] == "," {
            index += 1
            let start = index
            while index < s.count, isDigit(s[index]) { index += 1 }
            guard index > start else { return nil }
        }
        guard index < s.count else { return nil }
        var offsetSeconds = 0
        if s[index] == "Z" || s[index] == "z" {
            guard index == s.count - 1 else { return nil }
        } else if s[index] == "+" || s[index] == "-" {
            let sign = s[index] == "+" ? 1 : -1
            let rest = Array(s[(index + 1)...])
            let oh: Int, om: Int
            if rest.count == 5, rest[2] == ":", let h = number(rest, 0, 2), let m = number(rest, 3, 2) { oh = h; om = m }
            else if rest.count == 4, let h = number(rest, 0, 2), let m = number(rest, 2, 2) { oh = h; om = m }
            else if rest.count == 2, let h = number(rest, 0, 2) { oh = h; om = 0 }
            else { return nil }
            guard oh <= 23, om <= 59 else { return nil }
            offsetSeconds = sign * (oh * 3600 + om * 60)
        } else {
            return nil
        }
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
        let parts = DateComponents(year: date.year, month: date.month, day: date.day, hour: hour, minute: minute, second: second)
        guard let local = utc.date(from: parts) else { return nil }
        return local.addingTimeInterval(TimeInterval(-offsetSeconds))
    }

    static func text(year: Int, month: Int, day: Int, language: SisuLanguage) -> String {
        switch language {
        case .en: return "\(day) \(months[month - 1]) \(year)"
        case .fi: return "\(day).\(month).\(year)"
        }
    }

    static func isDigit(_ scalar: Unicode.Scalar) -> Bool { scalar.value >= 48 && scalar.value <= 57 }

    static func number(_ s: [Unicode.Scalar], _ start: Int, _ length: Int) -> Int? {
        guard start + length <= s.count else { return nil }
        var value = 0
        for i in start..<(start + length) {
            guard isDigit(s[i]) else { return nil }
            value = value * 10 + Int(s[i].value - 48)
        }
        return value
    }

    static func parseDate(_ s: [Unicode.Scalar]) -> (year: Int, month: Int, day: Int)? {
        guard s.count >= 10, s[4] == "-", s[7] == "-",
              let year = number(s, 0, 4), let month = number(s, 5, 2), let day = number(s, 8, 2),
              (1...12).contains(month), day >= 1 else { return nil }
        let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
        let lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        guard day <= lengths[month - 1] else { return nil }
        return (year, month, day)
    }
}

/// The four things the basket bar shows: the three spending baskets and savings ("Jars").
public enum BasketKind: String, Codable, CaseIterable, Sendable {
    case fixed, curveballs, leaks, jars

    /// The display name. English: Fixed, Curveballs, Leaks, Jars. Finnish: Kiinteät, Yllärit, Vuodot, Purkit.
    public func label(_ language: SisuLanguage) -> String {
        switch (self, language) {
        case (.fixed, .en): return "Fixed"
        case (.curveballs, .en): return "Curveballs"
        case (.leaks, .en): return "Leaks"
        case (.jars, .en): return "Jars"
        case (.fixed, .fi): return "Kiinteät"
        case (.curveballs, .fi): return "Yllärit"
        case (.leaks, .fi): return "Vuodot"
        case (.jars, .fi): return "Purkit"
        }
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
        func amount(_ id: BasketId) -> Double {
            clean(overview.baskets.first(where: { $0.id == id })?.monthlyAvg ?? 0)
        }
        let fixed = amount(.regular), curveballs = amount(.irregular), leaks = amount(.everyday)
        let jars = clean(overview.monthlySaved)
        let sum = fixed + curveballs + leaks + jars
        guard sum > 0, sum.isFinite else { return .zero }
        return BasketShares(fixed: fixed / sum, curveballs: curveballs / sum, leaks: leaks / sum, jars: jars / sum)
    }

    static func clean(_ value: Double) -> Double { value.isFinite && value > 0 ? value : 0 }
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
        let safe = overview.safeToSpend
        let gap = Money.format(abs(safe.gapPerMonth), language: language)
        let room = !(safe.gapPerMonth < 0)
        let context: String
        switch (room, language) {
        case (true, .en): context = "About \(gap) a month under this. That is room to save."
        case (true, .fi): context = "Noin \(gap) kuukaudessa tämän alle. Siinä on tilaa säästää."
        case (false, .en): context = "About \(gap) a month above this on everyday choices."
        case (false, .fi): context = "Noin \(gap) kuukaudessa tämän yli arjen valinnoissa."
        }
        return HeroViewState(
            eyebrow: language == .en ? "Safe to spend" : "Käytettävissä",
            amount: Money.format(safe.perWeek, language: language),
            unit: language == .en ? "a week" : "viikossa",
            context: context,
            tone: room ? .room : .above
        )
    }
}
