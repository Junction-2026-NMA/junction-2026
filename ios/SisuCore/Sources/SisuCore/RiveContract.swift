// The Swift side of `rive/contract.json`: which Rive components exist and how view state maps to their
// view model properties. Pure data, so it is testable without the Rive runtime.
import Foundation

/// The two Rive files the app ships.
public enum RiveFile: String, CaseIterable, Sendable {
    /// 2D interface components. No scripts, loads unsigned.
    case ui = "sisu_ui"
    /// Scripted 3D scenes. Needs a signed build; the app must work without it.
    case threeD = "sisu_3d"
}

/// A value written to a view model property.
public enum RiveValue: Equatable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    /// The name of an enum case, exactly as in `rive/contract.json`.
    case enumCase(String)
}

/// How a component is sized by its SwiftUI parent.
public enum RiveSizing: String, Sendable {
    /// Use the design size as is.
    case fixed
    /// Fill the available width, keep the design height.
    case flexibleWidth
    /// Scale to fit inside the frame, keeping the aspect ratio.
    case contain
    /// Fill the whole frame.
    case fill
}

/// Every artboard in `rive/contract.json`. The raw value is the artboard name.
public enum RiveComponent: String, CaseIterable, Sendable {
    case button = "Button"
    case heroNumber = "HeroNumber"
    case basketBar = "BasketBar"
    case basketChip = "BasketChip"
    case progressBar = "ProgressBar"
    case statPill = "StatPill"
    case tabBar = "TabBar"
    case actionRow = "ActionRow"
    case choiceCard = "ChoiceCard"
    case voiceButton = "VoiceButton"
    case stageIndicator = "StageIndicator"
    case liito = "Liito"
    case jar = "Jar"
    case celebration = "Celebration"
    case sticker = "Sticker"
    case toggle = "Toggle"
    case tag = "Tag"
    case jar3D = "Jar3D"
    case liito3D = "Liito3D"
    case baskets3D = "Baskets3D"
    case berries3D = "Berries3D"

    /// The file the artboard lives in. The four `…3D` components are in `.threeD`, all others in `.ui`.
    public var file: RiveFile {
        .ui // scaffold stub
    }

    /// The 2D component shown when the 3D file cannot be loaded: Jar3D → Jar, Liito3D → Liito,
    /// Baskets3D → BasketBar, Berries3D → StatPill. Nil for 2D components.
    public var fallback: RiveComponent? {
        nil // scaffold stub
    }

    /// The design size in points, exactly as `size` in `rive/contract.json`.
    public var designSize: (width: Double, height: Double) {
        (0, 0) // scaffold stub
    }

    /// Exactly as `sizing` in `rive/contract.json`.
    public var sizing: RiveSizing {
        .fixed // scaffold stub
    }

    /// The names of the trigger properties the Rive file fires and the app listens to (direction `out` in
    /// `rive/contract.json`), in contract order. Empty when there are none.
    public var outTriggers: [String] {
        [] // scaffold stub
    }
}

/// Builds the property values for a component from view state. Keys are the property names in
/// `rive/contract.json`; every `in` property of the component that is not a trigger gets a value.
public enum RiveBindings {
    public enum ButtonStyle: String, CaseIterable, Sendable { case primary, secondary, onDark, quiet }

    /// `label`, `style`, `enabled`, `loading`.
    public static func button(label: String, style: ButtonStyle = .primary, enabled: Bool = true, loading: Bool = false) -> [String: RiveValue] {
        [:] // scaffold stub
    }

    /// `eyebrow`, `amount`, `unit`, `context`.
    public static func heroNumber(_ state: HeroViewState) -> [String: RiveValue] {
        [:] // scaffold stub
    }

    /// `fixed`, `curveballs`, `leaks`, `jars` as numbers 0...1. Works for both `BasketBar` and `Baskets3D`.
    public static func basketBar(_ shares: BasketShares) -> [String: RiveValue] {
        [:] // scaffold stub
    }

    /// `basket` (the kind's raw value as an enum case) and `label`.
    public static func basketChip(_ kind: BasketKind, language: SisuLanguage) -> [String: RiveValue] {
        [:] // scaffold stub
    }

    /// `progress` clamped to 0...1 (a non-finite value counts as 0) and `tone` (`green` or `streak`).
    public static func progressBar(progress: Double, streak: Bool = false) -> [String: RiveValue] {
        [:] // scaffold stub
    }

    /// `stage` (the stage's raw value as an enum case) and `label`.
    /// English labels: `Searching for current offers`, `Reading the pages`, `Comparing with your bill`, `Done`.
    /// Finnish labels: `Etsitään tämänhetkisiä tarjouksia`, `Luetaan sivuja`, `Verrataan laskuusi`, `Valmis`.
    public static func stageIndicator(_ stage: ResearchStage, language: SisuLanguage) -> [String: RiveValue] {
        [:] // scaffold stub
    }

    /// `fill` clamped to 0...1, `label`, and `full` (true when `fill` is 1 or more). Works for `Jar`; `Jar3D`
    /// ignores the extra `label` key.
    public static func jar(fill: Double, label: String) -> [String: RiveValue] {
        [:] // scaffold stub
    }
}
