"use client";

import { useCallback, useEffect, useState } from "react";
import type { DemoCustomer, EvidenceFilter, Overview } from "@/lib/types";
import { fetchDemoCustomers, fetchOverview } from "@/lib/api";
import { niceDate } from "@/lib/format";
import { ProfilePicker } from "@/components/ProfilePicker";
import { SafeToSpendCard } from "@/components/SafeToSpendCard";
import { BasketsCard } from "@/components/BasketsCard";
import { CashflowChart } from "@/components/CashflowChart";
import { BillsCard } from "@/components/BillsCard";
import { InsightsCard } from "@/components/InsightsCard";
import { FuturesCard } from "@/components/FuturesCard";
import { TransactionSheet } from "@/components/TransactionSheet";

type Evidence = { title: string; filter: EvidenceFilter };

export default function Home() {
  const [customers, setCustomers] = useState<DemoCustomer[] | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);

  useEffect(() => {
    fetchDemoCustomers().then(setCustomers).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    fetchOverview(customerId)
      .then((result) => !cancelled && setOverview(result))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const pick = (id: string) => {
    setOverview(null);
    setError(null);
    setCustomerId(id);
  };
  const reset = () => {
    setCustomerId(null);
    setOverview(null);
    setEvidence(null);
    setError(null);
  };
  const openEvidence = useCallback((title: string, filter: EvidenceFilter) => setEvidence({ title, filter }), []);
  const closeEvidence = useCallback(() => setEvidence(null), []);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-paper sm:my-6 sm:min-h-[calc(100dvh-3rem)] sm:rounded-[2.5rem] sm:border sm:border-line sm:shadow-xl">
      {error && (
        <div className="p-6">
          <p className="rounded-2xl bg-coral/10 p-4 text-sm text-coral">{error}</p>
          <button type="button" onClick={reset} className="mt-4 min-h-11 font-semibold text-green underline">Start again</button>
        </div>
      )}

      {!error && !customerId && (customers ? <ProfilePicker customers={customers} onPick={pick} /> : <p className="p-6 text-muted">Loading…</p>)}

      {!error && customerId && !overview && <p className="p-6 pt-16 text-muted">Reading two years of transactions…</p>}

      {!error && overview && (
        <div className="space-y-4 px-4 pb-10 pt-6">
          <header className="flex items-center justify-between px-1">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-green">SISU</p>
              <h1 className="text-2xl font-semibold tracking-tight">Hei {overview.displayName}</h1>
            </div>
            <button type="button" onClick={reset} className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-semibold">
              Switch customer
            </button>
          </header>

          <SafeToSpendCard overview={overview} />
          <InsightsCard overview={overview} onEvidence={openEvidence} />
          <BasketsCard overview={overview} onEvidence={openEvidence} />
          <BillsCard overview={overview} onEvidence={openEvidence} />
          <FuturesCard overview={overview} />
          <CashflowChart overview={overview} />

          <details className="px-1 text-xs leading-relaxed text-muted">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold">How Sisu calculated this · data as of {niceDate(overview.dataTimestamp)}</summary>
            <ul className="list-disc space-y-1 pl-4">
              {overview.assumptions.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </details>
        </div>
      )}

      {evidence && customerId && (
        <TransactionSheet customerId={customerId} title={evidence.title} filter={evidence.filter} onClose={closeEvidence} />
      )}
    </main>
  );
}
