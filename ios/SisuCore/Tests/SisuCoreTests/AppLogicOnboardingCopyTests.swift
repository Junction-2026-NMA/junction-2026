import SisuCore
import XCTest

final class AppLogicOnboardingCopyTests: XCTestCase {
    private func overview(_ id: String) async throws -> Overview {
        try await FixtureAPI().overview(customerId: id)
    }

    func testProfilesComeEetuFirstWithAPitchEach() async throws {
        let customers = try await FixtureAPI().demoCustomers()
        let sorted = OnboardingProfiles.sorted(customers)
        XCTAssertEqual(sorted.map(\.displayName), ["Eetu", "Aino", "Sanna"])
        XCTAssertEqual(OnboardingProfiles.pitch(for: "CUST04414"), "The biggest bill-switching win")
        for customer in customers {
            let pitch = OnboardingProfiles.pitch(for: customer.customerId)
            XCTAssertFalse(pitch.isEmpty)
            XCTAssertNil(pitch.rangeOfCharacter(from: .decimalDigits), "no figures before the overview is loaded")
        }
        XCTAssertEqual(OnboardingProfiles.subtitle(sorted[0]), "25 · Espoo")
        XCTAssertEqual(OnboardingProfiles.accessibilityLabel(sorted[0]), "Eetu, 25, Espoo. The biggest bill-switching win")
    }

    func testUnknownCustomersKeepTheirOrderAfterTheKnownOnes() {
        let other = DemoCustomer(customerId: "X1", displayName: "Xenia", age: 30, postalCode: "00100", area: "Helsinki")
        let other2 = DemoCustomer(customerId: "X2", displayName: "Yrjö", age: 31, postalCode: "00100", area: "Helsinki")
        let sanna = DemoCustomer(customerId: "CUST02003", displayName: "Sanna", age: 33, postalCode: "00350", area: "Helsinki")
        XCTAssertEqual(OnboardingProfiles.sorted([other, sanna, other2]).map(\.customerId), ["CUST02003", "X1", "X2"])
        XCTAssertEqual(OnboardingProfiles.pitch(for: "X1"), "A year of everyday banking")
    }

    func testDisclosureSaysDemoAndFictional() {
        XCTAssertTrue(OnboardingCopy.disclosureTitle.contains("demo"))
        XCTAssertTrue(OnboardingCopy.disclosureBody.contains("fictional people"))
        XCTAssertEqual(OnboardingCopy.promiseBaskets.map(\.kind), [.fixed, .curveballs, .leaks])
        for row in OnboardingCopy.promiseBaskets {
            XCTAssertNil(row.examples.rangeOfCharacter(from: .decimalDigits), "no invented amounts")
        }
        XCTAssertTrue(OnboardingCopy.disclosureBody.replacingOccurrences(of: "\u{2060}", with: "").contains("synthetic S-Pankki data"))
        XCTAssertTrue(OnboardingCopy.disclosureBody.contains("invented names"))
        XCTAssertEqual(OnboardingCopy.promiseThen.count, 3)
    }

    func testReadingCountsThePaymentsOfTheOverview() async throws {
        let eetu = try await overview("CUST04414")
        XCTAssertEqual(OnboardingReading.paymentCount(eetu), 358)
        XCTAssertEqual(OnboardingReading.loadingTitle(name: "Eetu"), "Liito is sorting 12 months of Eetu's payments")
    }

    func testFirstInsightIsTheFlaggedBillWithItsCategoryRows() async throws {
        let eetu = try await overview("CUST04414")
        let state = try XCTUnwrap(FirstInsightPresenter.state(for: eetu))
        XCTAssertEqual(state.headline, "Looks like Electricity is your biggest bill after rent: about €79 a month.")
        XCTAssertEqual(state.detail, "All your utilities bills come to about €188 a month. Bills like these are often cheaper for new customers.")
        XCTAssertEqual(state.source, "From 36 of Eetu's transactions")
        XCTAssertEqual(state.linkLabel, "From 36 of Eetu's transactions · See them")
        XCTAssertEqual(state.evidenceTitle, "Utilities payments")
        XCTAssertEqual(state.evidence, EvidenceFilter(from: "2025-10-01", to: "2026-09-30", category: "Utilities"))
    }

    func testFirstInsightUsesTheConfirmedName() async throws {
        let aino = try await overview("CUST04974")
        let state = try XCTUnwrap(FirstInsightPresenter.state(for: aino, confirmedName: "Helen electricity"))
        XCTAssertTrue(state.headline.hasPrefix("Helen electricity is your biggest bill after rent"))
    }

    func testFirstInsightLinkOpensExactlyTheRowsItCounts() async throws {
        let eetu = try await overview("CUST04414")
        let state = try XCTUnwrap(FirstInsightPresenter.state(for: eetu))
        let api = FixtureAPI()
        let basket = SampleEvidence.basket(for: state.evidence, in: eetu)
        let source = try await api.transactions(customerId: "CUST04414",
                                                filter: basket.map { EvidenceFilter(from: state.evidence.from, to: state.evidence.to, basket: $0) })
        let rows = SampleEvidence.narrow(source, to: state.evidence)
        XCTAssertEqual(rows.count, 36)
    }
}
