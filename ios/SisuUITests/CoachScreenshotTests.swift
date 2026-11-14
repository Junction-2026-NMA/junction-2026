// Screenshots of the coach (Ask tab), modelled on ScreenshotTests. Each shot launches the app in sample mode
// with the coach's own launch arguments (see ios/Sisu/Coach/CoachLaunch.swift), waits for the answer to settle
// and attaches a full-screen screenshot. Run it with:
//   SISU_DEVICE="iPhone 17 Pro Max" SISU_DERIVED=ios/.derived-coach SISU_ONLY=SisuUITests/CoachScreenshotTests sh ios/scripts/screenshots.sh
// The PNGs land in ios/.derived-coach/screens/<name>.png.
import XCTest

final class CoachScreenshotTests: XCTestCase {
    private struct Shot {
        let name: String
        let arguments: [String]
        /// Seconds to wait after launch.
        var wait: Double = 4
    }

    /// The default text size, whatever the simulator is set to, so shots compare with the design.
    private static let textSize = ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryL"]
    private static let customer = ["-sisu.customer", "CUST04974", "-sisu.tab", "ask"]
    private static let electricity = ["-sisu.coachAsk", "Can you find me a cheaper electricity deal?"]
    private static let investigate = ["-sisu.coachInvestigate", "1"]

    private static let shots: [Shot] = [
        Shot(name: "c01-ask-empty", arguments: customer, wait: 3),
        Shot(name: "c02-ask-typed", arguments: customer + ["-sisu.coachAsk", "How much do I spend on everyday things?", "-sisu.coachScroll", "end"], wait: 7),
        Shot(name: "c03-electricity-answer", arguments: customer + electricity + ["-sisu.coachScroll", "top"], wait: 8),
        Shot(name: "c04-electricity-offers", arguments: customer + electricity + ["-sisu.coachScroll", "offers"], wait: 8),
        // The recorded electricity turn has research, extraction and calculation (no teaching card: the quiz comes
        // with the investigation below).
        Shot(name: "c05-electricity-working", arguments: customer + electricity + ["-sisu.coachScroll", "calculation"], wait: 8),
        Shot(name: "c05b-investigate-streaming", arguments: customer + investigate, wait: 2.2),
        Shot(name: "c06-investigate-lead", arguments: customer + investigate + ["-sisu.coachScroll", "lead"], wait: 10),
        Shot(name: "c07-bills-evidence", arguments: customer + ["-sisu.coachAsk", "Which bills have gone up?", "-sisu.coachScroll", "evidence"], wait: 8),
        Shot(name: "c07b-remember-memory", arguments: customer + ["-sisu.coachAsk", "Remember that my electricity use is 3500 kWh", "-sisu.coachScroll", "end"], wait: 8),
        Shot(name: "c08-investigate-research", arguments: customer + investigate + ["-sisu.coachScroll", "research"], wait: 10),
        Shot(name: "c09-investigate-extraction", arguments: customer + investigate + ["-sisu.coachScroll", "extraction"], wait: 10),
        Shot(name: "c10-investigate-calculation", arguments: customer + investigate + ["-sisu.coachScroll", "calculation"], wait: 10),
        Shot(name: "c11-investigate-quiz", arguments: customer + investigate + ["-sisu.coachScroll", "teaching"], wait: 10),
        Shot(name: "c12-investigate-quiz-answered", arguments: customer + investigate + ["-sisu.coachQuiz", "1", "-sisu.coachScroll", "teaching"], wait: 10),
        Shot(name: "c13-approval-card", arguments: customer + investigate + ["-sisu.coachScroll", "action"], wait: 10),
        Shot(name: "c13b-approval-buttons", arguments: customer + investigate + ["-sisu.coachScroll", "action-bottom"], wait: 10),
        Shot(name: "c12b-investigate-impact", arguments: customer + investigate + ["-sisu.coachScroll", "impact"], wait: 10),
        Shot(name: "c14-investigate-end", arguments: customer + investigate + ["-sisu.coachScroll", "end"], wait: 10),
        Shot(name: "c16-after-approval", arguments: customer + investigate + ["-sisu.coachDecide", "approve", "-sisu.coachScroll", "action-bottom"], wait: 15),
        Shot(name: "c17-after-approval-end", arguments: customer + investigate + ["-sisu.coachDecide", "approve", "-sisu.coachScroll", "end"], wait: 15),
        // Live from the team backend in mock mode (falls back to sample data, and says so, when it is down).
        Shot(name: "c20-live-electricity", arguments: customer + electricity + ["-sisu.sample", "0", "-sisu.baseURL", "http://localhost:3300", "-sisu.coachScroll", "top"], wait: 12),
        Shot(name: "c21-live-offers", arguments: customer + electricity + ["-sisu.sample", "0", "-sisu.baseURL", "http://localhost:3300", "-sisu.coachScroll", "offers"], wait: 12),
        // The backend cannot be reached: the coach answers from the recordings and says so.
        Shot(name: "c22-offline-empty", arguments: customer + ["-sisu.sample", "0", "-sisu.baseURL", "http://localhost:9"], wait: 5),
    ]

    override func setUp() {
        continueAfterFailure = true
    }

    private var filter: [String]? {
        let raw = ProcessInfo.processInfo.environment["SISU_SHOTS"] ?? ""
        return raw.isEmpty ? nil : raw.split(separator: ",").map(String.init)
    }

    @MainActor
    func testCoachScreens() {
        for shot in Self.shots where filter == nil || filter!.contains(where: { shot.name.contains($0) }) {
            let app = XCUIApplication()
            let sample = shot.arguments.contains("-sisu.sample") ? [] : ["-sisu.sample", "1"]
            app.launchArguments = sample + ["-sisu.screenshots", "1"] + Self.textSize + shot.arguments
            app.launch()
            Thread.sleep(forTimeInterval: shot.wait)
            attach(shot.name)
            app.terminate()
        }
    }

    /// The approval with real taps: Approve on the card, the celebration, the screen after, then Jars.
    @MainActor
    func testCoachApproveFlow() {
        guard filter == nil || filter!.contains(where: { "c15-celebration".contains($0) || $0 == "flow" }) else { return }
        let app = XCUIApplication()
        app.launchArguments = ["-sisu.sample", "1", "-sisu.screenshots", "1"] + Self.textSize + Self.customer + Self.investigate + ["-sisu.coachScroll", "action"]
        app.launch()
        Thread.sleep(forTimeInterval: 10)
        let approve = app.buttons["Approve"]
        if approve.waitForExistence(timeout: 10) {
            approve.tap()
        } else {
            XCTFail("No Approve button")
        }
        let party = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Approved.")).firstMatch
        _ = party.waitForExistence(timeout: 4)
        Thread.sleep(forTimeInterval: 0.8)
        attach("c15-celebration")
        Thread.sleep(forTimeInterval: 5)
        attach("c18-after-approval-tapped")
        // The Rive tab bar: the third quarter (Jars).
        app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.625, dy: 0.95)).tap()
        Thread.sleep(forTimeInterval: 2.5)
        attach("c19-jars-after")
        app.swipeUp()
        Thread.sleep(forTimeInterval: 1.5)
        attach("c19b-jars-after-scrolled")
        app.terminate()
    }

    /// "Show transactions" on an evidence card opens the transactions sheet with that card's filter.
    @MainActor
    func testCoachEvidenceSheet() {
        guard filter == nil || filter!.contains(where: { "c23-evidence-sheet".contains($0) }) else { return }
        let app = XCUIApplication()
        app.launchArguments = ["-sisu.sample", "1", "-sisu.screenshots", "1"] + Self.textSize + Self.customer
            + ["-sisu.coachAsk", "Which bills have gone up?", "-sisu.coachScroll", "evidence"]
        app.launch()
        Thread.sleep(forTimeInterval: 8)
        let show = app.buttons["Show transactions"]
        if show.waitForExistence(timeout: 5) { show.tap() } else { XCTFail("No Show transactions button") }
        Thread.sleep(forTimeInterval: 2.5)
        attach("c23-evidence-sheet")
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
