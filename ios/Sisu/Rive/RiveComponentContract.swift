// What the Rive layer needs to know about one component, read from SisuCore's `RiveComponent`
// (which mirrors rive/contract.json; RiveContractTests checks it against the file).
import CoreGraphics
import SisuCore

/// What the app needs to know about one Rive component.
struct RiveComponentContract: Equatable {
    var file: SisuCore.RiveFile
    var fallback: RiveComponent?
    var designSize: CGSize
    var sizing: RiveSizing
    var outTriggers: [String]
}

extension RiveComponent {
    /// The contract of this component, from SisuCore.
    var contract: RiveComponentContract {
        RiveComponentContract(
            file: file,
            fallback: fallback,
            designSize: CGSize(width: designSize.width, height: designSize.height),
            sizing: sizing,
            outTriggers: outTriggers
        )
    }
}
