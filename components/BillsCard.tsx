"use client";

import { useState } from "react";
import type { EvidenceFilter, Overview } from "@/lib/types";
import { eur } from "@/lib/format";
import { Card, ConfidenceChip, Eyebrow } from "./ui";

const LABEL_CHOICES = ["Electricity", "Home internet", "Mobile plan", "Water", "Insurance", "Streaming", "Something else"];

type Props = { overview: Overview; onEvidence: (title: string, filter: EvidenceFilter) => void };

export function BillsCard({ overview, onEvidence }: Props) {
  // The user's corrections to Sisu's guesses, kept per bill id.
  const [labels, setLabels] = useState<Record<string, string>>({});
  const bills = overview.recurringBills.filter((b) => b.category !== "Housing");
  if (!bills.length) return null;
  const yearly = bills.reduce((total, b) => total + b.monthlyAvg * 12, 0);

  return (
    <Card>
      <Eyebrow>Bills Sisu found</Eyebrow>
      <p className="mt-1 text-lg font-semibold leading-snug">
        {bills.length} bills repeat every month. Together they cost <span className="tabular">{eur(yearly)}</span> a year.
      </p>
      <ul className="mt-4 space-y-3">
        {bills.map((b) => {
          const confirmed = labels[b.id] !== undefined;
          return (
            <li key={b.id} className="rounded-2xl bg-paper p-4">
              <div className="flex items-baseline justify-between gap-2">
                <label className="flex-1">
                  <span className="sr-only">What is this bill?</span>
                  <select
                    value={labels[b.id] ?? b.guessLabel}
                    onChange={(e) => setLabels({ ...labels, [b.id]: e.target.value })}
                    className="min-h-11 w-full rounded-xl border border-line bg-card px-3 font-semibold"
                  >
                    {LABEL_CHOICES.map((choice) => <option key={choice}>{choice}</option>)}
                  </select>
                </label>
                <span className="tabular text-lg font-semibold">{eur(b.monthlyAvg)}<span className="text-sm font-normal text-muted">/mo</span></span>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <ConfidenceChip level={b.confidence} />
                <span>{confirmed ? "Name confirmed by you" : "Name is Sisu's guess. Change it if wrong."}</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{b.basis} Usually paid around day {b.typicalDay}.</p>
              <button
                type="button"
                onClick={() => onEvidence("Bill payments", { from: overview.windowFrom, to: overview.windowTo, category: b.category })}
                className="mt-2 min-h-11 text-sm font-semibold text-green underline decoration-green/30 underline-offset-4"
              >
                See the payments →
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
