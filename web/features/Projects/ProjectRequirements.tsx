"use client";
// A project's requirements. Editable when the server has `PATCH /api/watch/:id`: every field the server can change
// is offered (RequirementForm.ts), a value it would refuse is named under its field and Save waits until it is fixed,
// and the server's own refusal shows next to Save. Without the route the requirements are read-only, with a plain
// note on how to change them (no agent tool edits a project, so nothing is sent on the person's behalf).
import { useMemo, useState } from "react";
import { ProjectStore } from "@/web/app/ProjectStore";
import { type PropertyWatch, projectStatusOf } from "@/web/core/WatchModels";
import { SisuCard } from "@/web/shared/SisuStyle";
import { Rows } from "./ProjectParts";
import { ProjectText } from "./ProjectPresenter";
import { type RequirementField, formErrors, requirementFields, requirementPatch } from "./RequirementForm";

export const NO_EDIT_NOTE = "This server cannot edit a project yet. To change the limits, ask Sisu for a new project with the new requirements, then stop this one.";

export interface ProjectRequirementsProps {
  watch: PropertyWatch;
  store: ProjectStore;
  canEdit: boolean;
  rent: boolean;
  /** The server's answer when saving failed. */
  notice: string | null;
  busy: boolean;
}

export function ProjectRequirements({ watch, store, canEdit, rent, notice, busy }: ProjectRequirementsProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const rows = ProjectText.requirements(watch);
  const fields = useMemo(() => requirementFields(watch, rent), [watch, rent]);
  const errors = formErrors(fields, draft, rent);
  const invalid = Object.keys(errors).length > 0;
  const stopped = projectStatusOf(watch) === "stopped";

  const close = () => {
    setEditing(false);
    setDraft({});
    store.dismissNotice(ProjectStore.noticeKey(watch.id, "update"));
  };
  const save = async () => {
    if (invalid || busy) return;
    const patch = requirementPatch(fields, draft);
    if (Object.keys(patch).length === 0) return close();
    if (await store.updateRequirements(watch.id, patch)) close();
  };

  return (
    <SisuCard>
      <h2 className="sisu-project-h2">Requirements</h2>
      {editing ? (
        <form className="sisu-project-form" noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
          {fields.map((field) => (
            <Field key={field.key} field={field} value={draft[field.key] ?? field.initial} error={errors[field.key] ?? null}
              onChange={(text) => setDraft((d) => ({ ...d, [field.key]: text }))} />
          ))}
          <div className="sisu-project-actions">
            <button type="submit" className="sisu-project-small" data-kind="primary" disabled={busy || invalid} data-testid="project.saveRequirements">
              {busy ? "Saving…" : "Save requirements"}
            </button>
            <button type="button" className="sisu-project-small" onClick={close}>Cancel</button>
          </div>
          {invalid ? <p className="sisu-project-muted" role="status">Fix the field marked above to save.</p> : null}
          {notice ? <p className="sisu-project-error" role="alert">{notice}</p> : null}
        </form>
      ) : (
        <>
          {rows.length ? <Rows rows={rows} /> : <p className="sisu-project-muted">No requirements were saved with this project.</p>}
          {stopped ? null : canEdit ? (
            <div className="sisu-project-actions">
              <button type="button" className="sisu-project-small" onClick={() => setEditing(true)} data-testid="project.editRequirements">Edit requirements</button>
            </div>
          ) : <p className="sisu-project-muted">{NO_EDIT_NOTE}</p>}
        </>
      )}
    </SisuCard>
  );
}

function Field({ field, value, error, onChange }: { field: RequirementField; value: string; error: string | null; onChange: (text: string) => void }) {
  const id = `req-${field.key}`;
  // The error replaces the hint (the budget's says the same range).
  const described = error ? `${id}-error` : field.hint ? `${id}-hint` : undefined;
  const numeric = field.kind === "euros" || field.kind === "rooms" || field.kind === "minutes";
  return (
    <div className="sisu-project-field">
      <label className="sisu-project-label" htmlFor={id}>{field.label}</label>
      <input id={id} className="sisu-project-input" value={value} type={field.kind === "date" ? "date" : "text"}
        inputMode={numeric ? (field.kind === "euros" ? "decimal" : "numeric") : undefined} required={field.required}
        aria-invalid={error ? true : undefined} aria-describedby={described} autoComplete="off"
        onChange={(event) => onChange(event.target.value)} />
      {error ? <p className="sisu-project-field-error" id={`${id}-error`}>{error}</p>
        : field.hint ? <p className="sisu-project-muted" id={`${id}-hint`}>{field.hint}</p> : null}
    </div>
  );
}
