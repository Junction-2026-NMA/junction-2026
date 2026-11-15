"use client";
// One project (a watch), shown in place of the conversation on the Sisu tab: its goal and status, the checks (last
// successful, next, said honestly), the requirements, the pages watched, the findings, and the controls (pause or
// resume when the server has them, stop after a confirmation, check now). Opening it marks its findings seen.
import { useEffect, useState } from "react";
import { useCoachDataTag } from "@/web/app/AppProvider";
import { ProjectStore, type ProjectsState } from "@/web/app/ProjectStore";
import { type PropertyWatch, PriceUnit, projectStatusOf } from "@/web/core/WatchModels";
import { Screen, ScreenStack } from "@/web/shared/Screen";
import { prefersReducedMotion } from "@/web/theme/motion";
import { SisuCard } from "@/web/shared/SisuStyle";
import { Chevron, Chip, ExternalLink, Note } from "./ProjectParts";
import { ProjectFindings } from "./ProjectFindings";
import { ProjectRequirements } from "./ProjectRequirements";
import { ProjectText } from "./ProjectPresenter";
import { useProjects } from "./useProjects";
import "./projects.css";

export interface ProjectScreenProps {
  /** The watch id (`PropertyWatch.id`). */
  id: string;
  onClose: () => void;
}

export function ProjectScreen({ id, onClose }: ProjectScreenProps) {
  const { store, state } = useProjects();
  const watch = state?.watches.find((w) => w.id === id) ?? null;
  const fresh = useFreshFindings(store, state, id);

  const header = (
    <div className="sisu-project-top">
      <button type="button" className="sisu-project-back" onClick={onClose} data-testid="project.back"><Chevron left />Back</button>
    </div>
  );

  return (
    <Screen testId="project.screen" header={header}>
      <ScreenStack>
        {!state || !store || (!state.loaded && !watch) ? <SisuCard><p className="sisu-project-muted" role="status">Loading the project…</p></SisuCard> : null}
        {state && store && state.loaded && !watch ? (
          <SisuCard>
            <h1 className="sisu-project-h1">Project not found</h1>
            <p className="sisu-project-body">It may have been removed, or it belongs to another customer.</p>
            {state.error ? <p className="sisu-project-error" role="alert">{state.error}</p> : null}
          </SisuCard>
        ) : null}
        {state && store && watch ? <ProjectBody watch={watch} store={store} state={state} fresh={fresh} /> : null}
      </ScreenStack>
    </Screen>
  );
}

/** Opening the project marks its findings seen; those that were unread keep a "New" mark while it is open.
 *  Findings that arrive while it is open are marked the same way. */
function useFreshFindings(store: ProjectStore | null, state: ProjectsState | null, id: string): ReadonlySet<string> {
  const loaded = state?.loaded ?? false;
  const unread = state ? ProjectStore.unreadCount(state, id) : 0;
  useEffect(() => {
    if (store && loaded) void store.markRead(id, true);
  }, [store, loaded, id]);
  useEffect(() => {
    if (store && loaded && unread > 0) void store.markRead(id);
  }, [store, loaded, unread, id]);
  return new Set(state?.fresh[id] ?? []);
}

function ProjectBody({ watch, store, state, fresh }: { watch: PropertyWatch; store: ProjectStore; state: ProjectsState; fresh: ReadonlySet<string> }) {
  const status = ProjectText.status(watch);
  const rent = watch.priceUnit === PriceUnit.perMonth || (!watch.priceUnit && !watch.topic);
  const findings = ProjectStore.findingsOf(state, watch.id);
  const last = ProjectText.lastSuccess(watch);
  const sources = ProjectText.sources(watch);
  const problems = [...watch.problems, ...(status.tone === "attention" ? state.checkProblems : [])];
  const dataTag = useCoachDataTag();

  return (
    <>
      <SisuCard className="sisu-project-head">
        <span className="sisu-project-label">Project</span>
        <h1 className="sisu-project-h1">{ProjectText.title(watch)}</h1>
        <div className="sisu-project-chips"><Chip tone={status.tone}>{status.label}</Chip>
          {dataTag ? <Chip tone="attention">{`${dataTag}: nothing on the web is watched`}</Chip> : null}
          {findings.length ? <Chip tone="plain">{`${findings.length} finding${findings.length === 1 ? "" : "s"}`}</Chip> : null}
        </div>
        {problems.length > 0 ? <Note title={status.tone === "attention" ? "What needs attention" : "Good to know"} lines={[...new Set(problems)]} /> : null}
      </SisuCard>

      <SisuCard>
        <h2 className="sisu-project-h2">Checks</h2>
        <dl className="sisu-project-rows">
          <div className="sisu-project-row-line"><dt>Last successful check</dt><dd>{last ? ProjectText.when(last) : "Not yet"}</dd></div>
          {state.lastCheckAt ? <div className="sisu-project-row-line"><dt>Reviewed by Sisu</dt><dd>{ProjectText.when(state.lastCheckAt)}</dd></div> : null}
        </dl>
        <p className="sisu-project-muted">{ProjectText.schedule(watch, state.scheduler)}</p>
        {state.error ? <p className="sisu-project-error" role="alert">{state.error}</p> : null}
      </SisuCard>

      <ProjectRequirements watch={watch} store={store} canEdit={state.support.update} />

      <SisuCard>
        <h2 className="sisu-project-h2">Pages watched</h2>
        {sources.length === 0 ? <p className="sisu-project-muted">No page is watched.</p> : (
          <ul className="sisu-project-links">
            {sources.map((source) => (
              <li key={source.url}>
                <ExternalLink url={source.url}>{source.title}</ExternalLink>
                {source.detail ? <p className="sisu-project-muted">{source.detail}</p> : null}
                {source.problem ? <p className="sisu-project-muted">{`Last read failed: ${source.problem}`}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </SisuCard>

      <h2 className="sisu-project-section-title">Findings</h2>
      <ProjectFindings findings={findings} rent={rent} fresh={fresh} />

      <ProjectControls watch={watch} store={store} state={state} />
    </>
  );
}

function ProjectControls({ watch, store, state }: { watch: PropertyWatch; store: ProjectStore; state: ProjectsState }) {
  const [confirming, setConfirming] = useState(false);
  const busy = state.busy[watch.id] ?? null;
  const notice = state.notices[watch.id] ?? null;
  const stopped = projectStatusOf(watch) === "stopped";
  const paused = projectStatusOf(watch) === "paused";
  const live = store.isLive;

  if (stopped) {
    return (
      <SisuCard>
        <p className="sisu-project-body">This project is stopped. Its pages are no longer watched.</p>
        <p className="sisu-project-muted">To start again, ask Sisu in the conversation.</p>
      </SisuCard>
    );
  }
  return (
    <SisuCard>
      <h2 className="sisu-project-h2">Controls</h2>
      {!live ? <p className="sisu-project-muted">Projects need the live server. The sample data has none.</p> : null}
      <div className="sisu-project-actions">
        {!paused ? (
          <button type="button" className="sisu-project-small" data-kind="primary" disabled={!live || busy !== null || state.checking}
            onClick={() => void store.checkNow(watch.id)} data-testid="project.checkNow">
            {busy === "check" || state.checking ? "Checking…" : "Check now"}
          </button>
        ) : null}
        {paused && state.support.resume ? (
          <button type="button" className="sisu-project-small" data-kind="primary" disabled={busy !== null} onClick={() => void store.resume(watch.id)}>
            {busy === "resume" ? "Resuming…" : "Resume"}
          </button>
        ) : null}
        {!paused && state.support.pause ? (
          <button type="button" className="sisu-project-small" disabled={busy !== null} onClick={() => void store.pause(watch.id)}>
            {busy === "pause" ? "Pausing…" : "Pause"}
          </button>
        ) : null}
        {!confirming ? (
          <button type="button" className="sisu-project-small" data-kind="danger" disabled={!live || busy !== null}
            onClick={() => setConfirming(true)} data-testid="project.stop">Stop project</button>
        ) : null}
      </div>
      {busy === "check" || state.checking ? (
        <p className="sisu-project-muted" role="status">Asking Context.dev to read the pages again. New results can take a few minutes to show.</p>
      ) : null}
      {confirming ? (
        <div className="sisu-project-confirm" role="alertdialog" aria-label="Stop this project?"
          ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" })}>
          <p>Stop this project? Its pages stop being watched and their monitors are removed. Findings so far stay here.</p>
          <div className="sisu-project-actions">
            <button type="button" className="sisu-project-small" data-kind="danger" disabled={busy !== null} data-testid="project.stopConfirm"
              onClick={() => void store.stop(watch.id).then(() => setConfirming(false))}>{busy === "stop" ? "Stopping…" : "Stop watching"}</button>
            <button type="button" className="sisu-project-small" onClick={() => setConfirming(false)}>Keep it</button>
          </div>
        </div>
      ) : null}
      {notice ? <p className="sisu-project-error" role="alert">{notice}</p> : null}
    </SisuCard>
  );
}
