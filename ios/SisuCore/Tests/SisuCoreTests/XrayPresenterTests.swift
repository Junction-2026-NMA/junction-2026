import XCTest
@testable import SisuCore

/// `XrayPresenter.hero`: what the safe-to-spend block says.
final class XrayPresenterTests: XCTestCase {
    private let nb = "\u{00A0}"

    func testAboveToneNeverBlames() async throws {
        let hero = XrayPresenter.hero(for: try await FixtureAPI().overview(customerId: "CUST04974"), language: .en)
        XCTAssertEqual(hero.eyebrow, "Safe to spend")
        XCTAssertEqual(hero.amount, "€164")
        XCTAssertEqual(hero.unit, "a week")
        XCTAssertEqual(hero.context, "About €12 a month above this on everyday choices.")
        XCTAssertEqual(hero.tone, .above)
        XCTAssertFalse(hero.context.lowercased().contains("overspent"))
    }

    func testRoomTone() async throws {
        let hero = XrayPresenter.hero(for: try await FixtureAPI().overview(customerId: "CUST04414"), language: .en)
        XCTAssertEqual(hero.amount, "€480")
        XCTAssertEqual(hero.context, "About €87 a month under this. That is room to save.")
        XCTAssertEqual(hero.tone, .room)
    }

    func testFinnish() async throws {
        let hero = XrayPresenter.hero(for: try await FixtureAPI().overview(customerId: "CUST02003"), language: .fi)
        XCTAssertEqual(hero.eyebrow, "Käytettävissä")
        XCTAssertEqual(hero.unit, "viikossa")
        XCTAssertEqual(hero.amount, "364\(nb)€")
        XCTAssertEqual(hero.context, "Noin 1\(nb)471\(nb)€ kuukaudessa tämän alle. Siinä on tilaa säästää.")
        let above = XrayPresenter.hero(for: try await FixtureAPI().overview(customerId: "CUST04974"), language: .fi)
        XCTAssertEqual(above.context, "Noin 12\(nb)€ kuukaudessa tämän yli arjen valinnoissa.")
    }
}
