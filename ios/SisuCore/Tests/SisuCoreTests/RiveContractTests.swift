import XCTest
@testable import SisuCore

/// `RiveComponent` against the table of `rive/contract.json` (embedded here, nothing is read from disk).
final class RiveContractTests: XCTestCase {
    private struct Row {
        let name: String, file: RiveFile, width: Double, height: Double, sizing: RiveSizing, out: [String], fallback: RiveComponent?
    }

    private let table: [Row] = [
        Row(name: "Button", file: .ui, width: 350, height: 60, sizing: .flexibleWidth, out: ["pressed"], fallback: nil),
        Row(name: "HeroNumber", file: .ui, width: 350, height: 200, sizing: .flexibleWidth, out: [], fallback: nil),
        Row(name: "BasketBar", file: .ui, width: 350, height: 40, sizing: .flexibleWidth, out: [], fallback: nil),
        Row(name: "BasketChip", file: .ui, width: 160, height: 32, sizing: .fixed, out: [], fallback: nil),
        Row(name: "ProgressBar", file: .ui, width: 350, height: 14, sizing: .flexibleWidth, out: [], fallback: nil),
        Row(name: "StatPill", file: .ui, width: 96, height: 36, sizing: .fixed, out: [], fallback: nil),
        Row(name: "TabBar", file: .ui, width: 390, height: 64, sizing: .flexibleWidth, out: ["tap0", "tap1", "tap2", "tap3"], fallback: nil),
        Row(name: "ActionRow", file: .ui, width: 350, height: 56, sizing: .flexibleWidth, out: ["pressed"], fallback: nil),
        Row(name: "ChoiceCard", file: .ui, width: 350, height: 64, sizing: .flexibleWidth, out: ["pressed"], fallback: nil),
        Row(name: "VoiceButton", file: .ui, width: 96, height: 96, sizing: .fixed, out: ["pressDown", "pressUp"], fallback: nil),
        Row(name: "StageIndicator", file: .ui, width: 350, height: 72, sizing: .flexibleWidth, out: [], fallback: nil),
        Row(name: "Liito", file: .ui, width: 240, height: 240, sizing: .contain, out: [], fallback: nil),
        Row(name: "Jar", file: .ui, width: 160, height: 200, sizing: .contain, out: [], fallback: nil),
        Row(name: "Celebration", file: .ui, width: 390, height: 844, sizing: .fill, out: ["done"], fallback: nil),
        Row(name: "Sticker", file: .ui, width: 120, height: 120, sizing: .contain, out: [], fallback: nil),
        Row(name: "Toggle", file: .ui, width: 64, height: 36, sizing: .fixed, out: ["toggled"], fallback: nil),
        Row(name: "Tag", file: .ui, width: 200, height: 28, sizing: .fixed, out: [], fallback: nil),
        Row(name: "Jar3D", file: .threeD, width: 320, height: 360, sizing: .contain, out: [], fallback: .jar),
        Row(name: "Liito3D", file: .threeD, width: 320, height: 320, sizing: .contain, out: [], fallback: .liito),
        Row(name: "Baskets3D", file: .threeD, width: 350, height: 260, sizing: .contain, out: [], fallback: .basketBar),
        Row(name: "Berries3D", file: .threeD, width: 320, height: 240, sizing: .contain, out: [], fallback: .statPill),
    ]

    func testEveryComponentMatchesTheContract() throws {
        XCTAssertEqual(RiveComponent.allCases.count, 21)
        XCTAssertEqual(RiveComponent.allCases.map(\.rawValue), table.map(\.name))
        for row in table {
            let component = try XCTUnwrap(RiveComponent(rawValue: row.name))
            XCTAssertEqual(component.file, row.file, row.name)
            XCTAssertEqual(component.designSize.width, row.width, row.name)
            XCTAssertEqual(component.designSize.height, row.height, row.name)
            XCTAssertEqual(component.sizing, row.sizing, row.name)
            XCTAssertEqual(component.outTriggers, row.out, row.name)
            XCTAssertEqual(component.fallback, row.fallback, row.name)
        }
    }

    func testFilesAndInTriggers() {
        XCTAssertEqual(RiveFile.ui.rawValue, "sisu_ui")
        XCTAssertEqual(RiveFile.threeD.rawValue, "sisu_3d")
        XCTAssertEqual(RiveComponent.allCases.filter { $0.file == .threeD }, [.jar3D, .liito3D, .baskets3D, .berries3D])
        XCTAssertEqual(RiveComponent.heroNumber.inTriggers, ["reveal"])
        XCTAssertEqual(RiveComponent.jar.inTriggers, ["celebrate"])
        XCTAssertEqual(RiveComponent.celebration.inTriggers, ["fire"])
        XCTAssertEqual(RiveComponent.berries3D.inTriggers, ["drop"])
        XCTAssertEqual(RiveComponent.button.inTriggers, [])
    }
}
