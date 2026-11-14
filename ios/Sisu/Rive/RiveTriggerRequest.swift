// How a parent view asks `RiveComponentView` to fire an `in` trigger.
import Foundation

/// The `triggers:` array of `RiveComponentView` is a list of requests.
///
/// A request is the trigger's name, optionally followed by `#` and a stamp: `"reveal"`, `"reveal#2"`.
/// The stamp is any text; it is never sent to Rive. It only makes a request different from the one before.
///
/// Rules:
/// 1. The array a view starts with fires nothing. It is the baseline, so a view that SwiftUI rebuilds
///    (a lazy stack, a tab switch) never repeats an old trigger.
/// 2. Each time the array changes, every request that was not in the previous array fires once.
/// 3. To fire the same trigger again, change its stamp. A counter is enough:
///
///        @State private var celebrations = 0
///        RiveComponentView(.jar, values: jar, triggers: ["celebrate#\(celebrations)"])
///        // later: celebrations += 1   → fires `celebrate` once
///
/// A request made while the artboard is still loading is kept and fired when it is ready.
enum RiveTriggerRequest {
    /// The trigger name of a request: the text before the first `#`.
    static func name(of request: String) -> String {
        guard let hash = request.firstIndex(of: "#") else { return request }
        return String(request[..<hash])
    }

    /// The trigger names to fire when the array changes from `old` to `new`, in the order of `new`.
    static func namesToFire(old: [String], new: [String]) -> [String] {
        let seen = Set(old)
        return new.filter { !seen.contains($0) }.map(name(of:)).filter { !$0.isEmpty }
    }
}
