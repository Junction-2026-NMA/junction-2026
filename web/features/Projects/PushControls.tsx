"use client";
// Notifications (v2 push): whether this phone gets them, the "Turn on notifications" button (it asks for the
// permission from the tap itself) and "Send a test notification". Shown in Settings and on a project.
import { PushText, enablePush, testPush, usePush } from "@/web/app/Push";
import "./ProjectMonitoringStatus.css";

export function PushControls({ baseURL, customerId, projectId = null }: { baseURL: string; customerId: string | null; projectId?: string | null }) {
  const push = usePush(baseURL);
  const canEnable = !!customerId && (push.status === "off" || push.status === "checking");
  return (
    <div className="sisu-monitor-push" data-testid="push.controls">
      <div className="sisu-monitor-line">
        <span className="sisu-monitor-label">Notifications</span>
        <span className="sisu-monitor-value" data-status={push.status} data-testid="push.status">{PushText[push.status]}</span>
      </div>
      {push.status === "homeScreen" ? <p className="sisu-monitor-muted">iPhone shows notifications only for the Sisu app on your Home Screen: Share, then Add to Home Screen, and open it from there.</p> : null}
      {push.status === "blocked" ? <p className="sisu-monitor-muted">Allow notifications for Sisu in the phone&apos;s Settings, then come back.</p> : null}
      {push.status === "on" ? <p className="sisu-monitor-muted">A notification only says that a project has an update. The details stay in the app.</p> : null}
      <div className="sisu-monitor-actions">
        {canEnable ? (
          <button type="button" className="sisu-monitor-button" data-kind="primary" disabled={push.busy}
            onClick={() => { if (customerId) void enablePush(baseURL, customerId); }} data-testid="push.enable">
            {push.busy ? "Turning on…" : "Turn on notifications"}
          </button>
        ) : null}
        {push.status === "on" && customerId ? (
          <button type="button" className="sisu-monitor-button" disabled={push.busy} onClick={() => void testPush(baseURL, customerId, projectId)} data-testid="push.test">
            {push.busy ? "Sending…" : "Send a test notification"}
          </button>
        ) : null}
      </div>
      {push.message ? <p className="sisu-monitor-muted" role="status">{push.message}</p> : null}
    </div>
  );
}
