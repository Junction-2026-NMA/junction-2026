// Checks the Rive layer against rive/contract.json. Runs inside the app on the simulator.
import RiveRuntime
import SisuCore
import XCTest
@testable import Sisu

final class RiveContractTests: XCTestCase {
    override func setUp() {
        super.setUp()
        continueAfterFailure = true
        // Used when test timeouts are on (ios/scripts/test-app.sh turns them on): a silent runtime fails, not hangs.
        executionTimeAllowance = 180
    }

    /// Every component the app knows is in the contract, with the same file, fallback, size, sizing and out triggers.
    func testContractTableMatchesContract() throws {
        let contract = try ContractJSON.load()
        var seen: [String] = []
        for (fileName, artboard) in contract.allArtboards {
            seen.append(artboard.name)
            guard let component = RiveComponent(rawValue: artboard.name) else {
                XCTFail("\(artboard.name) is in rive/contract.json but SisuCore has no RiveComponent for it")
                continue
            }
            let expected = RiveComponentContract(
                file: try XCTUnwrap(SisuCore.RiveFile(rawValue: fileName), "unknown Rive file \(fileName)"),
                fallback: artboard.fallback.flatMap(RiveComponent.init(rawValue:)),
                designSize: CGSize(width: artboard.size[0], height: artboard.size[1]),
                sizing: try XCTUnwrap(RiveSizing(rawValue: artboard.sizing), "unknown sizing \(artboard.sizing)"),
                outTriggers: artboard.properties.filter { $0.type == "trigger" && $0.direction == "out" }.map(\.name)
            )
            // What the views really use: SisuCore once it is implemented, the temporary table until then.
            XCTAssertEqual(component.contract, expected, "\(artboard.name): the app's contract differs from rive/contract.json")
            // Remove this line together with RiveContractTable.
            XCTAssertEqual(RiveContractTable.rows[component], expected, "\(artboard.name): RiveContractTable differs from rive/contract.json")
        }
        XCTAssertEqual(seen.sorted(), RiveComponent.allCases.map(\.rawValue).sorted(), "SisuCore's RiveComponent cases and the contract's artboards differ")
    }

    /// Every 2D artboard of the contract is in `sisu_ui.riv` with its view model, state machine and properties,
    /// and every `in` property accepts a value of its type.
    @MainActor
    func testEveryUIArtboardHonoursTheContract() async throws {
        try await check(.ui)
    }

    /// The same for the optional 3D file, once it is in the app.
    @MainActor
    func testEvery3DArtboardHonoursTheContract() async throws {
        try await check(.threeD)
    }

    @MainActor
    private func check(_ id: SisuCore.RiveFile) async throws {
        let name = "\(id.rawValue).riv"
        let contract = try ContractJSON.load()
        let artboards = try XCTUnwrap(contract.files[id.rawValue]?.artboards, "the contract has no file called \(id.rawValue)")
        guard RiveLibrary.shared.isBundled(id) else {
            throw XCTSkip("\(name) is not in the app bundle yet (expected at ios/Sisu/Resources/Rive/\(name)). Its Rive contract was NOT checked.")
        }

        var report = ContractReport()
        do {
            let file = try await RiveLibrary.shared.file(id)
            let checker = RiveArtboardChecker(file: file, contract: contract, fileEnums: await Self.enums(of: file, in: name, report: &report))
            checker.checkEnums(usedBy: artboards, report: &report)
            for artboard in artboards {
                await checker.check(artboard, report: &report)
            }
        } catch {
            report.fail(name, "the runtime could not load the file: \(error)")
        }

        let text = report.text(title: "\(name) against rive/contract.json")
        print(text)
        let attachment = XCTAttachment(string: text)
        attachment.name = "Rive contract report for \(name)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    @MainActor
    private static func enums(of file: File, in name: String, report: inout ContractReport) async -> [String: [String]] {
        do {
            let enums = try await file.getViewModelEnums()
            return Dictionary(enums.map { ($0.name, $0.values) }, uniquingKeysWith: { first, _ in first })
        } catch {
            report.fail(name, "the file's enums could not be listed: \(error)")
            return [:]
        }
    }
}

/// Collects one line per check and records a test failure for every mismatch.
struct ContractReport {
    private(set) var lines: [String] = []
    private(set) var failures = 0

    mutating func pass(_ subject: String, _ detail: String) {
        lines.append("PASS  \(subject): \(detail)")
    }

    mutating func note(_ subject: String, _ detail: String) {
        lines.append("NOTE  \(subject): \(detail)")
    }

    mutating func fail(_ subject: String, _ detail: String, file: StaticString = #filePath, line: UInt = #line) {
        failures += 1
        lines.append("FAIL  \(subject): \(detail)")
        XCTFail("\(subject): \(detail)", file: file, line: line)
    }

    func text(title: String) -> String {
        let passed = lines.filter { $0.hasPrefix("PASS") }.count
        let header = "[RiveContract] \(title): \(passed) passed, \(failures) failed"
        return ([header] + lines.map { "[RiveContract] \($0)" }).joined(separator: "\n")
    }
}
