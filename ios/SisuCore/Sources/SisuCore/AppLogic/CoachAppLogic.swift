// Small pure rules the coach screen (Ask) needs that the rest of SisuCore does not have: berries for coach
// moments, which kind of bill a detected bill is, and Liito's mood while Sisu works.
import Foundation

/// Berries earned in the coach: answering a teaching question and deciding on an action. Each moment earns its
/// berries once (keyed by the card or action id), whatever the answer or decision. Berries are never taken away.
public struct CoachRewards: Codable, Equatable, Sendable {
    public enum Moment: String, Codable, Sendable {
        /// The user answered a predict-before-reveal question.
        case quizAnswered
        /// The user approved or declined an action.
        case actionDecided

        public var reward: Int {
            switch self {
            case .quizAnswered: return 5
            case .actionDecided: return 10
            }
        }
    }

    public private(set) var berries: Int
    public private(set) var awarded: Set<String>

    public init() {
        berries = 0
        awarded = []
    }

    /// Records the moment and returns the berries earned: the moment's reward the first time, 0 after that.
    @discardableResult
    public mutating func award(_ moment: Moment, id: String) -> Int {
        let key = moment.rawValue + "/" + id
        guard !awarded.contains(key) else { return 0 }
        awarded.insert(key)
        berries += moment.reward
        return moment.reward
    }

    /// `+5` for the label next to a quiz or action.
    public static func rewardText(_ moment: Moment) -> String { "+\(moment.reward)" }
}

public enum CoachBillMatch {
    /// The kind of bill Sisu can research offers for, from a detected bill's category and guessed name.
    /// Nil when it is none of electricity, mobile or internet.
    public static func billType(for bill: RecurringBill) -> BillType? {
        billType(text: bill.category + " " + bill.guessLabel)
    }

    /// The same rule on free text (a confirmed name such as `Helen sähkö`).
    public static func billType(text: String) -> BillType? {
        let words = text.lowercased()
        if ["electric", "sähkö", "sahko", "energia", "energy", "power"].contains(where: words.contains) { return .electricity }
        if ["internet", "broadband", "laajakaista", "fiber", "fibre", "valokuitu"].contains(where: words.contains) { return .internet }
        if ["mobile", "phone", "puhelin", "liittymä", "liittyma", "telecom", "telia", "elisa", "dna"].contains(where: words.contains) { return .mobile }
        return nil
    }
}

/// Liito's mood on the Ask screen. Never sad: it follows what Sisu is doing, not the user's money.
public enum CoachMood {
    /// - Parameters:
    ///   - isThinking: a turn is running.
    ///   - stageJustLanded: a stage card arrived in the last moment.
    ///   - celebrating: the user just approved an action.
    public static func liito(isThinking: Bool, stageJustLanded: Bool, celebrating: Bool) -> RiveBindings.LiitoMood {
        if celebrating { return .cheering }
        if stageJustLanded { return .found }
        if isThinking { return .thinking }
        return .idle
    }
}

/// The names of the research services as the brand writes them (the server sends `exa`, `context.dev`).
public enum CoachProviderName {
    public static func display(_ raw: String) -> String {
        switch raw.lowercased() {
        case "exa": return "Exa"
        case "context.dev", "contextdev": return "Context.dev"
        case "exa+context.dev": return "Exa and Context.dev"
        default: return raw
        }
    }
}
