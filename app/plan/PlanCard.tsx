"use client";

// What Sisu found and set up, with one button to approve all of it. Shown when the work on the stage is finished.
import { useEffect, useRef } from "react";
import type { AgentAction, PlanItem, PlanProjection } from "@/lib/types";
import { euro } from "./Stage";
import type { PlanView } from "@/lib/agent/usePlan";

const hostOf = (url: string): string => new URL(url).hostname.replace(/^www\./, "");

function Item({ item, index }: { item: PlanItem; index: number }) {
  const effortless = item.needs === "nothing";
  return (
    <li className="plan-in py-3" style={{ animationDelay: `${index * 90}ms` }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 font-medium leading-snug">{item.title}</p>
        <p className="tabular shrink-0 font-semibold text-green">{euro(item.yearlyEur)}/yr</p>
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium ${effortless ? "bg-green-soft text-green" : "bg-amber/15 text-[#8a5f08]"}`}>{effortless ? "Needs nothing from you" : "Needs spending to come down"}</span>
        {item.sources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="text-muted underline decoration-line underline-offset-2">
            {hostOf(source.url)}
          </a>
        ))}
      </p>
      <details className="mt-1.5 text-sm text-muted">
        <summary className="cursor-pointer text-xs underline decoration-line underline-offset-2">How Sisu worked this out</summary>
        <p className="mt-1 leading-snug">{item.detail}</p>
      </details>
    </li>
  );
}

function ActionRow({ action }: { action: AgentAction }) {
  const done = action.status === "executed_simulated";
  return (
    <li className="rounded-xl border border-line bg-paper/60 p-3 text-sm">
      <p className="flex items-start justify-between gap-3">
        <span className="font-medium leading-snug">{action.title}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${done ? "bg-green text-white" : "bg-amber/20 text-[#8a5f08]"}`}>{done ? "Done" : "Waiting"}</span>
      </p>
      {action.warning && !done && <p className="mt-2 rounded-lg bg-coral/10 p-2 text-[13px] leading-snug text-coral">{action.warning}</p>}
      {done && action.confirmation && <p className="plan-in mt-1 text-[13px] text-green">{action.confirmation}</p>}
    </li>
  );
}

function FiveYears({ projection }: { projection: PlanProjection }) {
  const top = Math.max(projection.investedHighEur, projection.keptEur, projection.nothingEur, 1);
  const bars = [
    { label: "Change nothing", value: projection.nothingEur, tone: "bg-line", note: null as string | null },
    { label: "With this plan, kept as cash", value: projection.keptEur, tone: "bg-green", note: null },
    { label: "With this plan, invested", value: projection.investedEur, tone: "bg-lime", note: `between ${euro(projection.investedLowEur)} and ${euro(projection.investedHighEur)}` },
  ];
  // This appears the moment the plan is approved, so it is brought into view: it is the payoff.
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    void box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  return (
    <div ref={box} className="plan-in space-y-3 rounded-2xl bg-green-soft/60 p-4">
      <p className="text-sm font-semibold">
        In {projection.years} years: about {euro(projection.gainKeptEur)} more than changing nothing
      </p>
      <ul className="space-y-2.5">
        {bars.map((bar, index) => (
          <li key={bar.label}>
            <p className="flex items-baseline justify-between gap-3 text-[13px]">
              <span>{bar.label}</span>
              <span className="tabular font-semibold">{euro(bar.value)}</span>
            </p>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/70">
              <div className={`plan-grow h-full rounded-full ${bar.tone}`} style={{ width: `${Math.max(2, (Math.max(0, bar.value) / top) * 100)}%`, animationDelay: `${index * 160}ms` }} />
            </div>
            {bar.note && <p className="mt-0.5 text-xs text-muted">{bar.note}. Investments can lose value.</p>}
          </li>
        ))}
      </ul>
      <p className="text-xs leading-snug text-muted">A scenario, not a forecast. It assumes the whole plan holds for {projection.years} years, including the spending coming down by €{Math.round(projection.freedPerMonthEur)} a month.</p>
    </div>
  );
}

export function PlanCard({ view, onApprove, onDecline, onAgain }: { view: PlanView; onApprove: () => void; onDecline: () => void; onAgain: () => void }) {
  const plan = view.plan;
  if (!plan) return null;
  const waiting = view.actions.filter((action) => action.status === "awaiting_approval");
  const approved = view.approval === "done";
  return (
    <section className="plan-act space-y-5 rounded-[28px] border border-line bg-card p-5">
      <div>
        <p className="text-lg font-medium leading-snug">{plan.summary}</p>
        <p className="mt-1.5 text-xs text-muted">{plan.summaryBy === "nemotron" ? "Worded by Nemotron on our own GPU in Finland. Every number checked by code." : "Written and checked by code."}</p>
      </div>

      {plan.items.length > 0 && <ul className="divide-y divide-line border-y border-line">{plan.items.map((item, index) => <Item key={item.id} item={item} index={index} />)}</ul>}

      {view.actions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{approved ? "Done, as a simulation" : "Set up by Sisu, waiting for you"}</p>
          <ul className="space-y-2">{view.actions.map((action) => <ActionRow key={action.id} action={action} />)}</ul>
        </div>
      )}

      {view.approvalError && <p className="rounded-xl bg-coral/10 p-3 text-sm text-coral">{view.approvalError}</p>}

      {waiting.length > 0 && view.approval !== "declined" && (
        <div className="sticky bottom-3 z-10 space-y-1 rounded-3xl border border-line bg-card/95 p-2 shadow-[0_14px_34px_-14px_rgba(20,32,27,0.45)] backdrop-blur">
          <button type="button" onClick={onApprove} disabled={view.approval === "sending"} className="min-h-14 w-full rounded-2xl bg-green px-5 text-lg font-semibold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-60">
            {view.approval === "sending" ? "Approving…" : `Approve all ${waiting.length}`}
          </button>
          <button type="button" onClick={onDecline} className="min-h-10 w-full rounded-2xl text-sm font-medium text-muted">
            Not now
          </button>
          <p className="pb-1 text-center text-[11px] text-muted">A simulation: no contract is switched and no money moves.</p>
        </div>
      )}
      {view.approval === "declined" && <p className="rounded-xl bg-paper p-3 text-sm text-muted">Nothing was approved. The actions stay waiting for 30 minutes, then expire.</p>}

      {approved && plan.projection && <FiveYears projection={plan.projection} />}

      {plan.notices.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Also worth knowing</p>
          <ul className="space-y-1.5 text-sm">
            {plan.notices.map((notice) => (
              <li key={notice.title}>
                <span className="font-medium">{notice.title}.</span> <span className="text-muted">{notice.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" onClick={onAgain} className="min-h-11 w-full rounded-2xl border border-line text-sm font-medium">
        Run it again
      </button>
    </section>
  );
}
