"use client";

// The stage: where the customer watches Sisu work. Three acts, in the order the work really happens:
// their account, the web, the sums. Everything drawn here came from the server as it happened.
import type { BillType } from "@/lib/types";
import { useCountUp, useTyped } from "./hooks";
import type { Act, Lane, PageState, PlanView } from "@/lib/agent/usePlan";

export const euro = (value: number): string => `€${Math.round(value).toLocaleString("en-US")}`;
const BILL_LABEL: Record<BillType, string> = { electricity: "Electricity", internet: "Home internet", mobile: "Mobile plan" };
const ACTS: { id: Exclude<Act, "idle">; label: string }[] = [
  { id: "scan", label: "Account" },
  { id: "web", label: "Web" },
  { id: "sums", label: "Sums" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (date: string): string => `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

function Tick({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path className="plan-tick" d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  );
}

function Rail({ act, done }: { act: Act; done: boolean }) {
  const at = ACTS.findIndex((step) => step.id === act);
  return (
    <ol className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em]">
      {ACTS.map((step, index) => {
        const finished = done || index < at;
        const active = !done && index === at;
        return (
          <li key={step.id} className="flex items-center gap-2 whitespace-nowrap">
            {index > 0 && <span className={`h-px w-6 transition-colors duration-300 ${finished || active ? "bg-lime/70" : "bg-white/15"}`} />}
            <span className={`flex items-center gap-1.5 transition-colors duration-300 ${active ? "text-lime" : finished ? "text-white/80" : "text-white/35"}`}>
              {finished ? <Tick className="text-lime" /> : <span className={`h-1.5 w-1.5 rounded-full ${active ? "plan-pulse bg-lime" : "bg-white/30"}`} />}
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ScanAct({ view }: { view: PlanView }) {
  const scan = view.scan;
  const count = useCountUp(scan?.transactions ?? 0, 1200);
  if (!scan) return null;
  const rows = [...scan.rows, ...scan.rows];
  return (
    <div className="plan-act space-y-4">
      <div>
        <p className="text-sm text-[var(--stage-dim)]">Reading {view.customerName ? `${view.customerName}'s` : "your"} S-Pankki account</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="tabular text-5xl font-semibold tracking-tight text-lime">{Math.round(count)}</span>
          <span className="text-sm text-[var(--stage-dim)]">
            transactions · {scan.months} months · {monthYear(scan.from)} to {monthYear(scan.to)}
          </span>
        </p>
      </div>

      <div className="plan-rows-mask relative h-36 overflow-hidden rounded-xl border border-[var(--stage-line)] bg-black/15">
        <ul className="plan-rows px-3 py-1 font-mono text-[12px] leading-6">
          {rows.map((row, index) => (
            <li key={index} className="flex justify-between gap-3 text-white/70">
              <span className="text-white/35">{row.date}</span>
              <span className="flex-1 truncate">{row.category}</span>
              <span className="tabular">{row.amount.toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <span className="plan-sweep pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-lime/0 via-lime/45 to-lime/0" />
      </div>

      <ul className="space-y-1.5">
        {view.findings.map((finding) => (
          <li key={finding.id} className="plan-in flex items-baseline justify-between gap-3 rounded-xl bg-white/[0.07] px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="mr-2 text-[10px] font-semibold uppercase tracking-wider text-lime/80">{finding.role === "habit" ? "Found" : "Noticed"}</span>
              {finding.title}
            </span>
            {finding.yearlyEur !== null && <span className="tabular shrink-0 font-medium text-lime">{euro(finding.yearlyEur)}/yr</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PageRow({ page }: { page: PageState }) {
  return (
    <li className="plan-in flex items-center gap-2 text-[12px]">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {page.state === "read" ? <Tick className="text-lime" /> : page.state === "failed" ? <span className="text-white/35">–</span> : <span className="plan-pulse h-1.5 w-1.5 rounded-full bg-lime" />}
      </span>
      <span className={`min-w-0 flex-1 truncate font-mono ${page.state === "failed" ? "text-white/35" : "text-white/80"}`}>{page.host}</span>
      {page.state === "reading" && (
        <span className="relative h-1 w-16 shrink-0 overflow-hidden rounded-full bg-white/10">
          <span className="plan-read absolute inset-y-0 left-0 w-2/5 rounded-full bg-lime/80" />
        </span>
      )}
      {page.state === "read" && (
        <span className="tabular shrink-0 text-white/60">
          {page.offers} {page.offers === 1 ? "offer" : "offers"}
          {(page.ageMs ?? 0) >= 60_000 && ` · read ${Math.round((page.ageMs ?? 0) / 60_000)} min ago`}
        </span>
      )}
      {page.state === "failed" && <span className="shrink-0 text-white/35">could not be read</span>}
    </li>
  );
}

function SearchLane({ lane, index }: { lane: Lane; index: number }) {
  const typed = useTyped(lane.query, 12);
  const result = lane.result;
  return (
    <div className="plan-in rounded-2xl border border-[var(--stage-line)] bg-white/[0.05] p-2.5" style={{ animationDelay: `${index * 70}ms` }}>
      <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-white/45">{BILL_LABEL[lane.billType]}</p>
      <div className="flex min-h-9 items-center gap-2 rounded-xl bg-black/25 py-1.5 pl-1.5 pr-3">
        <span className="plan-pop shrink-0 rounded-lg bg-[var(--exa)] px-2 py-1 text-[11px] font-bold lowercase leading-none tracking-wide text-white" style={{ animationDelay: `${index * 70 + 120}ms` }}>
          exa
        </span>
        <span className="min-w-0 flex-1 font-mono text-[12px] leading-snug text-white/90">
          {typed.shown}
          {!typed.done && <span className="plan-caret ml-px inline-block h-3 w-[6px] translate-y-0.5 bg-lime" />}
        </span>
      </div>
      {lane.pages.length > 0 && <ul className="mt-2 space-y-1 px-1">{lane.pages.map((page) => <PageRow key={page.url} page={page} />)}</ul>}
      {result && (
        <p className="plan-in mt-2 flex items-baseline justify-between gap-3 border-t border-[var(--stage-line)] px-1 pt-2 text-[13px]">
          {result.best && (result.yearlySavingEur ?? 0) > 0 && !result.note ? (
            <>
              <span className="min-w-0 truncate">{result.best.provider}</span>
              <span className="tabular shrink-0 font-medium text-lime">saves {euro(result.yearlySavingEur ?? 0)}/yr</span>
            </>
          ) : (
            <span className="text-white/50">{result.note ?? "Nothing cheaper today."}</span>
          )}
        </p>
      )}
    </div>
  );
}

function WebAct({ view }: { view: PlanView }) {
  return (
    <div className="plan-act space-y-3">
      <div>
        <p className="flex items-center gap-2 text-lg font-medium">
          Searching the live web with
          <span className="plan-pop rounded-xl bg-[var(--exa)] px-3 py-1 text-xl font-bold lowercase leading-none tracking-wide text-white shadow-[0_6px_24px_-6px_var(--exa)]">exa</span>
        </p>
        <p className="plan-in mt-1 text-[13px] text-[var(--stage-dim)]" style={{ animationDelay: "240ms" }}>
          Each page is read by Context.dev, then compared with your own bill.
        </p>
      </div>
      {view.lanes.map((lane, index) => <SearchLane key={lane.billType} lane={lane} index={index} />)}
    </div>
  );
}

function SumsAct({ view }: { view: PlanView }) {
  const calc = view.calc;
  const total = useCountUp(calc?.totalYearlyEur ?? 0, 1300);
  if (!calc) return null;
  const effort = calc.totalYearlyEur - calc.effortlessYearlyEur;
  return (
    <div className="plan-act space-y-4">
      <p className="text-sm text-[var(--stage-dim)]">Adding it up. Every sum is done in code, not by the model.</p>
      <ul className="space-y-1 text-[13px]">
        {calc.steps.map((step, index) => (
          <li key={step.label} className="plan-in flex items-baseline justify-between gap-3" style={{ animationDelay: `${index * 150}ms` }}>
            <span className="min-w-0 truncate text-white/80">{step.label}</span>
            <span className="tabular shrink-0">{euro(step.amount)}</span>
          </li>
        ))}
        {calc.steps.length === 0 && <li className="text-white/60">Nothing found that would clearly save money.</li>}
      </ul>
      <div className="plan-in border-t border-white/25 pt-3" style={{ animationDelay: `${calc.steps.length * 150 + 100}ms` }}>
        <p className="flex items-baseline gap-2">
          <span className="tabular text-6xl font-semibold tracking-tight text-lime">{euro(total)}</span>
          <span className="text-base text-[var(--stage-dim)]">a year</span>
        </p>
        {calc.totalYearlyEur > 0 && (
          <p className="mt-2 text-[13px] text-[var(--stage-dim)]">
            {euro(calc.effortlessYearlyEur)} needs nothing from you · {euro(effort)} needs spending to come down
          </p>
        )}
      </div>
    </div>
  );
}

export function Stage({ view, onStart, canStart }: { view: PlanView; onStart: () => void; canStart: boolean }) {
  const plan = view.plan;
  const pagesRead = plan ? plan.searches.reduce((total, search) => total + search.pagesRead, 0) : 0;
  return (
    <section className="plan-stage relative overflow-hidden rounded-[28px] p-5 shadow-[0_18px_40px_-18px_rgba(13,34,25,0.7)]" aria-live="polite">
      {view.phase === "idle" ? (
        <div className="flex min-h-[26rem] flex-col justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/45">Sisu · money coach</p>
          <div>
            <h1 className="text-[2.6rem] font-semibold leading-[1.02] tracking-tight">
              Let Sisu sort out <span className="text-lime">your money.</span>
            </h1>
            <p className="mt-4 max-w-[30ch] text-[15px] leading-relaxed text-[var(--stage-dim)]">It reads your last twelve months, checks today&apos;s prices on the web, and sets up what would save you money. You watch it work.</p>
          </div>
          <div>
            <button type="button" onClick={onStart} disabled={!canStart} className="min-h-14 w-full rounded-2xl bg-lime px-5 text-lg font-semibold text-[#0d2219] transition-transform duration-150 active:scale-[0.98] disabled:opacity-50">
              Sort out my money
            </button>
            <p className="mt-3 text-center text-xs text-white/45">Nothing is switched or moved until you approve it.</p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[26rem] flex-col gap-5">
          <Rail act={view.act} done={view.phase === "done"} />
          <div className="flex-1">
            {view.phase === "error" ? (
              <p className="plan-act rounded-xl bg-coral/20 p-3 text-sm">{view.error}</p>
            ) : view.act === "scan" ? (
              <ScanAct view={view} />
            ) : view.act === "web" ? (
              <WebAct view={view} />
            ) : view.act === "sums" ? (
              <SumsAct view={view} />
            ) : (
              <p className="plan-act flex items-center gap-2 text-sm text-[var(--stage-dim)]">
                <span className="plan-pulse h-1.5 w-1.5 rounded-full bg-lime" /> Opening your account…
              </p>
            )}
          </div>
          {plan && (
            <p className="plan-in flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--stage-line)] pt-3 text-[11px] text-white/50">
              <span className="tabular">Done in {(plan.tookMs / 1000).toFixed(1)} s</span>
              <span>· {plan.scanned.transactions} transactions</span>
              <span>· {plan.searches.length} {plan.searches.length === 1 ? "search" : "searches"} with Exa</span>
              <span>· {pagesRead} pages read</span>
              {view.mock && <span className="rounded-full bg-amber/30 px-2 py-0.5 text-amber">example data, not live</span>}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
