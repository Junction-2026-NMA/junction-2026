import XCTest
@testable import SisuCore

/// `CoachClient` against the bundled recordings (sample mode) and against scripted answers.
final class CoachClientTests: XCTestCase {
    private let aino = "CUST04974"
    private let sanna = "CUST02003"

    private func scripted(_ transport: ScriptedTransport) -> CoachClient {
        CoachClient(baseURL: URL(string: "http://localhost:3000")!, transport: transport)
    }

    private func assertThrows<T>(_ expected: SisuError, _ work: () async throws -> T, file: StaticString = #filePath, line: UInt = #line) async {
        do {
            _ = try await work()
            XCTFail("expected \(expected)", file: file, line: line)
        } catch {
            XCTAssertEqual(error as? SisuError, expected, file: file, line: line)
        }
    }

    func testServerAndVoice() async throws {
        let client = CoachClient.sample(eventDelay: 0)
        XCTAssertEqual(client.kind, .bundledSample)
        XCTAssertEqual(CoachClient.live(baseURL: URL(string: "http://localhost:3000")!).kind, .live)
        let warm = try await client.warm()
        XCTAssertTrue(warm.mock)
        let health = try await client.health()
        XCTAssertTrue(health.ok)
        let options = try await client.voiceOptions()
        XCTAssertGreaterThan(options.languages.count, 10)
        let transcript = try await client.transcribe(audio: Data([1]), fileName: "a.m4a", mimeType: "audio/mp4")
        XCTAssertEqual(transcript.text, "Can you find me a cheaper electricity deal?")
        let audio = try await client.speech(SpeechRequest(text: "Hello."))
        XCTAssertEqual(audio.contentType, "audio/wav")
        XCTAssertEqual(Array(audio.data.prefix(4)), Array("RIFF".utf8))
        let reset = try await client.resetDemo()
        XCTAssertTrue(reset.ok)
    }

    func testCoachEndpoints() async throws {
        let client = CoachClient.sample(eventDelay: 0)
        let patterns = try await client.patterns(customerId: aino)
        XCTAssertFalse(patterns.isEmpty)
        let cashFlow = try await client.cashFlow(customerId: aino)
        XCTAssertEqual(cashFlow.customerId, aino)
        let affordable = try await client.affordability(customerId: aino, amountEur: 200)
        XCTAssertEqual(affordable.amountEur, 200)
        await assertThrows(.server(status: 404, message: ReplayTransport.notInSample)) { try await client.affordability(customerId: self.aino, amountEur: 123) }
        let all = try await client.teachingCards(customerId: aino)
        XCTAssertEqual(all.count, 7)
        let one = try await client.teachingCards(customerId: aino, concept: .safeToSpend)
        XCTAssertEqual(one.map(\.concept), [.safeToSpend])
        XCTAssertEqual(one.first, all.first { $0.concept == .safeToSpend })
        do {
            _ = try await client.teachingCards(customerId: aino, concept: ConceptId(rawValue: "alchemy"))
            XCTFail("expected an error")
        } catch SisuError.server(let status, let message) {
            XCTAssertEqual(status, 400)
            XCTAssertTrue(message.hasPrefix("Unknown concept."))
        }
        let none = try await client.mortgage(customerId: aino)
        XCTAssertNil(none)
        let mortgage = try await client.mortgage(customerId: sanna)
        XCTAssertEqual(mortgage?.customerId, sanna)
    }

    func testResearch() async throws {
        let client = CoachClient.sample(eventDelay: 0)
        let started = try await client.research(customerId: aino, billType: .electricity, wait: false)
        XCTAssertEqual(started.billType, .electricity)
        let done = try await client.research(customerId: aino, billType: .mobile)
        XCTAssertEqual(done.status, .done)
        let snapshot = try await client.researchSnapshot(customerId: aino, billType: .internet)
        XCTAssertEqual(snapshot.billType, .internet)
        await assertThrows(.server(status: 404, message: ReplayTransport.notInSample)) {
            try await client.research(customerId: self.aino, billType: BillType(rawValue: "water"))
        }
    }

    func testMemoryIsRememberedWithinTheSampleSession() async throws {
        let client = CoachClient.sample(eventDelay: 0)
        let empty = try await client.memory(customerId: aino)
        XCTAssertEqual(empty.items, [])
        let saved = try await client.confirmBill(customerId: aino, billId: "utilities-1", name: "Oma sähkö", billType: .electricity)
        XCTAssertEqual(saved.items.map(\.value), ["Oma sähkö"])
        XCTAssertEqual(saved.items.first?.billType, .electricity)
        let kwh = try await client.rememberKwh(customerId: aino, yearlyKwh: 3500)
        XCTAssertEqual(kwh.items.map(\.kind), [.billName, .yearlyKwh])
        XCTAssertEqual(kwh.items.last?.value, "3500")
        let again = try await client.memory(customerId: aino)
        XCTAssertEqual(again, kwh)
        let oneLess = try await client.forgetMemory(customerId: aino, itemId: kwh.items[0].id)
        XCTAssertEqual(oneLess.items.map(\.kind), [.yearlyKwh])
        let off = try await client.setMemoryConsent(customerId: aino, consent: false)
        XCTAssertFalse(off.consent)
        XCTAssertEqual(off.items, [])
        let cleared = try await client.forgetMemory(customerId: aino)
        XCTAssertEqual(cleared.items, [])
    }

    func testPrepareApproveDeclineAndTheAuditTrail() async throws {
        let client = CoachClient.sample(eventDelay: 0)
        let before = try await client.actions(customerId: aino)
        XCTAssertEqual(before.actions, [])
        let action = try await client.prepareAction(PrepareActionRequest(customerId: aino, kind: .switchContract, billType: .electricity))
        XCTAssertEqual(action.status, .awaitingApproval)
        XCTAssertEqual(action.preparedBy, "user")
        let pending = try await client.actions(customerId: aino)
        XCTAssertEqual(pending.actions.map(\.id), [action.id])

        let approved = try await client.approveAction(customerId: aino, actionId: action.id)
        XCTAssertEqual(approved.status, .executedSimulated)
        XCTAssertNotNil(approved.impact)
        let after = try await client.actions(customerId: aino)
        XCTAssertEqual(after.actions.map(\.status), [.executedSimulated])
        let audit = try await client.audit(customerId: aino)
        XCTAssertEqual(audit.events.map(\.type), ["action_prepared", "action_approved", "action_executed_simulated"])
        XCTAssertTrue(audit.chainValid)

        await assertThrows(.server(status: 409, message: "This action was already approved.")) { try await client.declineAction(customerId: self.aino, actionId: action.id) }
        await assertThrows(.server(status: 404, message: "We could not find that action.")) { try await client.approveAction(customerId: self.aino, actionId: "nope") }
        await assertThrows(.server(status: 404, message: ReplayTransport.notInSample)) {
            try await client.prepareAction(PrepareActionRequest(customerId: self.aino, kind: .standingTransfer, monthlyAmountEur: 50))
        }

        try await client.resetDemo()
        let other = CoachClient.sample(eventDelay: 0)
        let second = try await other.prepareAction(PrepareActionRequest(customerId: sanna, kind: .switchContract, billType: .electricity))
        let declined = try await other.declineAction(customerId: sanna, actionId: second.id)
        XCTAssertEqual(declined.status, .declined)
        let list = try await other.actions(customerId: sanna)
        XCTAssertEqual(list.actions.map(\.status), [.declined])
    }

    func testATypedQuestionGetsTheRecordedTurnOfItsKind() {
        let expected: [(String, String?)] = [
            ("Can you find me a cheaper electricity deal?", "electricity"),
            ("Onko halvempaa sähköä?", "electricity"),
            ("Is there a cheaper mobile plan?", nil),
            ("Can I afford a 200 euro bike?", "afford"),
            ("Can I afford a 1,500 euro trip?", nil),
            ("Remember that my electricity use is 3500 kWh a year", "remember"),
            ("Remember that I use 2000 kWh", nil),
            ("How is my mortgage application going?", "mortgage"),
            ("Will I run out of money before payday?", "payday"),
            ("Which of my bills have gone up?", "bills"),
            ("Where does my money go?", "patterns"),
            ("What if I save 50 euros a month?", "whatif"),
            ("What if I cut my spending?", nil),
            ("Explain why a buffer comes first", "teach"),
            ("Explain fixed and spot prices", nil),
            ("How much do I spend on restaurants?", "category"),
            ("How much do I spend on groceries?", nil),
            ("How much can I safely spend this week?", "spending"),
            ("Hello there", "spending"),
        ]
        for (question, turn) in expected {
            XCTAssertEqual(ReplayTransport.recordedTurn(for: question), turn, question)
        }
        XCTAssertEqual(ReplayTransport.recordedTurn(for: "Is there a better deal for this?", focusBill: "electricity"), "electricity")
        XCTAssertNil(ReplayTransport.recordedTurn(for: "Is there a better deal for this?", focusBill: "mobile"))
        XCTAssertEqual(ReplayTransport.firstNumber("a 1,500 euro trip"), 1500)
        XCTAssertEqual(ReplayTransport.firstNumber("about 12.5 percent."), 12.5)
        XCTAssertNil(ReplayTransport.firstNumber("no number"))
    }

    func testBillPhoto() async throws {
        let client = CoachClient.sample(eventDelay: 0)
        let result = try await client.readBillPhoto(customerId: aino, image: Data([0x89, 0x50]), fileName: "bill.png", mimeType: "image/png")
        XCTAssertEqual(result.customerId, aino)
        XCTAssertEqual(result.reading.yearlyKwh, 2650)
        XCTAssertTrue(result.reading.mock)
        XCTAssertTrue(result.toConfirm.hasPrefix("Sisu read: "))
        XCTAssertEqual(result.facts.first?.source, "customer-stated")
        XCTAssertNotNil(result.comparison)
        let request = CoachEndpoints.billPhoto(baseURL: URL(string: "http://localhost:3000")!, customerId: aino, image: Data([1]), boundary: "B")
        XCTAssertEqual(request.url?.path, "/api/agent/bill-photo")
        let body = String(decoding: try XCTUnwrap(request.httpBody), as: UTF8.self)
        XCTAssertTrue(body.contains("name=\"image\"; filename=\"bill.jpg\"\r\nContent-Type: image/jpeg"))
        XCTAssertTrue(body.contains("name=\"customerId\"\r\n\r\nCUST04974\r\n"))
    }

    func testStreams() async throws {
        let client = CoachClient.sample(eventDelay: 0)
        var types: [String] = []
        for try await event in client.ask(AgentRequest(customerId: aino, text: "How much can I safely spend this week?")) { types.append(event.type) }
        XCTAssertEqual(types.first, "start")
        XCTAssertEqual(types.last, "done")
        XCTAssertFalse(types.contains("research"))

        types = []
        for try await event in client.ask(AgentRequest(customerId: aino, text: "Is there a cheaper electricity deal?")) { types.append(event.type) }
        XCTAssertTrue(types.contains("research"))

        var stages = 0
        for try await event in client.investigate(InvestigateRequest(customerId: sanna)) {
            if case .stage = event { stages += 1 }
        }
        XCTAssertEqual(stages, 7)

        types = []
        for try await event in client.voiceTurn(customerId: aino, audio: Data([1, 2]), fileName: "a.m4a", mimeType: "audio/mp4") { types.append(event.type) }
        XCTAssertEqual(Array(types.prefix(2)), ["transcript", "start"])
    }

    func testTheFourDataRoutesWorkThroughTheSameClient() async throws {
        let client = CoachClient.sample(eventDelay: 0)
        let customers = try await client.demoCustomers()
        XCTAssertEqual(customers.count, 3)
        let overview = try await client.overview(customerId: aino)
        XCTAssertEqual(overview.customerId, aino)
        let rows = try await client.transactions(customerId: aino, filter: EvidenceFilter(from: "2025-11-01", to: "2026-10-31", basket: .everyday))
        let bundled = try await FixtureAPI().transactions(customerId: aino, filter: EvidenceFilter(from: "", to: "", basket: .everyday))
        XCTAssertEqual(rows, bundled)
        let scenario = try await client.scenario(customerId: aino, input: ScenarioInput(billSavingPerMonth: 15, everydayCutPct: 10, years: 5))
        XCTAssertEqual(scenario.freedPerMonth, 87.32, accuracy: 0.01)
        await assertThrows(.unknownCustomer("NOPE")) { try await client.overview(customerId: "NOPE") }
    }

    func testErrorMapping() async {
        let transport = ScriptedTransport()
        let client = scripted(transport)
        transport.onSend = { _ in throw SisuError.offline }
        await assertThrows(.offline) { try await client.warm() }
        transport.onSend = { _ in TransportResponse(status: 200, body: Data("<html>".utf8)) }
        await assertThrows(.invalidResponse) { try await client.health() }
        transport.onSend = { _ in TransportResponse(status: 500, body: Data()) }
        await assertThrows(.server(status: 500, message: "")) { try await client.memory(customerId: self.aino) }
        transport.onSend = { _ in TransportResponse(status: 409, body: Data(#"{"error":"Look up offers first."}"#.utf8)) }
        await assertThrows(.server(status: 409, message: "Look up offers first.")) {
            try await client.prepareAction(PrepareActionRequest(customerId: self.aino, kind: .switchContract, billType: .electricity))
        }
        transport.onSend = { _ in TransportResponse(status: 404, body: Data(#"{"error":"There is no mortgage application on record for this customer."}"#.utf8)) }
        let mortgage = try? await client.mortgage(customerId: aino)
        XCTAssertNil(mortgage ?? nil)

        transport.onOpen = { _ in ScriptedTransport.failed(status: 429, body: #"{"error":"Please wait."}"#) }
        do {
            for try await _ in client.ask(AgentRequest(customerId: aino, text: "Hi")) {}
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? SisuError, .server(status: 429, message: "Please wait."))
        }
        XCTAssertEqual(CoachErrors.sentence(for: SisuError.server(status: 410, message: "Expired.")), CoachErrors.expired)
        XCTAssertEqual(CoachErrors.sentence(for: SisuError.server(status: 409, message: "")), CoachErrors.alreadyDecided)
        XCTAssertEqual(CoachErrors.sentence(for: SisuError.server(status: 400, message: "Ask Sisu a question.")), "Ask Sisu a question.")
        XCTAssertEqual(CoachErrors.sentence(for: SisuError.invalidResponse), CoachErrors.unreadable)
    }
}
