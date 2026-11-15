"use client";
// A closed-by-default section of an answer ("How this was worked out", "Assumptions", "Sources", the offers):
// a real button with aria-expanded and aria-controls, a panel that grows to its height (grid 0fr to 1fr, the
// state spring; instant under reduced motion) and is inert while closed, so it is neither read out nor tabbed to.
import { useId, useState, type ReactNode } from "react";
import "./answer.css";

export function Disclosure({ label, count, testId, defaultOpen = false, children }: {
  label: string;
  /** Shown after the label, for example the number of assumptions. */
  count?: number | null;
  /** `answer.disclosure.<testId>` on the button. */
  testId: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const buttonId = useId();
  return (
    <div className="sisu-answer-disclosure" data-open={open ? "true" : "false"}>
      <button type="button" id={buttonId} className="sisu-answer-disclosure-button" aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen((was) => !was)} data-testid={`answer.disclosure.${testId}`}>
        <span className="sisu-answer-disclosure-label">
          {label}
          {count != null && count > 0 ? <span className="sisu-answer-count" aria-hidden="true">{count}</span> : null}
        </span>
        <DisclosureChevron open={open} />
      </button>
      <div id={panelId} role="region" aria-labelledby={buttonId} className="sisu-answer-panel" data-open={open ? "true" : "false"} inert={!open}>
        <div className="sisu-answer-panel-clip">
          <div className="sisu-answer-panel-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Points down when closed and up when open. */
export function DisclosureChevron({ open }: { open: boolean }) {
  return (
    <svg className="sisu-answer-chevron" data-open={open ? "true" : "false"} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
