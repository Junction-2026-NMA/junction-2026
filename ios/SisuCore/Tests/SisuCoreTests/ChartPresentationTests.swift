import XCTest
@testable import SisuCore

/// Charts, the steps list and the plan cards, built from recorded payloads.
final class ChartPresentationTests: XCTestCase {
    private let aino = "CUST04974"
    private let helsinki = TimeZone(identifier: "Europe/Helsinki")!

    private func visuals() throws -> [Visual] {
        try JSONDecoder().decode(VisualList.self, from: XCTUnwrap(ReplayTransport.fixture("coach/visuals-\(aino).json"))).visuals
    }

    private func chart(_ kind: String) throws -> ChartState {
        ChartPresenter.chart(for: try XCTUnwrap(try visuals().first { $0.kind == kind }, kind))
    }

    func testEveryRecordedChartDecodesWithItsOwnContent() throws {
        for id in FixtureAPI.customerIds {
            let list = try JSONDecoder().decode(VisualList.self, from: XCTUnwrap(ReplayTransport.fixture("coach/visuals-\(id).json"))).visuals
            XCTAssertEqual(list.map(\.kind), ["budget_donut", "peer_bars", "month_bars", "waterfall", "futures_lines"], id)
            for visual in list {
                XCTAssertNotEqual(visual.content, .unknown, visual.kind)
                XCTAssertFalse(visual.summary.isEmpty)
                XCTAssertFalse(visual.facts.isEmpty)
                let state = ChartPresenter.chart(for: visual)
                XCTAssertNotEqual(state.body, .none)
                XCTAssertEqual(state.summary, visual.summary)
                let encoded = try JSONEncoder().encode(visual)
                XCTAssertEqual(try JSONDecoder().decode(Visual.self, from: encoded), visual)
            }
        }
        let unknown = try JSONDecoder().decode(Visual.self, from: Data(#"{"id":"v","kind":"hologram","title":"T","caption":"C","summary":"S","source":"moon","facts":[]}"#.utf8))
        let state = ChartPresenter.chart(for: unknown)
        XCTAssertEqual(state.body, .none)
        XCTAssertEqual([state.title, state.caption, state.summary], ["T", "C", "S"])
    }

    func testDonut() throws {
        let state = try chart("budget_donut")
        guard case .donut(let slices, let centerLabel, let centerValue) = state.body else { return XCTFail("not a donut") }
        XCTAssertEqual(slices.map(\.label), ["Housing", "Groceries", "Restaurants", "Home & Tech", "Entertainment", "Other"])
        XCTAssertEqual(slices.map(\.color), [.category1, .category2, .category3, .category4, .category5, .category6])
        XCTAssertEqual(slices[0].valueText, "€662")
        XCTAssertEqual(slices[0].shareText, "37%")
        XCTAssertEqual(slices[0].start, 0)
        XCTAssertEqual(slices[0].end, 0.3685, accuracy: 0.001)
        XCTAssertEqual(slices.last?.end ?? 0, 1, accuracy: 0.000001)
        for (a, b) in zip(slices, slices.dropFirst()) { XCTAssertEqual(a.end, b.start, accuracy: 0.000001) }
        XCTAssertEqual(centerLabel, "a month")
        XCTAssertEqual(centerValue, "€1,795")
        XCTAssertEqual(state.legend.map(\.label), slices.map(\.label))
        XCTAssertEqual(state.source, "Your bank data")
        XCTAssertEqual(ChartColorRole.category(7), .category2)
    }

    func testPeerBars() throws {
        let state = try chart("peer_bars")
        guard case .bars(let groups) = state.body else { return XCTFail("not bars") }
        XCTAssertEqual(groups.count, 5)
        XCTAssertEqual(state.legend.map(\.label), ["You", "People aged 18-24"])
        XCTAssertEqual(state.legend.map(\.color), [.main, .quiet])
        XCTAssertEqual(groups[0].title, "Housing")
        XCTAssertEqual(groups[0].note, "€63 below")
        XCTAssertEqual(groups[0].bars.map(\.valueText), ["€662", "€725"])
        XCTAssertEqual(groups[0].bars.map(\.color), [.main, .quiet])
        XCTAssertEqual(groups[0].bars[1].fraction, 1, accuracy: 0.000001)
        XCTAssertEqual(groups[0].bars[0].fraction, 661.7 / 724.5, accuracy: 0.000001)
        XCTAssertEqual(groups[2].note, "€64 above")
        XCTAssertEqual(groups[1].note, "€3 below")
    }

    func testMonthColumnsFlagTheMonthsThatCostMoreThanTheyBroughtIn() throws {
        let state = try chart("month_bars")
        guard case .columns(let columns) = state.body else { return XCTFail("not columns") }
        XCTAssertEqual(columns.count, 12)
        XCTAssertEqual(columns.filter(\.flagged).count, 6)
        XCTAssertFalse(columns[0].flagged)
        XCTAssertEqual(columns[0].color, .main)
        XCTAssertEqual(columns[0].detail, "Oct 25: €1,822 in, €1,644 out")
        XCTAssertTrue(columns[1].flagged)
        XCTAssertEqual(columns[1].color, .flagged)
        XCTAssertEqual(columns[1].detail, "Nov 25: €1,833 in, €1,961 out, €128 more out than in")
        XCTAssertGreaterThan(columns[1].fraction, columns[1].markFraction)
        XCTAssertTrue(columns.allSatisfy { (0...1).contains($0.fraction) && (0...1).contains($0.markFraction) })
        XCTAssertEqual(columns.map(\.showsLabel), [true, false, false, true, false, false, true, false, false, true, false, true])
        XCTAssertEqual(state.footnote, "Marked months cost more than they brought in.")
        XCTAssertEqual(state.legend.map(\.isLine), [false, true])
    }

    func testWaterfall() throws {
        let state = try chart("waterfall")
        guard case .bars(let groups) = state.body else { return XCTFail("not bars") }
        XCTAssertEqual(groups.map(\.title), ["Money in per month", "Must pay, every month", "Set aside for now-and-then costs"])
        XCTAssertEqual(groups.map { $0.bars[0].valueText }, ["€1,783", "\u{2212}€757", "\u{2212}€316"])
        XCTAssertEqual(groups.map { $0.bars[0].color }, [.main, .quiet, .quiet])
        XCTAssertEqual(groups[0].bars[0].fraction, 1)
        XCTAssertEqual(state.resultLabel, "Safe to spend a week")
        XCTAssertEqual(state.resultValue, "€164")
        XCTAssertEqual(state.source, "Calculation")
    }

    func testFuturesLines() throws {
        let state = try chart("futures_lines")
        guard case .lines(let lines, let axis) = state.body else { return XCTFail("not lines") }
        XCTAssertEqual(lines.map(\.id), ["nothing", "save", "invest"])
        XCTAssertEqual(lines.map(\.color), [.quiet, .category2, .main])
        XCTAssertEqual(lines.map(\.hasBand), [false, false, true])
        XCTAssertEqual(lines.map(\.endText), ["€491", "€6,491", "€7,284"])
        XCTAssertEqual(lines.map(\.rangeText), [nil, nil, "€6,614 to €7,848"])
        XCTAssertEqual(axis, ["0", "1", "2", "3", "4", "5"])
        XCTAssertEqual(lines[2].points.count, 6)
        XCTAssertEqual(lines[2].points.first?.x, 0)
        XCTAssertEqual(lines[2].points.last?.x, 1)
        XCTAssertEqual(lines[2].points.last?.high ?? 0, 1, accuracy: 0.000001)
        for line in lines {
            for point in line.points { XCTAssertTrue((0...1).contains(point.y) && point.low <= point.y && point.y <= point.high) }
        }
    }

    func testOfferBarsFromAChatTurn() throws {
        let visual = try XCTUnwrap(CoachSamples.reply(turn: "electricity").visuals.first)
        XCTAssertEqual(visual.kind, "offer_bars")
        let state = ChartPresenter.chart(for: visual)
        guard case .bars(let groups) = state.body else { return XCTFail("not bars") }
        XCTAssertEqual(groups.map(\.title), ["Your bill now", "Example Energia · Fixed 24", "Demo Sähkö · Fixed 12"])
        XCTAssertEqual(groups.map(\.note), [nil, "saves about €24 a year", "not cheaper"])
        XCTAssertEqual(groups.map { $0.bars[0].valueText }, ["€40", "€38", "€42"])
        XCTAssertEqual(groups.map { $0.bars[0].color }, [.quiet, .main, .main])
        XCTAssertEqual(groups[2].bars[0].fraction, 1)
        XCTAssertEqual(groups[1].url, "https://example.com/mock-offers")
        XCTAssertEqual(state.footnote, "Example data, not a live search.")
        XCTAssertEqual(state.title, "Your electricity bill beside today's offers")
    }

    /// The three-baskets chart, added on the server on 14 Nov (after the recordings were made).
    func testBasketBarsAreDrawnAsOneGroupPerBasket() throws {
        let json = #"""
        {"id":"baskets-CUST04974","kind":"basket_bar","title":"Your three baskets","caption":"A month","summary":"S","source":"bank-data","facts":[],
         "total":1796,"baskets":[
          {"id":"mandatory","label":"Must pay, every month","description":"Rent and bills","monthly":757,"share":42,"top":[{"category":"Housing","monthly":665},{"category":"Utilities","monthly":65}]},
          {"id":"occasional","label":"Must pay, now and then","description":"Insurance","monthly":316,"share":18,"top":[]},
          {"id":"everyday","label":"Everyday choices","description":"Food and fun","monthly":723,"share":40,"top":[{"category":"Restaurants","monthly":500}]}]}
        """#
        let visual = try JSONDecoder().decode(Visual.self, from: Data(json.utf8))
        guard case .basketBar(let total, let baskets) = visual.content else { return XCTFail("not a basket chart") }
        XCTAssertEqual(total, 1796)
        XCTAssertEqual(baskets.map(\.id), ["mandatory", "occasional", "everyday"])
        XCTAssertEqual(try JSONDecoder().decode(Visual.self, from: JSONEncoder().encode(visual)), visual)

        let state = ChartPresenter.chart(for: visual)
        guard case .bars(let groups) = state.body else { return XCTFail("not drawn as bars") }
        XCTAssertEqual(groups.map(\.title), ["Must pay, every month", "Must pay, now and then", "Everyday choices"])
        XCTAssertEqual(groups.map { $0.bars.count }, [3, 1, 2], "the basket's own bar, then its largest categories")
        XCTAssertEqual(groups[0].bars[0].fraction, 1, accuracy: 0.0001, "the largest basket fills the width")
        XCTAssertEqual(groups[2].bars[0].fraction, 723.0 / 757.0, accuracy: 0.0001)
        XCTAssertEqual(groups[0].bars[1].fraction, 665.0 / 757.0, accuracy: 0.0001, "categories share the baskets' scale")
        XCTAssertEqual(state.legend.count, 3)
    }

    func testStepsList() {
        var message = CoachSamples.reply(turn: "investigate")
        XCTAssertEqual(StepPresenter.heading(pending: true), "What Sisu is doing")
        XCTAssertEqual(StepPresenter.heading(pending: false), "What Sisu did")
        let rows = StepPresenter.rows(message)
        XCTAssertEqual(rows.map(\.label), ["Scanning twelve months of your transactions for what stands out",
                                           "Searching today's electricity offers with Exa and reading the pages with Context.dev",
                                           "Projecting 5 years ahead from your real averages", "Building a short lesson from your own numbers",
                                           "Setting up the electricity switch for you to approve"])
        XCTAssertTrue(rows.allSatisfy { $0.state == .done && $0.duration != nil && $0.result != nil })
        XCTAssertEqual(rows[1].result, message.tools[1].summary)

        message.pending = true
        message.steps.append(CoachStep(id: "x", label: "Searching the web with Exa: rents"))
        message.steps.append(CoachStep(id: "y", label: "Reading a page", done: true, ok: false, tookMs: 1234, result: "Could not be read"))
        let live = StepPresenter.rows(message)
        XCTAssertEqual(live[5].state, .running)
        XCTAssertNil(live[5].duration)
        XCTAssertEqual(live[6].state, .failed)
        XCTAssertEqual(live[6].duration, "1.2 s")
        message.pending = false
        XCTAssertEqual(StepPresenter.rows(message)[5].state, .done)
        XCTAssertEqual(StepPresenter.rows(CoachSamples.reply(turn: "spending")), [])
    }

    func testPlanCardNeverShowsTheTotalWithoutItsSplit() async throws {
        let plan = await PlanSession(customerId: aino, client: .sample(eventDelay: 0), pause: { _ in })
        let none = await PlanPresenter.card(plan.view)
        XCTAssertNil(none)
        await plan.start().value
        let view = await plan.view
        let card = try XCTUnwrap(PlanPresenter.card(view))
        XCTAssertEqual(card.title, "About €1,771 a year")
        XCTAssertEqual(card.needsNothing, PlanSplitFigure(amount: "€257 a year", label: "needs nothing from you"))
        XCTAssertEqual(card.needsSpendingChange, PlanSplitFigure(amount: "€1,514 a year", label: "needs spending to come down"))
        XCTAssertEqual(card.approveLabel, "Approve all 4")
        XCTAssertEqual(card.approveNote, "Approving sets these up as a simulation. No contract is switched and no money moves.")
        XCTAssertEqual(card.simulatedTag, "Simulated, no real switch")
        XCTAssertEqual(card.warnings.count, 1)
        XCTAssertEqual(card.warnings.first?.hasPrefix("€126 a month is more than"), true)
        XCTAssertEqual(card.confirmations, [])
        XCTAssertEqual(card.summary, view.summary?.text)

        let rows = PlanPresenter.items(try XCTUnwrap(view.plan))
        XCTAssertEqual(rows.count, 5)
        XCTAssertEqual(rows[0].amount, "About €768 a year")
        XCTAssertEqual(rows[0].needsNote, "Only if this spending really comes down")
        XCTAssertTrue(rows[0].needsSpendingChange)
        XCTAssertEqual(rows[2].needsNote, "Needs nothing from you")
        XCTAssertFalse(rows[2].needsSpendingChange)

        await plan.approveAll()
        let approvedView = await plan.view
        let after = try XCTUnwrap(PlanPresenter.card(approvedView))
        XCTAssertNil(after.approveLabel)
        XCTAssertEqual(after.confirmations.count, 4)
        XCTAssertEqual(after.needsNothing.amount, "€257 a year")
    }

    func testACheckIsWhatSourcesSayNotADecision() async throws {
        let plan = await PlanSession(customerId: aino, client: .sample(eventDelay: 0), pause: { _ in })
        await plan.start().value
        let checks = await plan.view.checks
        let lane = try XCTUnwrap(checks.first)
        let card = PlanPresenter.check(lane, timeZone: helsinki)
        XCTAssertEqual(card.title, "Could you get housing allowance from Kela?")
        XCTAssertEqual(card.heading, "What the sources say today")
        XCTAssertEqual(card.finding.hasPrefix("Example finding."), true)
        XCTAssertEqual(card.yoursLabel, "Your income, as it arrives in your account")
        XCTAssertEqual(card.yoursValue, "€1,783.33 a month")
        XCTAssertEqual(card.confirmedNote, "The figures could not be found in the pages' own text. Check the sources.")
        XCTAssertEqual(card.sources.first?.label, "Mock source (example data)")
        XCTAssertEqual(card.sources.first?.value?.hasPrefix("Fetched 14 Nov 2026, "), true)
        XCTAssertEqual(card.disclaimer, "This is general information, not a decision about your case.")
        XCTAssertFalse(card.isRunning)
        XCTAssertTrue(card.isMock)
        for text in [card.heading, card.disclaimer, card.confirmedNote ?? ""] {
            XCTAssertFalse(text.lowercased().contains("you qualify"))
            XCTAssertFalse(text.lowercased().contains("eligible"))
        }
        let running = PlanPresenter.check(PlanCheckLane(id: "c", title: "T", query: "q", check: nil), timeZone: helsinki)
        XCTAssertTrue(running.isRunning)
        XCTAssertEqual(running.finding, "Looking this up now.")
        XCTAssertNil(running.confirmedNote)
        XCTAssertNil(running.yoursValue)
    }

    func testAnActionsWarningConfirmationAndDestination() throws {
        func action(_ name: String) throws -> AgentAction {
            try JSONDecoder().decode(ActionEnvelope.self, from: XCTUnwrap(ReplayTransport.fixture("coach/\(name)"))).action
        }
        let waiting = try action("action-transfer-\(aino).json")
        XCTAssertEqual(waiting.kind, .oneOffTransfer)
        XCTAssertEqual(ActionPresenter.warning(waiting)?.hasPrefix("Moving €500 today would leave the account about €323 below zero"), true)
        XCTAssertNil(ActionPresenter.confirmation(waiting))
        XCTAssertEqual(ActionPresenter.destination(waiting), "To your savings")
        let approved = try action("action-transfer-\(aino)-approve.json")
        XCTAssertEqual(ActionPresenter.confirmation(approved)?.hasPrefix("Done (simulation). Reference SIM-"), true)
        XCTAssertNotNil(ActionPresenter.warning(approved))
        let plain = try XCTUnwrap(CoachSamples.action())
        XCTAssertNil(ActionPresenter.warning(plain))
        XCTAssertNil(ActionPresenter.destination(plain))
        let card = ActionPresenter.card(waiting, timeZone: helsinki)
        XCTAssertEqual(card.warning, waiting.warning)
        XCTAssertNil(card.confirmation)
        XCTAssertEqual(card.destination, "To your savings")
        XCTAssertEqual(ActionPresenter.card(approved, timeZone: helsinki).confirmation, approved.confirmation)
        XCTAssertNil(ActionPresenter.card(plain, timeZone: helsinki).warning)
    }
}
