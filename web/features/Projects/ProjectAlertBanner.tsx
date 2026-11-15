"use client";
// The in-app fallback for phone notifications: the newest unread alert of a project, as a slim banner at the top of
// the app (from the store's 60 s polling). Tapping it opens the project at that finding; "Simulated for demo" alerts
// say so. It shows whether or not phone notifications are on, so nothing is missed when they are off.
import { useAppModel } from "@/web/app/AppProvider";
import { AlertRules } from "./ProjectJourney";
import { useProjects } from "./useProjects";
import "./project-alerts.css";

export function ProjectAlertBanner() {
  const model = useAppModel();
  const { store, state } = useProjects();
  if (!store || !state) return null;
  const alert = AlertRules.unread(state.alerts, state.seenAlerts)[0];
  if (!alert) return null;
  const open = () => {
    model.setTab("sisu");
    model.setHistoryOpen(false);
    model.setOpenProjectId(alert.watchId);
    store.focusFinding(alert.watchId, alert.findingIds[0] ?? null);
  };
  return (
    <div className="sisu-palert" role="status" data-testid="project.alertBanner">
      <button type="button" className="sisu-palert-button" onClick={open}>
        <span className="sisu-palert-text">{alert.body}</span>
        {alert.simulated ? <span className="sisu-palert-tag">{AlertRules.simulatedLabel}</span> : null}
        <span className="sisu-palert-open">Open</span>
      </button>
    </div>
  );
}
