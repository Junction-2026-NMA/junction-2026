// Checks for the Path rework and the voice preferences: lesson wording, sequential unlock, evidence of
// understanding (a wrong answer needs a right follow-up), backend follow-ups and whyWrong read defensively, every
// concept's local follow-up built from the card's own facts, and the two language choices.
// Run: npx tsx web/core/__checks__/lessons.check.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TeachingCard } from "@/web/core/CoachModels";
import { ConceptId } from "@/web/core/CoachModels";
import { LessonWording } from "@/web/core/AppLogic/LessonPath";
import { LessonAttempt, LessonFollowUps } from "@/web/core/AppLogic/LessonFollowUps";
import { VoiceLanguages, VoicePrefs } from "@/web/voice/VoicePrefs";
import { memoryDefaults } from "@/web/app/Defaults";
import { previewSentence, voicesOffered } from "@/web/features/Sheets/voiceChoices";

let failures = 0, passes = 0;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function eq(actual: unknown, expected: unknown, label: string): void {
  if (same(actual, expected)) { passes += 1; return; }
  failures += 1;
  console.error(`  FAIL ${label}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`);
}
function ok(value: boolean, label: string): void { eq(value, true, label); }
function group(name: string, body: () => void): void {
  const before = failures;
  try { body(); } catch (error) { failures += 1; console.error(`  FAIL ${name} threw`, error); }
  console.log(`${failures === before ? "ok  " : "FAIL"} ${name}`);
}
const cardsOf = (customer: string): TeachingCard[] =>
  (JSON.parse(readFileSync(join(process.cwd(), "public/sisu-fixtures/coach", `teaching-${customer}.json`), "utf8")) as { cards: TeachingCard[] }).cards;
const customers = ["CUST04974", "CUST02003", "CUST04414"];
const numbers = (text: string) => (text.match(/[\d][\d,.]*/g) ?? []).map((n) => n.replace(/[.,]$/, ""));

group("wording: the app's basket names and the weekly budget, figures untouched", () => {
  for (const customer of customers) {
    for (const card of cardsOf(customer)) {
      const renamed = LessonWording.card(card);
      const all = [renamed.title, renamed.explanation, renamed.question, ...renamed.options, renamed.reveal, ...renamed.facts.map((f) => f.label)].join(" ");
      ok(!/must pay|must-pay|everyday choices|now-and-then|safe to spend/i.test(all), `${customer} ${card.concept}: old names gone`);
      eq(renamed.facts.map((f) => f.value), card.facts.map((f) => f.value), `${customer} ${card.concept}: fact values unchanged`);
      eq(numbers(renamed.reveal).filter((n) => n !== "-"), numbers(card.reveal.replace("€-", "€")), `${customer} ${card.concept}: reveal figures unchanged`);
      eq([renamed.correctIndex, renamed.options.length], [card.correctIndex, card.options.length], `${customer} ${card.concept}: answer unchanged`);
    }
  }
  const first = LessonWording.card(cardsOf("CUST04974")[0]);
  ok(first.reveal.includes("everyday spending") && first.reveal.includes("regular essentials") && first.reveal.includes("occasional essentials"), "three baskets reveal uses the three names");
  eq(LessonWording.card(cardsOf("CUST04974")[1]).title, "Estimated weekly budget", "safe to spend is the estimated weekly budget");
});

group("follow-ups: one per concept, consistent, built from the card's facts", () => {
  for (const customer of customers) {
    for (const card of cardsOf(customer)) {
      const f = LessonFollowUps.local(card);
      ok(f.question.length > 10 && f.options.length === 3, `${customer} ${card.concept}: a question with three options`);
      ok(f.correctIndex >= 0 && f.correctIndex < f.options.length, `${customer} ${card.concept}: correct index in range`);
      ok(f.whyWrong[f.correctIndex] == null, `${customer} ${card.concept}: no whyWrong for the right option`);
      ok(f.explanation.length > 10 && !/NaN|undefined|null/.test(f.question + f.explanation), `${customer} ${card.concept}: clean text`);
      ok(LessonFollowUps.principle(card.concept).length > 20, `${customer} ${card.concept}: a principle`);
      ok(LessonFollowUps.askQuestion(card).endsWith("?") || LessonFollowUps.askQuestion(card).endsWith("."), `${customer} ${card.concept}: an Ask Sisu question`);
    }
  }
  eq(ConceptId.all.length, 7, "seven concepts");
  const budget = LessonFollowUps.local(cardsOf("CUST04974")[1]);
  eq([budget.correctIndex, budget.explanation.includes("€12")], [0, true], "CUST04974 spends €12 a month more than the estimate");
  const budget2 = LessonFollowUps.local(cardsOf("CUST02003")[1]);
  eq(budget2.correctIndex, 1, "CUST02003 spends less than the estimate");
  ok(LessonFollowUps.local(cardsOf("CUST02003")[3]).explanation.includes("above the usual three"), "a large buffer is said to be above three months");
});

group("backend follow-up and whyWrong are used when valid, ignored when not", () => {
  const card = cardsOf("CUST04974")[0];
  const withExtras = { ...card, whyWrong: ["A", null, 3], followUp: { question: "Q?", options: ["x", "y"], correctIndex: 1, explanation: "E" } } as unknown as TeachingCard;
  eq(LessonFollowUps.whyWrong(withExtras, 0), "A", "whyWrong string");
  eq([LessonFollowUps.whyWrong(withExtras, 2), LessonFollowUps.whyWrong(card, 1)], [null, null], "whyWrong missing or not text");
  eq(LessonFollowUps.question(withExtras).question, "Q?", "backend follow-up wins");
  const broken = { ...card, followUp: { question: "Q?", options: ["x", "y"], correctIndex: 5 } } as unknown as TeachingCard;
  eq(LessonFollowUps.question(broken).question, LessonFollowUps.local(card).question, "an inconsistent backend follow-up falls back to the local one");
});

group("evidence of understanding: only a right answer completes", () => {
  const card = cardsOf("CUST04974")[2];
  const follow = LessonFollowUps.question(card);
  const wrong = (card.correctIndex + 1) % card.options.length;
  let a = LessonAttempt.make(card.concept);
  eq(LessonAttempt.phase(a, card, follow), "question", "starts at the question");
  eq(LessonAttempt.phase(LessonAttempt.chooseFirst(a, card, card.correctIndex), card, follow), "complete", "right first time completes");
  a = LessonAttempt.chooseFirst(a, card, wrong);
  eq(LessonAttempt.phase(a, card, follow), "followUp", "a wrong first answer asks the follow-up");
  eq(LessonAttempt.chooseFirst(a, card, card.correctIndex), a, "the first pick cannot be changed");
  const miss = (follow.correctIndex + 1) % follow.options.length;
  a = LessonAttempt.chooseFollowUp(a, card, follow, miss);
  eq([LessonAttempt.phase(a, card, follow), LessonAttempt.followUpState(a, follow, miss)], ["followUp", "wrong"], "a wrong follow-up does not complete");
  ok((LessonAttempt.followUpHint(a, follow) ?? "").endsWith("Try another one."), "a kind hint to try again");
  eq(LessonAttempt.chooseFollowUp(a, card, follow, miss), a, "the same wrong option twice counts once");
  a = LessonAttempt.chooseFollowUp(a, card, follow, follow.correctIndex);
  eq([LessonAttempt.phase(a, card, follow), LessonAttempt.followUpState(a, follow, follow.correctIndex)], ["complete", "correct"], "the right follow-up completes");
  eq(LessonAttempt.decode(JSON.parse(JSON.stringify({ ...a, resume: true }))), a, "attempt round trip");
  eq(LessonAttempt.decode({ concept: "x", first: null, followUpPicks: [1] })?.followUpPicks, [], "no follow-up picks before a first pick");
});

group("voice prefs: two languages, the session language, voices offered", () => {
  const store = memoryDefaults();
  eq(VoicePrefs.languages(store), { speak: "auto", reply: "same" }, "defaults");
  store.setJSON("sisu.prefs", { language: "fi" });
  eq(VoicePrefs.languages(store), { speak: "fi", reply: "same" }, "an older single language reads as I speak");
  VoicePrefs.setLanguages({ speak: "auto", reply: "sv" }, store);
  eq([VoicePrefs.languages(store), VoicePrefs.recogniserLanguage(store)], [{ speak: "auto", reply: "sv" }, "auto"], "stored separately; the recogniser keeps auto");
  eq([VoiceLanguages.sessionLanguage({ speak: "fi", reply: "same" }), VoiceLanguages.sessionLanguage({ speak: "auto", reply: "en" })], ["fi", "en"], "session language");
  eq(VoiceLanguages.decode({ speak: "<b>", reply: 3 }), { speak: "auto", reply: "same" }, "invalid values fall back");
  eq(voicesOffered(null).map((v) => v.id), [null], "only the default voice without the server's list");
  eq(voicesOffered({ voices: [{ id: "SAz9YHcvj6GT2YYXdXww", name: "River" }], languages: [] }).map((v) => v.name), ["Sisu’s usual voice", "River"], "curated voices the server has");
  ok(["en", "fi", "sv", "de", "xx"].every((l) => previewSentence(l).text.length <= 240), "preview sentences fit the TTS cache");
  eq(previewSentence("xx").language, null, "an unknown language previews in English without a language code");
});

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
