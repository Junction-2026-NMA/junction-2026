// TEMPORARY until SisuCore's stubs are implemented.
//
// `RiveComponent.file`, `.fallback`, `.designSize`, `.sizing` and `.outTriggers` are still scaffold stubs in
// SisuCore. This table holds the same facts, copied from rive/contract.json, and is used only while SisuCore
// answers with the stub placeholder (a design size of 0 × 0).
//
// To delete this shim once SisuCore is implemented: remove `RiveContractTable` and make
// `RiveComponent.contract` return `fromSisuCore` unconditionally (or inline it at the call sites).
// `RiveContractTests.testContractTableMatchesContract` checks every row against rive/contract.json.
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
    /// The contract of this component: from SisuCore when it is implemented, from the temporary table until then.
    var contract: RiveComponentContract {
        let core = fromSisuCore
        let isStub = core.designSize.width <= 0 || core.designSize.height <= 0
        return isStub ? (RiveContractTable.rows[self] ?? core) : core
    }

    private var fromSisuCore: RiveComponentContract {
        RiveComponentContract(
            file: file,
            fallback: fallback,
            designSize: CGSize(width: designSize.width, height: designSize.height),
            sizing: sizing,
            outTriggers: outTriggers
        )
    }
}

enum RiveContractTable {
    static let rows: [RiveComponent: RiveComponentContract] = [
        .button: ui(350, 60, .flexibleWidth, out: ["pressed"]),
        .heroNumber: ui(350, 200, .flexibleWidth),
        .basketBar: ui(350, 40, .flexibleWidth),
        .basketChip: ui(160, 32, .fixed),
        .progressBar: ui(350, 14, .flexibleWidth),
        .statPill: ui(96, 36, .fixed),
        .tabBar: ui(390, 64, .flexibleWidth, out: ["tap0", "tap1", "tap2", "tap3"]),
        .actionRow: ui(350, 56, .flexibleWidth, out: ["pressed"]),
        .choiceCard: ui(350, 64, .flexibleWidth, out: ["pressed"]),
        .voiceButton: ui(96, 96, .fixed, out: ["pressDown", "pressUp"]),
        .stageIndicator: ui(350, 72, .flexibleWidth),
        .liito: ui(240, 240, .contain),
        .jar: ui(160, 200, .contain),
        .celebration: ui(390, 844, .fill, out: ["done"]),
        .sticker: ui(120, 120, .contain),
        .toggle: ui(64, 36, .fixed, out: ["toggled"]),
        .tag: ui(200, 28, .fixed),
        .jar3D: threeD(320, 360, fallback: .jar),
        .liito3D: threeD(320, 320, fallback: .liito),
        .baskets3D: threeD(350, 260, fallback: .basketBar),
        .berries3D: threeD(320, 240, fallback: .statPill),
    ]

    private static func ui(_ width: CGFloat, _ height: CGFloat, _ sizing: RiveSizing, out: [String] = []) -> RiveComponentContract {
        RiveComponentContract(file: .ui, fallback: nil, designSize: CGSize(width: width, height: height), sizing: sizing, outTriggers: out)
    }

    private static func threeD(_ width: CGFloat, _ height: CGFloat, fallback: RiveComponent) -> RiveComponentContract {
        RiveComponentContract(file: .threeD, fallback: fallback, designSize: CGSize(width: width, height: height), sizing: .contain, outTriggers: [])
    }
}
