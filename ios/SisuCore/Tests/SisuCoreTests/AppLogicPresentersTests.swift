import SisuCore
import XCTest

final class AppLogicPresentersTests: XCTestCase {
    private func overview(_ id: String = "CUST04974") async throws -> Overview {
        try await FixtureAPI().overview(customerId: id)
    }

    func testFlaggedBillIsLargestOutsideHousing() async throws {
        let o = try await overview()
        let bill = TodayPresenter.flaggedBill(in: o)
        XCTAssertEqual(bill?.guessLabel, "Electricity")
    }

    func testBillHeadlineIsAGuessUntilConfirmed() async throws {
        let o = try await overview()
        let bill = try XCTUnwrap(TodayPresenter.flaggedBill(in: o))
        XCTAssertEqual(TodayPresenter.bill(bill, confirmedName: nil).headline, "Looks like Electricity")
        let confirmed = TodayPresenter.bill(bill, confirmedName: "Helen electricity")
        XCTAssertEqual(confirmed.headline, "Helen electricity")
        XCTAssertTrue(confirmed.isConfirmed)
    }

    func testMathsEndsWithWhatIsLeftAndWhatIsSpent() async throws {
        let o = try await overview()
        let lines = TodayPresenter.mathsLines(o)
        XCTAssertEqual(lines.count, o.safeToSpend.steps.count + 2)
        XCTAssertTrue(lines[lines.count - 2].isResult)
    }

    func testBasketCardHasPeerLineOnlyWithPeerFigure() async throws {
        let o = try await overview()
        let card = TodayPresenter.basket(o.baskets[0], peerCount: o.peerCount)
        XCTAssertEqual(card.kind, .fixed)
        XCTAssertEqual(card.share, "42% of spending")
        XCTAssertNotNil(card.categories.first?.peer)
    }

    func testHeroContextIsShortAndNeverBlames() async throws {
        let o = try await overview()
        let line = TodayPresenter.heroContext(o)
        XCTAssertTrue(line.hasSuffix("a month above this"), line)
        XCTAssertLessThanOrEqual(line.count, 34)
        XCTAssertEqual(JarsPresenter.axisLabel(month: 0), "Now")
        XCTAssertEqual(JarsPresenter.axisLabel(month: 24), "2 years")
    }

    func testBasketLegend() async throws {
        let o = try await overview()
        XCTAssertEqual(TodayPresenter.basketLegend(o), "Fixed 42% · Curveballs 18% · Leaks 40%")
    }

    func testJarFigures() async throws {
        XCTAssertEqual(JarsPresenter.bufferFigure(runwayMonths: 1.14), "1.1 months")
        XCTAssertEqual(JarsPresenter.bufferFigure(runwayMonths: 1.02), "1 month")
        XCTAssertEqual(JarsPresenter.freedFigure(approvedMonthlySaving: 0), "€0 a month")
        let o = try await overview()
        XCTAssertEqual(TodayPresenter.basketLegendItems(o).map(\.text), ["Fixed 42%", "Curveballs 18%", "Leaks 40%"])
    }

    func testChartAxes() async throws {
        let o = try await overview()
        XCTAssertEqual(TodayPresenter.chartMonthTicks(o).count, (o.months.count + 1) / 2)
        let top = TodayPresenter.chartTop(o)
        XCTAssertTrue(o.months.allSatisfy { $0.income < top && $0.regular + $0.irregular + $0.everyday < top })
    }

    func testFuturesAxes() async throws {
        let response = try await FixtureAPI().scenario(customerId: "CUST04974", input: ScenarioInput(billSavingPerMonth: 15, everydayCutPct: 10, years: 5))
        XCTAssertEqual(JarsPresenter.futuresTicks(response.branches), [0, 12, 24, 36, 48, 60])
        XCTAssertEqual(JarsPresenter.futuresLastMonth(response.branches), 60)
        XCTAssertGreaterThan(JarsPresenter.futuresTop(response.branches), response.branches.map(\.endHigh).max() ?? 0)
        XCTAssertEqual(JarsPresenter.futuresTicks([]), [0])
        let ten = try await FixtureAPI().scenario(customerId: "CUST04974", input: ScenarioInput(billSavingPerMonth: 15, everydayCutPct: 10, years: 10))
        XCTAssertEqual(JarsPresenter.futuresTicks(ten.branches), [0, 24, 48, 72, 96, 120])
    }

    func testNumberText() {
        XCTAssertEqual(NumberText.percent(0.424), "42%")
        XCTAssertEqual(NumberText.percent(.nan), "0%")
        XCTAssertEqual(NumberText.oneDecimal(1.14), "1.1")
        XCTAssertEqual(NumberText.oneDecimal(25.11), "25.1")
        XCTAssertEqual(NumberText.oneDecimal(-0.26), "\u{2212}0.3")
        XCTAssertEqual(NumberText.monthShort("2025-10"), "Oct")
        XCTAssertEqual(NumberText.monthShort("bad"), "bad")
    }

    func testBufferFillIsCappedAtThreeMonths() {
        XCTAssertEqual(JarsPresenter.bufferFill(runwayMonths: 1.5), 0.5, accuracy: 0.0001)
        XCTAssertEqual(JarsPresenter.bufferFill(runwayMonths: 25), 1)
        XCTAssertEqual(JarsPresenter.bufferFill(runwayMonths: -2), 0)
        XCTAssertEqual(JarsPresenter.bufferFill(runwayMonths: .infinity), 0)
        XCTAssertEqual(JarsPresenter.freedFill(approvedMonthlySaving: 0, billMonthly: 40), 0)
    }

    func testQuizStates() {
        let branches = [
            Branch(id: .nothing, label: "Change nothing", points: [], endTotal: 1, endLow: 1, endHigh: 1, runwayMonthsAtYear1: 1),
            Branch(id: .save, label: "Make the change, keep the cash", points: [], endTotal: 2, endLow: 2, endHigh: 2, runwayMonthsAtYear1: 3),
            Branch(id: .invest, label: "Make the change, invest it", points: [], endTotal: 3, endLow: 2, endHigh: 4, runwayMonthsAtYear1: 2),
        ]
        XCTAssertEqual(FuturesQuiz.answer(branches), .save)
        XCTAssertEqual(FuturesQuiz.state(of: .save, guess: nil, branches: branches), "idle")
        XCTAssertEqual(FuturesQuiz.state(of: .save, guess: .invest, branches: branches), "correct")
        XCTAssertEqual(FuturesQuiz.state(of: .invest, guess: .invest, branches: branches), "wrong")
        XCTAssertEqual(FuturesQuiz.state(of: .nothing, guess: .invest, branches: branches), "idle")
        XCTAssertTrue(FuturesQuiz.explanation(guess: .save, branches: branches).hasPrefix("Right."))
    }
}
