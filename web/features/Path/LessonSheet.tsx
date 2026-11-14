"use client";
// One lesson: the idea in plain words, then predict (three Rive choice cards) and reveal (the customer's own
// figures). Berries are awarded once, when the lesson is answered the first time. Any answer is fine.
// Port of ios/Sisu/Features/Path/LessonSheet.swift, in a BottomSheet (large detent, grabber, near-white).
import { useEffect, useRef, useState } from "react";
import { TeachingQuiz } from "@/web/core/CoachPresentation";
import { LessonPathPresenter } from "@/web/core/AppLogic/LessonPath";
import { RiveBindings } from "@/web/core/RiveContract";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { BottomSheet } from "@/web/shared/BottomSheet";
import { Eyebrow, SisuButton, SisuCard, SisuMotion, riveAccessible } from "@/web/shared/SisuStyle";
import { prefersReducedMotion, useReducedMotion } from "@/web/theme/motion";
import type { OpenLesson, PathModel } from "./PathModel";

export function LessonSheet({ lesson, path, autoAnswer, onClose, onClosed }: {
  lesson: OpenLesson | null;
  path: PathModel;
  /** Screenshots: answer with option n (1 based) once the sheet is up. */
  autoAnswer: number | null;
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
      {shown ? <LessonContent key={shown.token} lesson={shown} path={path} autoAnswer={autoAnswer} /> : null}
    </BottomSheet>
  );
}

function LessonContent({ lesson, path, autoAnswer }: { lesson: OpenLesson; path: PathModel; autoAnswer: number | null }) {
  const { card } = lesson;
  const reduceMotion = useReducedMotion();
  const [quiz, setQuiz] = useState(() => TeachingQuiz.make(card));
  const [earned, setEarned] = useState(0);
  const [finishedPath, setFinishedPath] = useState(false);
  const done = useRef<HTMLDivElement>(null);
  const revealed = TeachingQuiz.isRevealed(quiz);
  const reveal = TeachingQuiz.reveal(quiz);
  const feedback = LessonPathPresenter.feedback(quiz);
  const reward = LessonPathPresenter.rewardText(earned);

  const choose = (index: number) => {
    if (revealed || index < 0 || index >= card.options.length) return;
    const wasAllDone = path.allDone;
    setQuiz(TeachingQuiz.choose(quiz, index));
    setEarned(path.complete(card));
    setFinishedPath(!wasAllDone && path.allDone);
  };

  // Once revealed: after 250 ms, scroll the Done button into view at the bottom.
  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => {
      const element = done.current;
      const scroller = element?.closest<HTMLElement>(".sisu-sheet-body");
      if (!element || !scroller) return;
      const delta = element.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom;
      if (delta <= 0) return;
      scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [revealed]);

  // The timer below calls the latest `choose`, so it sees the latest quiz.
  const latestChoose = useRef(choose);
  useEffect(() => {
    latestChoose.current = choose;
  });

  // Screenshots: answer by itself 700 ms after the sheet is up.
  useEffect(() => {
    if (autoAnswer === null) return;
    const timer = window.setTimeout(() => latestChoose.current(autoAnswer - 1), 700);
    return () => window.clearTimeout(timer);
    // Once per sheet, like the Swift `.task`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choiceValue = (index: number): string | undefined => {
    switch (TeachingQuiz.state(quiz, index)) {
      case "correct": return "Right answer";
      case "wrong": return "Your guess";
      default: return undefined;
    }
  };

  const entrance = SisuMotion.entrance(reduceMotion);
  return (
    <div className="sisu-lesson">
      <h1 className="sisu-lesson-title">{card.title}</h1>
      <p className="sisu-lesson-explanation">{card.explanation}</p>

      <div className="sisu-lesson-quiz">
        <Eyebrow text={revealed ? "Your guess" : "Make a guess"} />
        <p className="sisu-lesson-question">{card.question}</p>
        {TeachingQuiz.choices(quiz).map((values, index) => (
          <RiveComponent
            key={index}
            component="ChoiceCard"
            values={values}
            onTrigger={(trigger) => { if (trigger === "pressed") choose(index); }}
            testId={`choice.${index + 1}`}
            {...riveAccessible(card.options[index], { isButton: !revealed, value: choiceValue(index), action: () => choose(index) })}
          />
        ))}
      </div>

      {reveal !== null ? (
        <>
          <SisuCard className={entrance}>
            {feedback ? <p className="sisu-lesson-feedback">{feedback}</p> : null}
            <p className="sisu-lesson-reveal">{reveal}</p>
            {reward ? (
              <RiveComponent component="StatPill" values={RiveBindings.statPill("berries", reward)}
                sizing="contain" style={{ width: 120, height: 45 }}
                {...riveAccessible(`You earned ${reward}`)} />
            ) : null}
          </SisuCard>
          <div ref={done} className={`sisu-lesson-done ${entrance}`}>
            <SisuButton label="Done" action={() => path.finished(card, finishedPath)} />
          </div>
        </>
      ) : null}
    </div>
  );
}
