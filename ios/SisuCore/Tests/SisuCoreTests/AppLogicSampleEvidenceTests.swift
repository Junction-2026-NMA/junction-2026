import SisuCore
import XCTest

final class AppLogicSampleEvidenceTests: XCTestCase {
    func testCategoryFindsItsBasketFile() async throws {
        let overview = try await FixtureAPI().overview(customerId: "CUST04974")
        let filter = EvidenceFilter(from: overview.windowFrom, to: overview.windowTo, category: "Restaurants")
        XCTAssertEqual(SampleEvidence.basket(for: filter, in: overview), .everyday)
        XCTAssertEqual(SampleEvidence.basket(for: EvidenceFilter(from: "", to: "", basket: .regular), in: overview), .regular)
        XCTAssertNil(SampleEvidence.basket(for: EvidenceFilter(from: "", to: "", negativeBalance: true), in: overview))
    }

    func testNarrowKeepsOnlyMatchingRowsAndRecomputesTotals() {
        func row(_ date: String, _ category: String, _ amount: Double, _ balance: Double) -> Transaction {
            Transaction(customerId: "C", date: date, time: "12:00", category: category, amount: amount, balanceAfter: balance, type: "card")
        }
        let list = TransactionList(customerId: "C", dataTimestamp: "2026-09-30", currency: "EUR", count: 4, total: 0, truncated: false, transactions: [
            row("2026-09-01", "Restaurants", -10.5, 100),
            row("2026-08-01", "Restaurants", -4.25, -3),
            row("2026-08-02", "Groceries", -20, 50),
            row("2024-01-01", "Restaurants", -99, 10),
        ])
        let restaurants = SampleEvidence.narrow(list, to: EvidenceFilter(from: "2025-10-01", to: "2026-09-30", category: "Restaurants"))
        XCTAssertEqual(restaurants.count, 2)
        XCTAssertEqual(restaurants.total, -14.75, accuracy: 0.001)
        let negative = SampleEvidence.narrow(list, to: EvidenceFilter(from: "2025-10-01", to: "2026-09-30", negativeBalance: true))
        XCTAssertEqual(negative.transactions.map(\.amount), [-4.25])
        XCTAssertEqual(SampleEvidence.narrow(list, to: nil), list)
    }
}
