"use client";
// The approval card of a simulated action: the "Simulated, no real switch" tag, what it does, the sources, what a
// real switch takes, Approve / Decline, and the futures once approved. Port of ActionCard in AskCards.swift.
import { useRef } from "react";
import { useAppModel, useCoach, useCoachStore } from "@/web/app/AppProvider";
import type { AgentAction } from "@/web/core/CoachModels";
import { ActionPresenter, CoachText, FuturesPresenter } from "@/web/core/CoachPresentation";
import { RiveBindings } from "@/web/core/RiveContract";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { SisuButton, SisuCard, riveAccessible } from "@/web/shared/SisuStyle";
import { decideAction } from "./answerActions";
import { Assumptions, Footnote, Note, SourceLink } from "./CardParts";
import { ImpactChart } from "./ImpactChart";
import { isWatchKind } from "@/web/core/WatchModels";
import { WatchActionCard, showsWatchCard } from "@/web/features/Projects/WatchActionCard";

const language = "en";

/** A watch (property_watch, price_watch) gets the Projects card once it handles the action (`showsWatchCard`);
 *  every other action, and a watch it does not handle yet, gets the simulated-action card. */
export function ActionCard({ action }: { action: AgentAction }) {
  if (isWatchKind(action.kind) && showsWatchCard(action)) return <WatchActionCard action={action} />;
  return <SimulatedActionCard action={action} />;
}

function SimulatedActionCard({ action }: { action: AgentAction }) {
  const model = useAppModel();
  const store = useCoachStore();
  const coach = useCoach();
  const card = ActionPresenter.card(action, language);
  const busy = coach.deciding.includes(action.id);
  const notice = coach.decisionNotices[action.id];
  // One decision per card at a time: a second press (a stray tap on the other button while the first one is on
  // its way) is ignored until the server has answered.
  const inFlight = useRef(false);
  const decide = (approve: boolean) => {
    if (inFlight.current || busy) return;
    inFlight.current = true;
    void decideAction(action, approve, store, model).finally(() => { inFlight.current = false; });
  };

  return (
    <SisuCard>
      <RiveComponent component="Tag" values={RiveBindings.tag(card.simulatedTag, "amber")} {...riveAccessible(card.simulatedTag)} />
      <h2 className="sisu-ask-h2">{card.title}</h2>
      <p className="sisu-ask-body">{card.summary}</p>
      {/* The server asks for the warning to be shown prominently, never hidden. */}
      {card.warning ? <Note text={card.warning} /> : null}
      <div className="sisu-ask-baseline">
        <span className="sisu-ask-h3">{card.monthly}</span>
        <span className="sisu-ask-body sisu-ask-muted">freed</span>
      </div>
      <Assumptions items={card.assumptions} />
      {action.sources.length > 0 ? (
        <div className="sisu-ask-sources">
          <span className="sisu-ask-label">Sources</span>
          {action.sources.map((source) => (
            <div key={source.url} className="sisu-ask-source-block">
              <SourceLink title={source.title} url={source.url} />
              <Footnote text={CoachText.fetched(source.retrievedAt, language)} />
            </div>
          ))}
        </div>
      ) : null}
      {card.checklist.length > 0 ? (
        <>
          {/* The Rive row holds one short line, so it names the list; the steps themselves are text that wraps. */}
          <div className="sisu-ask-no-hit">
            <RiveComponent component="ActionRow"
              values={RiveBindings.actionRow("What a real switch takes", `${card.checklist.length} steps`, false)}
              {...riveAccessible(`What a real switch takes, ${card.checklist.length} steps`)} />
          </div>
          <ol className="sisu-ask-checklist">
            {card.checklist.map((step, index) => (
              <li key={index} className="sisu-ask-checklist-step">
                <span className="sisu-ask-label sisu-ask-primary" aria-hidden="true">{`${index + 1}.`}</span>
                <span className="sisu-ask-body">{step}</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      <p className="sisu-ask-button-text" role="status">{card.statusSentence}</p>
      {card.confirmation ? <p className="sisu-ask-body">{card.confirmation}</p> : null}
      {notice ? <Note text={notice} /> : null}
      {card.validUntil ? <Footnote text={card.validUntil} /> : null}
      {card.canDecide ? (
        <>
          <SisuButton label="Approve" style="primary" enabled={!busy} loading={busy} action={() => decide(true)} />
          <SisuButton label="Decline" style="secondary" enabled={!busy} action={() => decide(false)} />
        </>
      ) : null}
      {action.impact ? (
        <>
          <ImpactChart series={FuturesPresenter.series(action.impact, language)} />
          <p className="sisu-ask-body">{card.impactSummary ?? action.impact.summary}</p>
        </>
      ) : null}
    </SisuCard>
  );
}
