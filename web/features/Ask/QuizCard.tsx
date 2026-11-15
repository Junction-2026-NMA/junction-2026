"use client";
// The teaching question: guess first (Rive ChoiceCards), then the reveal. Port of QuizCard in AskCards.swift
// (no reward counter since the 15 Nov rework).
import { useState } from "react";
import { useCoach, useCoachStore } from "@/web/app/AppProvider";
import type { TeachingCard } from "@/web/core/CoachModels";
import { TeachingQuiz } from "@/web/core/CoachPresentation";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { Eyebrow, SisuCard, riveAccessible } from "@/web/shared/SisuStyle";
import { useReducedMotion } from "@/web/theme/motion";

const language = "en";

export function QuizCard({ card }: { card: TeachingCard }) {
  const store = useCoachStore();
  useCoach(); // re-render when the pick is recorded (quizChoices)
  const reduceMotion = useReducedMotion();
  const quiz = store.quiz(card);
  const revealed = TeachingQuiz.isRevealed(quiz);
  // The reveal animates in only when it happens on screen, not when the card is shown again later.
  const [revealedAtMount] = useState(revealed);
  const reveal = TeachingQuiz.reveal(quiz);
  const feedback = TeachingQuiz.feedback(quiz, language);

  const choose = (index: number) => { store.choose(index, card); };

  return (
    <SisuCard>
      <div className="sisu-ask-quiz-top">
        <Eyebrow text="Guess first" />
      </div>
      <h3 className="sisu-ask-h3">{card.question}</h3>
      {TeachingQuiz.choices(quiz).map((values, index) => (
        <div key={index} className="sisu-ask-choice" data-locked={revealed ? "true" : "false"}>
          <RiveComponent
            component="ChoiceCard"
            values={values}
            onTrigger={(trigger) => { if (trigger === "pressed") choose(index); }}
            testId={`ask.quiz.option.${index}`}
            {...riveAccessible(card.options[index] ?? "", {
              isButton: !revealed,
              value: revealed ? TeachingQuiz.state(quiz, index) : undefined,
              action: () => choose(index),
            })}
          />
        </div>
      ))}
      {reveal != null ? (
        <div className={`sisu-ask-reveal${revealedAtMount ? "" : reduceMotion ? " sisu-enter-fade" : " sisu-ask-reveal-in"}`}
          role="status" aria-live="polite">
          {feedback ? <span className="sisu-ask-button-text">{feedback}</span> : null}
          <p className="sisu-ask-body">{reveal}</p>
        </div>
      ) : null}
    </SisuCard>
  );
}
