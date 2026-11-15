"use client";
// Today's one primary insight or action (TodayFocus.primary): a shortfall before payday as the single warning when
// it applies, otherwise the most material thing Sisu found. One tap asks Sisu about it (model.askSisu); a quiet link
// shows the transactions behind it.
import { useAppModel } from "@/web/app/AppProvider";
import type { TodayFocusState } from "@/web/core/AppLogic/AppPresenters";
import { SisuCard } from "@/web/shared/SisuStyle";
import "./insight.css";

export function PrimaryInsight({ focus }: { focus: TodayFocusState }) {
  const model = useAppModel();
  const evidence = focus.evidence;
  return (
    <SisuCard className={focus.tone === "warning" ? "sisu-insight sisu-insight-warning" : "sisu-insight"}>
      <div data-testid="today.focus" data-focus={focus.id} data-tone={focus.tone}
        role={focus.tone === "warning" ? "alert" : undefined} className="sisu-insight-body">
        <p className="sisu-insight-eyebrow">
          {focus.tone === "warning" ? <span className="sisu-insight-mark" aria-hidden="true">!</span> : null}
          {focus.eyebrow}
        </p>
        <h2 className="sisu-insight-title">{focus.title}</h2>
        <p className="sisu-insight-detail">{focus.detail}</p>
      </div>
      <div className="sisu-insight-actions">
        <button type="button" className="sisu-insight-ask" onClick={() => model.askSisu(focus.question)}
          data-testid="today.focus.ask">
          {focus.askLabel}
        </button>
        {evidence ? (
          <button type="button" className="sisu-insight-see" onClick={() => model.showEvidence(evidence.title, evidence.filter)}>
            See the payments
          </button>
        ) : null}
      </div>
    </SisuCard>
  );
}
