import XCTest
@testable import SisuCore

/// `ScenarioEngine` reproduces the bundled answers of `POST /api/scenarios` to within 0.01.
final class ScenarioEngineTests: XCTestCase {
    func testCleanClampsToTheServerLimits() {
        XCTAssertEqual(ScenarioEngine.clean(ScenarioInput(billSavingPerMonth: 900, everydayCutPct: -4, years: 40)),
                       ScenarioInput(billSavingPerMonth: 500, everydayCutPct: 0, years: 10))
        XCTAssertEqual(ScenarioEngine.clean(ScenarioInput(billSavingPerMonth: .nan, everydayCutPct: 75, years: 0)),
                       ScenarioInput(billSavingPerMonth: 0, everydayCutPct: 50, years: 1))
        XCTAssertEqual(ScenarioEngine.clean(ScenarioInput(billSavingPerMonth: 15, everydayCutPct: 10, years: 5)),
                       ScenarioInput(billSavingPerMonth: 15, everydayCutPct: 10, years: 5))
    }

    func testMatchesEveryBundledScenario() throws {
        for id in FixtureAPI.customerIds {
            let overview = try FixtureAPI.load("overview-\(id)", as: Overview.self)
            for name in ["default", "nothing"] {
                let expected = try FixtureAPI.load("scenario-\(id)-\(name)", as: ScenarioResponse.self)
                let actual = ScenarioEngine.run(overview: overview, input: expected.input)
                let tag = "\(id) \(name)"
                XCTAssertEqual(actual.customerId, expected.customerId, tag)
                XCTAssertEqual(actual.dataTimestamp, expected.dataTimestamp, tag)
                XCTAssertEqual(actual.currency, expected.currency, tag)
                XCTAssertEqual(actual.input, expected.input, tag)
                XCTAssertEqual(actual.freedPerMonth, expected.freedPerMonth, accuracy: 0.01, tag)
                XCTAssertEqual(actual.assumptions, expected.assumptions, tag)
                XCTAssertEqual(actual.branches.map(\.id), expected.branches.map(\.id), tag)
                XCTAssertEqual(actual.branches.map(\.label), expected.branches.map(\.label), tag)
                for (a, e) in zip(actual.branches, expected.branches) {
                    XCTAssertEqual(a.endTotal, e.endTotal, accuracy: 0.01, tag)
                    XCTAssertEqual(a.endLow, e.endLow, accuracy: 0.01, tag)
                    XCTAssertEqual(a.endHigh, e.endHigh, accuracy: 0.01, tag)
                    XCTAssertEqual(a.runwayMonthsAtYear1, e.runwayMonthsAtYear1, accuracy: 0.01, tag)
                    XCTAssertEqual(a.points.count, e.points.count, tag)
                    for (p, q) in zip(a.points, e.points) {
                        XCTAssertEqual(p.month, q.month, tag)
                        XCTAssertEqual(p.cash, q.cash, accuracy: 0.01, tag)
                        XCTAssertEqual(p.invested, q.invested, accuracy: 0.01, tag)
                        XCTAssertEqual(p.total, q.total, accuracy: 0.01, tag)
                        XCTAssertEqual(p.totalLow, q.totalLow, accuracy: 0.01, tag)
                        XCTAssertEqual(p.totalHigh, q.totalHigh, accuracy: 0.01, tag)
                    }
                }
            }
        }
    }

    func testFixtureAPIComputesScenariosOffline() async throws {
        let api = FixtureAPI()
        XCTAssertEqual(api.kind, .bundledSample)
        let result = try await api.scenario(customerId: "CUST04974", input: ScenarioInput(billSavingPerMonth: 15, everydayCutPct: 10, years: 5))
        XCTAssertEqual(result.freedPerMonth, 87.32, accuracy: 0.01)
        XCTAssertEqual(result.branches.count, 3)
        XCTAssertEqual(result.branches[0].points.count, 61)
        do {
            _ = try await api.overview(customerId: "NOPE")
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? SisuError, .unknownCustomer("NOPE"))
        }
    }
}
