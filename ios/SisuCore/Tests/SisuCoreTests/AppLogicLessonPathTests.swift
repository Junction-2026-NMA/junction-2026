import SisuCore
import XCTest

final class AppLogicLessonPathTests: XCTestCase {
    private let cards = CoachSamples.teachingCards()
    private var concepts: [ConceptId] { cards.map(\.concept) }

    func testSampleHasSevenCards() {
        XCTAssertEqual(cards.count, 7)
    }

    func testLessonCountsOnce() {
        var progress = LessonProgress()
        XCTAssertEqual(progress.complete(.bufferFirst), LessonProgress.reward)
        XCTAssertEqual(progress.complete(.bufferFirst), 0)
        XCTAssertEqual(progress.berries, LessonProgress.reward)
        XCTAssertEqual(progress.done, ["buffer-first"])
    }

    func testBerriesNeverGoDown() {
        var progress = LessonProgress()
        var last = 0
        for concept in ConceptId.all + ConceptId.all {
            progress.complete(concept)
            XCTAssertGreaterThanOrEqual(progress.berries, last)
            last = progress.berries
        }
        XCTAssertEqual(progress.berries, LessonProgress.reward * 7)
    }

    func testNextIsFirstNotDone() {
        var progress = LessonProgress()
        XCTAssertEqual(progress.next(in: concepts), concepts[0])
        progress.complete(concepts[0])
        progress.complete(concepts[2])
        XCTAssertEqual(progress.next(in: concepts), concepts[1])
        for concept in concepts { progress.complete(concept) }
        XCTAssertNil(progress.next(in: concepts))
        XCTAssertTrue(progress.allDone(concepts))
    }

    func testNodesMarkDoneCurrentUpcoming() {
        var progress = LessonProgress()
        progress.complete(concepts[0])
        progress.complete(concepts[1])
        progress.complete(concepts[2])
        let nodes = LessonPathPresenter.nodes(cards, progress: progress)
        XCTAssertEqual(nodes.map(\.state), [.done, .done, .done, .current, .upcoming, .upcoming, .upcoming])
        XCTAssertEqual(nodes[3].title, cards[3].title)
        XCTAssertEqual(LessonPathPresenter.progressText(cards, progress: progress), "3 of 7 done")
        XCTAssertEqual(LessonPathPresenter.fraction(cards, progress: progress), 3.0 / 7.0, accuracy: 0.0001)
        XCTAssertTrue(nodes.allSatisfy { (-1...1).contains($0.sway) })
        XCTAssertEqual(nodes[3].accessibilityLabel(total: 7), "Lesson 4 of 7, \(cards[3].title), next up")
    }

    func testProgressRoundTrips() throws {
        var progress = LessonProgress()
        progress.complete(.compoundGrowth)
        let data = try JSONEncoder().encode(progress)
        XCTAssertEqual(try JSONDecoder().decode(LessonProgress.self, from: data), progress)
    }

    func testCopyNeverBlames() {
        var quiz = TeachingQuiz(card: cards[0])
        XCTAssertNil(LessonPathPresenter.feedback(quiz))
        quiz.choose((cards[0].correctIndex + 1) % cards[0].options.count)
        let line = LessonPathPresenter.feedback(quiz) ?? ""
        XCTAssertTrue(line.hasPrefix("Close."))
        for word in ["wrong", "fail", "should"] { XCTAssertFalse(line.lowercased().contains(word)) }
        XCTAssertEqual(LessonPathPresenter.rewardText(earned: 15), "+15 berries")
        XCTAssertNil(LessonPathPresenter.rewardText(earned: 0))
    }

    func testBerriesTextAddsDailyAndLessons() {
        var lessons = LessonProgress()
        lessons.complete(.safeToSpend)
        XCTAssertEqual(LessonPathPresenter.berriesText(daily: DailyProgress(), lessons: lessons), "15")
    }
}
