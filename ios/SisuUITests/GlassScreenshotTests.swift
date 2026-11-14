// Screenshots of the floating glass tab bar and the light look: every tab with the bar over scrolled content,
// Ask with the keyboard up (the bar steps aside), the "Data and sources" section in settings, and the pill's
// motion between tabs as numbered frames.
// Run it with
//   SISU_DEVICE="iPhone 17 Pro" SISU_DERIVED=ios/.derived-glass SISU_ONLY=SisuUITests/GlassScreenshotTests sh ios/scripts/screenshots.sh
// The PNGs land in ios/.derived-glass/screens/<name>.png.
//
// Not covered: Reduce Transparency (the solid near-white bar) cannot be switched on from a UI test, so there is
// no shot of it. Check it by hand: Settings > Accessibility > Display & Text Size > Reduce Transparency.
import XCTest

final class GlassScreenshotTests: XCTestCase {
    private static let base = ["-sisu.sample", "1", "-sisu.screenshots", "1",
                               "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryL"]
    private static let customer = ["-sisu.customer", "CUST04974"]

    override func setUp() {
        continueAfterFailure = true
    }

    // MARK: Tabs with the bar over scrolled content

    @MainActor
    func testTabsOverContent() {
        shot("g01-today-top", Self.customer + ["-sisu.tab", "today"])
        shot("g02-today-scrolled", Self.customer + ["-sisu.tab", "today", "-sisu.scroll", "baskets"])
        shot("g03-today-end", Self.customer + ["-sisu.tab", "today", "-sisu.scroll", "end"])
        shot("g04-ask-empty", Self.customer + ["-sisu.tab", "ask"])
        shot("g05-ask-answer", Self.customer + ["-sisu.tab", "ask", "-sisu.coachAsk", "Can you find me a cheaper electricity deal?",
                                                "-sisu.coachScroll", "offers"], wait: 8)
        shot("g06-jars-top", Self.customer + ["-sisu.tab", "jars"])
        shot("g07-jars-futures", Self.customer + ["-sisu.tab", "jars", "-sisu.answer", "save", "-sisu.scroll", "futures"])
        shot("g08-path", Self.customer + ["-sisu.tab", "path", "-sisu.lessonsDone", "3"])
        shot("g09-maths-sheet", Self.customer + ["-sisu.tab", "today", "-sisu.sheet", "maths"])
        shot("g10-transactions-sheet", Self.customer + ["-sisu.tab", "today", "-sisu.sheet", "transactions"])
    }

    /// The Ask tab with the keyboard up: the bar steps aside and the composer sits on the keys.
    @MainActor
    func testAskKeyboard() {
        let app = launch(Self.customer + ["-sisu.tab", "ask"])
        XCTAssertTrue(app.buttons["tab.ask"].exists, "The glass tab bar is on screen before typing")
        let field = app.textFields["Your question"].exists ? app.textFields["Your question"] : app.textViews["Your question"]
        if field.waitForExistence(timeout: 5) {
            field.tap()
            Thread.sleep(forTimeInterval: 1.2)
            field.typeText("Can I afford")
        } else {
            XCTFail("No question field")
        }
        Thread.sleep(forTimeInterval: 1)
        attach("g11-ask-keyboard")
        if app.keyboards.firstMatch.exists {
            XCTAssertFalse(app.buttons["tab.ask"].isHittable, "The tab bar steps aside while the keyboard is up")
        }
        app.terminate()
    }

    /// Settings, with the new "Data and sources" section.
    @MainActor
    func testSettingsDataAndSources() {
        let app = launch(Self.customer + ["-sisu.tab", "today", "-sisu.sheet", "settings"])
        attach("g12-settings-top")
        let heading = app.staticTexts["Data and sources"]
        XCTAssertTrue(heading.waitForExistence(timeout: 5), "Settings has a Data and sources section")
        app.swipeUp()
        Thread.sleep(forTimeInterval: 1)
        attach("g13-settings-data-sources")
        app.terminate()
    }

    /// VoiceOver shape of the bar: four buttons with their labels, the selected one marked as selected.
    @MainActor
    func testTabBarAccessibility() {
        let app = launch(Self.customer + ["-sisu.tab", "jars"])
        for name in ["Today", "Ask", "Jars", "Path"] {
            let button = app.buttons["tab.\(name.lowercased())"]
            XCTAssertTrue(button.exists, "\(name) is a button")
            XCTAssertEqual(button.label, name)
            XCTAssertEqual(button.isSelected, name == "Jars", "\(name) selected state")
        }
        app.buttons["tab.path"].tap()
        Thread.sleep(forTimeInterval: 1)
        XCTAssertTrue(app.buttons["tab.path"].isSelected)
        XCTAssertFalse(app.buttons["tab.jars"].isSelected)
        app.terminate()
    }

    // MARK: Motion frames

    /// Today → Ask → Jars → Path → Today, filming the bottom 200 points of the screen as fast as XCUITest
    /// allows during each switch: `motion-NNN`. The app runs the pill's animation slower (`-sisu.tabMotion`)
    /// and applies each tap a moment later (`-sisu.tabDelay`), because XCUITest waits for every animation to
    /// end before a tap returns. Play the frames back at the slow-down factor times the capture rate.
    @MainActor
    func testTabPillMotionFrames() {
        let slow = 4.0
        let delay = 0.9
        let app = launch(Self.customer + ["-sisu.tab", "today", "-sisu.tabMotion", "\(slow)", "-sisu.tabDelay", "\(delay)"])
        var index = 0
        for tab in ["ask", "jars", "path", "today"] {
            let button = app.buttons["tab.\(tab)"]
            guard button.waitForExistence(timeout: 5) else { XCTFail("No \(tab) tab"); continue }
            let tapped = Date()
            button.tap()
            // The switch starts `delay` after the tap; the slowed spring settles in about 0.9 s x slow.
            let end = tapped.addingTimeInterval(delay + 0.9 * slow)
            var frames: [UIImage] = []
            var times: [TimeInterval] = []
            while Date() < end {
                frames.append(XCUIScreen.main.screenshot().image)
                times.append(Date().timeIntervalSince(tapped))
            }
            for (frame, time) in zip(frames, times) {
                let attachment = XCTAttachment(image: Self.bottom(frame, points: 200))
                attachment.name = String(format: "motion-%03d", index)
                attachment.lifetime = .keepAlways
                add(attachment)
                print(String(format: "[motion] motion-%03d to=%@ t=%.3f", index, tab, time))
                index += 1
            }
            print("[motion] switch to \(tab): \(frames.count) frames")
            XCTAssertGreaterThanOrEqual(frames.count, 8, "At least 8 frames for the switch to \(tab)")
        }
        app.terminate()
    }

    // MARK: Helpers

    /// The bottom `points` of a full-screen screenshot.
    private static func bottom(_ image: UIImage, points: CGFloat) -> UIImage {
        guard let cg = image.cgImage else { return image }
        let pixelsPerPoint = UIScreen.main.scale
        let height = min(CGFloat(cg.height), (points * pixelsPerPoint).rounded())
        let rect = CGRect(x: 0, y: CGFloat(cg.height) - height, width: CGFloat(cg.width), height: height)
        guard let cropped = cg.cropping(to: rect) else { return image }
        return UIImage(cgImage: cropped, scale: image.scale, orientation: image.imageOrientation)
    }

    @MainActor
    private func launch(_ arguments: [String], wait: TimeInterval = 3) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = Self.base + arguments
        app.launch()
        Thread.sleep(forTimeInterval: wait)
        return app
    }

    @MainActor
    private func shot(_ name: String, _ arguments: [String], wait: TimeInterval = 3) {
        let app = launch(arguments, wait: wait)
        attach(name)
        app.terminate()
    }

    @MainActor
    private func attach(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
