"use client";

import { useEffect, useState } from "react";
import type { EvidenceFilter, TransactionList } from "@/lib/types";
import { fetchTransactions } from "@/lib/api";
import { eurExact, niceDate } from "@/lib/format";
import { MCC_LABELS } from "@/lib/finance/baskets";

type Props = { customerId: string; title: string; filter: EvidenceFilter; onClose: () => void };

export function TransactionSheet({ customerId, title, filter, onClose }: Props) {
  const [list, setList] = useState<TransactionList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTransactions(customerId, filter)
      .then((result) => !cancelled && setList(result))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [customerId, filter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="sheet-up flex max-h-[82dvh] w-full max-w-[430px] flex-col rounded-t-3xl bg-card"
      >
        <header className="flex items-start gap-3 border-b border-line p-5">
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">The evidence</p>
            <h2 className="text-lg font-semibold leading-snug">{title}</h2>
            {list && (
              <p className="tabular mt-1 text-sm text-muted">
                {list.count} transactions · {eurExact(list.total)} · {niceDate(filter.from)} to {niceDate(filter.to)}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full bg-paper text-xl">×</button>
        </header>

        <div className="overflow-y-auto px-5 pb-8">
          {error && <p className="py-6 text-sm text-coral">{error}</p>}
          {!list && !error && <p className="py-6 text-sm text-muted">Loading transactions…</p>}
          {list && list.count === 0 && <p className="py-6 text-sm text-muted">No transactions match.</p>}
          {list && (
            <ul className="divide-y divide-line">
              {list.transactions.map((t, i) => (
                <li key={`${t.date}-${t.time}-${i}`} className="flex items-baseline gap-3 py-3">
                  <div className="flex-1">
                    <p className="font-medium">{(t.mcc && MCC_LABELS[t.mcc]) || t.category}</p>
                    <p className="text-xs text-muted">
                      {niceDate(t.date)} · {t.time.slice(0, 5)}
                      {t.merchantId ? ` · ${t.merchantId}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular font-semibold">{eurExact(t.amount)}</p>
                    <p className={`tabular text-xs ${t.balanceAfter < 0 ? "text-coral" : "text-muted"}`}>bal. {eurExact(t.balanceAfter)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {list?.truncated && <p className="py-4 text-xs text-muted">Showing the newest {list.transactions.length} of {list.count}.</p>}
        </div>
      </div>
    </div>
  );
}
