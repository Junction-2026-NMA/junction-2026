"use client";
// A saved unread finding opens its own project and listing. This uses the same visitor-scoped store as the
// project screen; it does not need phone push permission or invent a separate notification.
import { ProjectStore } from "@/web/app/ProjectStore";
import { FindingText } from "./ProjectPresenter";
import { useProjects } from "./useProjects";
import "./projects.css";

export function ProjectNotification({ onOpen }: { onOpen: (watchId: string, findingId: string) => void }) {
  const { state } = useProjects();
  if (!state) return null;
  const finding = state.notifications.find((note) => ProjectStore.isUnread(state, note) && state.watches.some((watch) => watch.id === note.watchId));
  if (!finding?.watchId) return null;
  const title = FindingText.title(finding);
  return (
    <div className="sisu-project-notification" role="status" data-testid="project.notification">
      <button type="button" onClick={() => onOpen(finding.watchId!, finding.id)} aria-label={`Open finding: ${title}`}>
        <span className="sisu-project-label">{FindingText.isSimulated(finding) ? "Simulated monitoring update" : "New project finding"}</span>
        <span className="sisu-project-body">{title}</span>
        <span className="sisu-project-muted">Open finding →</span>
      </button>
    </div>
  );
}
