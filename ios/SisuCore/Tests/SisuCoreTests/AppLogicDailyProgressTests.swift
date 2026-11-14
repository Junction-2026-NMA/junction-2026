import SisuCore
import XCTest

final class AppLogicDailyProgressTests: XCTestCase {
    private let monday = DayStamp(year: 2026, month: 11, day: 16)
    private let tuesday = DayStamp(year: 2026, month: 11, day: 17)
    private let friday = DayStamp(year: 2026, month: 11, day: 20)

    func testStartsHonestly() {
        let progress = DailyProgress()
        XCTAssertEqual(progress.streakDays, 0)
        XCTAssertEqual(progress.berries, 0)
        XCTAssertEqual(progress.progress(on: monday), 0)
    }

    func testFirstCheckInIsDayOne() {
        var progress = DailyProgress()
        XCTAssertEqual(progress.complete(.checkIn, on: monday), DailyAction.checkIn.reward)
        XCTAssertEqual(progress.streakDays, 1)
        XCTAssertEqual(progress.berries, 5)
    }

    func testADayCountsOnce() {
        var progress = DailyProgress()
        progress.complete(.checkIn, on: monday)
        XCTAssertEqual(progress.complete(.checkIn, on: monday), 0)
        progress.complete(.confirmBill, on: monday)
        XCTAssertEqual(progress.streakDays, 1)
        XCTAssertEqual(progress.berries, 15)
        XCTAssertEqual(progress.progress(on: monday), 2.0 / 3.0, accuracy: 0.0001)
    }

    func testNextDayGrowsTheStreakAndResetsActions() {
        var progress = DailyProgress()
        progress.complete(.checkIn, on: monday)
        progress.complete(.checkIn, on: tuesday)
        XCTAssertEqual(progress.streakDays, 2)
        XCTAssertEqual(progress.done(on: tuesday), [.checkIn])
        XCTAssertEqual(progress.done(on: monday), [])
    }

    func testGapRestartsStreakButKeepsBerries() {
        var progress = DailyProgress()
        progress.complete(.checkIn, on: monday)
        progress.complete(.investigate, on: monday)
        progress.complete(.checkIn, on: friday)
        XCTAssertEqual(progress.streakDays, 1)
        XCTAssertEqual(progress.berries, 25)
    }

    func testClockSetBackChangesNothing() {
        var progress = DailyProgress()
        progress.complete(.checkIn, on: tuesday)
        let before = progress
        XCTAssertEqual(progress.complete(.confirmBill, on: monday), 0)
        XCTAssertEqual(progress, before)
    }

    func testCelebrationOnlyWhenAllThreeAreDone() {
        var progress = DailyProgress()
        progress.complete(.checkIn, on: monday)
        progress.complete(.confirmBill, on: monday)
        XCTAssertNil(progress.celebration(on: monday))
        progress.complete(.investigate, on: monday)
        XCTAssertEqual(progress.berriesEarned(on: monday), 30)
        XCTAssertEqual(progress.celebration(on: monday)?.detail, "30 berries today. Day 1 of your streak.")
        XCTAssertNil(progress.celebration(on: tuesday))
    }

    func testDayStampFromInjectedDate() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Helsinki")!
        // 2026-11-15 23:30 UTC is already 16 Nov in Helsinki.
        let date = Date(timeIntervalSince1970: 1_794_785_400)
        XCTAssertEqual(DayStamp(date, calendar: calendar), monday)
    }

    func testRoundTripsThroughJSON() throws {
        var progress = DailyProgress()
        progress.complete(.checkIn, on: monday)
        let data = try JSONEncoder().encode(progress)
        XCTAssertEqual(try JSONDecoder().decode(DailyProgress.self, from: data), progress)
    }
}
