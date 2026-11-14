// What a RiveComponentView asks for: which component, and the two things a screen may override.
import SisuCore

/// What a `RiveComponentView` asks its model to load.
struct RiveComponentRequest: Equatable {
    var component: RiveComponent
    /// Out triggers to listen to on top of the component's own.
    var extraOutTriggers: [String] = []
    /// Replaces the component's own sizing when set.
    var sizing: RiveSizing?

    func sizing(for shown: RiveComponent) -> RiveSizing {
        sizing ?? shown.contract.sizing
    }
}
