// Launch arguments the app understands. Pass them in the scheme, or from the screenshot harness.
//
//   -sisu.sample 1            bundled sample data only, no network
//   -sisu.baseURL <url>       the backend address (default http://localhost:3000)
//   -sisu.customer <id>       skip the picker and open this customer (CUST04974, CUST04414, CUST02003)
//   -sisu.tab today|ask|jars|path
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
        if options.screenshots, let store = UserDefaults(suiteName: "fi.sisu.screenshots") {
            store.removePersistentDomain(forName: "fi.sisu.screenshots")
            options.defaults = store
        }
        return options
    }()
}
