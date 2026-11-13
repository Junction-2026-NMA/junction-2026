"use client";

import { useState } from "react";
import type { BasketId, EvidenceFilter, Overview } from "@/lib/types";
import { eur } from "@/lib/format";
import { BASKET_COLOR, Card, Eyebrow } from "./ui";

type Props = { overview: Overview; onEvidence: (title: string, filter: EvidenceFilter) => void };

export function BasketsCard({ overview, onEvidence }: Props) {
  const [openId, setOpenId] = useState<BasketId | null>("everyday");
  const window = { from: overview.windowFrom, to: overview.windowTo };

  return (
    <Card>
      <Eyebrow>Where your money goes</Eyebrow>
      <p className="mt-1 text-2xl font-semibold tracking-tight">
        <span className="tabular">{eur(overview.monthlySpending)}</span> a month, in three baskets
      </p>

      <div className="mt-4 flex h-3 overflow-hidden rounded-full" role="img" aria-label="Share of spending per basket">
        {overview.baskets.map((b) => (
          <div key={b.id} style={{ width: `${b.share * 100}%`, background: BASKET_COLOR[b.id] }} />
        ))}
      </div>

      <ul className="mt-4 divide-y divide-line">
        {overview.baskets.map((b) => {
          const open = openId === b.id;
          return (
            <li key={b.id} className="py-3">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : b.id)}
                aria-expanded={open}
                className="flex min-h-11 w-full items-center gap-3 text-left"
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: BASKET_COLOR[b.id] }} />
                <span className="flex-1 font-semibold">{b.label}</span>
                <span className="tabular font-semibold">{eur(b.monthlyAvg)}</span>
                <span className="w-10 text-right text-sm text-muted">{Math.round(b.share * 100)}%</span>
              </button>

              {open && (
                <div className="mt-2 pl-6">
                  <p className="text-sm leading-relaxed text-muted">{b.description}</p>
                  <ul className="mt-3 space-y-2">
                    {b.categories.map((c) => {
                      const diff = c.peerMonthlyAvg === null ? null : c.monthlyAvg - c.peerMonthlyAvg;
                      return (
                        <li key={c.category}>
                          <button
                            type="button"
                            onClick={() => onEvidence(c.category, { ...window, category: c.category })}
                            className="w-full rounded-2xl bg-paper p-3 text-left transition hover:bg-green-soft"
                          >
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="font-medium">{c.category}</span>
                              <span className="tabular font-semibold">{eur(c.monthlyAvg)}</span>
                            </span>
                            <span className="mt-0.5 block text-xs text-muted">{c.reason}</span>
                            {diff !== null && Math.abs(diff) >= 5 && (
                              <span className={`mt-1 block text-xs font-medium ${diff > 0 ? "text-coral" : "text-green"}`}>
                                {eur(Math.abs(diff))} {diff > 0 ? "above" : "below"} the average for ages {overview.ageBand}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">Monthly averages, {overview.windowFrom.slice(0, 7)} to {overview.windowTo.slice(0, 7)}. Tap a category to see every payment.</p>
    </Card>
  );
}
