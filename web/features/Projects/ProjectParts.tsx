"use client";
// Small pieces of the project screens: chips, label/value rows, notes and the page links.
import type { ReactNode } from "react";
import type { ProjectLine } from "./ProjectPresenter";
import "./projects.css";

export type ChipTone = "active" | "paused" | "stopped" | "attention" | "simulated" | "new" | "plain";

export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <span className="sisu-project-chip" data-tone={tone}>{children}</span>;
}

export function Rows({ rows }: { rows: ProjectLine[] }) {
  if (rows.length === 0) return null;
  return (
    <dl className="sisu-project-rows">
      {rows.map((row, index) => (
        <div className="sisu-project-row-line" key={`${row.label}-${index}`}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Note({ title, lines = [] }: { title: string; lines?: readonly string[] }) {
  return (
    <div className="sisu-project-note" role="note">
      <strong>{title}</strong>
      {lines.map((line, index) => <span key={index}>{line}</span>)}
    </div>
  );
}

export function ExternalLink({ url, children }: { url: string; children: ReactNode }) {
  return <a className="sisu-project-link" href={url} target="_blank" rel="noopener noreferrer">{children}</a>;
}

export function Chevron({ left = false }: { left?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ transform: left ? "rotate(180deg)" : undefined }}>
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
