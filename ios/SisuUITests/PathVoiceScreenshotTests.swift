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

    /// The real microphone (no test clip) in the voice lab, against the mock backend, whose speech to text answers
    /// with a fixed transcript whatever the audio. Accepts the microphone alert the first time.
    @MainActor
    func testRealMicrophone() {
        let app = launch(Self.customer + Self.mock + ["-sisu.tab", "path", "-sisu.voicelab", "1"])
        let button = app.descendants(matching: .any)["voicelab.button"]
        XCTAssertTrue(button.waitForExistence(timeout: 8))
        let transcript = app.staticTexts["voicelab.transcript"]
        holdToTalk(button, app: app, heard: transcript)
        attach("p13-real-mic-lab-result")
        let clips = app.staticTexts["voicelab.clips"]
        let played = NSPredicate(format: "NOT (label BEGINSWITH '0 ')")
        XCTAssertEqual(XCTWaiter.wait(for: [expectation(for: played, evaluatedWith: clips)], timeout: 20), .completed,
                       "at least one spoken clip played after a real recording")
        let notice = app.staticTexts["voicelab.notice"]
        if notice.exists { XCTFail("notice after a real recording: \(notice.label)") }
        Thread.sleep(forTimeInterval: 1)
        attach("p14-real-mic-lab-spoken")
        app.terminate()

        // The recording state, held by the app itself for 4 seconds so a screenshot can be taken meanwhile.
        let held = launch(Self.customer + Self.mock + ["-sisu.tab", "path", "-sisu.voicelab", "1", "-sisu.voiceauto", "1", "-sisu.voicehold", "4"], settle: 1.8)
        attach("p15-real-mic-recording")
        let state = held.staticTexts["voicelab.state"]
        XCTAssertEqual(state.label, "Listening", "the lab shows the recording state while the microphone is open")
        let heard = held.staticTexts["voicelab.transcript"]
        let electricity = NSPredicate(format: "label CONTAINS[c] 'electricity'")
        XCTAssertEqual(XCTWaiter.wait(for: [expectation(for: electricity, evaluatedWith: heard)], timeout: 20), .completed)
        Thread.sleep(forTimeInterval: 1.5)
        attach("p16-real-mic-auto-result")
        held.terminate()
    }

    /// The Ask tab's composer voice button with a real recording: the reply is spoken; a typed question right
    /// after it stays silent.
    @MainActor
    func testAskVoice() {
        let app = launch(Self.customer + Self.mock + ["-sisu.tab", "ask"])
        let voice = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'ask.voice.clips.'")).firstMatch
        XCTAssertTrue(voice.waitForExistence(timeout: 10), "the composer's voice button is on screen")
        let heard = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'cheaper electricity deal'")).firstMatch
        holdToTalk(voice, app: app, heard: heard)
        let spoken = NSPredicate(format: "identifier != 'ask.voice.clips.0'")
        XCTAssertEqual(XCTWaiter.wait(for: [expectation(for: spoken, evaluatedWith: voice)], timeout: 25), .completed,
                       "the voice reply on the Ask tab is spoken")
        Thread.sleep(forTimeInterval: 3)
        attach("p17-ask-voice-result")
        let clipsAfterVoice = voice.identifier

        let field = app.textFields["Your question"].exists ? app.textFields["Your question"] : app.textViews["Your question"]
        XCTAssertTrue(field.waitForExistence(timeout: 5), "the composer's text field")
        field.tap()
        field.typeText("How much can I safely spend this week?")
        let send = app.buttons.matching(NSPredicate(format: "label == 'Send'")).firstMatch
        if send.waitForExistence(timeout: 3) { send.tap() }
        let typed = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'safely spend this week'")).firstMatch
        XCTAssertTrue(typed.waitForExistence(timeout: 8), "the typed question was sent")
        Thread.sleep(forTimeInterval: 10)
        XCTAssertEqual(voice.identifier, clipsAfterVoice, "a typed question after a voice turn starts no new clip")
        attach("p18-ask-typed-silent")
        app.terminate()
    }

    // MARK: Helpers

    /// Presses and holds the voice button for 1.5 s. When the microphone alert appears, allows it and presses
    /// again (the first press is then spent on the alert). Waits for `heard` to say "electricity".
    @MainActor
    private func holdToTalk(_ button: XCUIElement, app: XCUIApplication, heard: XCUIElement) {
        let electricity = NSPredicate(format: "label CONTAINS[c] 'electricity'")
        for attempt in 1...3 {
            button.press(forDuration: 1.5)
            let alertAnswered = allowMicrophone()
            if attempt == 1 { attach("p00-mic-press-\(alertAnswered ? "alert" : "no-alert")") }
            if XCTWaiter.wait(for: [expectation(for: electricity, evaluatedWith: heard)], timeout: alertAnswered ? 3 : 15) == .completed {
                return
            }
        }
        XCTFail("no transcript after three presses with the real microphone")
    }

    /// Taps Allow on the system microphone alert if it is up. Returns true when it was.
    private func allowMicrophone() -> Bool {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let alert = springboard.alerts.firstMatch
        guard alert.waitForExistence(timeout: 2) else { return false }
        for label in ["Allow", "OK", "Allow While Using App"] where alert.buttons[label].exists {
            alert.buttons[label].tap()
            return true
        }
        alert.buttons.element(boundBy: alert.buttons.count - 1).tap()
        return true
    }

    @MainActor
    private func launch(_ arguments: [String], settle: TimeInterval = 3) -> XCUIApplication {
        let app = XCUIApplication()
        let sample = arguments.contains("-sisu.sample") ? [] : ["-sisu.sample", "1"]
        app.launchArguments = sample + ["-sisu.screenshots", "1"] + arguments
        app.launch()
        Thread.sleep(forTimeInterval: settle)
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
