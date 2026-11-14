import XCTest
@testable import SisuCore

/// `PlanSession` and `PlanView`: the port of the web hook `usePlan`, run on the recorded plans.
@MainActor
final class PlanSessionTests: XCTestCase {
    private let aino = "CUST04974"

    /// Records the pauses the director asked for, and returns at once.
    private final class Pauses: @unchecked Sendable {
        private let lock = NSLock()
        private var values: [TimeInterval] = []
        func add(_ value: TimeInterval) { lock.lock(); values.append(value); lock.unlock() }
        var all: [TimeInterval] { lock.lock(); defer { lock.unlock() }; return values }
    }

    private func session(_ customerId: String = "CUST04974", pauses: Pauses = Pauses()) -> PlanSession {
        PlanSession(customerId: customerId, client: .sample(eventDelay: 0), pause: { pauses.add($0) })
    }

    private func scripted(_ transport: ScriptedTransport) -> PlanSession {
        PlanSession(customerId: aino, client: CoachClient(baseURL: URL(string: "http://localhost:3000")!, transport: transport), pause: { _ in })
    }

    func testRecordedPlansHoldOnlyKnownEvents() {
        for id in FixtureAPI.customerIds {
            let events = PlanEvent.events(in: ReplayTransport.fixture("coach/stream-plan-\(id).sse") ?? Data())
            XCTAssertGreaterThan(events.count, 20, id)
            XCTAssertFalse(events.contains { if case .unknown = $0 { return true } else { return false } }, id)
            XCTAssertEqual(events.first?.type, "plan_start")
            XCTAssertEqual(events.last?.type, "plan_done")
        }
        XCTAssertEqual(PlanEvent.decode(Data(#"{"type":"confetti"}"#.utf8)), .unknown(type: "confetti"))
        XCTAssertEqual(PlanEvent.decode(Data(#"{"type":"scan","transactions":"many"}"#.utf8)), .unknown(type: "scan"))
        XCTAssertNil(PlanEvent.decode(Data("nope".utf8)))
    }

    func testAWholePlan() async {
        let pauses = Pauses()
        let plan = session(pauses: pauses)
        XCTAssertEqual(plan.view, PlanView.empty)
        let task = plan.start()
        XCTAssertEqual(plan.view.phase, .running)
        XCTAssertEqual(plan.view.activity, SisuActivity(.thinking, label: "Opening your account"))
        await task.value

        let view = plan.view
        XCTAssertEqual(view.phase, .done)
        XCTAssertEqual(view.act, .sums)
        XCTAssertEqual(view.customerName, "Aino")
        XCTAssertTrue(view.mock)
        XCTAssertEqual(plan.dataLabel, .sample)
        XCTAssertEqual(view.scan?.transactions, 172)
        XCTAssertEqual(view.scan?.rows.count, 48)
        XCTAssertEqual(view.findings.map(\.title), ["Restaurants: €64 a month above people your age", "Entertainment is up 65% on a year ago",
                                                    "Below zero in 6 of the last 12 months", "34% of your everyday spending happens in the week after payday"])
        XCTAssertFalse(view.findings.contains { $0.role == "bill" })
        XCTAssertEqual(Set(view.lanes.map(\.billType)), [.electricity, .mobile, .internet])
        for lane in view.lanes {
            XCTAssertFalse(lane.query.isEmpty)
            XCTAssertEqual(lane.pages.map(\.state), [.read], lane.id)
            XCTAssertEqual(lane.pages.first?.reader, "context.dev")
            XCTAssertNotNil(lane.result?.best)
            XCTAssertGreaterThan(lane.result?.yearlySavingEur ?? 0, 0)
        }
        XCTAssertEqual(view.checks.map(\.id), ["housing-allowance", "housing-cost"])
        XCTAssertEqual(view.checks.first?.check?.yours?.value, 1783.33)
        XCTAssertEqual(view.calc?.totals.totalYearlyEur, 1770.96)
        XCTAssertEqual(view.calc?.totals.effortlessYearlyEur, 256.8)
        XCTAssertEqual(view.calc?.totals.spendingChangeYearlyEur ?? 0, 1514.16, accuracy: 0.001)
        XCTAssertEqual(view.plan?.totals, view.calc?.totals)
        XCTAssertEqual(view.actions.count, 4)
        XCTAssertEqual(view.waitingActions.count, 4)
        XCTAssertEqual(view.actions.map(\.kind), [.switchContract, .switchContract, .switchContract, .standingTransfer])
        XCTAssertEqual(view.actions.last?.destination, "savings")
        XCTAssertEqual(view.actions.last?.warning?.hasPrefix("€126 a month is more than"), true)
        XCTAssertEqual(view.projection?.years, 5)
        XCTAssertEqual(view.summary?.by, "code")
        XCTAssertEqual(view.summary?.text.hasPrefix("I found about €1,771 a year. About €257 of it needs nothing from you"), true)
        XCTAssertEqual(view.plan?.items.count, 5)
        XCTAssertNil(view.error)
        XCTAssertEqual(view.approval, .none)
        XCTAssertEqual(view.activity, SisuActivity(.waitingForApproval, label: "4 things set up"))

        // The director asked for the web's pauses: the scan and the total get their full time.
        XCTAssertTrue(pauses.all.contains(2.7))
        XCTAssertTrue(pauses.all.allSatisfy { $0 > 0 && $0 <= 2.7 })
    }

    func testPausesAreTheWebsAndShrinkWhenEventsPileUp() {
        let finding = PlanEvent.finding(PlanFinding(id: "f", role: "habit", title: "t", detail: "d", yearlyEur: 1))
        let bill = PlanEvent.finding(PlanFinding(id: "f", role: "bill", title: "t", detail: "d", yearlyEur: nil))
        let calc = PlanEvent.calc(steps: [], totals: PlanTotals(totalYearlyEur: 10, effortlessYearlyEur: 4))
        XCTAssertEqual(PlanSession.pause(after: finding, queued: 0), 0.32)
        XCTAssertEqual(PlanSession.pause(after: finding, queued: 3), 0.32)
        XCTAssertEqual(PlanSession.pause(after: finding, queued: 4), 0.32 * 0.7, accuracy: 0.0001)
        XCTAssertEqual(PlanSession.pause(after: finding, queued: 9), 0.32 * 0.45, accuracy: 0.0001)
        XCTAssertEqual(PlanSession.pause(after: bill, queued: 0), 0)
        XCTAssertEqual(PlanSession.pause(after: calc, queued: 20), 2.7)
        XCTAssertEqual(PlanSession.dwell(for: .searchStart(billType: .mobile, query: "q", engine: "exa")), 0.26)
        XCTAssertEqual(PlanSession.dwell(for: .checkStart(id: "c", title: "t", query: "q")), 0.26)
        XCTAssertEqual(PlanSession.dwell(for: .searchPages(billType: .mobile, pages: [])), 0.32)
        XCTAssertEqual(PlanSession.dwell(for: .summary(text: "t", by: "code")), 0)
        XCTAssertEqual(PlanSession.dwell(for: .error(message: "m")), 0)
    }

    func testApproveAll() async {
        let plan = session()
        await plan.start().value
        let approved = await plan.approveAll()
        XCTAssertEqual(approved.count, 4)
        XCTAssertEqual(plan.view.approval, .done)
        XCTAssertNil(plan.view.approvalError)
        XCTAssertEqual(plan.view.actions.map(\.status), Array(repeating: .executedSimulated, count: 4))
        XCTAssertEqual(plan.view.actions.first?.confirmation?.hasPrefix("Done (simulation). Reference SIM-"), true)
        XCTAssertEqual(plan.view.waitingActions, [])
        XCTAssertEqual(plan.view.activity.state, .approved)
        XCTAssertEqual(plan.view.activity.liito, .proud)
        XCTAssertEqual(plan.view.activity.label, "4 approved, as a simulation")
        let again = await plan.approveAll()
        XCTAssertEqual(again, [])
        let list = try? await plan.client.actions(customerId: aino)
        XCTAssertEqual(list?.actions.map(\.status), Array(repeating: .executedSimulated, count: 4))
        XCTAssertEqual(list?.audit.filter { $0.type == "action_executed_simulated" }.count, 4)
    }

    func testAPartOfThePlanThatCannotBeApprovedIsASentence() async {
        let plan = session("CUST04414")
        await plan.start().value
        let first = plan.view.actions[0].id
        _ = try? await plan.client.approveAction(customerId: "CUST04414", actionId: first)
        let approved = await plan.approveAll()
        XCTAssertEqual(approved.count, 3)
        XCTAssertEqual(plan.view.approvalError, "1 could not be approved: This action was already approved.")
        XCTAssertEqual(plan.view.approval, .done)
        XCTAssertEqual(plan.view.activity.liito, .cheering)
        XCTAssertEqual(plan.view.waitingActions.map(\.id), [first])
    }

    func testDeclineCancelAndReset() async {
        let plan = session()
        await plan.start().value
        plan.decline()
        XCTAssertEqual(plan.view.approval, .declined)
        XCTAssertEqual(plan.view.activity, SisuActivity(.declined))
        XCTAssertEqual(plan.view.waitingActions.count, 4)
        plan.reset()
        XCTAssertEqual(plan.view, PlanView.empty)

        let transport = ScriptedTransport()
        let (stream, feed) = AsyncThrowingStream<Data, Error>.makeStream()
        transport.onOpen = { _ in TransportStream(status: 200, chunks: stream) }
        let slow = scripted(transport)
        slow.start()
        XCTAssertEqual(slow.view.phase, .running)
        slow.cancel()
        XCTAssertEqual(slow.view.phase, .idle)
        XCTAssertEqual(slow.view.activity, .idle)
        feed.yield(ScriptedTransport.sse([#"{"type":"error","message":"late"}"#]))
        feed.finish()
        for _ in 0..<200 { await Task.yield() }
        XCTAssertNil(slow.view.error)
        XCTAssertEqual(slow.view.phase, .idle)
    }

    func testErrorsBecomeSentences() async {
        let transport = ScriptedTransport()
        let plan = scripted(transport)
        transport.onOpen = { _ in ScriptedTransport.finished([#"{"type":"plan_start","planId":"p","customerName":"Aino","provider":"nvidia","model":"n","mock":false}"#,
                                                               #"{"type":"hologram"}"#, #"{"type":"error","message":"Sisu could not read the account."}"#]) }
        await plan.start().value
        XCTAssertEqual(plan.view.phase, .error)
        XCTAssertEqual(plan.view.error, "Sisu could not read the account.")
        XCTAssertEqual(plan.view.activity, SisuActivity(.error, label: "Sisu could not read the account."))
        XCTAssertEqual(plan.dataLabel, .live)

        transport.onOpen = { _ in ScriptedTransport.failed(status: 429, body: #"{"error":"Sisu is getting a lot of questions. Please wait a moment and try again."}"#) }
        await plan.start().value
        XCTAssertEqual(plan.view.error, "Sisu is getting a lot of questions. Please wait a moment and try again.")
        transport.onOpen = { _ in ScriptedTransport.failed(status: 500, body: "<html>") }
        await plan.start().value
        XCTAssertEqual(plan.view.error, PlanSession.couldNotStart)
        transport.onOpen = { _ in throw SisuError.offline }
        await plan.start().value
        XCTAssertEqual(plan.view.error, PlanSession.connectionDropped)
        XCTAssertEqual(plan.view.phase, .error)

        transport.onOpen = { _ in ScriptedTransport.finished([#"{"type":"plan_start","planId":"p","customerName":"Aino","provider":"n","model":"n","mock":false}"#]) }
        await plan.start().value
        XCTAssertEqual(plan.view.phase, .error) // cut off before the end
        XCTAssertEqual(plan.view.error, PlanSession.connectionDropped)

        let body = ScriptedTransport.json(transport.requests[0])
        XCTAssertEqual(transport.requests[0].url?.path, "/api/agent/plan")
        XCTAssertEqual(Set(body.keys), ["customerId"])

        let waiting = session("CUST02003")
        await waiting.start().value
        let offline = ScriptedTransport()
        offline.onSend = { _ in throw SisuError.offline }
        let broken = PlanSession(customerId: "CUST02003", client: CoachClient(baseURL: URL(string: "http://localhost:3000")!, transport: offline), pause: { _ in })
        let nothing = await broken.approveAll()
        XCTAssertEqual(nothing, [])
    }

    func testAPlanThatFallsBackToTheSampleSaysSoOnce() async {
        let offline = ScriptedTransport()
        offline.onOpen = { _ in throw SisuError.offline }
        offline.onSend = { _ in throw SisuError.offline }
        let client = CoachClient(baseURL: URL(string: "http://localhost:3000")!, transport: FallbackTransport(primary: offline, sample: ReplayTransport(eventDelay: 0)))
        let plan = PlanSession(customerId: aino, client: client, pause: { _ in })
        XCTAssertEqual(plan.dataLabel, .live)
        await plan.start().value
        XCTAssertEqual(plan.view.phase, .done)
        XCTAssertEqual(plan.fallbackNotice, CoachClient.fallbackSentence)
        XCTAssertEqual(plan.dataLabel, .sample)
        plan.dismissFallbackNotice()
        let approved = await plan.approveAll()
        XCTAssertEqual(approved.count, 4)
        XCTAssertNil(plan.fallbackNotice)
    }

    func testTheReducerNeverShowsABill() {
        var view = PlanView().applying(.reset)
        view = view.applying(.event(.finding(PlanFinding(id: "b", role: "bill", title: "Electricity", detail: "d", yearlyEur: nil))))
        XCTAssertEqual(view.findings, [])
        view = view.applying(.event(.searchStart(billType: .electricity, query: "q", engine: "exa")))
        view = view.applying(.event(.searchPages(billType: .electricity, pages: [PlanPage(url: "u1", host: "a.fi", title: "A"), PlanPage(url: "u2", host: "b.fi", title: "B")])))
        XCTAssertEqual(view.lanes[0].pages.map(\.state), [.reading, .reading])
        view = view.applying(.event(.pageRead(PlanPageRead(billType: .electricity, url: "u2", host: "b.fi", ok: false, offers: 0, reader: "exa", ageMs: 90_000, tookMs: 5))))
        XCTAssertEqual(view.lanes[0].pages.map(\.state), [.reading, .failed])
        XCTAssertEqual(view.lanes[0].pages[1].ageMs, 90_000)
        XCTAssertEqual(view.act, .web)
        view = view.applying(.approving)
        XCTAssertEqual(view.approval, .sending)
        view = view.applying(.approved(actions: [], error: PlanSession.approvalNotSent))
        XCTAssertEqual(view.approval, .none)
        XCTAssertEqual(view.approvalError, PlanSession.approvalNotSent)
    }
}
