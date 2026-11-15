"use client";
// Small pieces shared by the answer cards: the stage header, label/value lines, footnotes, the amber note, the
// assumptions list, source links and the memory line. Port of the private views of ios/Sisu/Features/Ask/AskCards.swift.
import type { CardLine, StageCard } from "@/web/core/CoachPresentation";
import { Eyebrow, SisuCard } from "@/web/shared/SisuStyle";
import "./cards.css";

/** The eyebrow, the title (when it says more than the eyebrow) and the summary (when no line repeats it). */
export function StageHeader({ eyebrow, card, showSummary = true }: { eyebrow: string; card: StageCard; showSummary?: boolean }) {
  const title = card.title !== "" && card.title !== eyebrow ? card.title : null;
  const summary = showSummary && card.summary !== "" && !card.lines.some((line) => line.label === card.summary) && card.summary !== card.title
    ? card.summary : null;
  return (
    <div className="sisu-ask-stage-header">
      <Eyebrow text={eyebrow} />
      {title ? <h3 className="sisu-ask-h3">{title}</h3> : null}
      {summary ? <p className="sisu-ask-body">{summary}</p> : null}
    </div>
  );
}

/** Label on the left, value on the right, detail under the label. */
export function LinesView({ lines }: { lines: CardLine[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="sisu-ask-lines">
      {lines.map((line, index) => (
        <div className="sisu-ask-line" key={index}>
          <div className="sisu-ask-line-text">
            <span className="sisu-ask-body">{line.label}</span>
            {line.detail ? <span className="sisu-ask-caption sisu-ask-muted">{line.detail}</span> : null}
          </div>
          {line.value != null ? <span className="sisu-ask-label sisu-ask-line-value">{line.value}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function Footnote({ text, ariaLabel }: { text: string; ariaLabel?: string }) {
  return <p className="sisu-ask-caption sisu-ask-muted" aria-label={ariaLabel}>{text}</p>;
}

/** A heads-up note (amber), with optional detail lines. */
export function Note({ text, lines = [] }: { text: string; lines?: string[] }) {
  return (
    <div className="sisu-ask-note" role="note">
      <span className="sisu-ask-label">{text}</span>
      {lines.map((line, index) => <span className="sisu-ask-caption" key={index}>{line}</span>)}
    </div>
  );
}

export function Assumptions({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="sisu-ask-assumptions">
      <span className="sisu-ask-label">Assumptions</span>
      {items.map((item, index) => <span className="sisu-ask-caption sisu-ask-muted" key={index}>{"· " + item}</span>)}
    </div>
  );
}

/** A thin divider in neutral200. */
export function Divider() {
  return <div className="sisu-ask-divider" role="separator" />;
}

/** The address as an http(s) link, or null (nothing else is ever made a link). */
export function validURL(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** The page title in green and its address under it, cut in the middle when it does not fit. Opens the page. */
export function SourceLink({ title, url }: { title: string; url: string }) {
  const href = validURL(url);
  const tailLength = Math.min(18, Math.floor(url.length / 2));
  const head = url.slice(0, url.length - tailLength);
  const tail = url.slice(url.length - tailLength);
  const label = (
    <>
      <span className="sisu-ask-label sisu-ask-source-title">{title}</span>
      <span className="sisu-ask-caption sisu-ask-muted sisu-ask-source-url" aria-hidden="true">
        <span className="sisu-ask-source-head">{head}</span>
        <span className="sisu-ask-source-tail">{tail}</span>
      </span>
    </>
  );
  return href
    ? <a className="sisu-ask-source" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${title}, ${url}`}>{label}</a>
    : <div className="sisu-ask-source" aria-label={`${title}, ${url}`}>{label}</div>;
}

export function MemoryLine({ text }: { text: string }) {
  return <p className="sisu-ask-body">{`Sisu will remember: ${text}`}</p>;
}

export function MemoryCard({ text }: { text: string }) {
  return (
    <SisuCard>
      <Eyebrow text="Memory" />
      <MemoryLine text={text} />
    </SisuCard>
  );
}
