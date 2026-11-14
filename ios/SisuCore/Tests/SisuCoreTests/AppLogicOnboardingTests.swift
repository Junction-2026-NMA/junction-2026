import SisuCore
import XCTest

final class AppLogicOnboardingTests: XCTestCase {
    func testFreshFlowWalksWelcomePromiseProfileReadingThenFinishes() {
        var flow = OnboardingFlow.fresh
        XCTAssertTrue(flow.isActive)
        XCTAssertEqual(flow.step, .welcome)
        flow.advance()
        XCTAssertEqual(flow.step, .promise)
        flow.advance()
        XCTAssertEqual(flow.step, .profile)
        flow.advance()
        XCTAssertEqual(flow.step, .profile, "the profile screen moves on only by choosing")
        flow.profileChosen()
        XCTAssertEqual(flow.step, .reading)
        flow.advance()
        XCTAssertEqual(flow.step, .reading, "the reading screen moves on only by finish()")
        XCTAssertFalse(flow.firstInsightPending)
        flow.finish()
        XCTAssertTrue(flow.isComplete)
        XCTAssertFalse(flow.isActive)
        XCTAssertTrue(flow.firstInsightPending)
    }

    func testProgressRisesByAQuarterPerScreen() {
        var flow = OnboardingFlow.fresh
        XCTAssertEqual(flow.progress, 0.25, accuracy: 1e-9)
        flow.advance()
        XCTAssertEqual(flow.progress, 0.5, accuracy: 1e-9)
        flow.advance()
        flow.profileChosen()
        XCTAssertEqual(flow.progress, 1, accuracy: 1e-9)
        XCTAssertEqual(OnboardingFlow.stepCount, 4)
        XCTAssertEqual(OnboardingStep.profile.number, 3)
    }

    func testSkipGoesStraightToTheProfileFromTheIntroOnly() {
        var flow = OnboardingFlow.fresh
        XCTAssertTrue(flow.canSkip)
        flow.skipIntro()
        XCTAssertEqual(flow.step, .profile)
        XCTAssertFalse(flow.canSkip)
        flow.profileChosen()
        flow.skipIntro()
        XCTAssertEqual(flow.step, .reading)
    }

    func testBackStepsOneScreenFromPromiseAndProfile() {
        var flow = OnboardingFlow.fresh
        XCTAssertFalse(flow.canGoBack)
        flow.back()
        XCTAssertEqual(flow.step, .welcome)
        flow.advance()
        flow.advance()
        flow.back()
        XCTAssertEqual(flow.step, .promise)
        flow.back()
        XCTAssertEqual(flow.step, .welcome)
    }

    func testFinishOnlyFromReadingAndFailureReturnsToTheProfile() {
        var flow = OnboardingFlow.fresh
        flow.finish()
        XCTAssertTrue(flow.isActive, "finishing before a profile is read does nothing")
        flow.skipIntro()
        flow.profileChosen()
        flow.readingFailed()
        XCTAssertEqual(flow.step, .profile)
        XCTAssertTrue(flow.isActive)
    }

    func testCalloutIsDismissedOnceAndRestartBringsBackTheWelcome() {
        var flow = OnboardingFlow.fresh
        flow.skipIntro()
        flow.profileChosen()
        flow.finish()
        flow.dismissFirstInsight()
        XCTAssertFalse(flow.firstInsightPending)
        XCTAssertTrue(flow.isComplete)
        flow.restart()
        XCTAssertEqual(flow, .fresh)
        XCTAssertEqual(flow.step, .welcome)
    }

    func testCompletedFlowIsNotChangedByStepCalls() {
        var flow = OnboardingFlow.fresh
        flow.skipIntro()
        flow.profileChosen()
        flow.finish()
        let done = flow
        flow.advance()
        flow.back()
        flow.skipIntro()
        flow.profileChosen()
        flow.readingFailed()
        XCTAssertEqual(flow, done)
    }

    func testRoundTripsThroughJSONForUserDefaults() throws {
        var flow = OnboardingFlow.fresh
        flow.skipIntro()
        flow.profileChosen()
        flow.finish()
        let data = try JSONEncoder().encode(flow)
        XCTAssertEqual(try JSONDecoder().decode(OnboardingFlow.self, from: data), flow)
    }

    // MARK: Launch

    func testCleanInstallStartsAtTheWelcome() {
        XCTAssertEqual(OnboardingFlow.atLaunch(stored: nil, launch: nil, skipsByDefault: false), .fresh)
    }

    func testCompletedFlowIsRememberedAcrossLaunches() {
        let done = finished(pending: true)
        XCTAssertEqual(OnboardingFlow.atLaunch(stored: done, launch: nil, skipsByDefault: false), done)
        XCTAssertEqual(OnboardingFlow.atLaunch(stored: done, launch: nil, skipsByDefault: true), done)
    }

    func testUnfinishedFlowStartsAgainAtTheWelcome() {
        var midway = OnboardingFlow.fresh
        midway.skipIntro()
        midway.profileChosen()
        XCTAssertEqual(OnboardingFlow.atLaunch(stored: midway, launch: nil, skipsByDefault: false), .fresh)
    }

    func testResetArgumentAlwaysStartsAtTheWelcome() {
        XCTAssertEqual(OnboardingFlow.atLaunch(stored: finished(pending: false), launch: .reset, skipsByDefault: true), .fresh)
    }

    func testDoneArgumentAndDirectLaunchesSkipTheFlowWithoutACallout() {
        let skipped = OnboardingFlow.atLaunch(stored: nil, launch: .done, skipsByDefault: false)
        XCTAssertFalse(skipped.isActive)
        XCTAssertFalse(skipped.firstInsightPending)
        XCTAssertEqual(OnboardingFlow.atLaunch(stored: nil, launch: nil, skipsByDefault: true), .skipped)
        XCTAssertEqual(OnboardingFlow.atLaunch(stored: .fresh, launch: nil, skipsByDefault: true), .skipped)
        let pending = finished(pending: true)
        XCTAssertEqual(OnboardingFlow.atLaunch(stored: pending, launch: .done, skipsByDefault: false), pending)
    }

    func testLaunchArgumentParsing() {
        XCTAssertEqual(OnboardingLaunch(argument: "reset"), .reset)
        XCTAssertEqual(OnboardingLaunch(argument: "Done"), .done)
        XCTAssertNil(OnboardingLaunch(argument: "maybe"))
        XCTAssertNil(OnboardingLaunch(argument: nil))
    }

    private func finished(pending: Bool) -> OnboardingFlow {
        var flow = OnboardingFlow.fresh
        flow.skipIntro()
        flow.profileChosen()
        flow.finish()
        if !pending { flow.dismissFirstInsight() }
        return flow
    }
}
