import XCTest
@testable import SisuCore

/// Every recorded answer of the coach endpoints decodes into its model.
final class CoachModelsTests: XCTestCase {
    private let ids = FixtureAPI.customerIds

    private func load<T: Decodable>(_ name: String, as type: T.Type, file: StaticString = #filePath, line: UInt = #line) throws -> T {
        let data = try XCTUnwrap(ReplayTransport.fixture("coach/\(name)"), "missing recording \(name)", file: file, line: line)
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            XCTFail("\(name): \(error)", file: file, line: line)
            throw error
        }
    }

    func testServerAndVoiceRecordings() throws {
        let warm = try load("warm.json", as: WarmResponse.self)
        XCTAssertEqual(warm.server, ServerInfo(mock: true, provider: "mock", model: "mock"))
        let health = try load("health.json", as: HealthReport.self)
        XCTAssertTrue(health.ok)
        XCTAssertTrue(health.mock)
        XCTAssertFalse(health.dataBoundary.isEmpty)
        let options = try load("voice-options.json", as: VoiceOptions.self)
        XCTAssertTrue(options.languages.contains { $0.code == "fi" })
        let transcript = try load("voice-stt.json", as: Transcript.self)
        XCTAssertFalse(transcript.text.isEmpty)
        XCTAssertEqual(transcript.mock, true)
    }

    func testCoachRecordingsForEveryCustomer() throws {
        for id in ids {
            XCTAssertFalse(try load("patterns-\(id).json", as: PatternList.self).patterns.isEmpty, id)
            let cashFlow = try load("cash-flow-\(id).json", as: CashFlow.self)
            XCTAssertEqual(cashFlow.customerId, id)
            for amount in ["50", "200", "1000"] {
                let answer = try load("affordability-\(id)-\(amount).json", as: Affordability.self)
                XCTAssertEqual(answer.amountEur, Double(amount))
                XCTAssertFalse(answer.steps.isEmpty)
            }
            let cards = try load("teaching-\(id).json", as: TeachingCardList.self).cards
            XCTAssertEqual(cards.map(\.concept), ConceptId.all, id)
            for card in cards {
                XCTAssertEqual(card.options.count, 3)
                XCTAssertTrue(card.options.indices.contains(card.correctIndex))
            }
            for billType in ["electricity", "mobile", "internet", "electricity-nowait"] {
                let research = try load("research-\(id)-\(billType).json", as: ResearchResult.self)
                XCTAssertTrue(research.mock)
                XCTAssertFalse(research.offers.isEmpty, "\(id) \(billType)")
            }
        }
        let mortgage = try load("mortgage-CUST02003.json", as: MortgageApplication.self)
        XCTAssertEqual(mortgage.customerId, "CUST02003")
        XCTAssertEqual(try load("mortgage-CUST04974.json", as: ApiError.self).error, "There is no mortgage application on record for this customer.")
    }

    func testMemoryAndActionRecordings() throws {
        for id in ids {
            XCTAssertEqual(try load("memory-\(id).json", as: CustomerMemory.self).items, [])
            let saved = try load("memory-\(id)-saved.json", as: CustomerMemory.self)
            XCTAssertEqual(saved.items.first?.kind, .billName)
            XCTAssertEqual(saved.confirmedBillName(billId: "utilities-1"), "Helen electricity")
            XCTAssertNil(saved.confirmedBillName(billId: "other"))
            XCTAssertFalse(try load("memory-\(id)-consent-off.json", as: CustomerMemory.self).consent)
            XCTAssertEqual(try load("memory-\(id)-forgotten.json", as: CustomerMemory.self).items, [])

            XCTAssertEqual(try load("actions-\(id).json", as: ActionList.self).actions, [])
            for origin in ["investigate", "prepare"] {
                let pending = try load("actions-\(id)-\(origin)-pending.json", as: ActionList.self)
                XCTAssertEqual(pending.actions.map(\.status), [.awaitingApproval], "\(id) \(origin)")
                XCTAssertEqual(pending.audit.map(\.type), ["action_prepared"])
                let approved = try load("action-\(origin)-\(id)-approve.json", as: ActionEnvelope.self).action
                XCTAssertEqual(approved.id, pending.actions[0].id)
                XCTAssertEqual(approved.status, .executedSimulated)
                XCTAssertTrue(approved.simulated)
                XCTAssertNotNil(approved.impact)
                let declined = try load("action-\(origin)-\(id)-decline.json", as: ActionEnvelope.self).action
                XCTAssertEqual(declined.id, pending.actions[0].id)
                XCTAssertEqual(declined.status, .declined)
                XCTAssertNil(declined.impact)
                let after = try load("actions-\(id)-\(origin)-approved.json", as: ActionList.self)
                XCTAssertEqual(after.audit.map(\.type), ["action_prepared", "action_approved", "action_executed_simulated"])
                XCTAssertEqual(after.audit.map(\.actor), [origin == "investigate" ? "sisu-agent" : "user", "user", "system"])
                XCTAssertTrue(after.auditChainValid)
                XCTAssertEqual(try load("actions-\(id)-\(origin)-declined.json", as: ActionList.self).actions.map(\.status), [.declined])
            }
        }
    }

    func testRecordedStreamsHoldOnlyKnownEvents() throws {
        for id in ids {
            for name in ["spending", "electricity", "voice", "investigate", "afford", "mortgage", "payday", "bills", "patterns", "whatif", "teach", "category", "remember"] {
                let data = try XCTUnwrap(ReplayTransport.fixture("coach/stream-\(name)-\(id).sse"))
                let events = SisuEventStreamParser.events(in: data)
                XCTAssertGreaterThan(events.count, 8, "\(name) \(id)")
                XCTAssertFalse(events.contains { if case .unknown = $0 { return true } else { return false } }, "\(name) \(id)")
                XCTAssertEqual(events.last?.type, "done")
                XCTAssertEqual(events.dropLast().last?.type, "grounding")
                XCTAssertEqual(events.first?.type, name == "voice" ? "transcript" : "start")
            }
        }
    }

    func testInvestigationStagesComeInOrder() throws {
        let data = try XCTUnwrap(ReplayTransport.fixture("coach/stream-investigate-CUST04974.sse"))
        let stages: [Stage] = SisuEventStreamParser.events(in: data).compactMap { if case .stage(let stage) = $0 { return stage } else { return nil } }
        XCTAssertEqual(stages.map(\.kind), StageKind.investigationOrder)
        for stage in stages {
            switch (stage.kind, stage.data) {
            case (.lead, .lead(let patterns)): XCTAssertFalse(patterns.isEmpty)
            case (.research, .research(let research)): XCTAssertTrue(research.mock)
            case (.extraction, .extraction(let extraction)): XCTAssertEqual(extraction.offers.count, 3)
            case (.calculation, .calculation(let calculation)): XCTAssertEqual(calculation.unit, "EUR/year")
            case (.impact, .impact(let impact)): XCTAssertEqual(impact.branches.count, 3)
            case (.teaching, .teaching(let card)): XCTAssertEqual(card.concept, .switchingBills)
            case (.action, .action(let action)): XCTAssertEqual(action.status, .awaitingApproval)
            default: XCTFail("stage \(stage.kind) holds the wrong data")
            }
        }
    }

    func testEveryStageKindOfTheRecordingsHoldsItsOwnData() throws {
        var seen: Set<StageKind> = []
        for id in ids {
            for name in ["investigate", "electricity", "afford", "payday", "bills", "patterns", "whatif", "teach", "category", "remember"] {
                for event in Recorded.events("stream-\(name)-\(id).sse") {
                    guard case .stage(let stage) = event else { continue }
                    seen.insert(stage.kind)
                    switch (stage.kind, stage.data) {
                    case (.lead, .lead), (.evidence, .evidence), (.research, .research), (.extraction, .extraction), (.calculation, .calculation),
                         (.teaching, .teaching), (.action, .action), (.impact, .impact), (.memory, .memory):
                        break
                    default:
                        XCTFail("\(name) \(id): stage \(stage.kind) holds \(stage.data)")
                    }
                }
            }
        }
        XCTAssertEqual(seen, [.lead, .evidence, .research, .extraction, .calculation, .teaching, .action, .impact, .memory])
        let remembered = try load("memory-CUST04974-remembered.json", as: CustomerMemory.self)
        XCTAssertEqual(remembered.items.map(\.kind), [.yearlyKwh])
        XCTAssertEqual(remembered.items.first?.source, "user-said-in-chat")
    }

    func testUnknownAndBrokenEventsNeverThrow() {
        XCTAssertEqual(SisuEvent.decode(#"{"type":"confetti","amount":3}"#), .unknown(type: "confetti"))
        XCTAssertEqual(SisuEvent.decode(#"{"type":"tool_end","trace":"not an object"}"#), .unknown(type: "tool_end"))
        XCTAssertNil(SisuEvent.decode("[1,2]"))
        XCTAssertNil(SisuEvent.decode("not json"))
        XCTAssertEqual(SisuEvent.decode(#"{"type":"delta","text":"Hi","extra":true}"#), .delta("Hi"))
        XCTAssertEqual(SisuEvent.decode(#"{"type":"done","text":"Bye"}"#), .done(text: "Bye", citations: [], timings: nil))
        XCTAssertEqual(SisuEvent.decode(#"{"type":"error","message":"Sorry."}"#), .error(message: "Sorry."))
        XCTAssertEqual(SisuEvent.decode(#"{"type":"speculation","billType":"water","reason":"r"}"#), .speculation(billType: BillType(rawValue: "water"), reason: "r"))
    }

    func testAStageOfAnUnknownKindKeepsItsTitle() throws {
        let json = #"{"type":"stage","stage":{"id":"t:9","kind":"hologram","title":"New","summary":"Soon","source":"x","toolCallId":null,"atMs":4,"facts":[],"data":{"kind":"hologram","depth":3}}}"#
        guard case .stage(let stage) = try XCTUnwrap(SisuEvent.decode(json)) else { return XCTFail("not a stage") }
        XCTAssertEqual(stage.title, "New")
        XCTAssertEqual(stage.data, .unknown(kind: "hologram"))
    }

    func testEventsSurviveARoundTrip() throws {
        let data = try XCTUnwrap(ReplayTransport.fixture("coach/stream-investigate-CUST04414.sse"))
        let events = SisuEventStreamParser.events(in: data)
        for event in events {
            let encoded = try JSONEncoder().encode(event)
            XCTAssertEqual(try JSONDecoder().decode(SisuEvent.self, from: encoded), event, event.type)
        }
    }

    func testRequestBodiesHoldOnlyTheContractKeys() throws {
        func keys<T: Encodable>(_ value: T) throws -> Set<String> {
            Set(try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) as? [String: Any]).keys)
        }
        XCTAssertEqual(try keys(AgentRequest(customerId: "C", text: "Hi")), ["customerId", "text", "mode"])
        XCTAssertEqual(try keys(AgentRequest(customerId: "C", text: "Hi", mode: "voice", history: [], focusBill: .mobile, language: "fi")),
                       ["customerId", "text", "mode", "history", "focusBill", "language"])
        XCTAssertEqual(try keys(InvestigateRequest(customerId: "C")), ["customerId", "mode"])
        XCTAssertEqual(try keys(ResearchRequest(customerId: "C", billType: .electricity, wait: false)), ["customerId", "billType", "wait"])
        XCTAssertEqual(try keys(MemorySaveRequest(customerId: "C", kind: .billName, key: "k", value: "v", billType: .electricity)),
                       ["customerId", "kind", "key", "value", "billType"])
        XCTAssertEqual(try keys(MemoryConsentRequest(customerId: "C", consent: false)), ["customerId", "consent"])
        XCTAssertEqual(try keys(PrepareActionRequest(customerId: "C", kind: .switchContract, billType: .electricity)), ["customerId", "kind", "billType"])
        XCTAssertEqual(try keys(ActionDecisionRequest(customerId: "C", confirm: true)), ["customerId", "confirm"])
        XCTAssertEqual(try keys(ActionDecisionRequest(customerId: "C")), ["customerId"])
    }
}
