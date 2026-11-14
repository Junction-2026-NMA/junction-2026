import XCTest
@testable import SisuCore

final class AppLogicCoachTests: XCTestCase {
    func testEachMomentEarnsOnce() {
        var rewards = CoachRewards()
        XCTAssertEqual(rewards.award(.quizAnswered, id: "card-1"), 5)
        XCTAssertEqual(rewards.award(.quizAnswered, id: "card-1"), 0)
        XCTAssertEqual(rewards.award(.actionDecided, id: "act-1"), 10)
        XCTAssertEqual(rewards.award(.actionDecided, id: "act-1"), 0)
        XCTAssertEqual(rewards.award(.quizAnswered, id: "act-1"), 5)
        XCTAssertEqual(rewards.berries, 20)
    }

    func testRewardsSurviveCoding() throws {
        var rewards = CoachRewards()
        rewards.award(.actionDecided, id: "a")
        let copy = try JSONDecoder().decode(CoachRewards.self, from: JSONEncoder().encode(rewards))
        XCTAssertEqual(copy, rewards)
        XCTAssertEqual(CoachRewards.rewardText(.actionDecided), "+10")
    }

    func testBillTypeFromText() {
        XCTAssertEqual(CoachBillMatch.billType(text: "Electricity"), .electricity)
        XCTAssertEqual(CoachBillMatch.billType(text: "Helen sähkö"), .electricity)
        XCTAssertEqual(CoachBillMatch.billType(text: "Mobile phone"), .mobile)
        XCTAssertEqual(CoachBillMatch.billType(text: "Home broadband"), .internet)
        XCTAssertNil(CoachBillMatch.billType(text: "Rent"))
    }

    func testMoodIsNeverSad() {
        XCTAssertEqual(CoachMood.liito(isThinking: false, stageJustLanded: false, celebrating: false), .idle)
        XCTAssertEqual(CoachMood.liito(isThinking: true, stageJustLanded: false, celebrating: false), .thinking)
        XCTAssertEqual(CoachMood.liito(isThinking: true, stageJustLanded: true, celebrating: false), .found)
        XCTAssertEqual(CoachMood.liito(isThinking: false, stageJustLanded: false, celebrating: true), .cheering)
    }

    func testProviderNames() {
        XCTAssertEqual(CoachProviderName.display("exa"), "Exa")
        XCTAssertEqual(CoachProviderName.display("context.dev"), "Context.dev")
        XCTAssertEqual(CoachProviderName.display("Other"), "Other")
    }
}
