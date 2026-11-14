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
//                               approved saving, and goes back to the customer picker.
//   approvedMonthlySaving       Published euros a month the user approved through switches (0 for now). The
//                               Jars tab's "Freed by switches" jar is bound to it. Set it when an approval lands.
//   flaggedBill                 The bill Today flags (SisuCore's TodayPresenter.flaggedBill).
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
        baseURLString = launch.baseURL ?? defaults.string(forKey: Keys.baseURL) ?? Self.defaultBaseURL
        sampleOnly = launch.sampleOnly ?? defaults.bool(forKey: Keys.sample)
        progress = (defaults.data(forKey: Keys.progress)).flatMap { try? JSONDecoder().decode(DailyProgress.self, from: $0) } ?? DailyProgress()
        confirmedBillNames = (defaults.dictionary(forKey: Keys.billNames) as? [String: String]) ?? [:]
        if let tab = launch.tab { self.tab = tab }
    }

    private var today: DayStamp { DayStamp(now(), calendar: calendar) }

    // MARK: Loading

    /// Loads the customers (live, falling back to the bundled sample), then the chosen customer if one is set.
    func start() async {
        await loadCustomers()
        if let id = launch.customerId ?? defaults.string(forKey: Keys.customer),
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
        if customer != nil { await loadOverview() }
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
    }

    func startInvestigation() {
        tab = .ask
        investigationRequests += 1
        complete(.investigate)
    }

    func resetDemo() {
        progress = DailyProgress()
        confirmedBillNames = [:]
        approvedMonthlySaving = 0
        berryDrops = 0
        for key in [Keys.progress, Keys.billNames] { defaults.removeObject(forKey: key) }
        todaySheet = nil
        switchCustomer()
    }

    private static func billKey(_ customerId: String, _ billId: String) -> String { "\(customerId)/\(billId)" }

    private enum Keys {
        static let baseURL = "sisu.baseURL"
        static let sample = "sisu.sample"
        static let customer = "sisu.customer"
        static let progress = "sisu.progress"
        static let billNames = "sisu.billNames"
    }
}
