"use client";
// v2 housing in the project view: where it came from (the conversation, with Open conversation), a short top (the
// best match now, or the closest one that needs checking, and its effect on the month), then closed sections:
// listings that fit, excluded and why, the maths, Context.dev monitoring (each page: last and next check, the latest
// change and what it changed in the project) and Exa research (the query exactly as sent, the sources, and each
// listing's facts against each requirement). Simulated changes say "Simulated update" wherever they appear.
import { useCoachStore } from "@/web/app/AppProvider";
import { type HousingConversation, type HousingEvaluation, HousingModels, HousingText } from "@/web/core/HousingModels";
import type { PropertyWatch, WatchedPage } from "@/web/core/WatchModels";
import { Disclosure } from "@/web/features/Ask/Disclosure";
import { ExcludedList, ListingCard, MathsList, RequirementTable, ResearchSources } from "@/web/features/Ask/HousingParts";
import { SisuCard } from "@/web/shared/SisuStyle";
import { Chip } from "./ProjectParts";
import { hostOf } from "./ProjectPresenter";
import "./projects.css";
import "@/web/features/Ask/housing.css";

const conversationOf = (watch: PropertyWatch): HousingConversation | null => {
  const raw = watch.conversation;
  return raw && typeof raw.question === "string" && typeof raw.summary === "string" ? (raw as unknown as HousingConversation) : null;
};

export function ProjectConversation({ watch, onOpened }: { watch: PropertyWatch; onOpened: () => void }) {
  const coach = useCoachStore();
  const conversation = conversationOf(watch);
  if (!conversation) return null;
  const id = conversation.conversationId;
  const saved = id ? coach.getSnapshot().savedConversations.some((one) => one.id === id) || coach.getSnapshot().conversationId === id : false;
  const open = () => {
    if (!id) return;
    coach.openConversation(id);
    onOpened();
  };
  return (
    <SisuCard testId="project.conversation">
      <h2 className="sisu-project-h2">From your conversation</h2>
      <p className="sisu-project-body">{`“${conversation.question}”`}</p>
      <p className="sisu-project-muted">{`Requirements: ${conversation.summary}`}</p>
      {conversation.budgetReasoning ? <p className="sisu-project-muted">{`Budget: ${conversation.budgetReasoning}`}</p> : null}
      {saved ? (
        <div className="sisu-project-actions">
          <button type="button" className="sisu-project-small" onClick={open} data-testid="project.openConversation">Open conversation</button>
        </div>
      ) : <p className="sisu-project-muted">That conversation is not saved on this device.</p>}
    </SisuCard>
  );
}

export function ProjectHousingTop({ evaluation }: { evaluation: HousingEvaluation | null }) {
  if (!evaluation) return null;
  const shown = evaluation.best ?? evaluation.closest;
  const goal = typeof evaluation.criteria.requirements.savingsGoalEurPerMonth === "number" ? evaluation.criteria.requirements.savingsGoalEurPerMonth : null;
  return (
    <SisuCard testId="project.housingTop">
      <h2 className="sisu-project-h2">{evaluation.best ? "Best match now" : evaluation.closest ? "Closest match now" : "Nothing fits yet"}</h2>
      <p className="sisu-housing-verdict">{evaluation.verdict}</p>
      {shown ? <ListingCard one={shown} heading={evaluation.best ? "Best match" : "Needs checking"} savingsGoal={goal} /> : null}
    </SisuCard>
  );
}

export function ProjectHousingDetails({ watch, evaluation }: { watch: PropertyWatch; evaluation: HousingEvaluation | null }) {
  const research = HousingModels.research(watch.research);
  const changes = evaluation?.changes ?? [];
  const fitting = evaluation ? [...evaluation.fitting, ...evaluation.needsChecking] : [];
  const goal = evaluation && typeof evaluation.criteria.requirements.savingsGoalEurPerMonth === "number" ? evaluation.criteria.requirements.savingsGoalEurPerMonth : null;
  return (
    <SisuCard testId="project.housingDetails">
      {evaluation ? (
        <>
          <Disclosure label="Listings that fit" count={fitting.length} testId="project.fit">
            {fitting.length ? fitting.map((one) => <ListingCard key={one.key} one={one} heading={one.verdict === "fits" ? "Meets every requirement" : "Needs checking"} savingsGoal={goal} />)
              : <p className="sisu-project-muted">None of the listings last read fits the requirements.</p>}
          </Disclosure>
          <Disclosure label="Excluded and why" count={evaluation.excluded.length} testId="project.excluded">
            <ExcludedList excluded={evaluation.excluded} />
          </Disclosure>
          <Disclosure label="Show the maths" testId="project.maths">
            <MathsList steps={evaluation.maths} assumptions={evaluation.assumptions} reasoning={evaluation.rule} />
          </Disclosure>
        </>
      ) : null}
      <Disclosure label="Context.dev monitoring" count={watch.pages.length} testId="project.contextdev">
        <p className="sisu-project-muted">Context.dev watches each page and reports when it changes. Sisu then reads the page again and checks every listing against your requirements in code.</p>
        {watch.pages.map((page) => <MonitoredPage key={page.url ?? ""} page={page} />)}
        <p className="sisu-project-subhead">What changes did to this project</p>
        {changes.length ? changes.map((change) => (
          <div key={change.notificationId} className="sisu-housing-change" data-simulated={change.simulated ? "true" : "false"}>
            <div className="sisu-project-chips">
              {change.simulated ? <Chip tone="simulated">Simulated update</Chip> : <Chip tone="plain">{change.detectedBy}</Chip>}
              <span className="sisu-project-muted">{HousingText.time(change.detectedAt)}</span>
            </div>
            <span className="sisu-project-label">{change.line}</span>
            {change.simulated ? <span className="sisu-project-muted">Made up by the demo button: the page did not really change.</span> : null}
          </div>
        )) : <p className="sisu-project-muted">No change has been found yet.</p>}
      </Disclosure>
      {research ? (
        <Disclosure label="Exa research" count={research.sources.length} testId="project.exa">
          <p className="sisu-project-muted">Exa found the listing pages for the query below. Context.dev read the rent, size, rooms and district from each, and Sisu compared those facts with each requirement.</p>
          <ResearchSources research={research} />
          {evaluation ? (
            <>
              <p className="sisu-project-subhead">Facts compared with your requirements</p>
              <RequirementTable evaluation={evaluation} />
            </>
          ) : null}
        </Disclosure>
      ) : null}
    </SisuCard>
  );
}

function MonitoredPage({ page }: { page: WatchedPage }) {
  const change = page.lastChange && typeof page.lastChange.title === "string" ? page.lastChange : null;
  const lastCheck = page.monitorLastRunAt ?? page.lastReadAt ?? null;
  return (
    <div className="sisu-project-field">
      <span className="sisu-project-label">{page.url ? hostOf(page.url) : "A page"}</span>
      <span className="sisu-project-muted">{page.monitorId ? `Context.dev monitor ${page.monitorId}` : "No monitor: Sisu re-reads the page itself"}</span>
      <span className="sisu-project-muted">{`Last check ${HousingText.time(lastCheck)} · next ${page.monitorId ? HousingText.time(page.monitorNextRunAt) : "when the app checks in"}`}</span>
      {change ? (
        <span className="sisu-project-muted">{`${change.simulated === true ? "Simulated update: " : "Latest change: "}${String(change.title)}${typeof change.summary === "string" ? `. ${change.summary}` : ""} (${HousingText.time(typeof change.detectedAt === "string" ? change.detectedAt : null)})`}</span>
      ) : page.lastChangeAt ? <span className="sisu-project-muted">{`Latest change reported ${HousingText.time(page.lastChangeAt)}`}</span> : <span className="sisu-project-muted">No change reported yet.</span>}
      {page.lastError ? <span className="sisu-project-muted">{`Last read failed: ${page.lastError}`}</span> : null}
    </div>
  );
}
