"use client";
// An empty Sisu conversation: Liito, larger and animated, one friendly line, and the suggested questions
// (web/core/AppLogic/SisuSuggestions.ts): four Sisu answers today, plus up to two from what the overview noticed.
// Tapping one asks it.
import type { ReactNode } from "react";
import type { SisuSuggestion } from "@/web/core/AppLogic/SisuSuggestions";

export function SisuEmptyState({ name, liito, suggestions, voiceOn, onAsk }: {
  name: string | null;
  /** The big Liito badge (it travels to the header once the chat starts). */
  liito: ReactNode;
  suggestions: readonly SisuSuggestion[];
  voiceOn: boolean;
  onAsk: (question: string) => void;
}) {
  const standard = suggestions.filter((s) => s.noticed === null);
  const noticed = suggestions.filter((s) => s.noticed !== null);
  return (
    <div className="sisu-talk-empty" data-testid="talk.empty">
      <div className="sisu-talk-empty-hero">
        {liito}
        <h2 className="sisu-talk-empty-line">{name ? `Hi ${name}, what would you like to know?` : "What would you like to know?"}</h2>
        <p className="sisu-talk-empty-hint">
          {voiceOn ? "Sisu is listening. Ask out loud, then pause." : "Type below or tap the microphone to talk. Sisu checks your own numbers first."}
        </p>
      </div>
      <section className="sisu-talk-suggest" aria-labelledby="sisu-suggest-try">
        <h3 className="sisu-talk-suggest-head" id="sisu-suggest-try">Try asking</h3>
        <ul className="sisu-talk-suggest-list">
          {standard.map((s) => (
            <li key={s.id}>
              <button type="button" className="sisu-talk-suggest-item" data-testid={`talk.suggestion.${s.id}`} onClick={() => onAsk(s.question)}>
                <span className="sisu-talk-suggest-text">{s.question}</span>
                <Chevron />
              </button>
            </li>
          ))}
        </ul>
      </section>
      {noticed.length > 0 ? (
        <section className="sisu-talk-suggest" aria-labelledby="sisu-suggest-noticed">
          <h3 className="sisu-talk-suggest-head" id="sisu-suggest-noticed">From your data</h3>
          <ul className="sisu-talk-suggest-list">
            {noticed.map((s) => (
              <li key={s.id}>
                <button type="button" className="sisu-talk-suggest-item" data-testid={`talk.suggestion.${s.id}`} onClick={() => onAsk(s.question)}>
                  <span className="sisu-talk-suggest-stack">
                    <span className="sisu-talk-suggest-noticed">
                      {s.noticed}{s.synthetic ? <span className="sisu-talk-suggest-tag"> · compared with the synthetic dataset</span> : null}
                    </span>
                    <span className="sisu-talk-suggest-text">{s.question}</span>
                  </span>
                  <Chevron />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Chevron() {
  return (
    <svg className="sisu-talk-suggest-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
