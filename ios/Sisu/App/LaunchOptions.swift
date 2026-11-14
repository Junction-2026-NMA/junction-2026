// Launch arguments the app understands. Pass them in the scheme, or from the screenshot harness.
//
//   -sisu.sample 1            bundled sample data only, no network
//   -sisu.baseURL <url>       the backend address (default https://sisu-api.vercel.app, the hosted backend;
//                             http://localhost:3000 for `npm run dev` on this Mac)
//   -sisu.customer <id>       skip the picker and open this customer (CUST04974, CUST04414, CUST02003)
//   -sisu.tab today|ask|jars|path
//   -sisu.onboarding reset|done   reset: the first-run flow from its first screen, as on a clean install
//                             (progress, names and the chosen customer are cleared); done: skip it. Without it,
//                             -sisu.customer or -sisu.screenshots 1 count as done, so those launches land on
//                             their screens; otherwise the stored completion decides.
//   -sisu.motionScale <n>     slows the first-run transitions n times (the motion-frames test uses it)
//   -sisu.motionDelay <s>     applies each first-run tap s seconds later, because XCUITest waits for every
//                             animation to end before a tap returns (the motion-frames test uses it)
//
// For screenshots only:
//   -sisu.screenshots 1       a fresh, throwaway settings store, so every run starts at day 1 with 0 berries
//   -sisu.scroll baskets|bill|insights|end|futures   scroll Today or Jars to that section
//   -sisu.sheet maths|transactions|settings          open that sheet on Today
//   -sisu.answer nothing|save|invest                 answer the Jars question
import Foundation
import SisuCore

struct LaunchOptions {
    var sampleOnly: Bool?
    var baseURL: String?
    var customerId: String?
    var tab: AppTab?
    var screenshots = false
    var scroll: String?
    var sheet: String?
    var answer: BranchId?
    var onboarding: OnboardingLaunch?
    /// How many times slower the first-run transitions play. 1 normally.
    var motionScale: Double = 1
    /// Seconds between a first-run tap and its transition. 0 normally.
    var motionDelay: Double = 0
    var defaults: UserDefaults = .standard

    static let current: LaunchOptions = {
        let args = UserDefaults.standard
        var options = LaunchOptions()
        if args.object(forKey: "sisu.sample") != nil, ProcessInfo.processInfo.arguments.contains("-sisu.sample") {
            options.sampleOnly = args.bool(forKey: "sisu.sample")
        }
        let arguments = ProcessInfo.processInfo.arguments
        func value(_ name: String) -> String? {
            guard let index = arguments.firstIndex(of: "-\(name)"), index + 1 < arguments.count else { return nil }
            return arguments[index + 1]
        }
        options.baseURL = value("sisu.baseURL")
        options.customerId = value("sisu.customer")
        options.tab = value("sisu.tab").flatMap(AppTab.init(argument:))
        options.screenshots = value("sisu.screenshots") == "1"
        options.scroll = value("sisu.scroll")
        options.sheet = value("sisu.sheet")
        options.answer = value("sisu.answer").flatMap(BranchId.init(rawValue:))
        options.onboarding = OnboardingLaunch(argument: value("sisu.onboarding"))
        if let delay = value("sisu.motionDelay").flatMap(Double.init), delay > 0 { options.motionDelay = min(delay, 5) }
        if let scale = value("sisu.motionScale").flatMap(Double.init), scale > 0 { options.motionScale = min(scale, 10) }
        if options.screenshots, let store = UserDefaults(suiteName: "fi.sisu.screenshots") {
            store.removePersistentDomain(forName: "fi.sisu.screenshots")
            options.defaults = store
        }
        return options
    }()

    /// Launches that open a screen directly (a customer, or screenshot mode) skip the first run by default.
    var skipsOnboardingByDefault: Bool { customerId != nil || screenshots }
}
