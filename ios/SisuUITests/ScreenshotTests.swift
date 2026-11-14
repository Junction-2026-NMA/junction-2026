// The screenshot harness. Each shot launches the app in sample mode with launch arguments that put it in one
// state, waits for it to settle, and attaches a full-screen screenshot named after the shot.
// Run it with `sh ios/scripts/screenshots.sh` (from the repository root); the PNGs land in
// ios/.derived-app/screens/<name>.png.
import XCTest

final class ScreenshotTests: XCTestCase {
    /// One screenshot: its file name and the launch arguments that set the app up for it.
    private struct Shot {
        let name: String
        let arguments: [String]
    }

    private static let customer = ["-sisu.customer", "CUST04974"]

    private static let shots: [Shot] = [
        Shot(name: "01-picker", arguments: []),
        Shot(name: "02-today-top", arguments: customer + ["-sisu.tab", "today"]),
        Shot(name: "03-today-baskets", arguments: customer + ["-sisu.tab", "today", "-sisu.scroll", "baskets"]),
        Shot(name: "04-today-bill", arguments: customer + ["-sisu.tab", "today", "-sisu.scroll", "bill"]),
        Shot(name: "05-today-insights", arguments: customer + ["-sisu.tab", "today", "-sisu.scroll", "insights"]),
        Shot(name: "06-today-end", arguments: customer + ["-sisu.tab", "today", "-sisu.scroll", "end"]),
        Shot(name: "07-maths", arguments: customer + ["-sisu.tab", "today", "-sisu.sheet", "maths"]),
        Shot(name: "08-transactions", arguments: customer + ["-sisu.tab", "today", "-sisu.sheet", "transactions"]),
        Shot(name: "09-jars-question", arguments: customer + ["-sisu.tab", "jars"]),
        Shot(name: "10-jars-answered", arguments: customer + ["-sisu.tab", "jars", "-sisu.answer", "save", "-sisu.scroll", "question"]),
        Shot(name: "11-jars-futures", arguments: customer + ["-sisu.tab", "jars", "-sisu.answer", "save", "-sisu.scroll", "futures"]),
        Shot(name: "12-settings", arguments: customer + ["-sisu.tab", "today", "-sisu.sheet", "settings"]),
        Shot(name: "13-ask", arguments: customer + ["-sisu.tab", "ask"]),
        Shot(name: "14-path", arguments: customer + ["-sisu.tab", "path"]),
        Shot(name: "17-sanna-today", arguments: ["-sisu.customer", "CUST02003", "-sisu.tab", "today"]),
        Shot(name: "18-eetu-jars", arguments: ["-sisu.customer", "CUST04414", "-sisu.tab", "jars", "-sisu.answer", "invest", "-sisu.scroll", "question"]),
        Shot(name: "19-sanna-baskets", arguments: ["-sisu.customer", "CUST02003", "-sisu.tab", "today", "-sisu.scroll", "baskets"]),
        // Live from the team backend in mock mode. Falls back to sample data (and says so) when it is not running.
        Shot(name: "15-live-today", arguments: customer + ["-sisu.sample", "0", "-sisu.baseURL", "http://localhost:3300", "-sisu.tab", "today"]),
        Shot(name: "16-live-settings", arguments: customer + ["-sisu.sample", "0", "-sisu.baseURL", "http://localhost:3300", "-sisu.sheet", "settings"]),
    ]

    override func setUp() {
        continueAfterFailure = true
    }

    @MainActor
    func testScreens() {
        let filter = ProcessInfo.processInfo.environment["SISU_SHOTS"] ?? ""
        let only: [String]? = filter.isEmpty ? nil : filter.split(separator: ",").map(String.init)
        for shot in Self.shots where only == nil || only!.contains(where: { shot.name.contains($0) }) {
            let app = XCUIApplication()
            // Sample data only unless the shot says otherwise, and a clean slate each time.
            let sample = shot.arguments.contains("-sisu.sample") ? [] : ["-sisu.sample", "1"]
            app.launchArguments = sample + ["-sisu.screenshots", "1"] + shot.arguments
            app.launch()
            // Let the sample data load, Rive draw its first frames and any scroll or sheet settle.
            Thread.sleep(forTimeInterval: 3)
            let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            attachment.name = shot.name
            attachment.lifetime = .keepAlways
            add(attachment)
            app.terminate()
        }
    }

    /// Real taps on Rive components, to prove their triggers arrive: a daily action row, the bill's confirm
    /// button, the tab bar and a choice card. Shots 20 to 23.
    @MainActor
    func testTaps() {
        let filter = ProcessInfo.processInfo.environment["SISU_SHOTS"] ?? ""
        guard filter.isEmpty || filter.contains("tap") else { return }
        let app = XCUIApplication()
        app.launchArguments = ["-sisu.sample", "1", "-sisu.screenshots", "1", "-sisu.customer", "CUST04974", "-sisu.tab", "today"]
        app.launch()
        Thread.sleep(forTimeInterval: 3)

        let row = app.buttons["Confirm your bill's name"]
        if row.waitForExistence(timeout: 5) { row.tap() }
        Thread.sleep(forTimeInterval: 1.5)
        shot("20-tap-row-scrolls-to-bill")

        let confirm = app.buttons["Yes, that's it"]
        if confirm.waitForExistence(timeout: 5) { confirm.tap() }
        Thread.sleep(forTimeInterval: 1.5)
        shot("21-tap-bill-confirmed")

        // The Rive tab bar: tap the third quarter (Jars) near the bottom of the screen.
        let window = app.windows.firstMatch
        window.coordinate(withNormalizedOffset: CGVector(dx: 0.625, dy: 0.93)).tap()
        Thread.sleep(forTimeInterval: 2)
        shot("22-tap-tab-jars")

        let choice = app.buttons["Make the change, invest it"]
        if choice.waitForExistence(timeout: 5) {
            app.swipeUp()
            Thread.sleep(forTimeInterval: 1)
            choice.tap()
        }
        Thread.sleep(forTimeInterval: 2)
        shot("23-tap-choice")

        // Back to Today and the last daily action: Sisu switches to Ask and celebrates three for three.
        window.coordinate(withNormalizedOffset: CGVector(dx: 0.125, dy: 0.93)).tap()
        Thread.sleep(forTimeInterval: 2)
        let investigate = app.buttons["Let Sisu look into it"]
        if investigate.waitForExistence(timeout: 5) { investigate.tap() }
        Thread.sleep(forTimeInterval: 1.2)
        shot("24-tap-celebration")
        Thread.sleep(forTimeInterval: 4.5)
        shot("25-tap-ask-after")
        app.terminate()
    }

    /// Correcting the bill's name: shots 26 and 27.
    @MainActor
    func testRenameBill() {
        let filter = ProcessInfo.processInfo.environment["SISU_SHOTS"] ?? ""
        guard filter.isEmpty || filter.contains("rename") else { return }
        let app = XCUIApplication()
        app.launchArguments = ["-sisu.sample", "1", "-sisu.screenshots", "1", "-sisu.customer", "CUST04974",
                               "-sisu.tab", "today", "-sisu.scroll", "bill"]
        app.launch()
        Thread.sleep(forTimeInterval: 3)
        let change = app.buttons["No, change the name"]
        if change.waitForExistence(timeout: 5) { change.tap() }
        Thread.sleep(forTimeInterval: 1)
        let field = app.textFields.firstMatch
        if field.waitForExistence(timeout: 3) {
            field.tap()
            field.press(forDuration: 1.2)
            if app.menuItems["Select All"].waitForExistence(timeout: 1) { app.menuItems["Select All"].tap() }
            field.typeText("Helen electricity")
        }
        Thread.sleep(forTimeInterval: 0.5)
        shot("26-rename-typing")
        let save = app.buttons["Save the name"]
        if save.waitForExistence(timeout: 3) { save.tap() }
        Thread.sleep(forTimeInterval: 1.5)
        shot("27-rename-saved")
        app.terminate()
    }

    /// The Rive toggle in settings: starts live, one tap switches to sample data only. Shot 28.
    @MainActor
    func testToggle() {
        let filter = ProcessInfo.processInfo.environment["SISU_SHOTS"] ?? ""
        guard filter.isEmpty || filter.contains("toggle") else { return }
        let app = XCUIApplication()
        app.launchArguments = ["-sisu.sample", "0", "-sisu.baseURL", "http://localhost:3300", "-sisu.screenshots", "1",
                               "-sisu.customer", "CUST04974", "-sisu.sheet", "settings"]
        app.launch()
        Thread.sleep(forTimeInterval: 3)
        let toggle = app.buttons["Use sample data only"]
        if toggle.waitForExistence(timeout: 5) { toggle.tap() }
        Thread.sleep(forTimeInterval: 2)
        shot("28-toggle-sample-on")
        app.terminate()
    }

    @MainActor
    private func shot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
