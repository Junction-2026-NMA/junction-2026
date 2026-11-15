"use client";
// The confirmation before a project starts ("Make this a project" on the watch card): every requirement carried
// from the conversation, the one notification rule ("Notify me when a match is found"), how often Sisu really
// checks, and the phone-notification switch. Approve is the approval click.
// Updated server: POST /api/watch/create with fromActionId; the search, the first check and the notification run on
// Sisu's server, so the person can close the app. Old server: the existing approve route of the action.
import { useState } from "react";
import type { ProjectStore, ProjectsState } from "@/web/app/ProjectStore";
import type { AgentAction } from "@/web/core/CoachModels";
import { monitorUntil } from "@/web/core/ProjectCreate";
import type { WatchPlan } from "@/web/core/WatchModels";
import { SisuButton } from "@/web/shared/SisuStyle";
import { Rows } from "./ProjectParts";
import { CheckFrequency, confirmRows } from "./ProjectJourney";
import { ProjectText } from "./ProjectPresenter";
import { PushControl } from "./PushControl";

const numOf = (o: Readonly<Record<string, unknown>> | null | undefined, key: string): number | null =>
  o && typeof o[key] === "number" && Number.isFinite(o[key]) ? (o[key] as number) : null;

export function ProjectConfirm({ action, plan, store, state, approveOld, busyOld, onStarted, onBack }: {
  action: AgentAction;
  plan: WatchPlan;
  store: ProjectStore;
  state: ProjectsState;
  /** The existing approve route (old server). */
  approveOld: () => void;
  busyOld: boolean;
  onStarted: (watchId: string) => void;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = confirmRows(plan);
  const missingCity = !plan.city;
  const missingBudget = plan.budgetEur == null;

  const approve = async () => {
    if (!store.updated) return approveOld();
    if (missingCity || missingBudget) {
      setError("Tell Sisu the location and the most you would pay a month, then try again.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await store.create({
      customerId: state.customerId, confirm: true, goal: plan.goal?.trim() || ProjectText.title(plan), city: plan.city ?? "",
      budgetEur: plan.budgetEur ?? 0, minRooms: plan.minRooms ?? null, minAreaM2: numOf(plan.requirements, "minAreaM2"),
      requirements: plan.requirements ?? {}, schedule: { notify: "on_match", monitorUntil: monitorUntil() },
      fromActionId: action.id, fromConversation: true,
    });
    setBusy(false);
    if ("id" in result) onStarted(result.id);
    else setError(result.error);
  };

  return (
    <div className="sisu-psetup" data-testid="project.confirm">
      <p className="sisu-project-subhead">Confirm your project</p>
      <p className="sisu-project-muted">These come from your conversation. You can change them in the project later.</p>
      <Rows rows={rows} />
      <div className="sisu-psetup-rule">
        <p className="sisu-project-label">Notifications</p>
        <p className="sisu-project-body" data-testid="project.confirm.notify">{CheckFrequency.notifyLine}</p>
        <p className="sisu-project-muted" data-testid="project.confirm.frequency">{CheckFrequency.text(state.schedulerInfo)}</p>
      </div>
      <PushControl store={store} state={state} />
      <p className="sisu-project-muted">Nothing is rented or paid, no landlord is contacted and no money is moved. You can stop it at any time.</p>
      <SisuButton label="Approve and start" style="primary" enabled={!busy && !busyOld} loading={busy || busyOld} action={() => void approve()} />
      <SisuButton label="Back" style="secondary" enabled={!busy} action={onBack} />
      {error ? <p className="sisu-project-error" role="alert">{error}</p> : null}
    </div>
  );
}
