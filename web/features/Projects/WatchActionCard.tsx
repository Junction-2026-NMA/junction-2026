"use client";
// The approval card of a watch (property_watch, price_watch): Sisu proposes a project, and nothing starts until the
// user taps Approve. It shows the requirements, the pages, what was read today and how often the pages are really
// checked. Approving starts a real watch, so it never says "simulated" or "€X freed". After approval the project
// list is refreshed and the card offers "Open project".
import { useEffect, useRef } from "react";
import { useAppModel, useCoach, useCoachDataTag, useCoachStore } from "@/web/app/AppProvider";
import { ActionStatus, type AgentAction } from "@/web/core/CoachModels";
import { Dates } from "@/web/core/Presentation";
import { isWatchKind, WatchPlan } from "@/web/core/WatchModels";
import { SisuButton, SisuCard } from "@/web/shared/SisuStyle";
import { Chip, ExternalLink, Note, Rows } from "./ProjectParts";
import { ProjectText } from "./ProjectPresenter";
import { useProjects } from "./useProjects";
import "./projects.css";

export interface WatchActionCardProps {
  /** A `property_watch` or `price_watch` action. Read `action.watch` with `WatchPlan.decode`. */
  action: AgentAction;
}

/** Whether `WatchActionCard` draws this action: every watch action (it always renders something for them). */
export function showsWatchCard(action: AgentAction): boolean {
  return isWatchKind(action.kind);
}

const factValue = (action: AgentAction, id: string): number | null => action.facts.find((f) => f.id === id)?.value ?? null;

export function WatchActionCard({ action }: WatchActionCardProps) {
  const model = useAppModel();
  const coachStore = useCoachStore();
  const coach = useCoach();
  const dataTag = useCoachDataTag();
  const { store, state } = useProjects();
  const plan = WatchPlan.decode(action.watch) ?? { urls: [], seen: [], city: null, topic: null, budgetEur: action.monthlyAmountEur || null };
  const rent = action.kind === "property_watch";
  const status = action.status;
  const waiting = status === ActionStatus.awaitingApproval;
  const approved = status === ActionStatus.executedSimulated || status === "executed";
  const busy = coach.deciding.includes(action.id);
  const notice = coach.decisionNotices[action.id];
  const project = state?.watches.find((w) => w.actionId === action.id) ?? null;
  const inFlight = useRef(false);

  // An approved card (also one reloaded later) looks for its project once.
  const asked = useRef(false);
  useEffect(() => {
    if (!approved || project || !store || asked.current) return;
    asked.current = true;
    void store.load();
  }, [approved, project, store]);

  const decide = (approve: boolean) => {
    if (inFlight.current || busy) return;
    inFlight.current = true;
    void coachStore.decide(action.id, approve)
      .then((decided) => (approve && decided ? store?.load() : undefined))
      .finally(() => { inFlight.current = false; });
  };
  const openProject = (id: string) => {
    model.setHistoryOpen(false);
    model.setTab("sisu");
    model.setOpenProjectId(id);
  };

  const read = factValue(action, "watch:read");
  const fitting = factValue(action, "watch:fitting");
  const things = rent ? "homes" : "offers";
  const readLine = read !== null && fitting !== null
    ? `Sisu read ${read} ${read === 1 ? (rent ? "home" : "offer") : things} on these pages today. ${fitting === 0 ? "None fit yet." : `${fitting} fit${fitting === 1 ? "s" : ""} now.`}`
    : null;
  const sources = ProjectText.planSources(plan, action.sources);
  const question = rent
    ? "Would you like me to keep checking for homes that match these requirements?"
    : "Would you like me to keep checking for offers that match these requirements?";

  return (
    <SisuCard className="sisu-project-enter">
      <div className="sisu-project-chips" data-testid="watch.card">
        <Chip tone="plain">{approved ? "Project" : "Project proposal"}</Chip>
        {dataTag ? <Chip tone="attention">{`${dataTag}: nothing on the web is watched`}</Chip> : null}
      </div>
      <h2 className="sisu-project-h2">{approved ? ProjectText.title(plan) : question}</h2>
      {readLine ? <p className="sisu-project-body">{readLine}</p> : null}
      {action.warning ? <Note title={action.warning} /> : null}
      <p className="sisu-project-subhead">Requirements</p>
      <Rows rows={ProjectText.requirements(plan)} />
      {sources.length > 0 ? (
        <>
          <p className="sisu-project-subhead">Pages to watch</p>
          <ul className="sisu-project-links">
            {sources.map((source) => <li key={source.url}><ExternalLink url={source.url}>{source.title}</ExternalLink></li>)}
          </ul>
        </>
      ) : null}
      <p className="sisu-project-muted">
        {/* Example data starts no Context.dev monitor (the server says so), so it never promises one. */}
        {dataTag
          ? "Sisu re-reads these pages itself when you open the app and shows matches in the project. Nothing checks them while the app is closed."
          : `Context.dev re-checks these pages about every 6 hours. Sisu reviews the changes ${state?.scheduler ? "once a day on its server and " : ""}when you open the app and shows matches in the project.`}
        {" "}{rent ? "Nothing is rented or paid, and no landlord is contacted." : "Nothing is bought or paid, and no seller is contacted."}
      </p>

      {waiting ? (
        <>
          <SisuButton label="Approve" style="primary" enabled={!busy} loading={busy} action={() => decide(true)} />
          <SisuButton label="Not now" style="secondary" enabled={!busy} action={() => decide(false)} />
          <p className="sisu-project-muted">{`You can stop it at any time. Valid until ${Dates.shortDateTime(action.expiresAt, "en")}.`}</p>
        </>
      ) : null}
      {approved ? (
        <>
          <p className="sisu-project-body" role="status">{project ? "The project is set up." : "Setting up the project…"}</p>
          {action.confirmation ? <p className="sisu-project-muted">{action.confirmation}</p> : null}
          {project ? <SisuButton label="Open project" style="primary" action={() => openProject(project.id)} /> : null}
          {!project && state?.loaded && !state.loading ? (
            <p className="sisu-project-muted">The project list does not show it yet. Open the chat history to find it.</p>
          ) : null}
        </>
      ) : null}
      {status === ActionStatus.declined ? <p className="sisu-project-body" role="status">Not started. Nothing is being watched.</p> : null}
      {status === "expired" ? <p className="sisu-project-body" role="status">This proposal has expired. Ask Sisu again to set it up.</p> : null}
      {notice ? <p className="sisu-project-error" role="alert">{notice}</p> : null}
    </SisuCard>
  );
}
