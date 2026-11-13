// How RiveComponentView sizes itself and comes up in SwiftUI.
// The sizing tests need no Rive file: without one the view lays out the same and draws a placeholder.
import RiveRuntime
import SisuCore
import SwiftUI
import XCTest
@testable import Sisu

final class RiveComponentViewTests: XCTestCase {
    private let screen = CGSize(width: 390, height: 800)

    @MainActor
    func testAFixedComponentTakesExactlyItsDesignSize() {
        assertSize(of: RiveComponentView(.toggle), is: CGSize(width: 64, height: 36))
        assertSize(of: RiveComponentView(.statPill), is: CGSize(width: 96, height: 36))
        assertSize(of: RiveComponentView(.statPill).frame(width: 200, height: 80), is: CGSize(width: 200, height: 80))
    }

    @MainActor
    func testAFlexibleWidthComponentFillsTheWidthAtItsDesignHeight() {
        assertSize(of: RiveComponentView(.button), is: CGSize(width: 390, height: 60))
        assertSize(of: RiveComponentView(.button).frame(width: 200), is: CGSize(width: 200, height: 60))
        assertSize(of: RiveComponentView(.heroNumber).padding(.horizontal, 20), is: CGSize(width: 390, height: 200))
    }

    @MainActor
    func testAContainComponentFitsTheFrameItIsGiven() {
        assertSize(of: RiveComponentView(.liito), is: CGSize(width: 390, height: 390))
        assertSize(of: RiveComponentView(.liito).frame(width: 120, height: 120), is: CGSize(width: 120, height: 120))
        assertSize(of: RiveComponentView(.jar), is: CGSize(width: 390, height: 487.5))
        assertSize(of: RiveComponentView(.jar).frame(height: 200), is: CGSize(width: 160, height: 200))
    }

    @MainActor
    func testAFillComponentFillsTheFrame() {
        assertSize(of: RiveComponentView(.celebration), is: screen)
    }

    @MainActor
    func testASizingOverrideMakesAFixedComponentFollowTheParentsFrame() {
        let larger = RiveComponentView(.toggle).sizing(.contain).frame(width: 96, height: 54)
        assertSize(of: larger, is: CGSize(width: 96, height: 54))
        assertSize(of: RiveComponentView(.toggle).sizing(.contain), in: CGSize(width: 128, height: 500), is: CGSize(width: 128, height: 72))
    }

    /// A scroll view gives its content no height to fit into. A `contain` component then takes its design size.
    @MainActor
    func testWhereNoHeightIsGivenEveryKindFallsBackToItsDesignHeight() {
        let column = VStack(spacing: 0) {
            RiveComponentView(.button)
            RiveComponentView(.toggle)
            RiveComponentView(.liito)
        }
        .fixedSize(horizontal: false, vertical: true)
        assertSize(of: column, is: CGSize(width: 390, height: 60 + 36 + 240))
    }

    /// With the real file in the app, every 2D component must come up as a Rive view, not as a placeholder.
    @MainActor
    func testWithTheRiveFileEvery2DComponentAppearsAsARiveView() async throws {
        guard RiveLibrary.shared.isBundled(.ui) else {
            throw XCTSkip("sisu_ui.riv is not in the app bundle yet, so there is no artboard to put on screen.")
        }
        continueAfterFailure = true
        for component in RiveComponent.allCases where component.contract.file == .ui {
            await assertRiveViewAppears(for: component, library: nil)
        }
    }

    /// Without the 3D file, a 3D component must come up as its 2D fallback.
    @MainActor
    func testWithoutThe3DFileA3DComponentAppearsAsItsFallback() async throws {
        guard RiveLibrary.shared.isBundled(.ui), !RiveLibrary.shared.isBundled(.threeD) else {
            throw XCTSkip("needs sisu_ui.riv in the app bundle and no sisu_3d.riv")
        }
        await assertRiveViewAppears(for: .jar3D, library: nil)
    }

    // MARK: - Helpers

    @MainActor
    private func assertSize(
        of view: some View, in proposal: CGSize? = nil, is expected: CGSize,
        file: StaticString = #filePath, line: UInt = #line
    ) {
        let size = UIHostingController(rootView: view).sizeThatFits(in: proposal ?? screen)
        XCTAssertEqual(size.width, expected.width, accuracy: 0.5, "width", file: file, line: line)
        XCTAssertEqual(size.height, expected.height, accuracy: 0.5, "height", file: file, line: line)
    }

    /// Hosts the component in a window of the running app and waits for Rive's own view to show up in it.
    @MainActor
    func assertRiveViewAppears(
        for component: RiveComponent, library: RiveLibrary?,
        file: StaticString = #filePath, line: UInt = #line
    ) async {
        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first else {
            XCTFail("the app has no window scene", file: file, line: line)
            return
        }
        let window = UIWindow(windowScene: scene)
        window.rootViewController = UIHostingController(rootView: RiveComponentView(component).environment(\.riveLibrary, library))
        window.isHidden = false
        defer { window.isHidden = true }

        var found: RiveUIView?
        for _ in 0..<60 where found == nil {
            try? await Task.sleep(nanoseconds: 50_000_000)
            found = window.rootViewController.flatMap { Self.firstRiveView(in: $0.view) }
        }
        guard let found else {
            XCTFail("\(component.rawValue) never appeared as a Rive view (it shows a placeholder)", file: file, line: line)
            return
        }
        XCTAssertNotNil(found.rive, "\(component.rawValue)", file: file, line: line)
        XCTAssertGreaterThan(found.bounds.width, 0, "\(component.rawValue)", file: file, line: line)
        XCTAssertGreaterThan(found.bounds.height, 0, "\(component.rawValue)", file: file, line: line)
        // A few frames on screen: a broken artboard or renderer would have crashed by now.
        try? await Task.sleep(nanoseconds: 200_000_000)
    }

    @MainActor
    private static func firstRiveView(in view: UIView) -> RiveUIView? {
        if let match = view as? RiveUIView { return match }
        for subview in view.subviews {
            if let match = firstRiveView(in: subview) { return match }
        }
        return nil
    }
}
