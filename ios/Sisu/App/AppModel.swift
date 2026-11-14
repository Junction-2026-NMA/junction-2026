// The one model for the whole app: where the data comes from, which customer is shown, the loaded overview,
// today's progress and the settings. Views read it and call its methods; they hold no logic of their own.
//
// HOOKS AND SEAMS for the coach screens (Ask), the teaching path (Path) and anything else that comes next.
// All of them live here, on AppModel:
//
//   billConfirmed(bill:name:)   The user confirmed or corrected the flagged bill's name on Today. For now it
//                               stores the name locally (UserDefaults, per customer and bill id) and completes
//                               the "confirm the bill" daily action. Read the name back with confirmedName(for:).
//   startInvestigation()        "Look into my finances" on Today, or the third daily action. Switches to the
//                               Ask tab, completes the "let Sisu look into it" action and bumps
//                               `investigationRequests`, which AskScreen can watch with .onChange to start a run.
//   resetDemo()                 "Start the demo over" in settings: clears progress, confirmed names and the
//                               approved saving, and starts the first-run onboarding again from its first screen.
//   onboarding                  The first-run flow (SisuCore's OnboardingFlow), stored in UserDefaults. RootView
//                               shows it while `onboarding.isActive`; onboardingContinue/Back/Skip(),
//                               chooseInOnboarding(_:), finishOnboarding() move it. `firstInsightPending` makes
//                               Today show FirstInsightCallout until dismissFirstInsight().
//   approvedMonthlySaving       Published euros a month the user approved through switches (0 for now). The
//                               Jars tab's "Freed by switches" jar is bound to it. Set it when an approval lands.
//   flaggedBill                 The bill Today flags (SisuCore's TodayPresenter.flaggedBill).
//   coach                       The CoachStore: the CoachSession for the chosen customer (live, or the bundled
//                               sample), its data tag and the voice seam (voiceState, voiceDown(), voiceUp()).
//                               billConfirmed also saves the name on the server and starts offer research;
//                               startInvestigation also starts the session's investigate(); resetDemo also
//                               resets the backend's demo state; approvedMonthlySaving follows the session.
//   coachMoment(_:id:)          Berries for answering a quiz or deciding on an action (once per card/action).
//   berries, berriesText        Daily-action berries plus coach berries: what the berries pill should show.
//   api / isLive                The data source in use. Anything not live must show the "Sample data" tag.
import Foundation
import Observation
import SisuCore

enum AppTab: Int, CaseIterable, Identifiable {
    case today, ask, jars, path
    var id: Int { rawValue }

    init?(argument: String) {
        switch argument.lowercased() {
        case "today": self = .today
        case "ask": self = .ask
        case "jars": self = .jars
        case "path": self = .path
        default: return nil
        }
    }
}

/// Which transactions a sheet shows, and under what title.
struct EvidenceRequest: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let filter: EvidenceFilter?
}

/// The sheets Today can show.
enum TodaySheet: String, Identifiable {
    case maths, settings
    var id: String { rawValue }
}

enum LoadState: Equatable {
    case idle, loading, loaded
    case failed(String)
}

@MainActor
@Observable
final class AppModel {
    static let defaultBaseURL = "http://localhost:3000"

    // MARK: Settings (UserDefaults)

    /// The backend address. Launch argument `-sisu.baseURL <url>`.
    var baseURLString: String { didSet { defaults.set(baseURLString, forKey: Keys.baseURL) } }
    /// Use the bundled sample data only, no network. Launch argument `-sisu.sample 1`.
    var sampleOnly: Bool { didSet { defaults.set(sampleOnly, forKey: Keys.sample) } }

    // MARK: Data

    private(set) var api: any SisuAPI = FixtureAPI()
    /// Whether the backend answered the last time it was asked. Nil when it was not asked (sample only).
    private(set) var backendAnswered: Bool?
    private(set) var customers: [DemoCustomer] = []
    private(set) var customersState: LoadState = .idle
    private(set) var customer: DemoCustomer?
    private(set) var overview: Overview?
    private(set) var overviewState: LoadState = .idle

    var isLive: Bool { api.kind == .live }

    // MARK: Navigation

    var tab: AppTab = .today
    /// The first-run flow. Complete after the first visit; "Start the demo over" restarts it.
    private(set) var onboarding: OnboardingFlow
    var evidence: EvidenceRequest?
    var todaySheet: TodaySheet?

    // MARK: Progress and hooks

    private(set) var progress: DailyProgress
    private(set) var confirmedBillNames: [String: String]
    /// Euros a month freed by switches the user approved. 0 until the coach flow sets it.
    var approvedMonthlySaving: Double = 0
    /// Bumped by `startInvestigation()`. The Ask screen watches it.
    private(set) var investigationRequests = 0
    /// Bumped whenever berries are earned, so a Rive trigger can celebrate.
    private(set) var berryDrops = 0
    /// Set when the last of today's actions is done; MainScreen shows the Rive celebration and clears it.
    var celebration: (headline: String, detail: String)?

    // MARK: Coach

    /// The coach session for the chosen customer and the voice seam.
    let coach = CoachStore()
    /// Berries earned in the coach (quiz answered, action decided).
    private(set) var coachRewards: CoachRewards
    /// Every berry: today's actions plus the coach's.
    var berries: Int { progress.berries + coachRewards.berries }
    var berriesText: String { "\(berries)" }

    let launch: LaunchOptions
    private let defaults: UserDefaults
    private let now: () -> Date
    private let calendar: Calendar

    init(launch: LaunchOptions = .current, now: @escaping () -> Date = Date.init, calendar: Calendar = .current) {
        self.launch = launch
        self.now = now
        self.calendar = calendar
        let defaults = launch.defaults
        self.defaults = defaults
        if launch.onboarding == .reset {
            // As on a clean install: no progress, names, rewards, chosen customer or finished first run.
            for key in [Keys.progress, Keys.billNames, Keys.coachRewards, Keys.customer, Keys.onboarding] {
                defaults.removeObject(forKey: key)
            }
        }
        let storedFlow = defaults.data(forKey: Keys.onboarding).flatMap { try? JSONDecoder().decode(OnboardingFlow.self, from: $0) }
        onboarding = OnboardingFlow.atLaunch(stored: storedFlow, launch: launch.onboarding,
                                             skipsByDefault: launch.skipsOnboardingByDefault)
        baseURLString = launch.baseURL ?? defaults.string(forKey: Keys.baseURL) ?? Self.defaultBaseURL
        sampleOnly = launch.sampleOnly ?? defaults.bool(forKey: Keys.sample)
        progress = (defaults.data(forKey: Keys.progress)).flatMap { try? JSONDecoder().decode(DailyProgress.self, from: $0) } ?? DailyProgress()
        confirmedBillNames = (defaults.dictionary(forKey: Keys.billNames) as? [String: String]) ?? [:]
        coachRewards = (defaults.data(forKey: Keys.coachRewards)).flatMap { try? JSONDecoder().decode(CoachRewards.self, from: $0) } ?? CoachRewards()
        if let tab = launch.tab { self.tab = tab }
        coach.onApprovedSaving = { [weak self] saving in
            guard let self, self.approvedMonthlySaving != saving else { return }
            self.approvedMonthlySaving = saving
        }
    }

    private var today: DayStamp { DayStamp(now(), calendar: calendar) }

    // MARK: Loading

    /// Loads the customers (live, falling back to the bundled sample), then the chosen customer if one is set.
    func start() async {
        await loadCustomers()
        // While the first run is on screen the user chooses the customer in it.
        if !onboarding.isActive, let id = launch.customerId ?? defaults.string(forKey: Keys.customer),
           let match = customers.first(where: { $0.customerId == id }) {
            await choose(match)
        }
    }

    func loadCustomers() async {
        customersState = .loading
        if !sampleOnly, let url = URL(string: baseURLString) {
            let live = LiveAPI(baseURL: url)
            do {
                customers = try await live.demoCustomers()
                api = live
                backendAnswered = true
                customersState = .loaded
                return
            } catch {
                backendAnswered = false
            }
        } else {
            backendAnswered = nil
        }
        api = FixtureAPI()
        do {
            customers = try await api.demoCustomers()
            customersState = .loaded
        } catch {
            customersState = .failed("The demo profiles could not be loaded.")
        }
    }

    func choose(_ customer: DemoCustomer) async {
        self.customer = customer
        defaults.set(customer.customerId, forKey: Keys.customer)
        complete(.checkIn)
        await loadOverview()
        await configureCoach()
    }

    /// Points the coach at the chosen customer and the data source in use (live or the bundled sample).
    func configureCoach() async {
        guard let customer else { return }
        await coach.configure(customerId: customer.customerId, baseURL: isLive ? URL(string: baseURLString) : nil,
                              unreachable: backendAnswered == false)
    }

    func loadOverview() async {
        guard let customer else { return }
        overviewState = .loading
        do {
            overview = try await api.overview(customerId: customer.customerId)
            overviewState = .loaded
        } catch where isLive {
            // The backend went away: fall back to the bundled sample, which is labelled as such.
            backendAnswered = false
            api = FixtureAPI()
            do {
                overview = try await api.overview(customerId: customer.customerId)
                overviewState = .loaded
            } catch {
                overviewState = .failed("Sisu could not load this profile.")
            }
        } catch {
            overviewState = .failed("Sisu could not load this profile.")
        }
    }

    /// Tries again after a failure, from the customers on.
    func retry() async {
        await loadCustomers()
        if customer != nil {
            await loadOverview()
            await configureCoach()
        }
    }

    /// Re-reads the data source after the settings changed.
    func applySettings() async {
        await retry()
    }

    func transactions(_ filter: EvidenceFilter?) async throws -> TransactionList {
        guard let customer else { throw SisuError.invalidState("no customer") }
        guard !isLive, let filter, let overview else {
            return try await api.transactions(customerId: customer.customerId, filter: filter)
        }
        // Sample data: read the basket file that holds these rows, then keep only the rows of this figure.
        let basket = SampleEvidence.basket(for: filter, in: overview)
        let source = try await api.transactions(customerId: customer.customerId,
                                                filter: basket.map { EvidenceFilter(from: filter.from, to: filter.to, basket: $0) })
        return SampleEvidence.narrow(source, to: filter)
    }

    func scenario(_ input: ScenarioInput) async throws -> ScenarioResponse {
        guard let customer else { throw SisuError.invalidState("no customer") }
        return try await api.scenario(customerId: customer.customerId, input: input)
    }

    func switchCustomer() {
        customer = nil
        overview = nil
        overviewState = .idle
        coach.clear()
        defaults.removeObject(forKey: Keys.customer)
        tab = .today
    }

    // MARK: Progress

    func isDone(_ action: DailyAction) -> Bool { progress.done(on: today).contains(action) }
    var todayProgress: Double { progress.progress(on: today) }

    func complete(_ action: DailyAction) {
        let earned = progress.complete(action, on: today)
        if earned > 0 {
            berryDrops += 1
            if let party = progress.celebration(on: today) { celebration = party }
        }
        if let data = try? JSONEncoder().encode(progress) { defaults.set(data, forKey: Keys.progress) }
    }

    // MARK: Hooks (see the list at the top of this file)

    var flaggedBill: RecurringBill? { overview.flatMap(TodayPresenter.flaggedBill(in:)) }

    func confirmedName(for bill: RecurringBill) -> String? {
        guard let customer else { return nil }
        return confirmedBillNames[Self.billKey(customer.customerId, bill.id)]
    }

    func billConfirmed(bill: RecurringBill, name: String) {
        guard let customer else { return }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        confirmedBillNames[Self.billKey(customer.customerId, bill.id)] = trimmed.isEmpty ? bill.guessLabel : trimmed
        defaults.set(confirmedBillNames, forKey: Keys.billNames)
        complete(.confirmBill)
        // Save the name on the server and start offer research early, so offers are ready before the question.
        if let session = coach.session {
            let saved = confirmedBillNames[Self.billKey(customer.customerId, bill.id)] ?? bill.guessLabel
            let type = CoachBillMatch.billType(text: saved) ?? CoachBillMatch.billType(for: bill)
            Task { await session.confirmBill(bill.id, name: saved, billType: type) }
        }
    }

    func startInvestigation() {
        tab = .ask
        investigationRequests += 1
        coach.investigate()
        complete(.investigate)
    }

    /// A coach moment: answering a teaching question or deciding on an action. Earns its berries once.
    func coachMoment(_ moment: CoachRewards.Moment, id: String) {
        guard coachRewards.award(moment, id: id) > 0 else { return }
        berryDrops += 1
        if let data = try? JSONEncoder().encode(coachRewards) { defaults.set(data, forKey: Keys.coachRewards) }
    }

    func resetDemo() {
        // The backend's demo state (actions, memory) and the conversation go too.
        let session = coach.session
        session?.reset()
        let client = session?.client ?? (isLive ? URL(string: baseURLString).map { CoachClient.live(baseURL: $0) } : nil)
        if let client { Task { _ = try? await client.resetDemo() } }
        progress = DailyProgress()
        coachRewards = CoachRewards()
        confirmedBillNames = [:]
        approvedMonthlySaving = 0
        berryDrops = 0
        for key in [Keys.progress, Keys.billNames, Keys.coachRewards] { defaults.removeObject(forKey: key) }
        todaySheet = nil
        switchCustomer()
        onboarding.restart()
        saveOnboarding()
    }

    // MARK: Onboarding

    func onboardingContinue() { onboarding.advance(); saveOnboarding() }
    func onboardingBack() { onboarding.back(); saveOnboarding() }
    func onboardingSkip() { onboarding.skipIntro(); saveOnboarding() }

    /// The profile step's choice: show the reading moment and load the profile's overview.
    func chooseInOnboarding(_ customer: DemoCustomer) {
        onboarding.profileChosen()
        saveOnboarding()
        Task { await choose(customer) }
    }

    /// The profile could not be read: back to the profile step, with no customer chosen.
    func onboardingReadingFailed() {
        onboarding.readingFailed()
        saveOnboarding()
        switchCustomer()
    }

    /// The overview is read and the user goes on: Today, with the first insight highlighted.
    func finishOnboarding() {
        tab = .today
        onboarding.finish()
        saveOnboarding()
    }

    /// The first-insight callout on Today was tapped away.
    func dismissFirstInsight() {
        onboarding.dismissFirstInsight()
        saveOnboarding()
    }

    private func saveOnboarding() {
        if let data = try? JSONEncoder().encode(onboarding) { defaults.set(data, forKey: Keys.onboarding) }
    }

    private static func billKey(_ customerId: String, _ billId: String) -> String { "\(customerId)/\(billId)" }

    private enum Keys {
        static let baseURL = "sisu.baseURL"
        static let sample = "sisu.sample"
        static let customer = "sisu.customer"
        static let progress = "sisu.progress"
        static let billNames = "sisu.billNames"
        static let coachRewards = "sisu.coachRewards"
        /// Not "sisu.onboarding": that name is the launch argument, which would shadow the stored value.
        static let onboarding = "sisu.onboardingFlow"
    }
}
