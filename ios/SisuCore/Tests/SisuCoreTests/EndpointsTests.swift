import XCTest
@testable import SisuCore

/// `Endpoints`: the requests of the four data routes.
final class EndpointsTests: XCTestCase {
    private let base = URL(string: "http://localhost:3000")!

    func testDemoCustomersAndOverview() {
        let demo = Endpoints.demoCustomers(baseURL: base)
        XCTAssertEqual(demo.url?.absoluteString, "http://localhost:3000/api/customers/demo")
        XCTAssertEqual(demo.httpMethod, "GET")
        let overview = Endpoints.overview(baseURL: URL(string: "http://localhost:3000/")!, customerId: "CUST 1/2")
        XCTAssertEqual(overview.url?.absoluteString, "http://localhost:3000/api/customers/CUST%201%2F2/overview")
        XCTAssertEqual(overview.httpMethod, "GET")
    }

    func testTransactionsQueryOrder() {
        let none = Endpoints.transactions(baseURL: base, customerId: "CUST04974", filter: nil)
        XCTAssertEqual(none.url?.absoluteString, "http://localhost:3000/api/customers/CUST04974/transactions")
        let filter = EvidenceFilter(from: "2025-11-01", to: "2026-10-31", category: "Food & drink", basket: .everyday, mcc: "5411", negativeBalance: true)
        let all = Endpoints.transactions(baseURL: base, customerId: "CUST04974", filter: filter)
        XCTAssertEqual(all.url?.absoluteString,
                       "http://localhost:3000/api/customers/CUST04974/transactions?from=2025-11-01&to=2026-10-31&category=Food%20%26%20drink&basket=everyday&mcc=5411&negativeBalance=true")
        let some = Endpoints.transactions(baseURL: base, customerId: "CUST04974", filter: EvidenceFilter(from: "a", to: "b", negativeBalance: false))
        XCTAssertEqual(some.url?.query, "from=a&to=b&negativeBalance=false")
    }

    func testScenarioBody() throws {
        let request = Endpoints.scenario(baseURL: base, customerId: "CUST04974", input: ScenarioInput(billSavingPerMonth: 15, everydayCutPct: 10, years: 5))
        XCTAssertEqual(request.url?.absoluteString, "http://localhost:3000/api/scenarios")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(request.httpBody)) as? [String: Any])
        XCTAssertEqual(Set(body.keys), ["customerId", "billSavingPerMonth", "everydayCutPct", "years"])
        XCTAssertEqual(body["customerId"] as? String, "CUST04974")
        XCTAssertEqual(body["billSavingPerMonth"] as? Double, 15)
        XCTAssertEqual(body["everydayCutPct"] as? Double, 10)
        XCTAssertEqual(body["years"] as? Int, 5)
    }
}
