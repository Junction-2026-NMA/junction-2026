import XCTest
@testable import SisuCore

/// Every bundled fixture decodes into the model that mirrors lib/types.ts.
final class ModelsDecodingTests: XCTestCase {
    private func data(_ name: String) throws -> Data {
        let url = try XCTUnwrap(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"), "missing fixture \(name)")
        return try Data(contentsOf: url)
    }

    func testDemoCustomersDecode() throws {
        let customers = try JSONDecoder().decode([DemoCustomer].self, from: data("demo-customers"))
        XCTAssertEqual(customers.count, 3)
        XCTAssertEqual(Set(customers.map(\.displayName)), ["Aino", "Eetu", "Sanna"])
    }

    func testOverviewsTransactionsAndScenariosDecode() throws {
        for id in ["CUST02003", "CUST04414", "CUST04974"] {
            let overview = try JSONDecoder().decode(Overview.self, from: data("overview-\(id)"))
            XCTAssertEqual(overview.customerId, id)
            XCTAssertEqual(overview.baskets.count, 3)
            for name in ["all", "regular", "irregular", "everyday"] {
                let list = try JSONDecoder().decode(TransactionList.self, from: data("transactions-\(id)-\(name)"))
                XCTAssertEqual(list.customerId, id)
            }
            for name in ["default", "nothing"] {
                let scenario = try JSONDecoder().decode(ScenarioResponse.self, from: data("scenario-\(id)-\(name)"))
                XCTAssertEqual(scenario.branches.count, 3)
            }
        }
    }
}
