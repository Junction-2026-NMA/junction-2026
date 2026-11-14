// Screenshots of the teaching path and the voice lab, modelled on ScreenshotTests. Run with
// SISU_DEVICE="iPhone Air" SISU_DERIVED=ios/.derived-voice SISU_ONLY=SisuUITests/PathVoiceScreenshotTests sh ios/scripts/screenshots.sh
// The voice shots need the team backend in mock mode on http://localhost:3300.
import XCTest

final class PathVoiceScreenshotTests: XCTestCase {
    private static let customer = ["-sisu.customer", "CUST04974"]
    private static let mock = ["-sisu.sample", "0", "-sisu.baseURL", "http://localhost:3300"]

    override func setUp() {
        continueAfterFailure = true
    }

    @MainActor
    func testPathScreens() {
        shot("p01-path-start", Self.customer + ["-sisu.tab", "path"])
        shot("p02-lesson-open", Self.customer + ["-sisu.tab", "path", "-sisu.lesson", "1"])
        shot("p03-lesson-answered", Self.customer + ["-sisu.tab", "path", "-sisu.lesson", "1", "-sisu.lessonAnswer", "3"], wait: 4.5)
        shot("p04-path-three-done", Self.customer + ["-sisu.tab", "path", "-sisu.lessonsDone", "3"])
        shot("p05-path-mock", Self.customer + Self.mock + ["-sisu.tab", "path", "-sisu.lessonsDone", "3"])
    }

    /// Taps a lesson node, a choice card and Done for real, then finishes the seventh lesson for the celebration.
    @MainActor
    func testPathTaps() {
        let app = launch(Self.customer + ["-sisu.tab", "path", "-sisu.lessonsDone", "6"])
        let node = app.descendants(matching: .any)["lesson.7"]
        XCTAssertTrue(node.waitForExistence(timeout: 8), "the seventh lesson node is on screen")
        node.tap()
        let choice = app.descendants(matching: .any)["choice.1"]
        XCTAssertTrue(choice.waitForExistence(timeout: 5), "the lesson sheet shows its choices")
        Thread.sleep(forTimeInterval: 1)
        choice.tap()
        Thread.sleep(forTimeInterval: 1.5)
        attach("p06-lesson-tapped")
        let done = app.buttons["Done"]
        if done.waitForExistence(timeout: 5) { done.tap() }
        Thread.sleep(forTimeInterval: 1.2)
        attach("p07-path-celebration")
        Thread.sleep(forTimeInterval: 4.5)
        attach("p08-path-all-done")
        app.terminate()
    }

    @MainActor
    func testVoiceLab() {
        shot("p09-voicelab-idle", Self.customer + ["-sisu.tab", "path", "-sisu.voicelab", "1"])

        // A whole push-to-talk turn against the mock backend with the bundled clip instead of the microphone.
        let app = launch(Self.customer + Self.mock + ["-sisu.tab", "path", "-sisu.voicelab", "1", "-sisu.voicefixture", "1", "-sisu.voiceauto", "1"])
        let transcript = app.staticTexts["voicelab.transcript"]
        XCTAssertTrue(transcript.waitForExistence(timeout: 10))
        let heard = NSPredicate(format: "label CONTAINS[c] 'electricity'")
        XCTAssertEqual(XCTWaiter.wait(for: [expectation(for: heard, evaluatedWith: transcript)], timeout: 15), .completed,
                       "the mock transcript arrives")
        let clips = app.staticTexts["voicelab.clips"]
        let played = NSPredicate(format: "NOT (label BEGINSWITH '0 ')")
        XCTAssertEqual(XCTWaiter.wait(for: [expectation(for: played, evaluatedWith: clips)], timeout: 20), .completed,
                       "at least one spoken clip played")
        let answer = app.staticTexts["voicelab.answer"]
        XCTAssertFalse(answer.label.isEmpty)
        Thread.sleep(forTimeInterval: 2)
        attach("p10-voicelab-turn")
        app.terminate()

        // The same with a real press and hold on the Rive VoiceButton.
        let held = launch(Self.customer + Self.mock + ["-sisu.tab", "path", "-sisu.voicelab", "1", "-sisu.voicefixture", "1"])
        let button = held.descendants(matching: .any)["voicelab.button"]
        if button.waitForExistence(timeout: 8) {
            button.press(forDuration: 1.2)
            Thread.sleep(forTimeInterval: 6)
        }
        attach("p11-voicelab-press")

        // A quick tap is not speech: nothing is sent and the hint shows.
        if button.exists {
            button.tap()
            let notice = held.staticTexts["voicelab.notice"]
            XCTAssertTrue(notice.waitForExistence(timeout: 5), "a short tap shows the hold hint")
            XCTAssertEqual(notice.label, "Hold the button while you speak.")
            Thread.sleep(forTimeInterval: 0.8)
            attach("p12-voicelab-short-tap")
        }
        held.terminate()
    }

    // MARK: Helpers

    @MainActor
    private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        let sample = arguments.contains("-sisu.sample") ? [] : ["-sisu.sample", "1"]
        app.launchArguments = sample + ["-sisu.screenshots", "1"] + arguments
        app.launch()
        Thread.sleep(forTimeInterval: 3)
        return app
    }

    @MainActor
    private func shot(_ name: String, _ arguments: [String], wait: TimeInterval = 0) {
        let filter = ProcessInfo.processInfo.environment["SISU_SHOTS"] ?? ""
        guard filter.isEmpty || filter.split(separator: ",").contains(where: { name.contains($0) }) else { return }
        let app = launch(arguments)
        if wait > 0 { Thread.sleep(forTimeInterval: wait) }
        attach(name)
        app.terminate()
    }

    private func attach(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
