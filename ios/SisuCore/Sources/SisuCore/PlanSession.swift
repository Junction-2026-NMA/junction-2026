// The money plan: `PlanView` (what the screen shows) and `PlanSession`, the Swift port of the web hook
// `usePlan` (lib/agent/usePlan.ts). The server sends one event per real step; a small "director" plays them
// one after another with a short pause each. It never invents a step.
import Combine
import Foundation

/// One web page of a search lane.
public struct PlanPageState: Equatable, Sendable, Identifiable {
    public enum State: String, Sendable { case reading, read, failed }

    public var url: String
    public var host: String
    public var title: String
    public var state: State
    /// Offers found on the page.
    public var offers: Int
    /// How old the copy of the page was, when it was not read this second.
    public var ageMs: Double?
    /// `context.dev` or `exa`, once the page has been read.
    public var reader: String?

    public var id: String { url }
}

/// One bill being searched: the query, the pages found and read, and what came of it.
public struct PlanLane: Equatable, Sendable, Identifiable {
    public struct Result: Equatable, Sendable {
        public var best: Offer?
        public var yearlySavingEur: Double?
        /// Set when nothing is cheaper.
        public var note: String?
        public var offersFound: Int
    }

    public var billType: BillType
    public var query: String
    public var pages: [PlanPageState]
    public var result: Result?

    public var id: String { billType.rawValue }
}

/// A rule or price outside the account that Exa is researching. `check` is nil while it runs.
public struct PlanCheckLane: Equatable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var query: String
    public var check: PlanCheck?
}

/// Everything added up: the working, and the total together with its split.
public struct PlanCalc: Equatable, Sendable {
    public var steps: [CalcStep]
    public var totals: PlanTotals
}

public struct PlanSummary: Equatable, Sendable {
    public var text: String
    /// `nemotron` or `code`.
    public var by: String
}

/// What the plan screen shows, built from the events played so far.
public struct PlanView: Equatable, Sendable {
    public enum Phase: String, Sendable { case idle, running, done, error }
    /// The three acts of the stage: the account (`scan`), the web (`web`) and the sums (`sums`).
    public enum Act: String, Sendable { case idle, scan, web, sums }
    public enum Approval: String, Sendable { case none, sending, done, declined }

    public var phase: Phase = .idle
    public var act: Act = .idle
    public var customerName: String?
    public var model: String?
    /// True when the server says the plan is example data: show "Mock data".
    public var mock = false
    public var scan: PlanScan?
    /// Habits and notices, in the order found (bills are not listed: a search follows for them).
    public var findings: [PlanFinding] = []
    /// The offers being found and read, one lane per bill.
    public var lanes: [PlanLane] = []
    public var checks: [PlanCheckLane] = []
    /// The totals, always with their split. Nil until the sums act.
    public var calc: PlanCalc?
    public var actions: [AgentAction] = []
    public var projection: PlanProjection?
    public var summary: PlanSummary?
    public var plan: MoneyPlan?
    /// A sentence to show when the plan failed.
    public var error: String?
    public var approval: Approval = .none
    /// A sentence to show when approving failed, wholly or in part.
    public var approvalError: String?
    /// What Sisu is doing right now: drive the mascot from this.
    public var activity: SisuActivity = .idle

    public init() {}

    public static let empty = PlanView()

    /// The actions still waiting for approval: what "Approve all" would approve.
    public var waitingActions: [AgentAction] { actions.filter { $0.status == .awaitingApproval } }

    /// A change to the view: an event from the server, or something the customer did.
    public enum Change: Equatable, Sendable {
        case event(PlanEvent)
        case reset
        case approving
        case approved(actions: [AgentAction], error: String?)
        case declined
    }

    /// The view after a change. Pure: the same reducer as the web hook.
    public func applying(_ change: Change) -> PlanView {
        var next = stepped(change)
        switch change {
        case .reset: next.activity = SisuActivity(.thinking, label: "Opening your account")
        case .approving: break
        case .approved(let actions, let error):
            if !actions.isEmpty {
                // A whole plan approved is `proud`; a part of it is `cheering` (the backend's handoff table).
                let whole = error == nil && next.waitingActions.isEmpty
                next.activity = SisuActivity(.approved, label: "\(actions.count) approved, as a simulation").posed(whole ? .proud : .cheering)
            }
        case .declined: next.activity = SisuActivity(.declined)
        case .event(let event): next.activity = Activity.nextPlanActivity(activity, event)
        }
        return next
    }

    private func withLane(_ billType: BillType, _ change: (inout PlanLane) -> Void) -> [PlanLane] {
        lanes.map { lane in
            guard lane.billType == billType else { return lane }
            var copy = lane
            change(&copy)
            return copy
        }
    }

    private func stepped(_ change: Change) -> PlanView {
        var view = self
        switch change {
        case .reset:
            view = PlanView()
            view.phase = .running
        case .approving:
            view.approval = .sending
            view.approvalError = nil
        case .approved(let done, let error):
            view.approval = done.isEmpty ? .none : .done
            view.approvalError = error
            view.actions = actions.map { action in done.first { $0.id == action.id } ?? action }
        case .declined:
            view.approval = .declined
        case .event(let event):
            switch event {
            case .planStart(_, let customerName, _, let model, let mock):
                view.customerName = customerName; view.model = model; view.mock = mock
            case .scan(let scan):
                view.act = .scan; view.scan = scan
            case .finding(let finding):
                if finding.role != "bill" { view.findings.append(finding) }
            case .searchStart(let billType, let query, _):
                view.act = .web
                view.lanes.append(PlanLane(billType: billType, query: query, pages: [], result: nil))
            case .searchPages(let billType, let pages):
                view.lanes = withLane(billType) { lane in
                    lane.pages = pages.map { PlanPageState(url: $0.url, host: $0.host, title: $0.title, state: .reading, offers: 0, ageMs: nil, reader: nil) }
                }
            case .pageRead(let read):
                view.lanes = withLane(read.billType) { lane in
                    lane.pages = lane.pages.map { page in
                        guard page.url == read.url else { return page }
                        var copy = page
                        copy.state = read.ok ? .read : .failed
                        copy.offers = read.offers.isFinite ? Int(min(max(read.offers, 0), 10_000)) : 0
                        copy.ageMs = read.ageMs
                        copy.reader = read.reader
                        return copy
                    }
                }
            case .offers(let offers):
                view.lanes = withLane(offers.billType) { lane in
                    lane.result = PlanLane.Result(best: offers.best, yearlySavingEur: offers.yearlySavingEur, note: offers.note,
                                                  offersFound: offers.offersFound.isFinite ? Int(min(max(offers.offersFound, 0), 10_000)) : 0)
                }
            case .checkStart(let id, let title, let query):
                view.act = .web
                view.checks.append(PlanCheckLane(id: id, title: title, query: query, check: nil))
            case .checkDone(let check):
                view.checks = checks.map { lane in
                    guard lane.id == check.id else { return lane }
                    var copy = lane
                    copy.check = check
                    return copy
                }
            case .calc(let steps, let totals):
                view.act = .sums
                view.calc = PlanCalc(steps: steps, totals: totals)
            case .action(let action):
                view.actions.append(action)
            case .projection(let projection):
                view.projection = projection
            case .summary(let text, let by):
                view.summary = PlanSummary(text: text, by: by)
            case .planDone(let plan):
                view.phase = .done; view.plan = plan; view.actions = plan.actions
            case .error(let message):
                view.phase = .error
                view.error = message.isEmpty ? PlanSession.couldNotStart : message
            case .unknown:
                break
            }
        }
        return view
    }
}

/// Runs the money plan for one customer and turns its real events into `view`. Screens observe it.
///
/// Main-actor, like `CoachSession`. Events can arrive in a burst, so they are played one after another with a
/// short pause each (`dwell`), fast enough to feel quick and slow enough to follow; when events pile up the
/// pauses shrink. The pause is injected: tests pass one that returns at once. Errors become a sentence in
/// `view.error` or `view.approvalError`; nothing here throws.
@MainActor
public final class PlanSession: ObservableObject {
    nonisolated public static let couldNotStart = "Sisu could not start. Try again in a moment."
    nonisolated public static let connectionDropped = "The connection to Sisu dropped. Try again."
    nonisolated public static let approvalNotSent = "The approval did not reach Sisu. Nothing was done."

    public let customerId: String
    public let client: CoachClient

    /// Everything the plan screen shows.
    @Published public private(set) var view = PlanView()

    private let pause: @Sendable (TimeInterval) async -> Void
    private var queue: [PlanEvent] = []
    private var player: Task<Void, Never>?
    private var reader: Task<Void, Never>?
    private var run = 0

    /// - Parameter pause: waits the given number of seconds between two played events. The default sleeps;
    ///   tests inject `{ _ in }`.
    public init(customerId: String, client: CoachClient,
                pause: @escaping @Sendable (TimeInterval) async -> Void = { seconds in try? await Task.sleep(nanoseconds: UInt64(max(seconds, 0) * 1_000_000_000)) }) {
        self.customerId = customerId
        self.client = client
        self.pause = pause
    }

    /// A plan against a real server.
    public static func live(customerId: String, baseURL: URL, session: URLSession = .shared) -> PlanSession {
        PlanSession(customerId: customerId, client: .live(baseURL: baseURL, session: session))
    }

    /// A plan from the recordings bundled with the package: no server, label it "Sample data".
    public static func sample(customerId: String) -> PlanSession {
        PlanSession(customerId: customerId, client: .sample(eventDelay: 0))
    }

    /// `.sample` for the bundled recordings, `.mock` when the server said `mock: true`, otherwise `.live`.
    public var dataLabel: CoachDataLabel {
        if client.kind == .bundledSample { return .sample }
        return view.mock ? .mock : .live
    }

    /// Set once, at the moment a live plan could not reach the server and was answered from the bundled sample
    /// instead (only with `CoachClient.liveWithSampleFallback`). Show it where it happens.
    @Published public private(set) var fallbackNotice: String?

    /// Call when the notice has been shown.
    public func dismissFallbackNotice() { fallbackNotice = nil }

    private func noteFallback() {
        if fallbackNotice == nil, let notice = client.fallbackNotice, !announcedFallback {
            announcedFallback = true
            fallbackNotice = notice
        }
    }

    private var announcedFallback = false

    /// Seconds each kind of event stays on screen before the next one plays, as on the web.
    public static func dwell(for event: PlanEvent) -> TimeInterval {
        switch event {
        case .scan: return 1.5
        case .finding(let finding): return finding.role == "bill" ? 0 : 0.32
        case .searchStart, .checkStart: return 0.26
        case .checkDone, .offers: return 0.42
        case .searchPages: return 0.32
        case .pageRead: return 0.24
        case .calc: return 2.7
        case .planStart, .action, .projection, .summary, .planDone, .error, .unknown: return 0
        }
    }

    /// The pause after an event when `queued` more are waiting: full length up to three, 0.7 of it up to eight,
    /// 0.45 beyond. The total (`calc`) always gets its full time: it is the moment the run builds to.
    public static func pause(after event: PlanEvent, queued: Int) -> TimeInterval {
        if case .calc = event { return dwell(for: event) }
        let speed = queued > 8 ? 0.45 : queued > 3 ? 0.7 : 1
        return dwell(for: event) * speed
    }

    /// Starts the plan (and stops one that is running). Returns at once; `view` then fills in. The returned
    /// task ends when the last event has been played.
    /// - Parameter fresh: false reuses a recent search instead of searching now.
    @discardableResult
    public func start(language: String? = nil, fresh: Bool? = nil) -> Task<Void, Never> {
        stop()
        run += 1
        let runId = run
        view = view.applying(.reset)
        let stream = client.plan(customerId: customerId, fresh: fresh, language: language)
        let task = Task { [weak self] in
            do {
                for try await event in stream {
                    guard let self, self.run == runId, !Task.isCancelled else { return }
                    self.queue.append(event)
                    self.play(runId)
                }
            } catch {
                guard let self, self.run == runId, !Task.isCancelled else { return }
                let sentence: String
                if case SisuError.server(_, let message) = error { sentence = message.isEmpty ? Self.couldNotStart : message }
                else { sentence = Self.connectionDropped }
                self.queue.append(.error(message: sentence))
                self.play(runId)
            }
            await self?.player?.value
            // A stream that ended without `plan_done` or `error` was cut off: say so instead of running forever.
            if let self, self.run == runId, self.view.phase == .running {
                self.view = self.view.applying(.event(.error(message: Self.connectionDropped)))
            }
        }
        reader = task
        return task
    }

    private func play(_ runId: Int) {
        guard player == nil else { return }
        player = Task { [weak self] in
            while let self, self.run == runId, !self.queue.isEmpty, !Task.isCancelled {
                let event = self.queue.removeFirst()
                self.view = self.view.applying(.event(event))
                self.noteFallback()
                let wait = Self.pause(after: event, queued: self.queue.count)
                if wait > 0 { await self.pause(wait) }
            }
            if let self, self.run == runId { self.player = nil }
        }
    }

    private func stop() {
        run += 1
        reader?.cancel()
        player?.cancel()
        reader = nil
        player = nil
        queue = []
    }

    /// Stops a running plan. What has been shown stays on screen.
    public func cancel() {
        stop()
        if view.phase == .running {
            view.phase = .idle
            view.activity = .idle
        }
    }

    /// Stops and clears everything.
    public func reset() {
        stop()
        view = PlanView()
    }

    /// One tap approves everything the plan set up and is still waiting. Each action is approved, simulated
    /// and logged on its own. Returns the approved actions; what could not be approved is a sentence in
    /// `view.approvalError`.
    @discardableResult
    public func approveAll() async -> [AgentAction] {
        let ids = view.waitingActions.map(\.id)
        guard !ids.isEmpty else { return [] }
        view = view.applying(.approving)
        do {
            let result = try await client.approveAll(customerId: customerId, actionIds: Array(ids.prefix(6)))
            let failed = result.failed.first.map { "\(result.failed.count) could not be approved: \($0.reason)" }
            view = view.applying(.approved(actions: result.approved, error: failed))
            return result.approved
        } catch {
            let sentence: String
            if case SisuError.server(_, let message) = error, !message.isEmpty { sentence = message } else { sentence = Self.approvalNotSent }
            view = view.applying(.approved(actions: [], error: sentence))
            return []
        }
    }

    /// The customer said "not now": nothing is sent, the actions simply stay waiting until they expire.
    public func decline() {
        view = view.applying(.declined)
    }
}
