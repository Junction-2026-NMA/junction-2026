"use client";
// The saved projects (watches) in the Sisu tab's history drawer: each with its goal, status, last successful check
// and unread findings. Tapping one opens it (`onOpen(id)`, the drawer calls `AppModel.setOpenProjectId`).
import { ProjectStore } from "@/web/app/ProjectStore";
import { Chip } from "./ProjectParts";
import { ProjectText } from "./ProjectPresenter";
import { useProjects } from "./useProjects";
import "./projects.css";

export interface ProjectsSectionProps {
  /** A project (a watch id) was tapped: open it (`AppModel.setOpenProjectId`). */
  onOpen: (id: string) => void;
}

const EMPTY = "No projects yet. Ask Sisu to keep an eye on something, like homes in Espoo under €900.";

export function ProjectsSection({ onOpen }: ProjectsSectionProps) {
  const { state } = useProjects();
  const watches = state?.watches ?? [];
  // Running projects first, then the stopped ones; newest first within each.
  const ordered = [...watches].sort((a, b) =>
    Number(a.status === "stopped") - Number(b.status === "stopped") || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return (
    <section className="sisu-project-section" aria-labelledby="sisu-projects-title" data-testid="projects.section">
      <div className="sisu-project-section-head">
        <h2 id="sisu-projects-title" className="sisu-project-h2">Projects</h2>
        {state?.loading && state.loaded ? <span className="sisu-project-muted" role="status">Updating…</span> : null}
      </div>
      {!state || !state.loaded ? <p className="sisu-project-muted" role="status">Loading projects…</p> : null}
      {state?.loaded && ordered.length === 0 && !state.error ? <p className="sisu-project-muted">{EMPTY}</p> : null}
      {state?.error ? <p className="sisu-project-error" role="alert">{state.error}</p> : null}
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
    </section>
  );
}
