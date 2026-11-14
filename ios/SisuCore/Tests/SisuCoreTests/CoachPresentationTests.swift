import XCTest
@testable import SisuCore

/// The strings and numbers the coach screens show, built from recorded payloads.
final class CoachPresentationTests: XCTestCase {
    private let aino = "CUST04974"
    private let helsinki = TimeZone(identifier: "Europe/Helsinki")!
    private let nb = "\u{00A0}"

    private func load<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        try JSONDecoder().decode(T.self, from: XCTUnwrap(ReplayTransport.fixture("coach/\(name)"), name))
    }

    private func investigation() -> [SisuEvent] { Recorded.events("stream-investigate-\(aino).sse") }

    private func stages() -> [Stage] {
        investigation().compactMap { if case .stage(let stage) = $0 { return stage } else { return nil } }
    }

    func testOfferRows() throws {
        let research = try load("research-\(aino)-electricity.json", as: ResearchResult.self)
        let rows = OfferPresenter.rows(research)
        XCTAssertEqual(rows.count, 3)
        XCTAssertEqual(rows[0].provider, "Example Energia")
        XCTAssertEqual(rows[0].plan, "Fixed 24")
        XCTAssertEqual(rows[0].price, "€3.90 a month + 8.9 c/kWh")
        XCTAssertEqual(rows[0].contract, "24 months")
        XCTAssertEqual(rows[0].estimatedMonthlyCost, "About €38 a month")
        XCTAssertEqual(rows[0].saving, "About €24 less a year")
        XCTAssertTrue(rows[0].isBest)
        XCTAssertTrue(rows[0].comparable)
        XCTAssertEqual(rows[1].saving, "About €24 more a year")
        XCTAssertFalse(rows[1].isBest)
        XCTAssertEqual(rows[2].provider, "Sample Voima")
        XCTAssertEqual(rows[2].saving, "Spot price, not comparable")
        XCTAssertFalse(rows[2].comparable)
        XCTAssertEqual(rows[2].contract, "not stated")
        XCTAssertEqual(rows[2].estimatedMonthlyCost, "not stated")
        XCTAssertEqual(OfferPresenter.headline(research), "About €24 less a year with Example Energia")
        XCTAssertEqual(OfferPresenter.baseline(research), "Your bill now: about €40 a month")
        XCTAssertEqual(OfferPresenter.monthlyBillSaving(research) ?? 0, 24.12 / 12, accuracy: 0.000001)
        let note = OfferPresenter.fetchedNote(research, timeZone: helsinki)
        XCTAssertTrue(note.hasPrefix("Fetched 14 Nov 2026, "), note)
        XCTAssertTrue(note.hasSuffix(" · Mock data"), note)
        XCTAssertEqual(OfferPresenter.rows(research, language: .fi)[0].saving, "Noin 24\(nb)€ vähemmän vuodessa")
        XCTAssertEqual(OfferPresenter.rows(research, language: .fi)[0].price, "3,90\(nb)€ kuukaudessa + 8,9 c/kWh")
    }

    func testOfferEdgeCases() {
        let bare = Offer(provider: "Oomi", sourceUrl: "https://example.com", comparable: true)
        let row = OfferPresenter.row(bare)
        XCTAssertEqual([row.plan, row.price, row.contract, row.estimatedMonthlyCost, row.saving], Array(repeating: "not stated", count: 5))
        XCTAssertEqual(OfferPresenter.savingText(Offer(provider: "A", sourceUrl: "", comparable: true, estimatedYearlySavingEur: 47.76)), "About €48 less a year")
        XCTAssertEqual(OfferPresenter.savingText(Offer(provider: "A", sourceUrl: "", comparable: true, estimatedYearlySavingEur: 0.3)), "About the same as now")
        XCTAssertEqual(OfferPresenter.savingText(Offer(provider: "A", sourceUrl: "", comparable: false, estimatedYearlySavingEur: 90)), "Not comparable")
        XCTAssertEqual(OfferPresenter.savingText(Offer(provider: "A", contractType: "Spot", sourceUrl: "", comparable: false)), "Spot price, not comparable")
        XCTAssertEqual(OfferPresenter.yearly(-1234.4), "About €1,234 more a year")
        XCTAssertEqual(OfferPresenter.yearly(.nan), "not stated")
        XCTAssertEqual(OfferPresenter.yearly(.infinity), "not stated")
    }

    func testNothingCheaperToday() throws {
        var research = try load("research-\(aino)-electricity.json", as: ResearchResult.self)
        research.best = nil
        research.baselineMonthlyEur = nil
        XCTAssertEqual(OfferPresenter.headline(research), "Nothing cheaper today")
        XCTAssertEqual(OfferPresenter.headline(research, language: .fi), "Ei halvempaa tänään")
        XCTAssertNil(OfferPresenter.baseline(research))
        XCTAssertNil(OfferPresenter.monthlyBillSaving(research))
        XCTAssertFalse(OfferPresenter.rows(research).contains { $0.isBest })
    }

    func testStageCards() {
        let cards = stages().map { StagePresenter.card($0, timeZone: helsinki) }
        XCTAssertEqual(cards.map(\.kind), StageKind.investigationOrder)

        let lead = cards[0]
        XCTAssertEqual(lead.title, "What Sisu noticed")
        XCTAssertEqual(lead.source, "Your bank data")
        XCTAssertEqual(lead.lines.count, 5)
        XCTAssertEqual(lead.lines[0].label, "Entertainment is up 65% on a year ago")
        XCTAssertEqual(lead.lines[0].value, "About €746 a year")
        XCTAssertNil(lead.lines[2].value)

        let research = cards[1]
        XCTAssertEqual(research.source, "Web search")
        XCTAssertTrue(research.isMock)
        XCTAssertEqual(research.lines[0], CardLine(label: "Searched for", detail: "cheapest electricity contract Helsinki Finland price comparison"))
        XCTAssertEqual(research.lines[1], CardLine(label: "Mock offers (example data)", detail: "https://example.com/mock-offers"))
        XCTAssertEqual(research.footnote?.hasPrefix("Fetched 14 Nov 2026, "), true)

        let extraction = cards[2]
        XCTAssertEqual(extraction.source, "Offer pages")
        XCTAssertEqual(extraction.lines[0], CardLine(label: "Pages read", value: "1 of 1"))
        XCTAssertEqual(extraction.lines[1], CardLine(label: "Example Energia · Fixed 24", value: "About €24 less a year"))
        XCTAssertEqual(extraction.lines[3].value, "Spot price, not comparable")

        let calculation = cards[3]
        XCTAssertEqual(calculation.summary, "About €24 a year")
        XCTAssertEqual(calculation.lines.count, 5)
        XCTAssertEqual(calculation.lines[0], CardLine(label: "Your bill per month", value: "€39.83", detail: "average of the last 12 months, from your bank data"))
        XCTAssertEqual(calculation.lines[1].value, "\u{2212}€33.92")
        XCTAssertEqual(calculation.lines[4], CardLine(label: "Estimated saving per year", value: "€24.12", detail: "monthly saving times 12"))

        let impact = cards[4]
        XCTAssertEqual(impact.lines, [CardLine(label: "Change nothing", value: "€491"), CardLine(label: "Make the change, keep the cash", value: "€611"),
                                      CardLine(label: "Make the change, invest it", value: "€627", detail: "€614 to €639")])
        XCTAssertEqual(cards[5].lines.first?.label.hasSuffix("?"), true)
        XCTAssertEqual(cards[6].lines.first?.value, "Waiting for your approval. Nothing has been done.")
        XCTAssertNil(cards[6].footnote)

        let unknown = Stage(id: "x", kind: StageKind(rawValue: "hologram"), title: "New", summary: "Soon", source: "moon", data: .unknown(kind: "hologram"))
        let card = StagePresenter.card(unknown, timeZone: helsinki)
        XCTAssertEqual([card.title, card.summary, card.source], ["New", "Soon", "moon"])
        XCTAssertEqual(card.lines, [])
    }

    func testEvidenceAndMemoryCards() throws {
        func firstStage(_ name: String) throws -> Stage {
            for event in Recorded.events("stream-\(name)-\(aino).sse") {
                if case .stage(let stage) = event { return stage }
            }
            throw XCTSkip("no stage in \(name)")
        }
        let evidence = StagePresenter.card(try firstStage("category"), timeZone: helsinki)
        XCTAssertEqual(evidence.kind, .evidence)
        XCTAssertEqual(evidence.source, "Your bank data")
        XCTAssertEqual(evidence.lines.first?.label, "20 transactions")
        XCTAssertEqual(evidence.lines.first?.value, "€2,010.63")
        XCTAssertGreaterThan(evidence.lines.count, 1)
        XCTAssertTrue(evidence.lines[1].label.contains(" · Restaurants"), evidence.lines[1].label)

        let memory = StagePresenter.card(try firstStage("remember"), timeZone: helsinki)
        XCTAssertEqual(memory.kind, .memory)
        XCTAssertEqual(memory.lines, [CardLine(label: "Sisu will remember", value: "3500")])
    }

    func testResearchStageFollowsTheReply() {
        var message = CoachMessage(id: "m", role: .assistant, pending: true)
        XCTAssertNil(StagePresenter.researchStage(of: message))
        message.startedEarly = .electricity
        XCTAssertEqual(StagePresenter.researchStage(of: message), .searching)
        let all = stages()
        message.stages = [all[1]]
        XCTAssertEqual(StagePresenter.researchStage(of: message), .reading)
        message.stages = [all[1], all[2]]
        XCTAssertEqual(StagePresenter.researchStage(of: message), .comparing)
        message.stages = [all[1], all[2], all[3]]
        XCTAssertEqual(StagePresenter.researchStage(of: message), .done)
    }

    func testActionCard() throws {
        var waiting = try load("actions-\(aino)-investigate-pending.json", as: ActionList.self).actions[0]
        waiting.expiresAt = "2026-11-14T09:56:38.388Z"
        let card = ActionPresenter.card(waiting, timeZone: helsinki)
        XCTAssertEqual(card.title, "Switch electricity contract to Example Energia (Fixed 24)")
        XCTAssertTrue(card.summary.hasPrefix("Estimated saving about €24 a year (€2.01 a month)"))
        XCTAssertEqual(card.checklist.count, 5)
        XCTAssertEqual(card.assumptions.count, 7)
        XCTAssertEqual(card.monthly, "€2.01 a month")
        XCTAssertEqual(card.statusSentence, "Waiting for your approval. Nothing has been done.")
        XCTAssertEqual(card.simulatedTag, "Simulated, no real switch")
        XCTAssertTrue(card.canDecide)
        XCTAssertNil(card.impactSummary)
        XCTAssertEqual(card.validUntil, "Valid until 14 Nov 2026, 11:56")
        XCTAssertEqual(card.draftMessage?.hasPrefix("Hello Example Energia,"), true)

        let approved = ActionPresenter.card(try load("action-investigate-\(aino)-approve.json", as: ActionEnvelope.self).action, timeZone: helsinki)
        XCTAssertEqual(approved.statusSentence, "Approved. Simulated, no real switch was made.")
        XCTAssertFalse(approved.canDecide)
        XCTAssertNil(approved.validUntil)
        XCTAssertEqual(approved.impactSummary, "About €121 more after 5 years if the saving is simply kept.")
        XCTAssertEqual(approved.simulatedTag, "Simulated, no real switch")

        XCTAssertEqual(ActionPresenter.statusSentence(.declined), "Declined. Nothing was done.")
        XCTAssertEqual(ActionPresenter.statusSentence(.expired), "Expired. Prices may have changed. Ask Sisu to prepare it again.")
        XCTAssertEqual(ActionPresenter.statusSentence(ActionStatus(rawValue: "paused")), "paused")

        let audit = try load("actions-\(aino)-investigate-approved.json", as: ActionList.self).audit
        let lines = audit.map { ActionPresenter.auditLine($0, timeZone: helsinki) }
        XCTAssertEqual(lines.map(\.label), ["Prepared by Sisu", "Approved by you", "Carried out as a simulation by the system"])
        XCTAssertEqual(lines[0].value?.hasPrefix("14 Nov 2026, "), true)
    }

    func testGroundingLine() {
        for event in investigation() {
            if case .grounding(let grounding, _) = event {
                XCTAssertEqual(GroundingPresenter.line(grounding), GroundingLine(text: "All 7 numbers have a source", isWarning: false))
                XCTAssertEqual(GroundingPresenter.line(grounding, language: .fi)?.text, "Kaikilla 7 luvulla on lähde")
            }
        }
        let two = Grounding(ok: false, checked: 6, unverified: [12, 99], numbers: [], corrections: [], nameCorrections: nil)
        XCTAssertEqual(GroundingPresenter.line(two), GroundingLine(text: "2 of 6 numbers have no source yet", isWarning: true))
        let one = Grounding(ok: false, checked: 6, unverified: [12], numbers: [], corrections: [], nameCorrections: nil)
        XCTAssertEqual(GroundingPresenter.line(one)?.text, "1 of 6 numbers has no source yet")
        XCTAssertNil(GroundingPresenter.line(Grounding(ok: true, checked: 0, unverified: [], numbers: [], corrections: [], nameCorrections: nil)))
        let single = Grounding(ok: true, checked: 1, unverified: [], numbers: [], corrections: [], nameCorrections: nil)
        XCTAssertEqual(GroundingPresenter.line(single)?.text, "The 1 number has a source")
    }

    func testToolRows() {
        XCTAssertEqual(ToolPresenter.duration(ms: 1234), "1.2 s")
        XCTAssertEqual(ToolPresenter.duration(ms: 1234, language: .fi), "1,2 s")
        XCTAssertEqual(ToolPresenter.duration(ms: 950), "1.0 s")
        XCTAssertEqual(ToolPresenter.duration(ms: 12_050), "12.1 s")
        XCTAssertEqual(ToolPresenter.duration(ms: 3), "under 0.1 s")
        XCTAssertEqual(ToolPresenter.duration(ms: .nan), "under 0.1 s")
        XCTAssertEqual(ToolPresenter.name("search_offers"), "Search offers")
        let traces: [ToolTrace] = investigation().compactMap { if case .toolEnd(let trace) = $0 { return trace } else { return nil } }
        let rows = traces.map { ToolPresenter.row($0) }
        XCTAssertEqual(rows.map(\.name), ["Find patterns", "Search offers", "Run scenario", "Explain concept", "Prepare action"])
        XCTAssertEqual(rows[0].source, "Your bank data")
        XCTAssertEqual(rows[1].source, "Web search and offer pages")
        XCTAssertEqual(rows[1].summary, traces[1].summary)
        XCTAssertTrue(rows.allSatisfy(\.ok))
        for event in investigation() {
            if case .done(_, _, let timings?) = event {
                XCTAssertTrue(ToolPresenter.timingLine(timings).hasPrefix("Answered in "))
                XCTAssertFalse(ToolPresenter.timingLine(timings).contains("backup"))
            }
        }
    }

    func testTeachingQuizPredictsThenReveals() throws {
        let card = try XCTUnwrap(try load("teaching-\(aino).json", as: TeachingCardList.self).cards.first { $0.concept == .switchingBills })
        XCTAssertEqual(card.correctIndex, 0)
        var quiz = TeachingQuiz(card: card)
        XCTAssertFalse(quiz.isRevealed)
        XCTAssertNil(quiz.reveal)
        XCTAssertNil(quiz.isCorrect)
        XCTAssertNil(quiz.feedback())
        XCTAssertEqual((0..<3).map { quiz.state(of: $0) }, [.idle, .idle, .idle])
        quiz.choose(9)
        XCTAssertFalse(quiz.isRevealed)
        quiz.choose(1)
        XCTAssertEqual(quiz.selectedIndex, 1)
        XCTAssertEqual((0..<3).map { quiz.state(of: $0) }, [.correct, .wrong, .idle])
        XCTAssertEqual(quiz.isCorrect, false)
        XCTAssertEqual(quiz.reveal, card.reveal)
        XCTAssertEqual(quiz.feedback(), "Good guess. Here is the real figure.")
        XCTAssertEqual(quiz.choices[0], ["label": .string(card.options[0]), "state": .enumCase("correct")])
        quiz.choose(0)
        XCTAssertEqual(quiz.selectedIndex, 1)

        var right = TeachingQuiz(card: card)
        right.choose(0)
        XCTAssertEqual((0..<3).map { right.state(of: $0) }, [.correct, .idle, .idle])
        XCTAssertEqual(right.feedback(), "Spot on.")
    }

    func testFetchedTimesAndTags() throws {
        XCTAssertEqual(CoachText.fetched("2026-11-14T08:42:00Z", timeZone: helsinki), "Fetched 14 Nov 2026, 10:42")
        XCTAssertEqual(CoachText.fetched("2026-11-14T08:42:00Z", language: .fi, timeZone: helsinki), "Haettu 14.11.2026 klo 10.42")
        XCTAssertEqual(CoachText.fetched("2026-11-14T08:42:00Z", timeZone: try XCTUnwrap(TimeZone(identifier: "UTC"))), "Fetched 14 Nov 2026, 08:42")
        XCTAssertNil(CoachText.dataTag(for: .live))
        XCTAssertEqual(CoachText.dataTag(for: .mock), "Mock data")
        XCTAssertEqual(CoachText.dataTag(for: .sample), "Sample data")
        XCTAssertEqual(CoachText.simulatedTag(), "Simulated, no real switch")
        XCTAssertEqual(CoachText.notStated(), "not stated")
    }

    func testFactValues() {
        func fact(_ value: Double, _ unit: String) -> Fact {
            Fact(id: "f", label: "l", value: value, unit: unit, source: "bank-data", basis: "b", evidence: nil, url: nil)
        }
        XCTAssertEqual(CoachText.factValue(fact(39.83, "EUR/month")), "€39.83 a month")
        XCTAssertEqual(CoachText.factValue(fact(746, "EUR/year")), "€746 a year")
        XCTAssertEqual(CoachText.factValue(fact(1220.35, "EUR")), "€1,220.35")
        XCTAssertEqual(CoachText.factValue(fact(4573, "kWh/year")), "4,573 kWh a year")
        XCTAssertEqual(CoachText.factValue(fact(8.9, "c/kWh")), "8.9 c/kWh")
        XCTAssertEqual(CoachText.factValue(fact(65, "percent")), "65%")
        XCTAssertEqual(CoachText.factValue(fact(3, "count")), "3")
        XCTAssertEqual(CoachText.factValue(fact(1, "months")), "1 month")
        XCTAssertEqual(CoachText.factValue(fact(5, "years")), "5 years")
        XCTAssertEqual(CoachText.factValue(fact(2, "parsecs")), "2 parsecs")
        XCTAssertEqual(CoachText.factValue(fact(4573, "kWh/year"), language: .fi), "4\(nb)573 kWh vuodessa")
        XCTAssertEqual(CoachText.sourceLabel("customer-stated"), "You told Sisu")
        XCTAssertEqual(CoachText.sourceLabel("something-new"), "something-new")
    }

    func testFuturesSeries() throws {
        let impact = try XCTUnwrap(try load("action-investigate-\(aino)-approve.json", as: ActionEnvelope.self).action.impact)
        let ends = FuturesPresenter.series(impact)
        XCTAssertEqual(ends.map(\.id), ["nothing", "save", "invest"])
        XCTAssertEqual(ends.map(\.endLabel), ["€491", "€611", "€627"])
        XCTAssertEqual(ends.map(\.rangeLabel), [nil, nil, "€614 to €639"])
        XCTAssertEqual(ends[1].points, [FuturesPoint(month: 60, total: 611.35, low: 611.35, high: 611.35)])
        XCTAssertEqual(FuturesPresenter.gain(impact), "About €121 more after 5 years")

        let scenario = try FixtureAPI.load("scenario-\(aino)-default", as: ScenarioResponse.self)
        let curves = FuturesPresenter.series(scenario)
        XCTAssertEqual(curves.map(\.label), ["Change nothing", "Make the change, keep the cash", "Make the change, invest it"])
        XCTAssertEqual(curves.map { $0.points.count }, [61, 61, 61])
        XCTAssertEqual(curves[2].points.last?.total, scenario.branches[2].endTotal)
        XCTAssertEqual(curves[2].points.last?.month, 60)
        XCTAssertEqual(curves[0].endLabel, Money.format(scenario.branches[0].endTotal, language: .en))
        XCTAssertNotNil(curves[2].rangeLabel)
    }

    func testCoachCards() throws {
        XCTAssertEqual(CoachCardPresenter.verdict(.comfortable), "Fits comfortably")
        XCTAssertEqual(CoachCardPresenter.verdict(.tight), "Possible, but tight")
        XCTAssertEqual(CoachCardPresenter.verdict(.notYet), "Not yet")
        let answer = try load("affordability-\(aino)-200.json", as: Affordability.self)
        let lines = CoachCardPresenter.lines(answer.steps)
        XCTAssertEqual(lines[0], CardLine(label: "Balance today", value: "€1,220.35", detail: "account balance on 2026-09-30"))
        XCTAssertEqual(lines[1].value, "\u{2212}€200.00")
        XCTAssertEqual(CoachStatus.allCases.map { CoachCardPresenter.voiceState($0).rawValue }, CoachStatus.allCases.map(\.rawValue))

        let overview = try FixtureAPI.load("overview-\(aino)", as: Overview.self)
        let bill = try XCTUnwrap(overview.recurringBills.first { $0.id == "utilities-1" })
        XCTAssertEqual(CoachCardPresenter.billName(bill, memory: nil), "Looks like \(bill.guessLabel)")
        let memory = try load("memory-\(aino)-saved.json", as: CustomerMemory.self)
        XCTAssertEqual(CoachCardPresenter.billName(bill, memory: memory), "Helen electricity")
    }
}
