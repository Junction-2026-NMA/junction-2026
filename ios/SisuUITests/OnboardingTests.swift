// The first run: a clean first launch through every screen to Today's first insight and its transactions,
// a relaunch that remembers completion, "Start the demo over" bringing the first screen back, and numbered
// motion frames of every transition. Run it with
//   SISU_DEVICE="iPhone Air" SISU_DERIVED=ios/.derived-onb SISU_ONLY=SisuUITests/OnboardingTests sh ios/scripts/screenshots.sh
// The PNGs land in ios/.derived-onb/screens/<name>.png.
//
// These launches use the app's real settings store (no `-sisu.screenshots 1`), so completion persists between
// launches; `-sisu.onboarding reset` clears it at the start of each test that needs a clean install.
import XCTest

final class OnboardingTests: XCTestCase {
    private static let cleanInstall = ["-sisu.onboarding", "reset", "-sisu.sample", "1"]
    private static let eetuLink = "From 36 of Eetu's transactions · See them"

    override func setUp() {
        continueAfterFailure = false
    }

    // MARK: 1. Clean first launch

    @MainActor
    func testFirstRunToFirstInsight() {
        let app = launch(Self.cleanInstall)

        let start = app.buttons["Show me how"]
        XCTAssertTrue(start.waitForExistence(timeout: 10), "The first launch opens on the welcome screen")
        XCTAssertTrue(app.buttons["Skip"].exists)
        settle(1.5)
        shot("onb-01-welcome")
        start.tap()

        let gotIt = app.buttons["Got it"]
        XCTAssertTrue(gotIt.waitForExistence(timeout: 5))
        settle(1.8)
        shot("onb-02-baskets")
        gotIt.tap()

        let eetu = profile(app, "Eetu")
        XCTAssertTrue(eetu.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["This is a demo"].exists, "The profile step discloses the demo")
        settle(1.2)
        shot("onb-03-profile")
        eetu.tap()
        shot("onb-04-profile-chosen")

        let link = app.buttons[Self.eetuLink]
        XCTAssertTrue(link.waitForExistence(timeout: 10), "Today opens with the first insight highlighted")
        XCTAssertFalse(app.buttons["Show me how"].exists)
        settle(0.4)
        shot("onb-05-today-spotlight")
        settle(2)
        shot("onb-06-today-insight")

        link.tap()
        XCTAssertTrue(app.staticTexts["Utilities payments"].waitForExistence(timeout: 5), "The link opens the transactions behind it")
        settle(1.5)
        shot("onb-07-transactions")
        app.terminate()
    }

    // MARK: 2. Relaunch after completion

    @MainActor
    func testRelaunchRemembersCompletion() {
        var app = launch(Self.cleanInstall)
        XCTAssertTrue(app.buttons["Skip"].waitForExistence(timeout: 10))
        app.buttons["Skip"].tap()
        let eetu = profile(app, "Eetu")
        XCTAssertTrue(eetu.waitForExistence(timeout: 5))
        eetu.tap()
        XCTAssertTrue(app.buttons[Self.eetuLink].waitForExistence(timeout: 10))
        app.terminate()

        // Same store, no reset: straight to Today, with the callout still owed until it is tapped away.
        app = launch(["-sisu.sample", "1"])
        XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout: 10), "Relaunch lands on Today")
        XCTAssertFalse(app.buttons["Show me how"].exists, "No onboarding after completion")
        XCTAssertTrue(app.buttons[Self.eetuLink].waitForExistence(timeout: 5))
        settle(2)
        shot("onb-08-relaunch-today")

        let close = app.buttons["Got it, hide this"]
        XCTAssertTrue(close.exists)
        close.tap()
        settle(1)
        XCTAssertFalse(app.buttons[Self.eetuLink].exists, "Tapping the callout away hides it")
        shot("onb-09-callout-dismissed")
        app.terminate()

        app = launch(["-sisu.sample", "1"])
        XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout: 10))
        settle(1.5)
        XCTAssertFalse(app.buttons["Show me how"].exists)
        XCTAssertFalse(app.buttons[Self.eetuLink].exists, "A dismissed callout stays dismissed")
        app.terminate()
    }

    // MARK: 3. Start the demo over

    @MainActor
    func testStartOverBringsBackTheFirstRun() {
        // A direct launch at a customer counts as onboarding done.
        let app = launch(["-sisu.sample", "1", "-sisu.screenshots", "1", "-sisu.customer", "CUST04414"])
        let settings = app.buttons["Settings"]
        XCTAssertTrue(settings.waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["Show me how"].exists)
        settle(1)
        settings.tap()
        let startOver = app.buttons["Start the demo over"]
        XCTAssertTrue(startOver.waitForExistence(timeout: 5))
        settle(1)
        shot("onb-10-settings")
        startOver.tap()
        XCTAssertTrue(app.buttons["Show me how"].waitForExistence(timeout: 5), "Start the demo over shows the first screen again")
        settle(1.5)
        shot("onb-11-start-over-welcome")

        // And it plays through again.
        app.buttons["Skip"].tap()
        let aino = profile(app, "Aino")
        XCTAssertTrue(aino.waitForExistence(timeout: 5))
        aino.tap()
        XCTAssertTrue(app.buttons["From 36 of Aino's transactions · See them"].waitForExistence(timeout: 10))
        settle(2)
        shot("onb-12-aino-insight")

        // "Switch customer" keeps the chooser reachable, without the intro.
        app.buttons["Settings"].tap()
        let switchCustomer = app.buttons["Switch customer"]
        XCTAssertTrue(switchCustomer.waitForExistence(timeout: 5))
        switchCustomer.tap()
        XCTAssertTrue(profile(app, "Sanna").waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Show me how"].exists)
        settle(1.2)
        shot("onb-13-switch-customer")
        app.terminate()
    }

    // MARK: 4. Motion frames

    /// Films every transition of the first run as fast as XCUITest allows: `onb-motion-NNN`. The app runs the
    /// first run's motion `slow` times slower and applies each tap `delay` seconds later, because XCUITest
    /// waits for animations to end before a tap returns. Play back at about `slow` times the capture rate.
    @MainActor
    func testOnboardingMotionFrames() {
        let slow = 3.0
        let delay = 0.6
        let app = launch(Self.cleanInstall + ["-sisu.motionScale", "\(slow)", "-sisu.motionDelay", "\(delay)"])
        XCTAssertTrue(app.buttons["Show me how"].waitForExistence(timeout: 10))
        settle(1.5)
        var index = 0
        let steps: [(String, () -> XCUIElement, TimeInterval)] = [
            ("welcome to baskets", { app.buttons["Show me how"] }, delay + 2.6),
            ("baskets back to welcome", { app.buttons["Back"] }, delay + 1.8),
            ("welcome to baskets again", { app.buttons["Show me how"] }, delay + 2.6),
            ("baskets to profile", { app.buttons["Got it"] }, delay + 1.8),
            ("profile to Today", { self.profile(app, "Eetu") }, 4.5),
        ]
        for (name, element, length) in steps {
            let target = element()
            XCTAssertTrue(target.waitForExistence(timeout: 8), "No control for \(name)")
            let tapped = Date()
            target.tap()
            let end = tapped.addingTimeInterval(length)
            var frames: [XCUIScreenshot] = []
            while Date() < end || frames.count < 8 {
                frames.append(XCUIScreen.main.screenshot())
            }
            for frame in frames {
                let attachment = XCTAttachment(screenshot: frame)
                attachment.name = String(format: "onb-motion-%03d", index)
                attachment.lifetime = .keepAlways
                add(attachment)
                index += 1
            }
            print("[motion] \(name): \(frames.count) frames")
            XCTAssertGreaterThanOrEqual(frames.count, 8, "At least 8 frames for \(name)")
            settle(0.6)
        }
        XCTAssertTrue(app.buttons[Self.eetuLink].waitForExistence(timeout: 5))
        app.terminate()
    }

    // MARK: Helpers

    @MainActor
    private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = arguments
        app.launch()
        return app
    }

    /// A profile card, by the name its accessibility label starts with.
    @MainActor
    private func profile(_ app: XCUIApplication, _ name: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "\(name),")).firstMatch
    }

    private func settle(_ seconds: TimeInterval) {
        Thread.sleep(forTimeInterval: seconds)
    }

    @MainActor
    private func shot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
