"use client";
// The one result an answer leads with: the most useful number, its label, a line of context and where it comes
// from. When no offer meets the user's requirements it says so instead ("No matching options found") and offers
// two follow-ups, asked through the coach store like a typed question. Figures come from AnswerPresenter.
import { useAppModel, useCoachStore } from "@/web/app/AppProvider";
import type { AnswerResult, SourceTag } from "@/web/core/AnswerPresentation";
import "./answer.css";

const BROADEN = "Broaden the search: show me the closest options, even if they miss one of my requirements, and say what each one misses.";
const KEEP_LOOKING = "Keep looking for an option that meets all my requirements.";

export function ResultLine({ result }: { result: AnswerResult }) {
  const model = useAppModel();
  const store = useCoachStore();
  return (
    <div className="sisu-answer-result" data-tone={result.noMatch ? "nomatch" : "value"} data-testid="answer.result">
      {result.noMatch ? (
        <h3 className="sisu-answer-result-heading">{result.label}</h3>
      ) : (
        <>
          <span className="sisu-answer-result-label">{result.label}</span>
          {result.value != null ? <span className="sisu-answer-result-value">{result.value}</span> : null}
        </>
      )}
      {result.detail ? <p className="sisu-answer-result-detail">{result.detail}</p> : null}
      {result.tags.length > 0 ? <SourceChips tags={result.tags} /> : null}
      {result.noMatch ? (
        <div className="sisu-answer-followups">
          <button type="button" className="sisu-answer-followup" onClick={() => store.ask(BROADEN)} data-testid="answer.broaden">Broaden the search</button>
          <button type="button" className="sisu-answer-followup" onClick={() => store.ask(KEEP_LOOKING)} data-testid="answer.keepLooking">Keep looking</button>
        </div>
      ) : null}
      {result.evidence ? (
        <button type="button" className="sisu-answer-link" onClick={() => model.showEvidence(result.evidence!.title, result.evidence!.filter)}>
          See the transactions
        </button>
      ) : null}
    </div>
  );
}

/** Where the figures come from, one chip per kind: Bank data, Your input, Web (by what, when), Estimate, Synthetic
 *  demo data comparison, Simulated, Mock data. */
export function SourceChips({ tags }: { tags: readonly SourceTag[] }) {
  return (
    <ul className="sisu-answer-chips" aria-label="Where this comes from">
      {tags.map((tag) => <li key={tag.kind} className="sisu-answer-chip" data-kind={tag.kind}>{tag.label}</li>)}
    </ul>
  );
}
