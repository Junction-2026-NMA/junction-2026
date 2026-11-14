// The Swift side of `rive/contract.json`: which Rive components exist and how view state maps to their
// view model properties. Pure data, so it is testable without the Rive runtime.
import Foundation

/// The Rive file the app ships: every interface component, in 2D.
public enum RiveFile: String, CaseIterable, Sendable {
    /// The 2D interface components. No scripts, loads unsigned.
    case ui = "sisu_ui"
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

/// The stages of live research, in order (the `ResearchStage` enum of `rive/contract.json`).
public enum ResearchStage: String, Codable, CaseIterable, Sendable {
    case searching, reading, comparing, done
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
    case baskets = "Baskets"
    case berries = "Berries"

    /// The file the artboard lives in: always `.ui`.
    public var file: RiveFile { .ui }

    /// The design size in points, exactly as `size` in `rive/contract.json`.
    public var designSize: (width: Double, height: Double) {
        switch self {
        case .button: return (350, 60)
        case .heroNumber: return (350, 200)
        case .basketBar: return (350, 40)
        case .basketChip: return (160, 32)
        case .progressBar: return (350, 14)
        case .statPill: return (96, 36)
        case .tabBar: return (390, 64)
        case .actionRow: return (350, 56)
        case .choiceCard: return (350, 64)
        case .voiceButton: return (96, 96)
        case .stageIndicator: return (350, 72)
        case .liito: return (240, 240)
        case .jar: return (160, 200)
        case .celebration: return (390, 844)
        case .sticker: return (120, 120)
        case .toggle: return (64, 36)
        case .tag: return (200, 28)
        case .baskets: return (350, 220)
        case .berries: return (320, 200)
        }
    }

    /// Exactly as `sizing` in `rive/contract.json`.
    public var sizing: RiveSizing {
        switch self {
        case .button, .heroNumber, .basketBar, .progressBar, .tabBar, .actionRow, .choiceCard, .stageIndicator, .baskets:
            return .flexibleWidth
        case .basketChip, .statPill, .voiceButton, .toggle, .tag:
            return .fixed
        case .liito, .jar, .sticker, .berries:
            return .contain
        case .celebration:
            return .fill
        }
    }

    /// The names of the trigger properties the Rive file fires and the app listens to (direction `out` in
    /// `rive/contract.json`), in contract order. Empty when there are none.
    public var outTriggers: [String] {
        switch self {
        case .button, .actionRow, .choiceCard: return ["pressed"]
        case .tabBar: return ["tap0", "tap1", "tap2", "tap3"]
        case .voiceButton: return ["pressDown", "pressUp"]
        case .celebration: return ["done"]
        case .toggle: return ["toggled"]
        default: return []
        }
    }

    /// The names of the trigger properties the app may fire (direction `in`), in contract order:
    /// `reveal` (HeroNumber), `celebrate` (Jar), `fire` (Celebration), `drop` (Berries).
    public var inTriggers: [String] {
        switch self {
        case .heroNumber: return ["reveal"]
        case .jar: return ["celebrate"]
        case .celebration: return ["fire"]
        case .berries: return ["drop"]
        default: return []
        }
    }
}

/// Builds the property values for a component from view state. Keys are the property names in
/// `rive/contract.json`; every `in` property of the component that is not a trigger gets a value.
/// Numbers outside a property's range are clamped to it, and a number that is not finite counts as 0.
public enum RiveBindings {
    public enum ButtonStyle: String, CaseIterable, Sendable { case primary, secondary, onDark, quiet }
    public enum ChoiceState: String, CaseIterable, Sendable { case idle, selected, correct, wrong }
    public enum VoiceState: String, CaseIterable, Sendable { case idle, recording, thinking, speaking }
    public enum LiitoMood: String, CaseIterable, Sendable { case idle, cheering, proud, gliding, curious, found, focused, cosy, sleepy, thinking }
    public enum StatKind: String, CaseIterable, Sendable { case streak, berries }
    public enum TagTone: String, CaseIterable, Sendable { case neutral, amber, info }
    public enum StickerKind: String, CaseIterable, Sendable { case firstJar, leakPlugged, streak, lesson }

    /// The tab labels of the contract's defaults: Today, Ask, Jars, Path.
    public static let defaultTabLabels = ["Today", "Ask", "Jars", "Path"]

    /// A finite value clamped to `range`; a value that is not finite counts as 0 (then clamped).
    static func clamp(_ value: Double, _ range: ClosedRange<Double> = 0...1) -> Double {
        let finite = value.isFinite ? value : 0
        return min(max(finite, range.lowerBound), range.upperBound)
    }

    /// `label`, `style`, `enabled`, `loading`.
    public static func button(label: String, style: ButtonStyle = .primary, enabled: Bool = true, loading: Bool = false) -> [String: RiveValue] {
        ["label": .string(label), "style": .enumCase(style.rawValue), "enabled": .bool(enabled), "loading": .bool(loading)]
    }

    /// `eyebrow`, `amount`, `unit`, `context`.
    public static func heroNumber(_ state: HeroViewState) -> [String: RiveValue] {
        ["eyebrow": .string(state.eyebrow), "amount": .string(state.amount), "unit": .string(state.unit), "context": .string(state.context)]
    }

    /// `fixed`, `curveballs`, `leaks`, `jars` as numbers 0...1. For `BasketBar` and `Baskets`.
    public static func basketBar(_ shares: BasketShares) -> [String: RiveValue] {
        ["fixed": .number(clamp(shares.fixed)), "curveballs": .number(clamp(shares.curveballs)),
         "leaks": .number(clamp(shares.leaks)), "jars": .number(clamp(shares.jars))]
    }

    /// `basket` (the kind's raw value as an enum case) and `label`.
    public static func basketChip(_ kind: BasketKind, language: SisuLanguage) -> [String: RiveValue] {
        ["basket": .enumCase(kind.rawValue), "label": .string(kind.label(language))]
    }

    /// `progress` clamped to 0...1 (a non-finite value counts as 0) and `tone` (`green` or `streak`).
    public static func progressBar(progress: Double, streak: Bool = false) -> [String: RiveValue] {
        ["progress": .number(clamp(progress)), "tone": .enumCase(streak ? "streak" : "green")]
    }

    /// The label the stage indicator shows.
    /// English: `Searching for current offers`, `Reading the pages`, `Comparing with your bill`, `Done`.
    public static func stageLabel(_ stage: ResearchStage, language: SisuLanguage) -> String {
        switch (stage, language) {
        case (.searching, .en): return "Searching for current offers"
        case (.reading, .en): return "Reading the pages"
        case (.comparing, .en): return "Comparing with your bill"
        case (.done, .en): return "Done"
        case (.searching, .fi): return "Etsitään tämänhetkisiä tarjouksia"
        case (.reading, .fi): return "Luetaan sivuja"
        case (.comparing, .fi): return "Verrataan laskuusi"
        case (.done, .fi): return "Valmis"
        }
    }

    /// `stage` (the stage's raw value as an enum case) and `label`.
    /// English labels: `Searching for current offers`, `Reading the pages`, `Comparing with your bill`, `Done`.
    /// Finnish labels: `Etsitään tämänhetkisiä tarjouksia`, `Luetaan sivuja`, `Verrataan laskuusi`, `Valmis`.
    public static func stageIndicator(_ stage: ResearchStage, language: SisuLanguage) -> [String: RiveValue] {
        ["stage": .enumCase(stage.rawValue), "label": .string(stageLabel(stage, language: language))]
    }

    /// `fill` clamped to 0...1, `label`, and `full` (true when `fill` is 1 or more). For `Jar`.
    /// A fill that is not finite counts as 0, so `full` is false for it.
    public static func jar(fill: Double, label: String) -> [String: RiveValue] {
        let finite = fill.isFinite ? fill : 0
        return ["fill": .number(clamp(finite)), "label": .string(label), "full": .bool(finite >= 1)]
    }

    /// `selected` (the tab index clamped to 0...3) and `label0`…`label3`. A missing label falls back to the
    /// contract's default (Today, Ask, Jars, Path).
    public static func tabBar(selected: Int, labels: [String] = defaultTabLabels) -> [String: RiveValue] {
        var values: [String: RiveValue] = ["selected": .number(Double(min(max(selected, 0), 3)))]
        for index in 0..<4 {
            values["label\(index)"] = .string(index < labels.count ? labels[index] : defaultTabLabels[index])
        }
        return values
    }

    /// `title`, `reward`, `done`.
    public static func actionRow(title: String, reward: String = "", done: Bool = false) -> [String: RiveValue] {
        ["title": .string(title), "reward": .string(reward), "done": .bool(done)]
    }

    /// `label` and `state`.
    public static func choiceCard(label: String, state: ChoiceState = .idle) -> [String: RiveValue] {
        ["label": .string(label), "state": .enumCase(state.rawValue)]
    }

    /// `state`.
    public static func voiceButton(state: VoiceState) -> [String: RiveValue] {
        ["state": .enumCase(state.rawValue)]
    }

    /// `mood`. For `Liito`.
    public static func liito(mood: LiitoMood) -> [String: RiveValue] {
        ["mood": .enumCase(mood.rawValue)]
    }

    /// `kind` and `value` (the text in the pill, for example `12`).
    public static func statPill(kind: StatKind, value: String) -> [String: RiveValue] {
        ["kind": .enumCase(kind.rawValue), "value": .string(value)]
    }

    /// `text` and `tone`.
    public static func tag(text: String, tone: TagTone = .neutral) -> [String: RiveValue] {
        ["text": .string(text), "tone": .enumCase(tone.rawValue)]
    }

    /// `on`.
    public static func toggle(on: Bool) -> [String: RiveValue] {
        ["on": .bool(on)]
    }

    /// `kind` and `label`.
    public static func sticker(kind: StickerKind, label: String) -> [String: RiveValue] {
        ["kind": .enumCase(kind.rawValue), "label": .string(label)]
    }

    /// `headline` and `detail`.
    public static func celebration(headline: String, detail: String) -> [String: RiveValue] {
        ["headline": .string(headline), "detail": .string(detail)]
    }

    /// `fixed`, `curveballs`, `leaks`, `jars` for the `Baskets` illustration (the same set as `basketBar`).
    public static func baskets(_ shares: BasketShares) -> [String: RiveValue] { basketBar(shares) }

    /// The same as `voiceButton(state:)`.
    public static func voiceButton(_ state: VoiceState) -> [String: RiveValue] { voiceButton(state: state) }

    /// The same as `liito(mood:)`.
    public static func liito(_ mood: LiitoMood) -> [String: RiveValue] { liito(mood: mood) }

    /// The same as `tag(text:tone:)`.
    public static func tag(_ text: String, tone: TagTone) -> [String: RiveValue] { tag(text: text, tone: tone) }

    /// `count` for `Berries`, clamped to 0...60.
    public static func berries(count: Int) -> [String: RiveValue] {
        ["count": .number(Double(min(max(count, 0), 60)))]
    }

    /// `count` for `Berries`, clamped to 0...60 (a value that is not finite counts as 0).
    public static func berries(count: Double) -> [String: RiveValue] {
        ["count": .number(clamp(count, 0...60))]
    }
}
