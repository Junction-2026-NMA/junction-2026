"use client";
// One lesson: the idea in plain words, a guess (three Rive choice cards), then the person's own figures. A right
// guess completes the lesson. A wrong one gets a kind explanation and one short follow-up question; the lesson
// completes only when that is answered right. It ends with one principle to keep. "Ask Sisu" opens the Sisu tab
// with a question about this lesson; the place in the lesson is kept and the lesson reopens on the way back.
// Logic: web/core/AppLogic/LessonFollowUps.ts. In a BottomSheet (large detent, grabber).
import { useEffect, useMemo, useRef, useState } from "react";
import { TeachingQuiz } from "@/web/core/CoachPresentation";
import { LessonAttempt, LessonFollowUps, type LessonQuestion } from "@/web/core/AppLogic/LessonFollowUps";
import { LessonPathPresenter } from "@/web/core/AppLogic/LessonPath";
import type { TeachingCard } from "@/web/core/CoachModels";
import { RiveBindings } from "@/web/core/RiveContract";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { BottomSheet } from "@/web/shared/BottomSheet";
import { Eyebrow, SisuButton, SisuCard, SisuMotion, riveAccessible } from "@/web/shared/SisuStyle";
import { prefersReducedMotion, useReducedMotion } from "@/web/theme/motion";
import type { OpenLesson, PathModel } from "./PathModel";

export function LessonSheet({ lesson, path, autoAnswer, onAskSisu, onClose, onClosed }: {
  lesson: OpenLesson | null;
  path: PathModel;
  /** Screenshots: answer with option n (1 based) once the sheet is up. */
  autoAnswer: number | null;
  onAskSisu: (question: string) => void;
  onClose: () => void;
  onClosed: () => void;
}) {
  // The last lesson stays in the sheet while it slides away.
  const [shown, setShown] = useState<OpenLesson | null>(lesson);
  if (lesson && lesson !== shown) setShown(lesson);

  return (
    <BottomSheet
      open={lesson !== null}
      onClose={onClose}
      onClosed={() => { setShown(null); onClosed(); }}
      ariaLabel={shown?.card.title}
      testId="sheet.lesson"
    >
      {shown ? <LessonContent key={shown.token} lesson={shown} path={path} autoAnswer={autoAnswer} onAskSisu={onAskSisu} /> : null}
    </BottomSheet>
  );
}

function LessonContent({ lesson, path, autoAnswer, onAskSisu }: {
  lesson: OpenLesson;
  path: PathModel;
  autoAnswer: number | null;
  onAskSisu: (question: string) => void;
}) {
  const { card } = lesson;
  const reduceMotion = useReducedMotion();
  const followUp = useMemo(() => LessonFollowUps.question(card), [card]);
  const [attempt, setAttempt] = useState(lesson.attempt);
  const [finishedPath, setFinishedPath] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const phase = LessonAttempt.phase(attempt, card, followUp);
  const firstRight = attempt.first !== null && attempt.first === card.correctIndex;

  const apply = (next: LessonAttempt) => {
    if (next === attempt) return;
    setAttempt(next);
    if (LessonAttempt.phase(next, card, followUp) === "complete") {
      setFinishedPath(path.complete(card));
      path.forgetAttempt();
    } else {
      path.keep(next);
    }
  };
  const chooseFirst = (index: number) => apply(LessonAttempt.chooseFirst(attempt, card, index));
  const chooseFollowUp = (index: number) => apply(LessonAttempt.chooseFollowUp(attempt, card, followUp, index));
  const askSisu = () => {
    if (phase !== "complete") path.keep(attempt, true);
    onAskSisu(LessonFollowUps.askQuestion(card));
  };

  // After each answer, bring what came next into view (250 ms, once it has started to arrive).
  const step = `${attempt.first}|${attempt.followUpPicks.length}`;
  useEffect(() => {
    if (attempt.first === null) return;
    const timer = window.setTimeout(() => {
      const element = end.current;
      const scroller = element?.closest<HTMLElement>(".sisu-sheet-body");
      if (!element || !scroller) return;
      const delta = element.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom;
      if (delta <= 0) return;
      scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // The timer below calls the latest `chooseFirst`, so it sees the latest attempt.
  const latestChoose = useRef(chooseFirst);
  useEffect(() => {
    latestChoose.current = chooseFirst;
  });

  // Screenshots: answer by itself 700 ms after the sheet is up.
  useEffect(() => {
    if (autoAnswer === null) return;
    const timer = window.setTimeout(() => latestChoose.current(autoAnswer - 1), 700);
    return () => window.clearTimeout(timer);
    // Once per sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entrance = SisuMotion.entrance(reduceMotion);
  return (
    <div className="sisu-lesson" data-phase={phase}>
      <h1 className="sisu-lesson-title">{card.title}</h1>
      <p className="sisu-lesson-explanation">{card.explanation}</p>

      <FirstQuestion card={card} first={attempt.first} choose={chooseFirst} />

      {attempt.first !== null ? (
        <SisuCard className={entrance}>
          <p className="sisu-lesson-feedback" data-testid="lesson.feedback">
            {firstRight ? "Spot on." : "Not quite. Here is how it works out for you."}
          </p>
          {!firstRight && LessonFollowUps.whyWrong(card, attempt.first) ? (
            <p className="sisu-lesson-reveal">{LessonFollowUps.whyWrong(card, attempt.first)}</p>
          ) : null}
          <p className="sisu-lesson-reveal">{card.reveal}</p>
        </SisuCard>
      ) : null}

      {attempt.first !== null && !firstRight ? (
        <FollowUp followUp={followUp} attempt={attempt} choose={chooseFollowUp} entrance={entrance} />
      ) : null}

      {phase === "complete" ? (
        <SisuCard className={`sisu-lesson-principle ${entrance}`} testId="lesson.principle">
          <Eyebrow text="One thing to keep" />
          <p className="sisu-lesson-principle-text">{LessonFollowUps.principle(card.concept)}</p>
          {finishedPath ? <p className="sisu-lesson-reveal">{LessonPathPresenter.pathFinished(path.cards)}</p> : null}
        </SisuCard>
      ) : null}

      <div ref={end} className="sisu-lesson-actions">
        {phase === "complete" ? <SisuButton label="Done" action={() => path.closeLesson()} /> : null}
        <button type="button" className="sisu-lesson-ask" data-testid="lesson.ask" onClick={askSisu}>
          <span aria-hidden="true" className="sisu-lesson-ask-mark">?</span>
          Ask Sisu about this
        </button>
        {phase !== "complete" ? <p className="sisu-lesson-ask-note">Your place in this lesson is kept.</p> : null}
      </div>
    </div>
  );
}

function FirstQuestion({ card, first, choose }: { card: TeachingCard; first: number | null; choose: (index: number) => void }) {
  const quiz: TeachingQuiz = { card, selectedIndex: first };
  const answered = first !== null;
  const value = (index: number): string | undefined => {
    switch (TeachingQuiz.state(quiz, index)) {
      case "correct": return "Right answer";
      case "wrong": return "Your guess";
      default: return undefined;
    }
  };
  return (
    <div className="sisu-lesson-quiz">
      <Eyebrow text={answered ? "Your guess" : "Make a guess"} />
      <p className="sisu-lesson-question">{card.question}</p>
      {TeachingQuiz.choices(quiz).map((values, index) => (
        <RiveComponent
          key={index}
          component="ChoiceCard"
          values={values}
          onTrigger={(trigger) => { if (trigger === "pressed") choose(index); }}
          testId={`choice.${index + 1}`}
          {...riveAccessible(card.options[index], { isButton: !answered, value: value(index), action: () => choose(index) })}
        />
      ))}
    </div>
  );
}

function FollowUp({ followUp, attempt, choose, entrance }: {
  followUp: LessonQuestion;
  attempt: LessonAttempt;
  choose: (index: number) => void;
  entrance: string;
}) {
  const solved = attempt.followUpPicks.includes(followUp.correctIndex);
  const hint = LessonAttempt.followUpHint(attempt, followUp);
  return (
    <div className={`sisu-lesson-quiz ${entrance}`} data-testid="lesson.followup">
      <Eyebrow text="One more question to check it" />
      <p className="sisu-lesson-question">{followUp.question}</p>
      {followUp.options.map((option, index) => {
        const state = LessonAttempt.followUpState(attempt, followUp, index);
        const tappable = !solved && state === "idle";
        return (
          <RiveComponent
            key={index}
            component="ChoiceCard"
            values={RiveBindings.choiceCard(option, state)}
            onTrigger={(trigger) => { if (trigger === "pressed" && tappable) choose(index); }}
            testId={`followup.${index + 1}`}
            {...riveAccessible(option, {
              isButton: tappable,
              value: state === "correct" ? "Right answer" : state === "wrong" ? "Not this one" : undefined,
              action: () => { if (tappable) choose(index); },
            })}
          />
        );
      })}
      {hint ? <p className="sisu-lesson-hint" role="status">{hint}</p> : null}
      {solved ? (
        <SisuCard className={entrance}>
          <p className="sisu-lesson-feedback">That is it.</p>
          <p className="sisu-lesson-reveal">{followUp.explanation}</p>
        </SisuCard>
      ) : null}
    </div>
  );
}
