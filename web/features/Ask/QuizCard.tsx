"use client";
// The teaching question: guess first, then the reveal. Drawn with the question mode of beUI's ApprovalCard
// (web/agents/ApprovalQuestion.tsx): the options are a radio group, the first tap is the guess, then every option
// shows whether it was right and the reveal opens under them. Port of QuizCard in AskCards.swift (no reward counter
// since the 15 Nov rework). When the answer's text already ends with the question, the card does not print it
// again (it stays for screen readers).
import { useCoach, useCoachStore } from "@/web/app/AppProvider";
import { ApprovalQuestion } from "@/web/agents/ApprovalQuestion";
import type { TeachingCard } from "@/web/core/CoachModels";
import { TeachingQuiz } from "@/web/core/CoachPresentation";

const language = "en";

/** `askedInText`: the answer above already ends with this question. */
export function QuizCard({ card, askedInText = false }: { card: TeachingCard; askedInText?: boolean }) {
  const store = useCoachStore();
  useCoach(); // re-render when the pick is recorded (quizChoices)
  const quiz = store.quiz(card);
  const revealed = TeachingQuiz.isRevealed(quiz);
  const reveal = TeachingQuiz.reveal(quiz);
  const feedback = TeachingQuiz.feedback(quiz, language);
  const options = card.options.map((label, index) => {
    const state = TeachingQuiz.state(quiz, index);
    return { label, state: state === "correct" || state === "wrong" ? state : ("idle" as const), selected: quiz.selectedIndex === index };
  });

  return (
    <ApprovalQuestion
      title={card.question}
      titleHidden={askedInText}
      badge={revealed ? "Answered" : "Guess first"}
      options={options}
      answered={revealed}
      onChoose={(index) => store.choose(index, card)}
      testIdPrefix="ask.quiz.option"
      result={reveal != null ? (
        <>
          {feedback ? <span className="sisu-ask-button-text">{feedback}</span> : null}
          <p className="sisu-ask-body">{reveal}</p>
        </>
      ) : null}
    />
  );
}
