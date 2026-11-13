import type { ReactNode } from "react";
import type { BasketId, Confidence } from "@/lib/types";

export const BASKET_COLOR: Record<BasketId, string> = {
  regular: "var(--green)",
  irregular: "var(--amber)",
  everyday: "var(--coral)",
};

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-card border border-line p-5 fade-in ${className}`}>{children}</section>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{children}</p>;
}

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: "bg-green-soft text-green",
  medium: "bg-amber/15 text-[#8a5f08]",
  low: "bg-coral/15 text-coral",
};

export function ConfidenceChip({ level }: { level: Confidence }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CONFIDENCE_STYLE[level]}`}>
      {level} confidence
    </span>
  );
}

export function EvidenceButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-green underline decoration-green/30 underline-offset-4"
    >
      {children} <span aria-hidden>→</span>
    </button>
  );
}
