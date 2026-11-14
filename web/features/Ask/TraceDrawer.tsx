"use client";
// "How Sisu worked this out": the tool calls of a finished answer, its sources with their retrieval time and the
// answer's timing. Port of TraceDrawer in AskCards.swift (a DisclosureGroup, closed at first).
import { useId, useState } from "react";
import { CoachText, ToolPresenter } from "@/web/core/CoachPresentation";
import type { CoachMessage } from "@/web/core/CoachSession";
import { useReducedMotion } from "@/web/theme/motion";
import { SisuMotion } from "@/web/shared/SisuStyle";
import { Footnote, SourceLink } from "./CardParts";

const language = "en";

export function TraceDrawer({ message }: { message: CoachMessage }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const panelId = useId();
  return (
    <div className="sisu-ask-drawer">
      <button type="button" className="sisu-ask-drawer-label" aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen((was) => !was)} data-testid="ask.trace">
        <span className="sisu-ask-label sisu-ask-primary">How Sisu worked this out</span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div id={panelId} className={`sisu-ask-drawer-body ${SisuMotion.entrance(reduceMotion)}`}>
          {message.tools.map((trace) => {
            const row = ToolPresenter.row(trace, language);
            return (
              <div key={trace.id} className="sisu-ask-tool">
                <div className="sisu-ask-tool-top">
                  <span className="sisu-ask-label">{row.name}</span>
                  <span className="sisu-ask-caption sisu-ask-muted">{row.duration}</span>
                </div>
                <span className="sisu-ask-caption">{row.summary}</span>
                <span className="sisu-ask-caption sisu-ask-muted">{row.source + (row.ok ? "" : " · did not finish")}</span>
              </div>
            );
          })}
          {message.citations.length > 0 ? (
            <>
              <span className="sisu-ask-label">Sources</span>
              {message.citations.map((citation) => (
                <div key={citation.url} className="sisu-ask-source-block">
                  <SourceLink title={citation.title} url={citation.url} />
                  <Footnote text={CoachText.fetched(citation.retrievedAt, language)} />
                </div>
              ))}
            </>
          ) : null}
          {message.timings ? <Footnote text={ToolPresenter.timingLine(message.timings, language)} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** The disclosure chevron: points right when closed, down when open. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg className="sisu-ask-chevron" data-open={open ? "true" : "false"} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M5 2.5 9.5 7 5 11.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
