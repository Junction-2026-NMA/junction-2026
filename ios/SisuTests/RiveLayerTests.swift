// The parts of the app's Rive layer and theme that can be checked without a Rive file.
import SisuCore
import SwiftUI
import UIKit
import XCTest
@testable import Sisu

final class RiveTriggerRequestTests: XCTestCase {
    func testNameIsTheTextBeforeTheStamp() {
        XCTAssertEqual(RiveTriggerRequest.name(of: "reveal"), "reveal")
        XCTAssertEqual(RiveTriggerRequest.name(of: "reveal#3"), "reveal")
        XCTAssertEqual(RiveTriggerRequest.name(of: "reveal#a#b"), "reveal")
    }

    func testOnlyRequestsThatAreNewFire() {
        XCTAssertEqual(RiveTriggerRequest.namesToFire(old: [], new: ["celebrate"]), ["celebrate"])
        XCTAssertEqual(RiveTriggerRequest.namesToFire(old: ["reveal#1"], new: ["reveal#1", "celebrate#1"]), ["celebrate"])
        XCTAssertEqual(RiveTriggerRequest.namesToFire(old: ["reveal#1"], new: ["reveal#1"]), [])
    }

    func testChangingTheStampFiresTheSameTriggerAgain() {
        XCTAssertEqual(RiveTriggerRequest.namesToFire(old: ["drop#1"], new: ["drop#2"]), ["drop"])
    }

    func testRemovingARequestFiresNothing() {
        XCTAssertEqual(RiveTriggerRequest.namesToFire(old: ["celebrate"], new: []), [])
    }

    func testARequestWithoutANameIsIgnored() {
        XCTAssertEqual(RiveTriggerRequest.namesToFire(old: [], new: ["#1", ""]), [])
    }
}

final class RiveComponentRequestTests: XCTestCase {
    func testA3DComponentIsTriedBeforeIts2DFallback() {
        XCTAssertEqual(RiveComponentRequest(component: .jar3D).candidates, [.jar3D, .jar])
        XCTAssertEqual(RiveComponentRequest(component: .berries3D).candidates, [.berries3D, .statPill])
        XCTAssertEqual(RiveComponentRequest(component: .button).candidates, [.button])
    }

    func testASizingOverrideWinsOverTheContract() {
        XCTAssertEqual(RiveComponentRequest(component: .toggle).sizing(for: .toggle), .fixed)
        XCTAssertEqual(RiveComponentRequest(component: .toggle, sizing: .contain).sizing(for: .toggle), .contain)
    }

    @MainActor
    func testAMissingFileIsReportedOnceAndNeverCrashes() async {
        // A bundle with no .riv files in it.
        let library = RiveLibrary(bundle: Bundle(for: RiveComponentRequestTests.self))
        XCTAssertFalse(library.isBundled(.ui))
        XCTAssertEqual(library.status(of: .ui), .notRequested)
        let available = await library.isAvailable(.ui)
        XCTAssertFalse(available)
        XCTAssertEqual(library.status(of: .ui), .unavailable(.notBundled("sisu_ui.riv")))
        XCTAssertFalse(library.canLoad(.ui))
    }
}

final class SisuThemeTests: XCTestCase {
    func testTheFiveBundledFontsAreRegisteredUnderTheirPostScriptNames() {
        XCTAssertEqual(SisuTheme.Font.postScriptNames.count, 5)
        for name in SisuTheme.Font.postScriptNames {
            XCTAssertEqual(
                UIFont(name: name, size: 12)?.fontName, name,
                "\(name) is not registered. Check UIAppFonts in ios/project.yml and the files in ios/Sisu/Resources/Fonts."
            )
        }
    }

    func testHexColours() {
        XCTAssertEqual(hex(of: SisuTheme.Color.green900), 0x004628)
        XCTAssertEqual(hex(of: SisuTheme.Color.green200), 0x91FA9B)
        XCTAssertEqual(hex(of: Color(hex: 0xB70000)), 0xB70000)
    }

    func testRoleColoursFollowLightAndDarkMode() {
        XCTAssertEqual(hex(of: SisuTheme.Color.background, in: .light), 0xEBF7EC)
        XCTAssertEqual(hex(of: SisuTheme.Color.background, in: .dark), 0x00301B)
        XCTAssertEqual(hex(of: SisuTheme.Color.card, in: .light), 0xFFFFFF)
        XCTAssertEqual(hex(of: SisuTheme.Color.card, in: .dark), 0x004628)
        XCTAssertEqual(hex(of: SisuTheme.Color.text, in: .dark), 0xF7FCF7)
        XCTAssertEqual(hex(of: SisuTheme.Color.primary, in: .dark), 0x91FA9B)
        XCTAssertEqual(hex(of: SisuTheme.Color.onPrimary, in: .dark), 0x00301B)
    }

    private func hex(of color: Color, in style: UIUserInterfaceStyle = .light) -> UInt32 {
        let resolved = UIColor(color).resolvedColor(with: UITraitCollection(userInterfaceStyle: style))
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        resolved.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        return UInt32((red * 255).rounded()) << 16 | UInt32((green * 255).rounded()) << 8 | UInt32((blue * 255).rounded())
    }
}
