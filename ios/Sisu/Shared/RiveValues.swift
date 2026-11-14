// Property sets for the Rive components, keyed by the names in rive/contract.json.
// Where SisuCore's `RiveBindings` has a builder it is used; the others are built here from the contract.
import SisuCore

enum RiveValues {
    static func button(_ label: String, style: RiveBindings.ButtonStyle = .primary, enabled: Bool = true, loading: Bool = false) -> [String: RiveValue] {
        RiveBindings.button(label: label, style: style, enabled: enabled, loading: loading)
    }

    static func hero(_ state: HeroViewState) -> [String: RiveValue] {
        RiveBindings.heroNumber(state)
    }

    static func baskets(_ shares: BasketShares) -> [String: RiveValue] {
        RiveBindings.basketBar(shares)
    }

    static func chip(_ kind: BasketKind) -> [String: RiveValue] {
        RiveBindings.basketChip(kind, language: .en)
    }

    static func progress(_ value: Double, streak: Bool = false) -> [String: RiveValue] {
        RiveBindings.progressBar(progress: value, streak: streak)
    }

    static func jar(fill: Double, label: String) -> [String: RiveValue] {
        RiveBindings.jar(fill: fill, label: label)
    }

    static func statPill(_ kind: String, value: String) -> [String: RiveValue] {
        ["kind": .enumCase(kind), "value": .string(value)]
    }

    static func tag(_ text: String, tone: String = "amber") -> [String: RiveValue] {
        ["text": .string(text), "tone": .enumCase(tone)]
    }

    static func actionRow(title: String, reward: String, done: Bool) -> [String: RiveValue] {
        ["title": .string(title), "reward": .string(reward), "done": .bool(done)]
    }

    static func choice(_ label: String, state: String) -> [String: RiveValue] {
        ["label": .string(label), "state": .enumCase(state)]
    }

    static func liito(_ mood: String) -> [String: RiveValue] {
        ["mood": .enumCase(mood)]
    }

    static func tabBar(selected: Int) -> [String: RiveValue] {
        ["selected": .number(Double(selected)), "label0": .string("Today"), "label1": .string("Ask"),
         "label2": .string("Jars"), "label3": .string("Path")]
    }

    static func toggle(on: Bool) -> [String: RiveValue] {
        ["on": .bool(on)]
    }

    static func celebration(headline: String, detail: String) -> [String: RiveValue] {
        ["headline": .string(headline), "detail": .string(detail)]
    }

    static func berries(count: Int) -> [String: RiveValue] {
        // Berries3D reads `count` (0...60); its 2D fallback (StatPill) reads `kind` and `value`.
        ["count": .number(Double(min(max(count, 0), 60))), "kind": .enumCase("berries"), "value": .string("\(count)")]
    }
}
