"use client";
// The futures simulator: one predict-before-reveal question that must be answered before the three futures are
// shown. Port of FuturesSection in ios/Sisu/Features/Jars/JarsScreen.swift.
// - The scenario is asked for on appear and again 250 ms after the sliders settle (`.task(id: input)`): a newer
//   input cancels the older request, and a failure only shows when nothing newer is pending.
// - `?answer=nothing|save|invest` answers the question on appear (LaunchOptions.answer).
import { useEffect, useState } from "react";
import { ScenarioInput, type BranchId, type ScenarioResponse } from "@/web/core/Models";
import { roundAway } from "@/web/core/Presentation";
import { FuturesQuiz } from "@/web/core/AppLogic/AppPresenters";
import { useAppModel } from "@/web/app/AppProvider";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { RiveValues } from "@/web/shared/RiveValues";
import { riveAccessible, SectionTitle, SisuCard, SisuMotion } from "@/web/shared/SisuStyle";
import { useReducedMotion } from "@/web/theme/motion";
import { FuturesReveal } from "./FuturesReveal";

export function FuturesSection() {
  const model = useAppModel();
  const reduceMotion = useReducedMotion();

  const [guess, setGuess] = useState<BranchId | null>(() => model.launch.answer);
  // The question was answered by a tap here (and not by the launch option), so the change is animated.
  const [animated, setAnimated] = useState(false);
  const [billSaving, setBillSaving] = useState(15);
  const [trim, setTrim] = useState(10);
  const [years, setYears] = useState(5);
  const [response, setResponse] = useState<ScenarioResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const bill = roundAway(billSaving);
  const cut = roundAway(trim);
  const span = roundAway(years);

  useEffect(() => {
    let cancelled = false;
    // Wait for the sliders to settle before asking.
    const timer = setTimeout(() => {
      model.scenario(ScenarioInput.make(bill, cut, span)).then(
        (next) => { if (!cancelled) { setResponse(next); setFailed(false); } },
        () => { if (!cancelled) setFailed(true); },
      );
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [model, bill, cut, span, attempt]);

  const branches = response?.branches ?? [];
  const choose = (id: BranchId) => {
    if (guess !== null) return;
    setAnimated(true);
    setGuess(id);
  };
  const motion = animated && SisuMotion.state(reduceMotion) !== null;

  return (
    <div className="sisu-jars-futures">
      <SectionTitle title="Three futures" detail="Predict first, then see what the numbers say." />
      <div data-scroll-id="question">
        <SisuCard>
          <p className="sisu-jars-question">{FuturesQuiz.question}</p>
          {FuturesQuiz.choices.map((choice) => (
            <RiveComponent
              key={choice.id}
              component="ChoiceCard"
              values={RiveValues.choice(choice.label, FuturesQuiz.state(choice.id, guess, branches))}
              onTrigger={(trigger) => { if (trigger === "pressed") choose(choice.id); }}
              {...riveAccessible(choice.label, { isButton: guess === null, action: () => choose(choice.id) })}
            />
          ))}
          {guess !== null ? (
            <p className={motion ? "sisu-jars-explanation sisu-jars-fade-in" : "sisu-jars-explanation"}>
              {FuturesQuiz.explanation(guess, branches)}
            </p>
          ) : null}
        </SisuCard>
      </div>

      {guess !== null ? (
        <div data-scroll-id="futures" className={motion ? `sisu-jars-reveal ${SisuMotion.entrance(reduceMotion)}` : "sisu-jars-reveal"}>
          <FuturesReveal
            response={response}
            failed={failed}
            onRetry={() => setAttempt((count) => count + 1)}
            billSaving={billSaving} onBillSaving={setBillSaving}
            trim={trim} onTrim={setTrim}
            years={years} onYears={setYears}
          />
        </div>
      ) : null}
    </div>
  );
}
