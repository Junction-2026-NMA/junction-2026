import XCTest
@testable import SisuCore

/// `RiveBindings`: exactly the non-trigger `in` properties of each artboard, with contract enum values.
final class RiveBindingsTests: XCTestCase {
    func testEnumRawValuesAreTheContractValues() {
        XCTAssertEqual(RiveBindings.ButtonStyle.allCases.map(\.rawValue), ["primary", "secondary", "onDark", "quiet"])
        XCTAssertEqual(RiveBindings.ChoiceState.allCases.map(\.rawValue), ["idle", "selected", "correct", "wrong"])
        XCTAssertEqual(RiveBindings.VoiceState.allCases.map(\.rawValue), ["idle", "recording", "thinking", "speaking"])
        XCTAssertEqual(RiveBindings.LiitoMood.allCases.map(\.rawValue),
                       ["idle", "cheering", "proud", "gliding", "curious", "found", "focused", "cosy", "sleepy", "thinking"])
        XCTAssertEqual(RiveBindings.StatKind.allCases.map(\.rawValue), ["streak", "berries"])
        XCTAssertEqual(RiveBindings.TagTone.allCases.map(\.rawValue), ["neutral", "amber", "info"])
        XCTAssertEqual(RiveBindings.StickerKind.allCases.map(\.rawValue), ["firstJar", "leakPlugged", "streak", "lesson"])
        XCTAssertEqual(ResearchStage.allCases.map(\.rawValue), ["searching", "reading", "comparing", "done"])
        XCTAssertEqual(BasketKind.allCases.map(\.rawValue), ["fixed", "curveballs", "leaks", "jars"])
    }

    func testButtonHeroAndChip() {
        XCTAssertEqual(RiveBindings.button(label: "Continue"),
                       ["label": .string("Continue"), "style": .enumCase("primary"), "enabled": .bool(true), "loading": .bool(false)])
        XCTAssertEqual(RiveBindings.button(label: "Go", style: .onDark, enabled: false, loading: true),
                       ["label": .string("Go"), "style": .enumCase("onDark"), "enabled": .bool(false), "loading": .bool(true)])
        let hero = HeroViewState(eyebrow: "Safe to spend", amount: "€64", unit: "a week", context: "c", tone: .room)
        XCTAssertEqual(RiveBindings.heroNumber(hero),
                       ["eyebrow": .string("Safe to spend"), "amount": .string("€64"), "unit": .string("a week"), "context": .string("c")])
        XCTAssertEqual(RiveBindings.basketChip(.curveballs, language: .fi), ["basket": .enumCase("curveballs"), "label": .string("Yllärit")])
    }

    func testNumbersAreClampedAndNonFiniteCountsAsZero() {
        XCTAssertEqual(RiveBindings.basketBar(BasketShares(fixed: 0.5, curveballs: 1.5, leaks: -0.2, jars: .nan)),
                       ["fixed": .number(0.5), "curveballs": .number(1), "leaks": .number(0), "jars": .number(0)])
        XCTAssertEqual(RiveBindings.basketBar(BasketShares(fixed: .infinity, curveballs: -.infinity, leaks: 0, jars: 1))["fixed"], .number(0))
        XCTAssertEqual(RiveBindings.progressBar(progress: 1.5), ["progress": .number(1), "tone": .enumCase("green")])
        XCTAssertEqual(RiveBindings.progressBar(progress: 0.4, streak: true), ["progress": .number(0.4), "tone": .enumCase("streak")])
        for value in [Double.nan, .infinity, -.infinity] {
            XCTAssertEqual(RiveBindings.progressBar(progress: value)["progress"], .number(0))
            XCTAssertEqual(RiveBindings.jar(fill: value, label: "x")["fill"], .number(0))
            XCTAssertEqual(RiveBindings.jar(fill: value, label: "x")["full"], .bool(false))
            XCTAssertEqual(RiveBindings.berries(count: value), ["count": .number(0)])
        }
    }

    func testJar() {
        XCTAssertEqual(RiveBindings.jar(fill: 0.4, label: "Buffer"), ["fill": .number(0.4), "label": .string("Buffer"), "full": .bool(false)])
        XCTAssertEqual(RiveBindings.jar(fill: -0.2, label: "Buffer")["fill"], .number(0))
        XCTAssertEqual(RiveBindings.jar(fill: 1, label: "Buffer")["full"], .bool(true))
        XCTAssertEqual(RiveBindings.jar(fill: 1.5, label: "Buffer"), ["fill": .number(1), "label": .string("Buffer"), "full": .bool(true)])
        XCTAssertEqual(RiveBindings.jar(fill: 0.99, label: "Buffer")["full"], .bool(false))
    }

    func testStageIndicatorLabels() {
        let english = ResearchStage.allCases.map { RiveBindings.stageIndicator($0, language: .en) }
        XCTAssertEqual(english[0], ["stage": .enumCase("searching"), "label": .string("Searching for current offers")])
        XCTAssertEqual(english[1], ["stage": .enumCase("reading"), "label": .string("Reading the pages")])
        XCTAssertEqual(english[2], ["stage": .enumCase("comparing"), "label": .string("Comparing with your bill")])
        XCTAssertEqual(english[3], ["stage": .enumCase("done"), "label": .string("Done")])
        XCTAssertEqual(ResearchStage.allCases.map { RiveBindings.stageLabel($0, language: .fi) },
                       ["Etsitään tämänhetkisiä tarjouksia", "Luetaan sivuja", "Verrataan laskuusi", "Valmis"])
    }

    func testTabBar() {
        XCTAssertEqual(RiveBindings.tabBar(selected: 2),
                       ["selected": .number(2), "label0": .string("Today"), "label1": .string("Ask"), "label2": .string("Jars"), "label3": .string("Path")])
        XCTAssertEqual(RiveBindings.tabBar(selected: 9, labels: ["Tänään", "Kysy"]),
                       ["selected": .number(3), "label0": .string("Tänään"), "label1": .string("Kysy"), "label2": .string("Jars"), "label3": .string("Path")])
        XCTAssertEqual(RiveBindings.tabBar(selected: -1)["selected"], .number(0))
    }

    func testTheOtherComponents() {
        XCTAssertEqual(RiveBindings.actionRow(title: "Check in", reward: "+10", done: true),
                       ["title": .string("Check in"), "reward": .string("+10"), "done": .bool(true)])
        XCTAssertEqual(RiveBindings.actionRow(title: "Check in"), ["title": .string("Check in"), "reward": .string(""), "done": .bool(false)])
        XCTAssertEqual(RiveBindings.choiceCard(label: "Invest it", state: .correct), ["label": .string("Invest it"), "state": .enumCase("correct")])
        XCTAssertEqual(RiveBindings.voiceButton(state: .recording), ["state": .enumCase("recording")])
        XCTAssertEqual(RiveBindings.liito(mood: .cheering), ["mood": .enumCase("cheering")])
        XCTAssertEqual(RiveBindings.statPill(kind: .berries, value: "12"), ["kind": .enumCase("berries"), "value": .string("12")])
        XCTAssertEqual(RiveBindings.tag(text: "Sample data", tone: .info), ["text": .string("Sample data"), "tone": .enumCase("info")])
        XCTAssertEqual(RiveBindings.toggle(on: true), ["on": .bool(true)])
        XCTAssertEqual(RiveBindings.sticker(kind: .leakPlugged, label: "Leak plugged"), ["kind": .enumCase("leakPlugged"), "label": .string("Leak plugged")])
        XCTAssertEqual(RiveBindings.celebration(headline: "Jar full.", detail: "d"), ["headline": .string("Jar full."), "detail": .string("d")])
        XCTAssertEqual(RiveBindings.berries(count: 12), ["count": .number(12)])
        XCTAssertEqual(RiveBindings.berries(count: 99), ["count": .number(60)])
        XCTAssertEqual(RiveBindings.berries(count: -3), ["count": .number(0)])
    }

    func testTheShortSpellingsGiveTheSameValues() {
        XCTAssertEqual(RiveBindings.voiceButton(.thinking), RiveBindings.voiceButton(state: .thinking))
        XCTAssertEqual(RiveBindings.liito(.proud), RiveBindings.liito(mood: .proud))
        XCTAssertEqual(RiveBindings.tag("Simulated, no real switch", tone: .amber), ["text": .string("Simulated, no real switch"), "tone": .enumCase("amber")])
        XCTAssertEqual(RiveBindings.tag(text: "x"), ["text": .string("x"), "tone": .enumCase("neutral")])
    }

    func testNoKeyIsPrivateOrATrigger() {
        let all: [[String: RiveValue]] = [
            RiveBindings.button(label: ""), RiveBindings.tabBar(selected: 0), RiveBindings.actionRow(title: ""),
            RiveBindings.choiceCard(label: ""), RiveBindings.voiceButton(state: .idle), RiveBindings.jar(fill: 0, label: ""),
            RiveBindings.celebration(headline: "", detail: ""), RiveBindings.toggle(on: false), RiveBindings.berries(count: 1),
        ]
        let triggers: Set<String> = ["pressed", "reveal", "tap0", "tap1", "tap2", "tap3", "pressDown", "pressUp", "celebrate", "fire", "done", "toggled", "drop"]
        for values in all {
            for key in values.keys where key != "done" {
                XCTAssertFalse(key.hasPrefix("_"))
                XCTAssertFalse(triggers.contains(key), key)
            }
        }
        // `done` is a boolean `in` property of ActionRow and an `out` trigger of Celebration.
        XCTAssertNil(RiveBindings.celebration(headline: "", detail: "")["done"])
    }
}
