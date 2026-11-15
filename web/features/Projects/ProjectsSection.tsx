"use client";
// The saved projects (watches) in the Sisu tab's history drawer: each with its goal, status, last successful check
// and unread findings. Tapping one opens it (`onOpen(id)`, the drawer calls `AppModel.setOpenProjectId`). No heading
// of its own: the drawer's "Saved projects" heading names it. When the list fails to load it says so, offers Retry
// and keeps the hint on how to start one.
import { ProjectStore } from "@/web/app/ProjectStore";
import { projectStatusOf } from "@/web/core/WatchModels";
import { Chip } from "./ProjectParts";
import { ProjectText } from "./ProjectPresenter";
import { useProjects } from "./useProjects";
import "./projects.css";

export interface ProjectsSectionProps {
  /** A project (a watch id) was tapped: open it (`AppModel.setOpenProjectId`). */
  onOpen: (id: string) => void;
}

const HINT = "Ask Sisu to keep an eye on something, like homes in Espoo under €900.";
const EMPTY = `No projects yet. ${HINT}`;
/** The list itself did not load (a check failure is the project view's to show, not the drawer's). */
const LIST_FAILED = "Sisu could not load your projects.";

export function ProjectsSection({ onOpen }: ProjectsSectionProps) {
  const { store, state } = useProjects();
  const watches = state?.watches ?? [];
  // Running projects first, then the stopped ones; newest first within each.
  const ordered = [...watches].sort((a, b) =>
    Number(projectStatusOf(a) === "stopped") - Number(projectStatusOf(b) === "stopped") || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return (
    <div className="sisu-project-section" data-testid="projects.section">
      {state?.loading && state.loaded && ordered.length > 0 ? <span className="sisu-project-muted" role="status">Updating…</span> : null}
      {!state || !state.loaded ? <p className="sisu-project-muted" role="status">Loading projects…</p> : null}
      {state?.listFailed ? (
        <div className="sisu-project-failed" data-testid="projects.failed">
          <p className="sisu-project-error" role="alert">{LIST_FAILED}</p>
          {/* Not disabled while it runs (focus would drop off it); a second press waits for the first load. */}
          <button type="button" className="sisu-project-small" aria-busy={state.loading || undefined} onClick={() => void store?.load()}
            data-testid="projects.retry">{state.loading ? "Retrying…" : "Retry"}</button>
        </div>
      ) : null}
      {/* Without a list, "No projects yet" is not known: only the hint stays. */}
      {state?.loaded && ordered.length === 0 ? <p className="sisu-project-muted">{state.listFailed ? HINT : EMPTY}</p> : null}
      {ordered.length > 0 ? (
        <ul className="sisu-project-list">
          {ordered.map((watch) => {
            const status = ProjectText.status(watch);
            const unread = state ? ProjectStore.unreadCount(state, watch.id) : 0;
            const last = ProjectText.lastSuccess(watch);
            const title = ProjectText.title(watch);
            const label = [title, status.label, unread ? `${unread} new finding${unread === 1 ? "" : "s"}` : null].filter(Boolean).join(", ");
            return (
              <li key={watch.id}>
                <button type="button" className="sisu-project-item" onClick={() => onOpen(watch.id)} aria-label={label}
                  data-testid={`project.row.${watch.id}`}>
                  <span className="sisu-project-item-title">{title}</span>
                  <span className="sisu-project-item-meta">
                    <Chip tone={status.tone}>{status.label}</Chip>
                    <span>{last ? `Last checked ${ProjectText.when(last)}` : "Not checked yet"}</span>
                  </span>
                  {unread > 0 ? <span className="sisu-project-badge" aria-hidden="true">{unread}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
