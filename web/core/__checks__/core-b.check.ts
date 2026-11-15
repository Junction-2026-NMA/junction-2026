// Checks for web/core part B (presentation, Rive contract and AppLogic), porting the intent of the SisuCore unit
// tests (ios/SisuCore/Tests). Run: npx tsx web/core/__checks__/core-b.check.ts
// It reads the bundled sample JSON from ios/SisuCore/Sources/SisuCore/Fixtures (the same files as public/sisu-fixtures).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import contract from "@/rive/contract.json";
import type { DemoCustomer, Overview, Transaction, TransactionList } from "@/web/core/Models";
import type { AgentAction, TeachingCard } from "@/web/core/CoachModels";
import { Visual } from "@/web/core/PlanModels";
import { BasketMath, Dates, Money, SisuLanguage, XrayPresenter } from "@/web/core/Presentation";
import { RiveBindings, RiveComponent, RiveFile, RiveValue, ResearchStage } from "@/web/core/RiveContract";
import type { RiveSizing } from "@/web/core/RiveContract";
import { ActionPresenter, CoachText, OfferPresenter, TeachingQuiz, ToolPresenter } from "@/web/core/CoachPresentation";
import { ChartColorRole, ChartPresenter, StepPresenter } from "@/web/core/ChartPresentation";
import { DailyAction, DailyProgress, DayStamp } from "@/web/core/AppLogic/DailyProgress";
import { LessonPathPresenter, LessonProgress, LessonNode } from "@/web/core/AppLogic/LessonPath";
import { OnboardingFlow, OnboardingLaunch, OnboardingStep } from "@/web/core/AppLogic/Onboarding";
import { FirstInsightPresenter, OnboardingCopy, OnboardingProfiles, OnboardingReading } from "@/web/core/AppLogic/OnboardingCopy";
import { NumberText, TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import { CoachBillMatch, CoachMood, CoachProviderName, CoachRewards } from "@/web/core/AppLogic/CoachAppLogic";
import { SampleEvidence } from "@/web/core/AppLogic/SampleEvidence";
import { VoiceAudioFormat, VoiceButtonPresenter, VoiceClipQueue, VoicePressRule } from "@/web/core/AppLogic/VoiceLogic";

// MARK: - A tiny harness

let failures = 0, passes = 0;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function eq(actual: unknown, expected: unknown, label: string): void {
  if (same(actual, expected)) { passes += 1; return; }
  failures += 1;
  console.error(`  FAIL ${label}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`);
}
const ok = (value: boolean, label: string) => eq(value, true, label);
const near = (actual: number, expected: number, label: string, accuracy = 1e-6) => ok(Math.abs(actual - expected) <= accuracy, `${label} (${actual} ≈ ${expected})`);
function group(name: string, body: () => void): void {
  const before = failures;
  try { body(); } catch (error) { failures += 1; console.error(`  FAIL ${name} threw`, error); }
  console.log(`${failures === before ? "ok  " : "FAIL"} ${name}`);
}

const fixtures = join(process.cwd(), "ios/SisuCore/Sources/SisuCore/Fixtures");
const fixture = <T>(path: string): T => JSON.parse(readFileSync(join(fixtures, path), "utf8")) as T;
const overview = (id: string) => fixture<Overview>(`overview-${id}.json`);
const nb = " ", minus = "−";

// MARK: - Money and dates (MoneyTests, DatesTests)

group("Money.format", () => {
  eq(Money.format(64, "en"), "€64", "64");
  eq(Money.format(1234, "en"), "€1,234", "1234");
  eq(Money.format(1234567.891, "en"), "€1,234,568", "1234567.891");
  eq(Money.format(0.5, "en"), "€1", "0.5");
  eq(Money.format(2.5, "en"), "€3", "2.5");
  eq(Money.format(999.5, "en"), "€1,000", "999.5");
  eq(Money.format(1234.5, "en", true), "€1,234.50", "decimals");
  eq(Money.format(0.125, "en", true), "€0.13", "0.125");
  eq(Money.format(-0.125, "en", true), `${minus}€0.13`, "-0.125");
  eq(Money.format(-1234.567, "en", true), `${minus}€1,234.57`, "-1234.567");
  eq(Money.format(3.98, "en", true), "€3.98", "3.98");
  eq(Money.format(64, "fi"), `64${nb}€`, "fi 64");
  eq(Money.format(1234, "fi"), `1${nb}234${nb}€`, "fi 1234");
  eq(Money.format(1234.5, "fi", true), `1${nb}234,50${nb}€`, "fi decimals");
  eq(Money.format(1234567.891, "fi", true), `1${nb}234${nb}567,89${nb}€`, "fi millions");
  eq(Money.format(0.375, "fi", true), `0,38${nb}€`, "fi 0.375");
  eq(Money.format(-12.2, "en"), `${minus}€12`, "negative en");
  eq(Money.format(-12.2, "fi"), `${minus}12${nb}€`, "negative fi");
  eq(Money.format(-0.4, "en"), "€0", "zero never negative");
  eq(Money.format(-0.004, "en", true), "€0.00", "zero cents never negative");
  for (const amount of [-1234567.891, -12.2, 0, 64, 1234.5]) for (const language of SisuLanguage.allCases) for (const decimals of [false, true]) {
    const text = Money.format(amount, language, decimals);
    ok(!text.includes(" ") && !text.includes("-") && !text.includes(" "), `no ordinary space or hyphen in ${text}`);
  }
  for (const amount of [NaN, Infinity, -Infinity, 1e300]) ok(Money.format(amount, "en") !== "" && Money.format(amount, "fi", true) !== "", `non-finite ${amount}`);
  eq(Money.signed(12, "en"), "+€12", "signed +");
  eq(Money.signed(-12, "en"), `${minus}€12`, "signed -");
  eq(Money.signed(0.2, "en"), "€0", "signed 0");
});

group("Dates", () => {
  eq(Dates.short("2026-11-13", "en"), "13 Nov 2026", "short en");
  eq(Dates.short("2026-09-05T08:00:00Z", "en"), "5 Sep 2026", "short date-time");
  eq(Dates.short("2026-11-13", "fi"), "13.11.2026", "short fi");
  eq(Dates.short("2026-09-05", "fi"), "5.9.2026", "short fi no padding");
  eq(Dates.short("2024-02-29", "en"), "29 Feb 2024", "leap day");
  for (const text of ["2026-13-01", "2026-02-30", "2026-1-5", "13.11.2026", "not a date", "", "2026-02-29", "2026-00-10", "2026-01-00"]) eq(Dates.short(text, "en"), text, `unchanged ${text}`);
  const h = "Europe/Helsinki";
  eq(Dates.shortDateTime("2026-11-14T09:30:00Z", "en", "UTC"), "14 Nov 2026, 09:30", "utc");
  eq(Dates.shortDateTime("2026-11-14T09:30:00Z", "en", h), "14 Nov 2026, 11:30", "helsinki");
  eq(Dates.shortDateTime("2026-11-14T09:30:00Z", "fi", h), "14.11.2026 klo 11.30", "helsinki fi");
  eq(Dates.shortDateTime("2026-11-13T23:30:00Z", "en", h), "14 Nov 2026, 01:30", "next day");
  eq(Dates.shortDateTime("2026-11-14T09:30:00.123Z", "en", "UTC"), "14 Nov 2026, 09:30", "fraction");
  eq(Dates.shortDateTime("2026-11-14T11:30:00+02:00", "en", "UTC"), "14 Nov 2026, 09:30", "offset");
  eq(Dates.shortDateTime("2026-07-01T12:00:00Z", "en", h), "1 Jul 2026, 15:00", "summer time");
  eq(Dates.shortDateTime("2026-11-14T09:05:00Z", "fi", "UTC"), "14.11.2026 klo 9.05", "fi hour unpadded");
  for (const text of ["", "not a time", "2026-11-14", "2026-11-14T09:30:00", "2026-11-14T25:30:00Z", "2026-11-14T09:30:00Zjunk"]) eq(Dates.shortDateTime(text, "en", "UTC"), text, `unchanged ${text}`);
});

group("Basket shares and hero (BasketMathTests, XrayPresenterTests intent)", () => {
  const aino = overview("CUST04974");
  const shares = BasketMath.shares(aino);
  near(shares.fixed + shares.curveballs + shares.leaks + shares.jars, 1, "shares add up to 1");
  eq(BasketMath.shares({ ...aino, baskets: [], monthlySaved: 0 }), { fixed: 0, curveballs: 0, leaks: 0, jars: 0 }, "zero");
  const hero = XrayPresenter.hero(aino, "en");
  eq(hero.amount, Money.format(aino.safeToSpend.perWeek, "en"), "hero amount");
  eq(hero.tone, aino.safeToSpend.gapPerMonth < 0 ? "above" : "room", "hero tone");
});

// MARK: - Rive contract (RiveContractTests, RiveBindingsTests)

group("RiveContract vs rive/contract.json and the Swift table", () => {
  const table: [string, number, number, RiveSizing, string[]][] = [
    ["Button", 350, 60, "flexibleWidth", ["pressed"]], ["HeroNumber", 350, 200, "flexibleWidth", []], ["BasketBar", 350, 40, "flexibleWidth", []],
    ["BasketChip", 160, 32, "fixed", []], ["ProgressBar", 350, 14, "flexibleWidth", []], ["StatPill", 96, 36, "fixed", []],
    ["TabBar", 390, 64, "flexibleWidth", ["tap0", "tap1", "tap2", "tap3"]], ["ActionRow", 350, 56, "flexibleWidth", ["pressed"]],
    ["ChoiceCard", 350, 64, "flexibleWidth", ["pressed"]], ["VoiceButton", 96, 96, "fixed", ["pressDown", "pressUp"]],
    ["StageIndicator", 350, 72, "flexibleWidth", []], ["Liito", 240, 240, "contain", []], ["Jar", 160, 200, "contain", []],
    ["Celebration", 390, 844, "fill", ["done"]], ["Sticker", 120, 120, "contain", []], ["Toggle", 64, 36, "fixed", ["toggled"]],
    ["Tag", 200, 28, "fixed", []], ["Baskets", 350, 220, "flexibleWidth", []], ["Berries", 320, 200, "contain", []],
    ["IconButton", 48, 48, "fixed", ["pressed"]], ["LessonNode", 120, 120, "contain", ["pressed"]], ["TypingDots", 56, 28, "fixed", []],
  ];
  eq(RiveComponent.allCases.length, 22, "22 components");
  eq(RiveComponent.allCases, table.map((row) => row[0]), "Swift case order");
  eq(contract.files.sisu_ui.artboards.map((a) => a.name), [...RiveComponent.allCases], "contract artboard order");
  for (const [name, width, height, sizing, out] of table) {
    const component = RiveComponent.fromRawValue(name);
    if (!component) { ok(false, `${name} exists`); continue; }
    eq(RiveComponent.file(component), "sisu_ui", `${name} file`);
    eq(RiveComponent.designSize(component), { width, height }, `${name} size`);
    eq(RiveComponent.sizing(component), sizing, `${name} sizing`);
    eq(RiveComponent.outTriggers(component), out, `${name} out triggers`);
  }
  eq(RiveFile.allCases, ["sisu_ui"], "files");
  eq(RiveFile.url(RiveFile.ui), "/rive/sisu_ui.riv", "file url");
  eq(RiveComponent.inTriggers("HeroNumber"), ["reveal"], "HeroNumber in");
  eq(RiveComponent.inTriggers("Jar"), ["celebrate"], "Jar in");
  eq(RiveComponent.inTriggers("Celebration"), ["fire"], "Celebration in");
  eq(RiveComponent.inTriggers("Berries"), ["drop"], "Berries in");
  for (const c of ["Baskets", "Button", "IconButton"] as const) eq(RiveComponent.inTriggers(c), [], `${c} in`);
  eq(RiveComponent.viewModelName("TabBar"), "TabBarVM", "view model name");
  const enums = contract.enums as Record<string, string[]>;
  eq(RiveBindings.ButtonStyleCases, enums.ButtonStyle, "ButtonStyle");
  eq(RiveBindings.ChoiceStateCases, enums.ChoiceState, "ChoiceState");
  eq(RiveBindings.VoiceStateCases, enums.VoiceState, "VoiceState");
  eq(RiveBindings.LiitoMoodCases, enums.LiitoMood, "LiitoMood");
  eq(RiveBindings.StatKindCases, enums.StatKind, "StatKind");
  eq(RiveBindings.TagToneCases, enums.TagTone, "TagTone");
  eq(RiveBindings.StickerKindCases, enums.StickerKind, "StickerKind");
  eq(RiveBindings.IconKindCases, enums.IconKind, "IconKind");
  eq(RiveBindings.IconStyleCases, enums.IconStyle, "IconStyle");
  eq(RiveBindings.LessonStateCases, enums.LessonState, "LessonState");
  eq(ResearchStage.allCases, enums.ResearchStage, "ResearchStage");
});

group("RiveBindings build complete value sets", () => {
  const S = RiveValue.string, N = RiveValue.number, B = RiveValue.bool, E = RiveValue.enumCase;
  eq(RiveBindings.button("Continue"), { label: S("Continue"), style: E("primary"), enabled: B(true), loading: B(false) }, "button");
  eq(RiveBindings.basketChip("curveballs", "fi"), { basket: E("curveballs"), label: S("Satunnaiset välttämättömät") }, "basketChip fi");
  eq(RiveBindings.basketBar({ fixed: 0.5, curveballs: 1.5, leaks: -0.2, jars: NaN }), { fixed: N(0.5), curveballs: N(1), leaks: N(0), jars: N(0) }, "basketBar clamps");
  eq(RiveBindings.progressBar(1.5), { progress: N(1), tone: E("green") }, "progress clamps");
  eq(RiveBindings.progressBar(0.4, true), { progress: N(0.4), tone: E("streak") }, "progress streak");
  for (const value of [NaN, Infinity, -Infinity]) {
    eq(RiveBindings.progressBar(value).progress, N(0), `progress ${value}`);
    eq(RiveBindings.jar(value, "x").full, B(false), `jar full ${value}`);
    eq(RiveBindings.berries(value), { count: N(0) }, `berries ${value}`);
  }
  eq(RiveBindings.jar(1.5, "Buffer"), { fill: N(1), label: S("Buffer"), full: B(true) }, "jar full");
  eq(RiveBindings.jar(0.99, "Buffer").full, B(false), "jar not full");
  eq(ResearchStage.allCases.map((stage) => RiveBindings.stageLabel(stage, "fi")), ["Etsitään tämänhetkisiä tarjouksia", "Luetaan sivuja", "Verrataan laskuusi", "Valmis"], "stage fi");
  eq(RiveBindings.tabBar(2), { selected: N(2), label0: S("Today"), label1: S("Ask"), label2: S("Jars"), label3: S("Path") }, "tabBar");
  eq(RiveBindings.tabBar(9, ["Tänään", "Kysy"]), { selected: N(3), label0: S("Tänään"), label1: S("Kysy"), label2: S("Jars"), label3: S("Path") }, "tabBar fallback");
  eq(RiveBindings.tabBar(-1).selected, N(0), "tabBar low");
  eq(RiveBindings.actionRow("Check in"), { title: S("Check in"), reward: S(""), done: B(false) }, "actionRow");
  eq(RiveBindings.tag("x"), { text: S("x"), tone: E("neutral") }, "tag default");
  eq(RiveBindings.berries(99), { count: N(60) }, "berries max");
  eq(RiveBindings.iconButton("soundOff", "plain", false), { icon: E("soundOff"), style: E("plain"), enabled: B(false) }, "iconButton");
  // Every `in` property that is not a trigger gets a value, and nothing else does.
  const sample: Record<string, Record<string, RiveValue>> = {
    Button: RiveBindings.button("x"), HeroNumber: RiveBindings.heroNumber(XrayPresenter.hero(overview("CUST04974"), "en")),
    BasketBar: RiveBindings.basketBar({ fixed: 0, curveballs: 0, leaks: 0, jars: 0 }), BasketChip: RiveBindings.basketChip("fixed", "en"),
    ProgressBar: RiveBindings.progressBar(0), StatPill: RiveBindings.statPill("streak", "1"), TabBar: RiveBindings.tabBar(0),
    ActionRow: RiveBindings.actionRow("x"), ChoiceCard: RiveBindings.choiceCard("x"), VoiceButton: RiveBindings.voiceButton("idle"),
    StageIndicator: RiveBindings.stageIndicator("done", "en"), Liito: RiveBindings.liito("idle"), Jar: RiveBindings.jar(0, "x"),
    Celebration: RiveBindings.celebration("", ""), Sticker: RiveBindings.sticker("lesson", "x"), Toggle: RiveBindings.toggle(true),
    Tag: RiveBindings.tag("x"), Baskets: RiveBindings.baskets({ fixed: 0, curveballs: 0, leaks: 0, jars: 0 }), Berries: RiveBindings.berries(1),
    IconButton: RiveBindings.iconButton("close"), LessonNode: RiveBindings.lessonNode("done", "1"), TypingDots: RiveBindings.typingDots(),
  };
  for (const component of RiveComponent.allCases) {
    const expected = RiveComponent.properties(component).filter((p) => p.type !== "trigger" && p.direction !== "out").map((p) => p.name).sort();
    eq(Object.keys(sample[component]).sort(), expected, `${component} keys`);
    for (const p of RiveComponent.properties(component)) {
      const value = sample[component][p.name];
      if (!value) continue;
      const kind = { string: "string", number: "number", boolean: "bool", enum: "enumCase" }[p.type];
      eq(value.kind, kind, `${component}.${p.name} type`);
      if (p.type === "enum") ok((contract.enums as Record<string, string[]>)[p.enum ?? ""].includes(String(value.value)), `${component}.${p.name} enum case`);
    }
  }
});

// MARK: - Daily progress (AppLogicDailyProgressTests)

group("DailyProgress", () => {
  const monday = DayStamp.make(2026, 11, 16), tuesday = DayStamp.make(2026, 11, 17), friday = DayStamp.make(2026, 11, 20);
  const run = (steps: [DailyAction, DayStamp][]) => steps.reduce((p, [a, d]) => DailyProgress.complete(p, a, d).progress, DailyProgress.make());
  const fresh = DailyProgress.make();
  eq([fresh.streakDays, fresh.berries, DailyProgress.progress(fresh, monday)], [0, 0, 0], "starts honestly");
  const first = DailyProgress.complete(fresh, "checkIn", monday);
  eq([first.earned, first.progress.streakDays, first.progress.berries], [DailyAction.reward("checkIn"), 1, 5], "first check-in is day one");
  const once = run([["checkIn", monday]]);
  eq(DailyProgress.complete(once, "checkIn", monday).earned, 0, "a day counts once");
  const two = run([["checkIn", monday], ["checkIn", monday], ["confirmBill", monday]]);
  eq([two.streakDays, two.berries], [1, 15], "streak 1, 15 berries");
  near(DailyProgress.progress(two, monday), 2 / 3, "progress 2/3");
  const next = run([["checkIn", monday], ["checkIn", tuesday]]);
  eq([next.streakDays, DailyProgress.done(next, tuesday), DailyProgress.done(next, monday)], [2, ["checkIn"], []], "next day grows the streak");
  const gap = run([["checkIn", monday], ["investigate", monday], ["checkIn", friday]]);
  eq([gap.streakDays, gap.berries], [1, 25], "gap restarts streak, keeps berries");
  const before = run([["checkIn", tuesday]]);
  const back = DailyProgress.complete(before, "confirmBill", monday);
  eq([back.earned, back.progress], [0, before], "clock set back changes nothing");
  const all = run([["checkIn", monday], ["confirmBill", monday]]);
  eq(DailyProgress.celebration(all, monday), null, "no celebration at two");
  const three = DailyProgress.complete(all, "investigate", monday).progress;
  eq(DailyProgress.berriesEarned(three, monday), 30, "30 berries");
  eq(DailyProgress.celebration(three, monday)?.detail, "30 berries today. Day 1 of your streak.", "celebration");
  eq(DailyProgress.celebration(three, tuesday), null, "no celebration tomorrow");
  eq(DayStamp.from(new Date(1_794_785_400 * 1000), "Europe/Helsinki"), monday, "day stamp in Helsinki");
  eq(DailyProgress.decode(JSON.parse(JSON.stringify(once))), once, "JSON round trip");
  eq(DayStamp.daysUntil(DayStamp.make(2024, 2, 28), DayStamp.make(2024, 3, 1)), 2, "leap year days");
  eq([DailyAction.title("investigate"), DailyAction.rewardText("confirmBill")], ["Let Sisu look into it", "+10"], "action copy");
});

// MARK: - Lesson path (AppLogicLessonPathTests)

group("LessonPath", () => {
  const cards = fixture<{ cards: TeachingCard[] }>("coach/teaching-CUST04974.json").cards;
  const concepts = cards.map((card) => card.concept);
  eq(cards.length, 7, "seven sample cards");
  const a = LessonProgress.complete(LessonProgress.make(), "buffer-first");
  const b = LessonProgress.complete(a.progress, "buffer-first");
  eq([a.added, b.added, b.progress.done], [true, false, ["buffer-first"]], "a lesson counts once");
  let p = LessonProgress.make();
  eq(LessonProgress.next(p, concepts), concepts[0], "next is first");
  p = LessonProgress.complete(LessonProgress.complete(p, concepts[0]).progress, concepts[2]).progress;
  eq(LessonProgress.next(p, concepts), concepts[1], "next is first not done");
  eq([LessonProgress.isOpen(p, concepts, concepts[1]), LessonProgress.isOpen(p, concepts, concepts[2]), LessonProgress.isOpen(p, concepts, concepts[3])], [true, true, false], "done and next open, later locked");
  const done = concepts.reduce((q, c) => LessonProgress.complete(q, c).progress, p);
  eq([LessonProgress.next(done, concepts), LessonProgress.allDone(done, concepts)], [null, true], "all done");
  const three = concepts.slice(0, 3).reduce((q, c) => LessonProgress.complete(q, c).progress, LessonProgress.make());
  const nodes = LessonPathPresenter.nodes(cards, three);
  eq(nodes.map((n) => n.state), ["done", "done", "done", "current", "locked", "locked", "locked"], "node states");
  eq(nodes[3].title, cards[3].title, "node title");
  eq(nodes[4].lockedReason, `Finish “${cards[3].title}” first.`, "locked reason names the lesson to finish");
  eq(LessonPathPresenter.progressText(cards, three), "3 of 7 lessons", "progress text");
  near(LessonPathPresenter.fraction(cards, three), 3 / 7, "fraction");
  ok(nodes.every((n) => n.sway >= -1 && n.sway <= 1), "sway in range");
  eq(LessonNode.accessibilityLabel(nodes[3], 7), `Lesson 4 of 7, ${cards[3].title}, next up`, "a11y label");
  ok(LessonNode.accessibilityLabel(nodes[5], 7).includes("locked. Finish"), "locked a11y label says why");
  eq([nodes[0].badge, nodes[3].badge], ["Done", "Lesson 4"], "badges");
  eq(LessonProgress.decode(JSON.parse(JSON.stringify(three))), three, "JSON round trip");
  eq(LessonProgress.decode({ done: ["safe-to-spend"], berries: 15 }), { done: ["safe-to-spend"] }, "old stored berries are ignored");
  const quiz = TeachingQuiz.make(cards[0]);
  const missed = TeachingQuiz.choose(quiz, (cards[0].correctIndex + 1) % cards[0].options.length);
  eq(TeachingQuiz.choices(missed).map((c) => c.state.value).filter((s) => s !== "idle").sort(), ["correct", "wrong"], "quiz choice states");
  eq(TeachingQuiz.choose(missed, cards[0].correctIndex), missed, "only the first choice counts");
  ok(!JSON.stringify(nodes).toLowerCase().includes("berr"), "no berries on the path");
});

// MARK: - Onboarding (AppLogicOnboardingTests, AppLogicOnboardingCopyTests)

group("Onboarding flow", () => {
  const F = OnboardingFlow;
  let flow = F.fresh;
  eq([F.isActive(flow), flow.step], [true, "welcome"], "fresh");
  flow = F.advance(flow); eq(flow.step, "promise", "promise");
  flow = F.advance(flow); eq(flow.step, "profile", "profile");
  flow = F.advance(flow); eq(flow.step, "profile", "profile moves on only by choosing");
  flow = F.profileChosen(flow); eq(flow.step, "reading", "reading");
  flow = F.advance(flow); eq(flow.step, "reading", "reading moves on only by finish");
  eq(flow.firstInsightPending, false, "no callout yet");
  flow = F.finish(flow);
  eq([flow.isComplete, F.isActive(flow), flow.firstInsightPending], [true, false, true], "finished");
  near(F.progress(F.fresh), 0.25, "progress 0.25");
  near(F.progress(F.advance(F.fresh)), 0.5, "progress 0.5");
  near(F.progress(F.profileChosen(F.skipIntro(F.fresh))), 1, "progress 1");
  eq([F.stepCount, OnboardingStep.number("profile")], [4, 3], "step numbers");
  const skipped = F.skipIntro(F.fresh);
  eq([F.canSkip(F.fresh), skipped.step, F.canSkip(skipped), F.skipIntro(F.profileChosen(skipped)).step], [true, "profile", false, "reading"], "skip");
  eq([F.canGoBack(F.fresh), F.back(F.fresh).step], [false, "welcome"], "no back from welcome");
  const atProfile = F.advance(F.advance(F.fresh));
  eq([F.back(atProfile).step, F.back(F.back(atProfile)).step], ["promise", "welcome"], "back");
  eq(F.isActive(F.finish(F.fresh)), true, "finish only from reading");
  eq(F.readingFailed(F.profileChosen(skipped)).step, "profile", "reading failed returns to profile");
  const done = F.finish(F.profileChosen(skipped));
  const dismissed = F.dismissFirstInsight(done);
  eq([dismissed.firstInsightPending, dismissed.isComplete, F.restart(dismissed)], [false, true, F.fresh], "dismiss and restart");
  const steps = [F.advance, F.back, F.skipIntro, F.profileChosen, F.readingFailed];
  eq(steps.reduce((f, step) => step(f), done), done, "a completed flow ignores step calls");
  eq(F.decode(JSON.parse(JSON.stringify(done))), done, "JSON round trip");
  eq(F.atLaunch(null, null, false), F.fresh, "clean install");
  eq([F.atLaunch(done, null, false), F.atLaunch(done, null, true)], [done, done], "completed is remembered");
  eq(F.atLaunch(F.profileChosen(skipped), null, false), F.fresh, "unfinished starts again");
  eq(F.atLaunch(dismissed, "reset", true), F.fresh, "reset");
  const viaDone = F.atLaunch(null, "done", false);
  eq([F.isActive(viaDone), viaDone.firstInsightPending], [false, false], "done skips without callout");
  eq([F.atLaunch(null, null, true), F.atLaunch(F.fresh, null, true), F.atLaunch(done, "done", false)], [F.skipped, F.skipped, done], "direct launches");
  eq([OnboardingLaunch.fromArgument("reset"), OnboardingLaunch.fromArgument("Done"), OnboardingLaunch.fromArgument("maybe"), OnboardingLaunch.fromArgument(null)],
    ["reset", "done", null, null], "launch argument");
});

group("Onboarding copy and first insight", () => {
  const customers = fixture<DemoCustomer[] | { customers: DemoCustomer[] }>("demo-customers.json");
  const list = Array.isArray(customers) ? customers : customers.customers;
  const sorted = OnboardingProfiles.sorted(list);
  eq(sorted.map((c) => c.displayName), ["Eetu", "Aino", "Sanna"], "Eetu first");
  ok(list.every((c) => !/\d/.test(OnboardingProfiles.pitch(c.customerId))), "no figures in pitches");
  eq(OnboardingProfiles.subtitle(sorted[0]), "25 · Espoo", "subtitle");
  eq(OnboardingProfiles.accessibilityLabel(sorted[0]), "Eetu, 25, Espoo. The biggest bill-switching win", "a11y");
  const x = (id: string) => ({ customerId: id, displayName: id, age: 30, postalCode: "00100", area: "Helsinki" });
  eq(OnboardingProfiles.sorted([x("X1"), x("CUST02003"), x("X2")]).map((c) => c.customerId), ["CUST02003", "X1", "X2"], "unknown keep order");
  eq(OnboardingCopy.promiseBaskets.map((r) => r.kind), ["fixed", "curveballs", "leaks"], "promise baskets");
  ok(OnboardingCopy.disclosureBody.replace(/⁠/g, "").includes("synthetic S-Pankki data"), "disclosure");
  const eetu = overview("CUST04414");
  eq(OnboardingReading.paymentCount(eetu), 358, "payment count");
  eq(OnboardingReading.loadingTitle("Eetu"), "Liito is sorting 12 months of Eetu's payments", "loading title");
  const state = FirstInsightPresenter.state(eetu);
  eq(state?.headline, "Looks like Electricity is your biggest bill after rent: about €79 a month.", "headline");
  eq(state?.detail, "All your utilities bills come to about €188 a month. Bills like these are often cheaper for new customers.", "detail");
  eq(state?.linkLabel, "From 36 of Eetu's transactions · See them", "link label");
  eq(state?.evidence, { from: "2025-10-01", to: "2026-09-30", category: "Utilities" }, "evidence filter");
  ok(FirstInsightPresenter.state(overview("CUST04974"), "Helen electricity")?.headline.startsWith("Helen electricity is your biggest bill after rent") ?? false, "confirmed name");
  if (state) {
    const basket = SampleEvidence.basket(state.evidence, eetu);
    const source = fixture<TransactionList>(`transactions-CUST04414-${basket ?? "all"}.json`);
    eq(SampleEvidence.narrow(source, state.evidence).count, 36, "the link opens exactly the rows it counts");
  }
});

// MARK: - Presenters (AppLogicPresentersTests, AppLogicSampleEvidenceTests, AppLogicCoachTests, voice)

group("Today presenters", () => {
  const o = overview("CUST04974");
  const bill = TodayPresenter.flaggedBill(o);
  eq(bill?.guessLabel, "Electricity", "flagged bill");
  if (bill) {
    eq(TodayPresenter.bill(bill, null).headline, "Looks like Electricity", "guess headline");
    eq([TodayPresenter.bill(bill, "Helen electricity").headline, TodayPresenter.bill(bill, "Helen electricity").isConfirmed], ["Helen electricity", true], "confirmed");
  }
  const card = TodayPresenter.basket(o.baskets[0], o.ageBand);
  eq([card.kind, card.name, card.share, card.categories[0]?.peer != null], ["fixed", "Regular essentials", "42% of spending", true], "basket card");
  ok(card.categories.every((c) => c.peer === null || c.peer.startsWith("Profiles aged")), "peer figures name the synthetic profiles");
  eq(TodayPresenter.basketButtons(o).map((b) => b.name), ["Regular essentials", "Occasional essentials", "Everyday spending"], "basket buttons, names only");
  ok(!/leak|waste/i.test(TodayPresenter.about("leaks")) && /groceries/i.test(TodayPresenter.about("leaks")), "everyday spending is not called waste");
  eq([NumberText.percent(0.424), NumberText.percent(NaN), NumberText.oneDecimal(1.14), NumberText.oneDecimal(25.11), NumberText.oneDecimal(-0.26), NumberText.monthShort("2025-10"), NumberText.monthShort("bad")],
    ["42%", "0%", "1.1", "25.1", `${minus}0.3`, "Oct", "bad"], "number text");
});

group("Sample evidence", () => {
  const o = overview("CUST04974");
  eq(SampleEvidence.basket({ from: o.windowFrom, to: o.windowTo, category: "Restaurants" }, o), "everyday", "category basket");
  eq(SampleEvidence.basket({ from: "", to: "", basket: "regular" }, o), "regular", "own basket");
  eq(SampleEvidence.basket({ from: "", to: "", negativeBalance: true }, o), null, "no basket");
  const row = (date: string, category: string, amount: number, balanceAfter: number): Transaction => ({ customerId: "C", date, time: "12:00", category, amount, balanceAfter, type: "card" });
  const list: TransactionList = { customerId: "C", dataTimestamp: "2026-09-30", currency: "EUR", count: 4, total: 0, truncated: false, transactions: [
    row("2026-09-01", "Restaurants", -10.5, 100), row("2026-08-01", "Restaurants", -4.25, -3), row("2026-08-02", "Groceries", -20, 50), row("2024-01-01", "Restaurants", -99, 10),
  ] };
  const restaurants = SampleEvidence.narrow(list, { from: "2025-10-01", to: "2026-09-30", category: "Restaurants" });
  eq(restaurants.count, 2, "count");
  near(restaurants.total, -14.75, "total", 0.001);
  eq(SampleEvidence.narrow(list, { from: "2025-10-01", to: "2026-09-30", negativeBalance: true }).transactions.map((t) => t.amount), [-4.25], "negative balance");
  eq(SampleEvidence.narrow(list, null), list, "no filter");
});

group("Coach app logic and voice", () => {
  const steps: [CoachRewards.Moment, string, number][] = [["quizAnswered", "card-1", 5], ["quizAnswered", "card-1", 0], ["actionDecided", "act-1", 10], ["actionDecided", "act-1", 0], ["quizAnswered", "act-1", 5]];
  const rewards = steps.reduce((r, [moment, id, expected]) => { const out = CoachRewards.award(r, moment, id); eq(out.earned, expected, `${moment} ${id}`); return out.rewards; }, CoachRewards.make());
  eq(rewards.berries, 20, "coach berries");
  eq(CoachRewards.decode(JSON.parse(JSON.stringify(rewards))), rewards, "rewards round trip");
  eq(CoachRewards.rewardText("actionDecided"), "+10", "reward text");
  eq(["Electricity", "Helen sähkö", "Mobile phone", "Home broadband", "Rent"].map((t) => CoachBillMatch.billType(t)), ["electricity", "electricity", "mobile", "internet", null], "bill types");
  eq([CoachMood.liito(false, false, false), CoachMood.liito(true, false, false), CoachMood.liito(true, true, false), CoachMood.liito(false, false, true)], ["idle", "thinking", "found", "cheering"], "moods");
  eq(["exa", "context.dev", "Other"].map(CoachProviderName.display), ["Exa", "Context.dev", "Other"], "provider names");
  const q = new VoiceClipQueue<string>();
  q.deliver("two", 2, q.generation); q.deliver("one", 1, q.generation);
  eq(q.next(), null, "waits for order 0");
  q.deliver("zero", 0, q.generation);
  eq([q.next(), q.next(), q.next(), q.next()], ["zero", "one", "two", null], "plays in order");
  const f = new VoiceClipQueue<string>();
  f.deliver("zero", 0, 0); f.deliver(null, 1, 0); f.deliver("two", 2, 0);
  eq([f.next(), f.next()], ["zero", "two"], "failed clip skipped");
  const s = new VoiceClipQueue<string>();
  const old = s.generation; s.deliver("one", 1, old); s.stop();
  eq([s.deliver("zero", 0, old), s.next(), s.deliver("new", 0, s.generation), s.next()], [false, null, true, "new"], "stop drops late clips");
  eq(s.deliver("again", 0, s.generation), false, "a played order cannot come again");
  eq([VoicePressRule.outcome(0.1, 4000), VoicePressRule.outcome(1.2, 0), VoicePressRule.outcome(NaN, 100), VoicePressRule.outcome(0.3, 100), VoicePressRule.outcome(2, VoicePressRule.maximumBytes + 1)],
    ["tooShort", "tooShort", "tooShort", "send", "tooLarge"], "press rule");
  eq([VoiceButtonPresenter.state(true, "speaking"), VoiceButtonPresenter.state(false, "thinking"), VoiceButtonPresenter.state(false, "idle")], ["recording", "thinking", "idle"], "voice button");
  eq([VoiceAudioFormat.fileTypeHint("audio/mpeg"), VoiceAudioFormat.fileTypeHint("audio/wav"), VoiceAudioFormat.isPCM("audio/pcm;rate=24000")], ["mp3", "wav", true], "formats");
  eq([VoiceAudioFormat.pcmRate("audio/pcm;rate=16000"), VoiceAudioFormat.pcmRate("audio/pcm")], [16000, 24000], "pcm rate");
  const wav = VoiceAudioFormat.wav(new Uint8Array(100), 24000);
  eq([wav.length, String.fromCharCode(...wav.slice(0, 4))], [144, "RIFF"], "wav header");
  eq(VoiceAudioFormat.testRecording().length, 44 + 32000, "test recording");
});

// MARK: - Coach and chart presentation (CoachPresentationTests, ChartPresentationTests intent)

group("Coach presentation", () => {
  eq([CoachText.value(39.83, "EUR/month"), CoachText.value(4573, "kWh/year"), CoachText.value(8.9, "c/kWh"), CoachText.value(65, "percent"), CoachText.value(3, "count")],
    ["€39.83 a month", "4,573 kWh a year", "8.9 c/kWh", "65%", "3"], "values");
  eq([CoachText.value(1, "months"), CoachText.value(24, "months"), CoachText.value(8.9, "c/kWh", "fi"), CoachText.value(65, "percent", "fi")], ["1 month", "24 months", "8,9 c/kWh", `65${nb}%`], "value units");
  eq(CoachText.fetched("2026-11-14T08:42:00Z", "en", "Europe/Helsinki"), "Fetched 14 Nov 2026, 10:42", "fetched");
  eq([ToolPresenter.duration(1234), ToolPresenter.duration(10), ToolPresenter.duration(1234, "fi"), ToolPresenter.name("find_patterns")], ["1.2 s", "under 0.1 s", "1,2 s", "Find patterns"], "tools");
  eq([OfferPresenter.yearly(24), OfferPresenter.yearly(-24), OfferPresenter.yearly(0.3)], ["About €24 less a year", "About €24 more a year", "About the same as now"], "offer yearly");
  const aino = "CUST04974";
  const waiting = fixture<{ action: AgentAction }>(`coach/action-transfer-${aino}.json`).action;
  ok(ActionPresenter.warning(waiting)?.startsWith("Moving €500 today would leave the account about €323 below zero") ?? false, "warning");
  eq([ActionPresenter.confirmation(waiting), ActionPresenter.destination(waiting)], [null, "To your savings"], "confirmation and destination");
  const approved = fixture<{ action: AgentAction }>(`coach/action-transfer-${aino}-approve.json`).action;
  ok(ActionPresenter.confirmation(approved)?.startsWith("Done (simulation). Reference SIM-") ?? false, "approved confirmation");
  const card = ActionPresenter.card(waiting, "en", "Europe/Helsinki");
  eq([card.warning, card.confirmation, card.destination, card.canDecide, card.simulatedTag], [waiting.warning, null, "To your savings", true, "Simulated, no real switch"], "action card");
  ok(card.validUntil?.startsWith("Valid until ") ?? false, "valid until");
  eq(ActionPresenter.card(approved, "en", "Europe/Helsinki").confirmation, approved.confirmation, "approved card");
});

group("Charts from the recorded visuals", () => {
  for (const id of ["CUST02003", "CUST04414", "CUST04974"]) {
    const visuals = (fixture<{ visuals: unknown[] }>(`coach/visuals-${id}.json`).visuals).map(Visual.decode);
    eq(visuals.map((v) => v.kind), ["budget_donut", "peer_bars", "month_bars", "waterfall", "futures_lines"], `${id} kinds`);
    for (const visual of visuals) {
      const state = ChartPresenter.chart(visual);
      ok(state.body.kind !== "none" && state.summary === visual.summary, `${id} ${visual.kind} draws`);
    }
  }
  const visuals = fixture<{ visuals: unknown[] }>("coach/visuals-CUST04974.json").visuals.map(Visual.decode);
  const chart = (kind: string) => ChartPresenter.chart(visuals.find((v) => v.kind === kind) as Visual);
  const donut = chart("budget_donut");
  if (donut.body.kind === "donut") {
    const slices = donut.body.slices;
    eq(slices.map((s) => s.label), ["Housing", "Groceries", "Restaurants", "Home & Tech", "Entertainment", "Other"], "donut labels");
    eq(slices.map((s) => s.color), ["category1", "category2", "category3", "category4", "category5", "category6"], "donut colours");
    eq([slices[0].valueText, slices[0].shareText, slices[0].start, donut.body.centerLabel, donut.body.centerValue, donut.source], ["€662", "37%", 0, "a month", "€1,795", "Your bank data"], "donut texts");
    near(slices[0].end, 0.3685, "first slice end", 0.001);
    near(slices[slices.length - 1].end, 1, "ring closes");
  } else ok(false, "donut body");
  eq(ChartColorRole.category(7), "category2", "category cycles");
  const peers = chart("peer_bars");
  if (peers.body.kind === "bars") {
    const g = peers.body.groups;
    eq([g.length, peers.legend.map((l) => l.label), g[0].title, g[0].note, g[0].bars.map((b) => b.valueText), g[2].note, g[1].note],
      [5, ["You", "People aged 18-24"], "Housing", "€63 below", ["€662", "€725"], "€64 above", "€3 below"], "peer bars");
    near(g[0].bars[0].fraction, 661.7 / 724.5, "peer fraction");
  } else ok(false, "peer body");
  const months = chart("month_bars");
  if (months.body.kind === "columns") {
    const c = months.body.columns;
    eq([c.length, c.filter((x) => x.flagged).length, c[0].detail, c[1].detail, c[1].color], [12, 6, "Oct 25: €1,822 in, €1,644 out", "Nov 25: €1,833 in, €1,961 out, €128 more out than in", "flagged"], "month columns");
    eq(c.map((x) => x.showsLabel), [true, false, false, true, false, false, true, false, false, true, false, true], "month labels");
    eq([months.footnote, months.legend.map((l) => l.isLine)], ["Marked months cost more than they brought in.", [false, true]], "month footnote");
  } else ok(false, "month body");
  const waterfall = chart("waterfall");
  if (waterfall.body.kind === "bars") {
    const g = waterfall.body.groups;
    eq(g.map((x) => x.bars[0].valueText), ["€1,783", `${minus}€757`, `${minus}€316`], "waterfall values");
    eq([g.map((x) => x.bars[0].color), waterfall.resultLabel, waterfall.resultValue, waterfall.source], [["main", "quiet", "quiet"], "Safe to spend a week", "€164", "Calculation"], "waterfall");
  } else ok(false, "waterfall body");
  const futures = chart("futures_lines");
  if (futures.body.kind === "lines") {
    const l = futures.body.lines;
    eq([l.map((x) => x.color), l.map((x) => x.hasBand), l.map((x) => x.endText), l.map((x) => x.rangeText), futures.body.axisLabels],
      [["quiet", "category2", "main"], [false, false, true], ["€491", "€6,491", "€7,284"], [null, null, "€6,614 to €7,848"], ["0", "1", "2", "3", "4", "5"]], "futures lines");
    ok(l.every((line) => line.points.every((p) => p.y >= 0 && p.y <= 1 && p.low <= p.y && p.y <= p.high)), "points in range");
  } else ok(false, "futures body");
  const unknown = Visual.decode({ id: "v", kind: "hologram", title: "T", caption: "C", summary: "S", source: "moon", facts: [] });
  const state = ChartPresenter.chart(unknown);
  eq([state.body.kind, state.title, state.caption, state.summary], ["none", "T", "C", "S"], "unknown kind");
  eq([StepPresenter.heading(true), StepPresenter.heading(false)], ["What Sisu is doing", "What Sisu did"], "steps heading");
});

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
