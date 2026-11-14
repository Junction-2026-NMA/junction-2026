import XCTest
@testable import SisuCore

/// `BasketKind.label`, `BasketId.kind` and `BasketMath.shares`.
final class BasketMathTests: XCTestCase {
    func testLabels() {
        XCTAssertEqual(BasketKind.allCases.map { $0.label(.en) }, ["Fixed", "Curveballs", "Leaks", "Jars"])
        XCTAssertEqual(BasketKind.allCases.map { $0.label(.fi) }, ["Kiinteät", "Yllärit", "Vuodot", "Purkit"])
        XCTAssertEqual(BasketId.allCases.map(\.kind), [.fixed, .curveballs, .leaks])
    }

    func testSharesOfBundledCustomers() async throws {
        let eetu = BasketMath.shares(for: try await FixtureAPI().overview(customerId: "CUST04414"))
        XCTAssertEqual(eetu.fixed, 0.235670, accuracy: 0.000001)
        XCTAssertEqual(eetu.curveballs, 0.099566, accuracy: 0.000001)
        XCTAssertEqual(eetu.leaks, 0.579361, accuracy: 0.000001)
        XCTAssertEqual(eetu.jars, 0.085403, accuracy: 0.000001)
        XCTAssertEqual(eetu.fixed + eetu.curveballs + eetu.leaks + eetu.jars, 1, accuracy: 0.000001)

        let aino = BasketMath.shares(for: try await FixtureAPI().overview(customerId: "CUST04974"))
        XCTAssertEqual(aino.jars, 0)
        XCTAssertEqual(aino.fixed + aino.curveballs + aino.leaks, 1, accuracy: 0.000001)
    }

    func testMissingNegativeAndNonFiniteAmountsCountAsZero() async throws {
        var overview = try await FixtureAPI().overview(customerId: "CUST04414")
        overview.baskets.removeAll { $0.id == .irregular }
        overview.baskets[0].monthlyAvg = 300
        overview.baskets[1].monthlyAvg = .nan
        overview.monthlySaved = 100
        let shares = BasketMath.shares(for: overview)
        XCTAssertEqual(shares.curveballs, 0)
        XCTAssertEqual(shares.fixed + shares.leaks + shares.jars, 1, accuracy: 0.000001)
        XCTAssertEqual(shares.jars, 0.25, accuracy: 0.000001)

        overview.baskets = []
        overview.monthlySaved = -5
        XCTAssertEqual(BasketMath.shares(for: overview), .zero)
        overview.monthlySaved = .infinity
        XCTAssertEqual(BasketMath.shares(for: overview), .zero)
    }
}
