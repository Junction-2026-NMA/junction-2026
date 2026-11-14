// The Duolingo loop: three small actions a day, a streak of days the app was opened, and berries for effort.
// Pure: the day is injected, so it is tested without a clock. The app stores `DailyProgress` in UserDefaults.
import Foundation

/// The three small actions on the Today screen.
public enum DailyAction: String, Codable, CaseIterable, Sendable {
    /// Done by opening the app.
    case checkIn
    /// Confirm or correct the name of the flagged bill.
    case confirmBill
    /// Let Sisu look into your finances (the Ask tab).
    case investigate

    /// Berries earned the first time the action is done on a day.
    public var reward: Int {
        switch self {
        case .checkIn: return 5
        case .confirmBill: return 10
        case .investigate: return 15
        }
    }

    /// The title shown on the action's row.
    public var title: String {
        switch self {
        case .checkIn: return "Check in"
        case .confirmBill: return "Confirm your bill's name"
        case .investigate: return "Let Sisu look into it"
        }
    }

    /// The reward as the row shows it: `+5`.
    public var rewardText: String { "+\(reward)" }
}

/// A calendar day as `yyyy-MM-dd`, so it stores and compares simply.
public struct DayStamp: Codable, Equatable, Hashable, Comparable, Sendable {
    public let year: Int
    public let month: Int
    public let day: Int

    public init(year: Int, month: Int, day: Int) {
        self.year = year; self.month = month; self.day = day
    }

    /// The day `date` falls on in `calendar` (pass the user's calendar and time zone).
    public init(_ date: Date, calendar: Calendar) {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        self.init(year: parts.year ?? 0, month: parts.month ?? 0, day: parts.day ?? 0)
    }

    /// The days from `self` to `other` (positive when `other` is later), in the Gregorian calendar.
    public func days(until other: DayStamp) -> Int {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        guard let a = calendar.date(from: DateComponents(year: year, month: month, day: day)),
              let b = calendar.date(from: DateComponents(year: other.year, month: other.month, day: other.day))
        else { return 0 }
        return calendar.dateComponents([.day], from: a, to: b).day ?? 0
    }

    public static func < (lhs: DayStamp, rhs: DayStamp) -> Bool {
        (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
    }
}

/// Streak, berries and today's actions.
///
/// - A day counts once for the streak, however often the app is opened.
/// - The streak grows by one when the last active day was yesterday, and starts again at 1 after a gap.
/// - Each action earns its berries once per day. Berries are never taken away, not even when the streak restarts.
/// - A new state starts honestly: streak 0, 0 berries, nothing done. The first check-in makes it day 1.
public struct DailyProgress: Codable, Equatable, Sendable {
    public private(set) var streakDays: Int
    public private(set) var berries: Int
    /// The last day an action was done. Nil before the first one.
    public private(set) var lastActiveDay: DayStamp?
    /// The actions done on `lastActiveDay`.
    public private(set) var doneOnLastDay: Set<DailyAction>

    public init() {
        streakDays = 0; berries = 0; lastActiveDay = nil; doneOnLastDay = []
    }

    /// The actions already done on `day`.
    public func done(on day: DayStamp) -> Set<DailyAction> {
        lastActiveDay == day ? doneOnLastDay : []
    }

    /// The share of today's actions done, 0...1, for the progress bar.
    public func progress(on day: DayStamp) -> Double {
        Double(done(on: day).count) / Double(DailyAction.allCases.count)
    }

    /// Records `action` on `day` and returns the berries earned (0 when it was already done that day).
    /// Completing any action also counts the day for the streak. A day earlier than the last active day
    /// (a clock set back) changes nothing.
    @discardableResult
    public mutating func complete(_ action: DailyAction, on day: DayStamp) -> Int {
        if let last = lastActiveDay {
            if day < last { return 0 }
            if day != last {
                streakDays = last.days(until: day) == 1 ? streakDays + 1 : 1
                lastActiveDay = day
                doneOnLastDay = []
            }
        } else {
            streakDays = 1
            lastActiveDay = day
            doneOnLastDay = []
        }
        guard !doneOnLastDay.contains(action) else { return 0 }
        doneOnLastDay.insert(action)
        berries += action.reward
        return action.reward
    }

    /// The berries earned on `day` (the rewards of the actions done that day).
    public func berriesEarned(on day: DayStamp) -> Int {
        done(on: day).reduce(0) { $0 + $1.reward }
    }

    /// True when every daily action is done on `day`.
    public func allDone(on day: DayStamp) -> Bool {
        done(on: day).count == DailyAction.allCases.count
    }

    /// The celebration when the last of today's actions is done: a headline and a detail line.
    public func celebration(on day: DayStamp) -> (headline: String, detail: String)? {
        guard allDone(on: day) else { return nil }
        let days = streakDays == 1 ? "Day 1 of your streak." : "\(streakDays) days in a row."
        return ("Three for three.", "\(berriesEarned(on: day)) berries today. \(days)")
    }

    /// The streak as the pill shows it: `1`.
    public var streakText: String { "\(streakDays)" }
    /// The berries as the pill shows them: `15`.
    public var berriesText: String { "\(berries)" }
}
