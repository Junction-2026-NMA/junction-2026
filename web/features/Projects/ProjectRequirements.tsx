"use client";
// A project's requirements. Editable only when the server has `PATCH /api/watch/:id` (the store probes it); otherwise
// read-only, with "Ask Sisu to change them", which opens the conversation with that request.
import { useState } from "react";
import { useAppModel } from "@/web/app/AppProvider";
import type { ProjectStore } from "@/web/app/ProjectStore";
import type { PropertyWatch } from "@/web/core/WatchModels";
import { SisuCard } from "@/web/shared/SisuStyle";
import { Rows } from "./ProjectParts";
import { ProjectText } from "./ProjectPresenter";

/** The plain values a person can edit in place (numbers and short texts). */
function editable(watch: PropertyWatch): [string, string][] {
  const base: [string, unknown][] = [["budgetEur", watch.budgetEur], ["minRooms", watch.minRooms], ...Object.entries(watch.requirements ?? {})];
  const seen = new Set<string>();
  return base.flatMap(([key, value]) => {
    if (seen.has(key) || (typeof value !== "number" && typeof value !== "string")) return [];
    seen.add(key);
    return [[key, String(value)]];
  });
}

const FIELD_LABEL: Record<string, string> = { budgetEur: "Rent or price at most (€)", minRooms: "Rooms at least" };

export function ProjectRequirements({ watch, store, canEdit }: { watch: PropertyWatch; store: ProjectStore; canEdit: boolean }) {
  const model = useAppModel();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const rows = ProjectText.requirements(watch);
  const fields = editable(watch);
  const stopped = watch.status === "stopped";
  const busy = store.getSnapshot().busy[watch.id] === "update";

  const askSisu = () => model.askSisu(`I'd like to change the requirements of my project "${ProjectText.title(watch)}".`);
  const save = async () => {
    const original = Object.fromEntries(fields);
    const changed = Object.entries({ ...original, ...draft }).map(([key, text]): [string, unknown] => {
      const wasNumber = typeof (key === "budgetEur" ? watch.budgetEur : key === "minRooms" ? watch.minRooms : watch.requirements?.[key]) === "number";
      const value = wasNumber ? Number(text.replace(",", ".")) : text.trim();
      return [key, wasNumber && !Number.isFinite(value) ? original[key] : value];
    });
    if (await store.updateRequirements(watch.id, { ...(watch.requirements ?? {}), ...Object.fromEntries(changed) })) setEditing(false);
  };

  return (
    <SisuCard>
      <h2 className="sisu-project-h2">Requirements</h2>
      {editing ? (
        <>
          {fields.map(([key, value]) => (
            <div className="sisu-project-field" key={key}>
              <label className="sisu-project-label" htmlFor={`req-${key}`}>{FIELD_LABEL[key] ?? ProjectText.label(key)}</label>
              <input id={`req-${key}`} className="sisu-project-input" defaultValue={value}
                inputMode={/^-?\d/.test(value) ? "decimal" : "text"}
                onChange={(event) => setDraft((d) => ({ ...d, [key]: event.target.value }))} />
            </div>
          ))}
          <div className="sisu-project-actions">
            <button type="button" className="sisu-project-small" data-kind="primary" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save requirements"}
            </button>
            <button type="button" className="sisu-project-small" onClick={() => { setEditing(false); setDraft({}); }}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          {rows.length ? <Rows rows={rows} /> : <p className="sisu-project-muted">No requirements were saved with this project.</p>}
          {!stopped ? (
            <div className="sisu-project-actions">
              {canEdit && fields.length > 0 ? (
                <button type="button" className="sisu-project-small" onClick={() => setEditing(true)}>Edit requirements</button>
              ) : (
                <button type="button" className="sisu-project-small" onClick={askSisu}>Ask Sisu to change them</button>
              )}
            </div>
          ) : null}
        </>
      )}
    </SisuCard>
  );
}
