// The teaching path: which lessons are done, the berries they earned, and what the path screen shows.
// Pure and Codable; the app keeps one `LessonProgress` per customer in UserDefaults.
import Foundation

/// The lessons a customer has finished. A lesson counts once; berries only ever go up.
public struct LessonProgress: Codable, Equatable, Sendable {
    /// Berries for one finished lesson.
    public static let reward = 15

    /// Concept ids (`three-baskets`…) in the order they were finished.
    public private(set) var done: [String]
    public private(set) var berries: Int

    public init() {
        done = []
        berries = 0
    }

    public func isDone(_ concept: ConceptId) -> Bool { done.contains(concept.rawValue) }

    /// Marks a lesson finished. Returns the berries earned now: `reward` the first time, 0 after that.
    @discardableResult
    public mutating func complete(_ concept: ConceptId) -> Int {
        guard !isDone(concept) else { return 0 }
        done.append(concept.rawValue)
        berries += Self.reward
        return Self.reward
    }

    /// How many of these lessons are done.
    public func doneCount(of concepts: [ConceptId]) -> Int {
        concepts.filter(isDone).count
    }

    /// The lesson the path suggests: the first one not done. Nil when all are done.
    public func next(in concepts: [ConceptId]) -> ConceptId? {
        concepts.first { !isDone($0) }
    }

    /// True when every one of these lessons is done.
    public func allDone(_ concepts: [ConceptId]) -> Bool {
        !concepts.isEmpty && concepts.allSatisfy(isDone)
    }
}

/// One round node on the path.
public struct LessonNode: Equatable, Sendable, Identifiable {
    public enum State: String, Equatable, Sendable { case done, current, upcoming }

    public var id: String { concept.rawValue }
    public let concept: ConceptId
    public let title: String
    public let state: State
    /// Its place along the path, 0 based.
    public let index: Int
    /// Sideways offset of the winding path, from -1 (left) to 1 (right).
    public let sway: Double

    /// The short text inside the node's sticker: `Done`, or `Lesson 4`.
    public var badge: String { state == .done ? "Done" : "Lesson \(index + 1)" }

    /// The node's accessibility label, for example `Lesson 2 of 7, Safe to spend, done`.
    public func accessibilityLabel(total: Int) -> String {
        let status: String
        switch state {
        case .done: status = "done"
        case .current: status = "next up"
        case .upcoming: status = "not started"
        }
        return "Lesson \(index + 1) of \(total), \(title), \(status)"
    }
}

/// What the path screen shows.
public enum LessonPathPresenter {
    /// The winding shape: centre, right, further right, right, centre, left, further left… repeating.
    static let swayPattern: [Double] = [0, 0.5, 0.85, 0.5, 0, -0.5, -0.85, -0.5]

    /// The nodes, in the order of the cards.
    public static func nodes(_ cards: [TeachingCard], progress: LessonProgress) -> [LessonNode] {
        let next = progress.next(in: cards.map(\.concept))
        return cards.enumerated().map { index, card in
            let state: LessonNode.State = progress.isDone(card.concept) ? .done : card.concept == next ? .current : .upcoming
            return LessonNode(concept: card.concept, title: card.title, state: state, index: index,
                              sway: swayPattern[index % swayPattern.count])
        }
    }

    /// `3 of 7 done`.
    public static func progressText(_ cards: [TeachingCard], progress: LessonProgress) -> String {
        "\(progress.doneCount(of: cards.map(\.concept))) of \(cards.count) done"
    }

    /// The share done, 0...1, for the Rive `ProgressBar`.
    public static func fraction(_ cards: [TeachingCard], progress: LessonProgress) -> Double {
        guard !cards.isEmpty else { return 0 }
        return Double(progress.doneCount(of: cards.map(\.concept))) / Double(cards.count)
    }

    /// The berries pill: the day's berries plus those the lessons earned.
    public static func berriesText(daily: DailyProgress, lessons: LessonProgress) -> String {
        "\(daily.berries + lessons.berries)"
    }

    /// The line under the path's title.
    public static func subtitle(_ cards: [TeachingCard], progress: LessonProgress) -> String {
        if progress.allDone(cards.map(\.concept)) { return "Every lesson done. Open any one again." }
        return "Short lessons built from your own numbers. Any order is fine."
    }

    /// `+15 berries` on the Done step, or nil when this lesson was already counted.
    public static func rewardText(earned: Int) -> String? {
        earned > 0 ? "+\(earned) berries" : nil
    }

    /// The celebration after the last lesson.
    public static func celebration(_ cards: [TeachingCard]) -> (headline: String, detail: String) {
        ("Path complete.", "All \(cards.count) lessons done. Liito is proud of you.")
    }

    /// The quiz feedback line. It praises the guess and never blames a miss.
    public static func feedback(_ quiz: TeachingQuiz) -> String? {
        guard let correct = quiz.isCorrect else { return nil }
        return correct ? "Spot on." : "Close. Here is how it works out for you."
    }

    /// The empty state, when the backend has no cards for this customer.
    public static let emptyText = "No lessons for this profile yet. Try again in a moment."
}
