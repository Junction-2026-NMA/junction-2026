// The teaching path's data: the seven teaching cards (live from the backend, or the bundled sample), the
// lessons done per customer (kept in UserDefaults), and the lesson that is open. Logic is in SisuCore's
// LessonProgress and LessonPathPresenter; this only loads, stores and remembers what is on screen.
import Foundation
import Observation
import SisuCore

/// The lesson the sheet shows.
struct OpenLesson: Identifiable {
    let card: TeachingCard
    var id: String { card.id }
}

@MainActor
@Observable
final class PathModel {
    enum State: Equatable {
        case idle, loading, loaded, empty
        case failed(String)
    }

    private(set) var state: State = .idle
    private(set) var cards: [TeachingCard] = []
    private(set) var progress = LessonProgress()
    /// `Sample data` or `Mock data`; nil when the cards are live.
    private(set) var dataTag: String?
    /// The lesson sheet.
    var openLesson: OpenLesson?
    /// Set when the last lesson is finished; the screen shows the Rive celebration and clears it.
    var celebration: (headline: String, detail: String)?

    private var customerId = ""
    private var defaults: UserDefaults = .standard
    private var loadedKey: String?

    var nodes: [LessonNode] { LessonPathPresenter.nodes(cards, progress: progress) }

    /// Loads the cards for this customer and data source, once per combination.
    func load(customerId: String, live: Bool, baseURL: String, defaults: UserDefaults, force: Bool = false) async {
        let key = "\(customerId)|\(live)|\(baseURL)"
        guard force || key != loadedKey else { return }
        loadedKey = key
        self.customerId = customerId
        self.defaults = defaults
        progress = Self.read(customerId, from: defaults)
        state = .loading
        let client: CoachClient
        if live, let url = URL(string: baseURL) {
            client = .live(baseURL: url)
        } else {
            client = .sample()
        }
        do {
            let cards = try await client.teachingCards(customerId: customerId)
            var label: CoachDataLabel = client.kind == .bundledSample ? .sample : .live
            if label == .live, let warm = try? await client.warm(), warm.mock { label = .mock }
            self.cards = cards
            dataTag = CoachText.dataTag(for: label)
            state = cards.isEmpty ? .empty : .loaded
        } catch {
            state = .failed(CoachErrors.sentence(for: error))
            loadedKey = nil
        }
    }

    func retry(customerId: String, live: Bool, baseURL: String, defaults: UserDefaults) async {
        await load(customerId: customerId, live: live, baseURL: baseURL, defaults: defaults, force: true)
    }

    /// Counts a lesson as done (once). Returns the berries earned now.
    @discardableResult
    func complete(_ card: TeachingCard) -> Int {
        let earned = progress.complete(card.concept)
        if earned > 0 { save() }
        return earned
    }

    /// Called when the user closes a lesson with Done. Celebrates when that finished the whole path.
    func finished(_ card: TeachingCard, justCompletedPath: Bool) {
        openLesson = nil
        if justCompletedPath { celebration = LessonPathPresenter.celebration(cards) }
    }

    var allDone: Bool { progress.allDone(cards.map(\.concept)) }

    /// Screenshots only: start with the first `count` lessons done.
    func pretendDone(_ count: Int) {
        for card in cards.prefix(count) { progress.complete(card.concept) }
        save()
    }

    private func save() {
        if let data = try? JSONEncoder().encode(progress) { defaults.set(data, forKey: Self.key(customerId)) }
    }

    private static func read(_ customerId: String, from defaults: UserDefaults) -> LessonProgress {
        defaults.data(forKey: key(customerId)).flatMap { try? JSONDecoder().decode(LessonProgress.self, from: $0) } ?? LessonProgress()
    }

    private static func key(_ customerId: String) -> String { "sisu.lessons.\(customerId)" }
}
