"use client";

// The booth's status light: open /dev/ready before a judge arrives. Every row is one real call made by
// GET /api/health/ready; nothing here is hard-coded. Green rows answered, amber rows have a stand-in, red rows stop the demo.
import { useCallback, useEffect, useState } from "react";
import type { ReadinessCheck, ReadinessReport } from "@/lib/types";

const REFRESH_MS = 60_000;
const tone = (check: ReadinessCheck): "good" | "weak" | "bad" => (check.status === "ok" || check.status === "mock" ? "good" : check.blocksDemo ? "bad" : "weak");
const DOT = { good: "bg-green", weak: "bg-amber-500", bad: "bg-coral" };
const WORD: Record<ReadinessCheck["status"], string> = { ok: "Answered", down: "Down", "not-configured": "No key", mock: "Example data" };

export default function ReadyPage() {
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (fresh: boolean) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/health/ready${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
      const body = (await response.json()) as ReadinessReport & { error?: string };
      if (!response.ok) throw new Error(body.error ?? `The server answered ${response.status}.`);
      setReport(body);
      setFailed(null);
    } catch (error) {
      setFailed((error as Error).message || "The Sisu server did not answer.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(false), 0);
    const timer = setInterval(() => void load(false), REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const resetDemo = async () => {
    setBusy(true);
    await fetch("/api/demo/reset", { method: "POST" }).catch(() => null);
    await load(true);
  };

  return (
    <main className="mx-auto max-w-xl space-y-4 p-5">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sisu · before the demo</p>
        <h1 className={`text-2xl font-semibold ${report && !report.ready ? "text-coral" : ""}`}>{failed ? "The Sisu server did not answer" : (report?.headline ?? "Checking every service…")}</h1>
        {report && <p className="text-sm text-muted">{report.mock ? "Mock mode. " : ""}Checked {new Date(report.checkedAt).toLocaleTimeString()} · voice {report.voiceReady ? "ready" : "off"}</p>}
        {failed && <p className="text-sm text-coral">{failed}</p>}
      </header>

      <ul className="divide-y divide-line rounded-3xl border border-line bg-card">
        {report?.checks.map((check) => (
          <li key={check.id} className="flex gap-3 p-4">
            <span aria-hidden className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${DOT[tone(check)]}`} />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{check.sponsor}</span>
                <span className="shrink-0 text-xs text-muted">{WORD[check.status]}{check.latencyMs ? ` · ${check.latencyMs} ms` : ""}</span>
              </p>
              <p className="text-sm text-muted">{check.role}</p>
              <p className="mt-1 text-sm">{check.detail}</p>
              {tone(check) !== "good" && check.standIn && <p className="mt-1 text-sm text-muted">Stand-in: {check.standIn}.</p>}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <button type="button" onClick={() => void load(true)} disabled={busy} className="min-h-11 flex-1 rounded-xl bg-green px-4 font-semibold text-white disabled:opacity-60">{busy ? "Checking…" : "Check again now"}</button>
        <button type="button" onClick={() => void resetDemo()} disabled={busy} className="min-h-11 rounded-xl border border-line bg-card px-4 font-semibold disabled:opacity-60">Reset demo</button>
      </div>
      <p className="text-xs text-muted">Each row is one real call. Reset clears approvals, memory and the audit log for the three demo customers: do it between visitors.</p>
    </main>
  );
}
