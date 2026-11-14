import Combine
import XCTest
@testable import SisuCore

/// `CoachSession` run headlessly against the bundled recordings and against scripted streams.
@MainActor
final class CoachSessionTests: XCTestCase {
    private let aino = "CUST04974"

    private func sample(_ customerId: String = "CUST04974", speech: SpeechOutput? = nil) -> CoachSession {
        CoachSession.sample(customerId: customerId, eventDelay: 0, speech: speech)
    }

    private func scripted(_ transport: ScriptedTransport, speech: SpeechOutput? = nil) -> CoachSession {
        var counter = 0
        return CoachSession(customerId: aino, client: CoachClient(baseURL: URL(string: "http://localhost:3000")!, transport: transport),
                            speech: speech, makeId: { counter += 1; return "m\(counter)" })
    }

    /// Waits until the session's state satisfies the condition (the timeout only bounds a failing test).
    private func wait(for session: CoachSession, _ what: String, until condition: @escaping (CoachSession) -> Bool) async {
        if condition(session) { return }
        let reached = expectation(description: what)
        var done = false
        let watcher = session.objectWillChange.receive(on: DispatchQueue.main).sink { [weak session] _ in
            guard !done, let session, condition(session) else { return }
            done = true
            reached.fulfill()
        }
        await fulfillment(of: [reached], timeout: 10)
        watcher.cancel()
    }

    private func settle() async {
        for _ in 0..<200 { await Task.yield() }
    }

    // MARK: Recorded turns

    func testTypedQuestion() async {
        let session = sample()
        XCTAssertEqual(session.status, .idle)
        let task = session.ask("  How much can I safely spend this week?  ")
        XCTAssertEqual(session.status, .thinking)
        XCTAssertEqual(session.messages.map(\.pending), [false, true])
        await task?.value

        XCTAssertEqual(session.messages.count, 2)
        XCTAssertEqual(session.messages[0].role, .user)
        XCTAssertEqual(session.messages[0].text, "How much can I safely spend this week?")
        let reply = session.messages[1]
        XCTAssertEqual(reply.role, .assistant)
        XCTAssertFalse(reply.pending)
        XCTAssertEqual(reply.text, Recorded.doneText("stream-spending-\(aino).sse"))
        XCTAssertFalse(reply.text.isEmpty)
        XCTAssertNil(reply.error)
        XCTAssertEqual(reply.grounding?.ok, true)
        XCTAssertFalse(reply.facts.isEmpty)
        XCTAssertNotNil(reply.timings)
        XCTAssertNil(reply.research)
        XCTAssertEqual(session.status, .idle)
        XCTAssertEqual(session.server, ServerInfo(mock: true, provider: "mock", model: "mock"))
        XCTAssertEqual(session.dataLabel, .sample)
        XCTAssertTrue(session.isSample)
        XCTAssertNil(session.ask("   "))
        XCTAssertEqual(session.messages.count, 2)
    }

    func testElectricityQuestionBringsResearch() async {
        let session = sample()
        await session.ask("Can you find me a cheaper electricity deal?")?.value
        let reply = session.messages[1]
        XCTAssertEqual(reply.startedEarly, .electricity)
        XCTAssertEqual(reply.tools.map(\.name), ["search_offers"])
        XCTAssertNil(reply.runningTool)
        XCTAssertEqual(reply.research?.status, .done)
        XCTAssertEqual(reply.research?.offers.count, 3)
        XCTAssertNotNil(reply.research?.best?.estimatedYearlySavingEur)
        XCTAssertEqual(reply.stages.map(\.kind), [.research, .extraction, .calculation])
        XCTAssertFalse(reply.citations.isEmpty)
        XCTAssertEqual(reply.text, Recorded.doneText("stream-electricity-\(aino).sse"))
        XCTAssertNil(reply.action)
    }

    func testAWholeInvestigation() async {
        for id in FixtureAPI.customerIds {
            let session = sample(id)
            await session.investigate().value
            XCTAssertEqual(session.messages[0].text, CoachSession.investigateText)
            let reply = session.messages[1]
            XCTAssertEqual(reply.stages.map(\.kind), StageKind.investigationOrder, id)
            XCTAssertEqual(reply.stages.count, 7)
            XCTAssertNotNil(reply.filler)
            XCTAssertNotNil(reply.teaching)
            XCTAssertEqual(reply.action?.status, .awaitingApproval)
            XCTAssertEqual(reply.action?.simulated, true)
            XCTAssertEqual(session.actions.map(\.id), [reply.action?.id])
            XCTAssertEqual(session.approvedMonthlySaving, 0)
            XCTAssertFalse(reply.pending)
            XCTAssertEqual(session.status, .idle)
        }
    }

    func testApprove() async throws {
        let session = sample()
        await session.investigate().value
        let id = try XCTUnwrap(session.messages[1].action?.id)

        let approvedOrNil = await session.approve(id)
        let approved = try XCTUnwrap(approvedOrNil)
        XCTAssertEqual(approved.status, .executedSimulated)
        XCTAssertNotNil(approved.impact)
        XCTAssertGreaterThan(approved.impact?.gainVsNothingEur ?? 0, 0)
        XCTAssertGreaterThan(session.approvedMonthlySaving, 0)
        XCTAssertEqual(session.approvedMonthlySaving, approved.monthlyAmountEur, accuracy: 0.0001)
        XCTAssertEqual(session.messages[1].action, approved)
        XCTAssertEqual(session.messages[1].stages.last?.data, .action(approved))
        XCTAssertEqual(session.actions, [approved])
        XCTAssertNil(session.notice)

        await session.refresh()
        XCTAssertEqual(session.actions.map(\.status), [.executedSimulated])
        XCTAssertGreaterThan(session.approvedMonthlySaving, 0)

        let again = await session.approve(id)
        XCTAssertNil(again)
        XCTAssertEqual(session.notice, "This action was already approved.")
        XCTAssertEqual(session.actions.map(\.status), [.executedSimulated])
    }

    func testDecline() async throws {
        let session = sample("CUST04414")
        await session.investigate().value
        let id = try XCTUnwrap(session.messages[1].action?.id)
        let declinedOrNil = await session.decline(id)
        let declined = try XCTUnwrap(declinedOrNil)
        XCTAssertEqual(declined.status, .declined)
        XCTAssertNil(declined.impact)
        XCTAssertEqual(session.messages[1].action?.status, .declined)
        XCTAssertEqual(session.approvedMonthlySaving, 0)
        XCTAssertNil(session.notice)
        let unknown = await session.decline("00000000-0000-0000-0000-000000000000")
        XCTAssertNil(unknown)
        XCTAssertEqual(session.notice, "We could not find that action.")
    }

    func testPrepareSwitchFromAButton() async throws {
        let session = sample("CUST02003")
        let preparedOrNil = await session.prepareSwitch(billType: .electricity)
        let prepared = try XCTUnwrap(preparedOrNil)
        XCTAssertEqual(prepared.status, .awaitingApproval)
        XCTAssertEqual(session.actions, [prepared])
        let approved = await session.approve(prepared.id)
        XCTAssertEqual(approved?.status, .executedSimulated)
        XCTAssertGreaterThan(session.approvedMonthlySaving, 0)
        let missing = await session.prepareSwitch(billType: BillType(rawValue: "water"))
        XCTAssertNil(missing)
        XCTAssertEqual(session.notice, ReplayTransport.notInSample)
    }

    func testOtherRecordedQuestions() async {
        let session = sample()
        await session.ask("How much do I spend on restaurants?")?.value
        XCTAssertEqual(session.messages[1].stages.map(\.kind), [.evidence])
        XCTAssertEqual(session.messages[1].tools.map(\.name), ["get_spending"])
        await session.ask("Where does my money go?")?.value
        XCTAssertEqual(session.messages[3].stages.map(\.kind), [.lead])
        await session.ask("Explain why a buffer comes first")?.value
        XCTAssertEqual(session.messages[5].teaching?.concept, .bufferFirst)
        await session.ask("Can I afford a 200 euro bike?")?.value
        XCTAssertEqual(session.messages[7].stages.map(\.kind), [.calculation])
        await session.ask("Can I afford a 777 euro bike?")?.value
        XCTAssertEqual(session.messages[9].error, ReplayTransport.notInSample)
        XCTAssertEqual(session.messages.filter { $0.role == .assistant && $0.error == nil }.count, 4)
    }

    func testSomethingSisuRemembersShowsOnTheMessageAndInMemory() async {
        let session = sample()
        await session.ask("Remember that my electricity use is 3500 kWh a year")?.value
        XCTAssertEqual(session.messages[1].remembered.map(\.value), ["3500"])
        XCTAssertEqual(session.messages[1].remembered.first?.kind, .yearlyKwh)
        XCTAssertEqual(session.messages[1].stages.map(\.kind), [.memory])
        await wait(for: session, "memory reloaded") { $0.memory?.items.count == 1 }
        XCTAssertEqual(session.memory?.items.first?.value, "3500")
    }

    func testSamplesGiveTheSameReplyAsARecordedTurn() async {
        let session = sample()
        await session.investigate().value
        var expected = CoachSamples.reply(turn: "investigate")
        expected.id = session.messages[1].id
        XCTAssertEqual(session.messages[1], expected)
        XCTAssertEqual(expected.stages.count, 7)
        for turn in CoachSamples.turns {
            for id in FixtureAPI.customerIds {
                let reply = CoachSamples.reply(turn: turn, customerId: id)
                XCTAssertFalse(reply.text.isEmpty, "\(turn) \(id)")
                XCTAssertNil(reply.error)
                XCTAssertFalse(reply.pending)
            }
        }
        XCTAssertEqual(CoachSamples.reply(turn: "nope").text, "")
        XCTAssertEqual(CoachSamples.research()?.offers.count, 3)
        XCTAssertEqual(CoachSamples.action()?.status, .awaitingApproval)
        XCTAssertEqual(CoachSamples.action(approved: true)?.status, .executedSimulated)
        XCTAssertEqual(CoachSamples.action()?.id, CoachSamples.action(approved: true)?.id)
        XCTAssertEqual(CoachSamples.teachingCards().count, 7)
    }

    func testStepsChartsAndActivityComeFromTheStream() async throws {
        let session = sample()
        XCTAssertEqual(session.activity, .idle)
        let task = session.investigate()
        XCTAssertEqual(session.activity, SisuActivity(.thinking))
        await task.value
        let reply = session.messages[1]
        XCTAssertEqual(reply.steps.count, 5)
        XCTAssertTrue(reply.steps.allSatisfy { $0.done && $0.ok && $0.result != nil })
        XCTAssertEqual(reply.steps.map(\.id), reply.tools.map(\.id))
        XCTAssertEqual(reply.visuals.map(\.kind), ["budget_donut", "offer_bars", "futures_lines"])
        let id = try XCTUnwrap(reply.action?.id)
        XCTAssertEqual(session.activity, SisuActivity(.waitingForApproval, label: "Switch electricity contract to Example Energia (Fixed 24)"))
        XCTAssertEqual(session.activity.mood, .found)

        session.setRecording(true)
        XCTAssertEqual(session.activity, SisuActivity(.listening))
        session.setRecording(false)
        session.setSpeaking(true)
        XCTAssertEqual(session.activity, SisuActivity(.speaking))
        session.setSpeaking(false)

        let approved = await session.approve(id)
        XCTAssertEqual(session.activity.state, .approved)
        XCTAssertEqual(session.activity.liito, .cheering)
        XCTAssertEqual(session.activity.label, approved?.confirmation ?? "Done, as a simulation")
        XCTAssertEqual(approved?.confirmation?.hasPrefix("Done (simulation). Reference SIM-"), true)

        await session.ask("How much can I safely spend this week?")?.value
        XCTAssertEqual(session.messages[3].steps, [])
        XCTAssertEqual(session.messages[3].visuals, [])
        XCTAssertEqual(session.activity, .idle)

        let other = sample("CUST04414")
        await other.investigate().value
        let otherId = try XCTUnwrap(other.messages[1].action?.id)
        await other.decline(otherId)
        XCTAssertEqual(other.activity, SisuActivity(.declined))
        XCTAssertEqual(other.activity.mood, .cosy)
    }

    func testReplaceThrowsAwayTheTextSoFarAndStepsFillInLive() async {
        let transport = ScriptedTransport()
        let (stream, feed) = AsyncThrowingStream<Data, Error>.makeStream()
        transport.onOpen = { _ in TransportStream(status: 200, chunks: stream) }
        let session = scripted(transport)
        let task = session.ask("Move 500 euros to my savings")
        feed.yield(ScriptedTransport.sse([#"{"type":"start","turnId":"t","provider":"nvidia","model":"n","mock":false}"#,
                                          #"{"type":"delta","text":"I've set it up. "}"#, #"{"type":"replace","text":""}"#,
                                          #"{"type":"tool_start","id":"c1","name":"prepare_action","args":{},"label":"Setting up the transfer for you to approve"}"#]))
        await wait(for: session, "the step is running") { $0.messages.last?.steps.count == 1 }
        XCTAssertEqual(session.messages[1].text, "")
        XCTAssertEqual(session.messages[1].steps, [CoachStep(id: "c1", label: "Setting up the transfer for you to approve")])
        XCTAssertEqual(session.activity, SisuActivity(.settingUp, label: "Setting up the transfer for you to approve"))
        feed.yield(ScriptedTransport.sse([#"{"type":"tool_end","trace":{"id":"c1","name":"prepare_action","source":"finance","startedAtMs":1,"tookMs":40,"ok":false,"summary":"Not enough room"}}"#,
                                          #"{"type":"tool_start","id":"c2","name":"new_tool","args":{}}"#,
                                          #"{"type":"delta","text":"That would leave you short."}"#, #"{"type":"done","text":"That would leave you short.","citations":[]}"#]))
        feed.finish()
        await task?.value
        let reply = session.messages[1]
        XCTAssertEqual(reply.text, "That would leave you short.")
        XCTAssertEqual(reply.steps[0], CoachStep(id: "c1", label: "Setting up the transfer for you to approve", done: true, ok: false, tookMs: 40, result: "Not enough room"))
        XCTAssertEqual(reply.steps[1].label, "new_tool")
        XCTAssertFalse(reply.steps[1].done)
    }

    func testFallingBackFromLiveToTheSampleIsAnnouncedOnce() async {
        let offline = ScriptedTransport()
        offline.onSend = { _ in throw SisuError.offline }
        offline.onOpen = { _ in throw SisuError.offline }
        let moment = Date(timeIntervalSince1970: 1_794_650_000)
        let transport = FallbackTransport(primary: offline, sample: ReplayTransport(eventDelay: 0), now: { moment })
        let session = CoachSession(customerId: aino, client: CoachClient(baseURL: URL(string: "http://localhost:3000")!, transport: transport))
        XCTAssertEqual(session.dataLabel, .live)
        XCTAssertNil(session.fallbackNotice)
        XCTAssertNil(session.client.fallenBackAt)

        await session.ask("How much can I safely spend this week?")?.value
        XCTAssertEqual(session.fallbackNotice, CoachClient.fallbackSentence)
        XCTAssertEqual(session.dataLabel, .sample)
        XCTAssertTrue(session.isSample)
        XCTAssertEqual(session.client.fallenBackAt, moment)
        XCTAssertNil(session.messages[1].error)
        XCTAssertFalse(session.messages[1].text.isEmpty)

        session.dismissFallbackNotice()
        XCTAssertNil(session.fallbackNotice)
        await session.open()
        await session.ask("Where does my money go?")?.value
        XCTAssertNil(session.fallbackNotice) // announced once
        XCTAssertEqual(session.dataLabel, .sample)
        XCTAssertEqual(offline.requests.count, 1) // after the fallback nothing is sent to the server

        // A server that answers, even with an error, is not a reason to fall back.
        let reachable = ScriptedTransport()
        reachable.onOpen = { _ in ScriptedTransport.failed(status: 500, body: "{}") }
        let live = CoachSession(customerId: aino, client: CoachClient(baseURL: URL(string: "http://localhost:3000")!, transport: FallbackTransport(primary: reachable)))
        await live.ask("Hi")?.value
        XCTAssertNil(live.fallbackNotice)
        XCTAssertEqual(live.dataLabel, .live)
        XCTAssertEqual(live.messages[1].error, CoachErrors.generic)
        XCTAssertNil(CoachSession.sample(customerId: aino).fallbackNotice)
    }

    func testVoiceTurnStartsWithWhatWasHeard() async {
        let session = sample()
        let task = session.sendVoice(audio: Data([1, 2, 3]), fileName: "speech.m4a", mimeType: "audio/mp4", language: "auto")
        XCTAssertEqual(session.messages.map(\.pending), [true, true])
        XCTAssertEqual(session.messages[0].text, "")
        await task.value
        XCTAssertEqual(session.messages[0].text, "Can you find me a cheaper electricity deal?")
        XCTAssertFalse(session.messages[0].pending)
        XCTAssertNotNil(session.messages[1].research)
        XCTAssertEqual(session.messages[1].text, Recorded.doneText("stream-voice-\(aino).sse"))
    }

    func testSpeechGetsTheFillerAndEverySentenceInOrder() async {
        let speech = RecordingSpeech()
        let session = sample(speech: speech)
        XCTAssertTrue(session.speakReplies)
        await session.investigate().value
        var expected: [String] = []
        for event in Recorded.events("stream-investigate-\(aino).sse") {
            if case .filler(let text) = event { expected.append(text) }
            if case .sentence(_, let text) = event { expected.append(text) }
        }
        XCTAssertGreaterThan(expected.count, 3)
        XCTAssertEqual(speech.spoken, expected)
        XCTAssertEqual(speech.orders, Array(0..<expected.count))
        XCTAssertEqual(speech.stops, 1) // a new turn stops whatever was playing

        let quiet = RecordingSpeech()
        let silent = sample(speech: quiet)
        silent.speakReplies = false
        await silent.ask("How much can I safely spend this week?")?.value
        XCTAssertEqual(quiet.spoken, [])
    }

    func testOpenLoadsServerActionsAndMemory() async {
        let session = sample()
        XCTAssertNil(session.memory)
        await session.open()
        XCTAssertEqual(session.server?.mock, true)
        XCTAssertEqual(session.memory?.consent, true)
        XCTAssertEqual(session.actions, [])
        await session.confirmBill("utilities-1", name: "Helen sähkö", billType: .electricity)
        XCTAssertEqual(session.memory?.confirmedBillName(billId: "utilities-1"), "Helen sähkö")
        XCTAssertNil(session.notice)
        await session.setRemembering(false)
        XCTAssertEqual(session.memory?.consent, false)
        XCTAssertEqual(session.memory?.items, [])
    }

    func testACustomerOutsideTheSampleGetsASentence() async {
        let session = sample("CUST00000")
        await session.ask("Hello?")?.value
        XCTAssertEqual(session.messages[1].error, ReplayTransport.notInSample)
        XCTAssertFalse(session.messages[1].pending)
        XCTAssertEqual(session.status, .idle)
    }

    // MARK: Scripted streams

    func testCancelInMidStream() async {
        let transport = ScriptedTransport()
        let (stream, feed) = AsyncThrowingStream<Data, Error>.makeStream()
        transport.onOpen = { _ in TransportStream(status: 200, chunks: stream) }
        let speech = RecordingSpeech()
        let session = scripted(transport, speech: speech)

        session.ask("Tell me something")
        feed.yield(ScriptedTransport.sse([#"{"type":"start","turnId":"t1","provider":"nvidia","model":"nemotron","mock":false}"#,
                                          #"{"type":"delta","text":"Hel"}"#, #"{"type":"delta","text":"lo"}"#]))
        await wait(for: session, "two deltas") { $0.messages.last?.text == "Hello" }
        XCTAssertEqual(session.status, .thinking)
        XCTAssertEqual(session.messages[1].pending, true)
        XCTAssertEqual(session.dataLabel, .live)

        session.cancel()
        XCTAssertEqual(session.status, .idle)
        XCTAssertEqual(session.messages.map(\.pending), [false, false])
        XCTAssertEqual(speech.stops, 2) // once when the turn started, once for the cancel

        feed.yield(ScriptedTransport.sse([#"{"type":"delta","text":" there"}"#, #"{"type":"done","text":"Hello there","citations":[]}"#]))
        feed.finish()
        await settle()
        XCTAssertEqual(session.messages[1].text, "Hello")
        XCTAssertNil(session.messages[1].error)
        XCTAssertEqual(session.messages.count, 2)
    }

    func testLateEventsOfAnOlderTurnChangeNothing() async {
        let transport = ScriptedTransport()
        let (first, feedFirst) = AsyncThrowingStream<Data, Error>.makeStream()
        var opened = 0
        transport.onOpen = { _ in
            opened += 1
            if opened == 1 { return TransportStream(status: 200, chunks: first) }
            return ScriptedTransport.finished([#"{"type":"delta","text":"Second"}"#, #"{"type":"done","text":"Second answer","citations":[]}"#])
        }
        let session = scripted(transport)

        session.ask("First")
        feedFirst.yield(ScriptedTransport.sse([#"{"type":"delta","text":"Fir"}"#]))
        await wait(for: session, "first delta") { $0.messages.last?.text == "Fir" }

        await session.ask("Second")?.value
        feedFirst.yield(ScriptedTransport.sse([#"{"type":"delta","text":"st, late"}"#, #"{"type":"error","message":"late"}"#]))
        feedFirst.finish()
        await settle()

        XCTAssertEqual(session.messages.map(\.text), ["First", "Fir", "Second", "Second answer"])
        XCTAssertEqual(session.messages.map(\.pending), [false, false, false, false])
        XCTAssertNil(session.messages[1].error)
        XCTAssertEqual(session.status, .idle)
    }

    func testAnErrorEventBecomesASentenceOnTheMessage() async {
        let transport = ScriptedTransport()
        transport.onOpen = { _ in
            ScriptedTransport.finished([#"{"type":"start","turnId":"t","provider":"nvidia","model":"n","mock":true}"#, #"{"type":"delta","text":"Let me"}"#,
                                        #"{"type":"error","message":"Sisu could not reach the model. Please try again."}"#])
        }
        let session = scripted(transport)
        await session.ask("Hi")?.value
        XCTAssertEqual(session.messages[1].error, "Sisu could not reach the model. Please try again.")
        XCTAssertEqual(session.messages[1].text, "Let me")
        XCTAssertFalse(session.messages[1].pending)
        XCTAssertEqual(session.dataLabel, .mock)
        XCTAssertEqual(session.status, .idle)
    }

    func testAnUnknownEventIsIgnored() async {
        let transport = ScriptedTransport()
        transport.onOpen = { _ in
            ScriptedTransport.finished([#"{"type":"hologram","depth":3}"#, #"{"type":"delta","text":"Fine"}"#, "not json at all",
                                        #"{"type":"stage","stage":"broken"}"#, #"{"type":"done","text":"Fine.","citations":[]}"#])
        }
        let session = scripted(transport)
        await session.ask("Hi")?.value
        XCTAssertEqual(session.messages[1].text, "Fine.")
        XCTAssertNil(session.messages[1].error)
        XCTAssertEqual(session.messages[1].stages, [])
    }

    func testHTTPErrorsAndOfflineBecomeSentences() async {
        let transport = ScriptedTransport()
        transport.onOpen = { _ in ScriptedTransport.failed(status: 429, body: #"{"error":"Sisu is getting a lot of questions. Please wait a moment and try again."}"#) }
        let session = scripted(transport)
        await session.ask("Hi")?.value
        XCTAssertEqual(session.messages[1].error, "Sisu is getting a lot of questions. Please wait a moment and try again.")

        transport.onOpen = { _ in throw SisuError.offline }
        await session.ask("Hi again")?.value
        XCTAssertEqual(session.messages[3].error, CoachErrors.offline)
        XCTAssertFalse(session.messages[3].pending)

        transport.onOpen = { _ in ScriptedTransport.failed(status: 500, body: "<html>") }
        await session.investigate().value
        XCTAssertEqual(session.messages[5].error, CoachErrors.generic)
        XCTAssertEqual(session.status, .idle)
    }

    func testRequestsCarryHistoryFocusAndLanguage() async {
        let transport = ScriptedTransport()
        transport.onOpen = { _ in ScriptedTransport.finished([#"{"type":"done","text":"Answer.","citations":[]}"#]) }
        let session = scripted(transport)
        session.focusBill = .mobile
        await session.ask("One")?.value
        session.language = "fi"
        session.speakReplies = true
        await session.ask("Two")?.value
        await session.investigate("my mobile bill").value
        await session.investigate().value

        let bodies = transport.requests.map(ScriptedTransport.json)
        XCTAssertEqual(transport.requests.map { $0.url?.path }, ["/api/agent/query", "/api/agent/query", "/api/agent/investigate", "/api/agent/investigate"])
        XCTAssertEqual(bodies[0]["customerId"] as? String, aino)
        XCTAssertEqual(bodies[0]["text"] as? String, "One")
        XCTAssertEqual(bodies[0]["mode"] as? String, "text")
        XCTAssertEqual(bodies[0]["focusBill"] as? String, "mobile")
        XCTAssertNil(bodies[0]["language"])
        XCTAssertEqual((bodies[0]["history"] as? [Any])?.count, 0)
        let history = bodies[1]["history"] as? [[String: String]]
        XCTAssertEqual(history, [["role": "user", "content": "One"], ["role": "assistant", "content": "Answer."]])
        XCTAssertEqual(bodies[1]["mode"] as? String, "voice")
        XCTAssertEqual(bodies[1]["language"] as? String, "fi")
        XCTAssertEqual(bodies[2]["text"] as? String, "my mobile bill")
        XCTAssertNil(bodies[2]["history"])
        XCTAssertNil(bodies[3]["text"])
        XCTAssertEqual(Set(bodies[3].keys), ["customerId", "mode", "language"])
    }

    func testConfirmBillSavesTheNameThenStartsResearchWithoutWaiting() async {
        let transport = ScriptedTransport()
        transport.onSend = { request in
            if request.url?.path == "/api/memory" {
                return TransportResponse(status: 200, body: ReplayTransport.fixture("coach/memory-CUST04974-saved.json") ?? Data())
            }
            return TransportResponse(status: 200, body: ReplayTransport.fixture("coach/research-CUST04974-electricity-nowait.json") ?? Data())
        }
        let session = scripted(transport)
        await session.confirmBill("utilities-1", name: "Helen electricity", billType: .electricity)
        XCTAssertEqual(session.memory?.items.first?.value, "Helen electricity")
        XCTAssertEqual(transport.requests.map { $0.url?.path }, ["/api/memory", "/api/research"])
        let save = ScriptedTransport.json(transport.requests[0])
        XCTAssertEqual(save["kind"] as? String, "bill_name")
        XCTAssertEqual(save["key"] as? String, "utilities-1")
        XCTAssertEqual(save["value"] as? String, "Helen electricity")
        XCTAssertEqual(save["billType"] as? String, "electricity")
        let research = ScriptedTransport.json(transport.requests[1])
        XCTAssertEqual(research["wait"] as? Bool, false)
        XCTAssertEqual(research["billType"] as? String, "electricity")

        transport.onSend = { _ in TransportResponse(status: 400, body: Data(#"{"error":"That bill does not exist for this customer."}"#.utf8)) }
        await session.confirmBill("nope", name: "x")
        XCTAssertEqual(session.notice, "That bill does not exist for this customer.")
    }

    func testAnExpiredActionShowsTheExpiredSentence() async {
        let transport = ScriptedTransport()
        transport.onSend = { request in
            request.httpMethod == "POST"
                ? TransportResponse(status: 410, body: Data(#"{"error":"This action has expired."}"#.utf8))
                : TransportResponse(status: 500, body: Data())
        }
        let session = scripted(transport)
        let result = await session.approve("a1")
        XCTAssertNil(result)
        XCTAssertEqual(session.notice, CoachErrors.expired)
        XCTAssertEqual(ScriptedTransport.json(transport.requests[0])["confirm"] as? Bool, true)
        XCTAssertEqual(transport.requests[0].url?.path, "/api/actions/a1/approve")
    }

    func testResetRecordingAndStatusOrder() async {
        let session = sample()
        await session.ask("How much can I safely spend this week?")?.value
        session.setSpeaking(true)
        XCTAssertEqual(session.status, .speaking)
        session.setRecording(true)
        XCTAssertEqual(session.status, .recording)
        session.setRecording(false)
        session.setSpeaking(false)
        XCTAssertEqual(session.status, .idle)
        session.reset()
        XCTAssertEqual(session.messages, [])
        XCTAssertEqual(session.status, .idle)
    }
}
