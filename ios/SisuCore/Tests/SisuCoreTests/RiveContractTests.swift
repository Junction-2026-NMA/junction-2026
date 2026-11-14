import XCTest
@testable import SisuCore

/// `RiveComponent` against the table of `rive/contract.json` (embedded here, nothing is read from disk).
final class RiveContractTests: XCTestCase {
    private struct Row {
        let name: String, file: RiveFile, width: Double, height: Double, sizing: RiveSizing, out: [String]
    }

    private let table: [Row] = [
        Row(name: "Button", file: .ui, width: 350, height: 60, sizing: .flexibleWidth, out: ["pressed"]),
        Row(name: "HeroNumber", file: .ui, width: 350, height: 200, sizing: .flexibleWidth, out: []),
        Row(name: "BasketBar", file: .ui, width: 350, height: 40, sizing: .flexibleWidth, out: []),
        Row(name: "BasketChip", file: .ui, width: 160, height: 32, sizing: .fixed, out: []),
        Row(name: "ProgressBar", file: .ui, width: 350, height: 14, sizing: .flexibleWidth, out: []),
        Row(name: "StatPill", file: .ui, width: 96, height: 36, sizing: .fixed, out: []),
        Row(name: "TabBar", file: .ui, width: 390, height: 64, sizing: .flexibleWidth, out: ["tap0", "tap1", "tap2", "tap3"]),
        Row(name: "ActionRow", file: .ui, width: 350, height: 56, sizing: .flexibleWidth, out: ["pressed"]),
        Row(name: "ChoiceCard", file: .ui, width: 350, height: 64, sizing: .flexibleWidth, out: ["pressed"]),
        Row(name: "VoiceButton", file: .ui, width: 96, height: 96, sizing: .fixed, out: ["pressDown", "pressUp"]),
        Row(name: "StageIndicator", file: .ui, width: 350, height: 72, sizing: .flexibleWidth, out: []),
        Row(name: "Liito", file: .ui, width: 240, height: 240, sizing: .contain, out: []),
        Row(name: "Jar", file: .ui, width: 160, height: 200, sizing: .contain, out: []),
        Row(name: "Celebration", file: .ui, width: 390, height: 844, sizing: .fill, out: ["done"]),
        Row(name: "Sticker", file: .ui, width: 120, height: 120, sizing: .contain, out: []),
        Row(name: "Toggle", file: .ui, width: 64, height: 36, sizing: .fixed, out: ["toggled"]),
        Row(name: "Tag", file: .ui, width: 200, height: 28, sizing: .fixed, out: []),
        Row(name: "Baskets", file: .ui, width: 350, height: 220, sizing: .flexibleWidth, out: []),
        Row(name: "Berries", file: .ui, width: 320, height: 200, sizing: .contain, out: []),
    ]

    func testEveryComponentMatchesTheContract() throws {
        XCTAssertEqual(RiveComponent.allCases.count, 19)
        XCTAssertEqual(RiveComponent.allCases.map(\.rawValue), table.map(\.name))
        for row in table {
            let component = try XCTUnwrap(RiveComponent(rawValue: row.name))
            XCTAssertEqual(component.file, row.file, row.name)
            XCTAssertEqual(component.designSize.width, row.width, row.name)
            XCTAssertEqual(component.designSize.height, row.height, row.name)
            XCTAssertEqual(component.sizing, row.sizing, row.name)
            XCTAssertEqual(component.outTriggers, row.out, row.name)
        }
    }

    func testFilesAndInTriggers() {
        XCTAssertEqual(RiveFile.ui.rawValue, "sisu_ui")
        XCTAssertEqual(RiveFile.allCases, [.ui])
        XCTAssertTrue(RiveComponent.allCases.allSatisfy { $0.file == .ui })
        XCTAssertEqual(RiveComponent.heroNumber.inTriggers, ["reveal"])
        XCTAssertEqual(RiveComponent.jar.inTriggers, ["celebrate"])
        XCTAssertEqual(RiveComponent.celebration.inTriggers, ["fire"])
        XCTAssertEqual(RiveComponent.berries.inTriggers, ["drop"])
        XCTAssertEqual(RiveComponent.baskets.inTriggers, [])
        XCTAssertEqual(RiveComponent.button.inTriggers, [])
    }
}
