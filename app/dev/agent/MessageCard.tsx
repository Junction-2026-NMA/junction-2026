import type { SisuMessage } from "@/lib/agent/useSisu";

const seconds = (ms: number | null | undefined) => (ms === null || ms === undefined ? "–" : `${(ms / 1000).toFixed(2)} s`);
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

export function MessageCard({ message }: { message: SisuMessage }) {
  if (message.role === "user") {
    return <p className="ml-auto w-fit max-w-[85%] rounded-2xl bg-green px-4 py-2 text-white">{message.pending ? "Listening…" : message.text}</p>;
  }
  const { research, timings } = message;

  return (
    <article className="space-y-2 rounded-2xl border border-line bg-card p-4">
      {message.startedEarly && <p className="text-xs text-muted">Started {message.startedEarly} research early, before the model asked.</p>}
      {message.filler && <p className="text-sm italic text-muted">“{message.filler}”</p>}
      {message.text && <p className="leading-relaxed">{message.text}</p>}
      {message.pending && !message.text && <p className="text-muted">Thinking…</p>}
      {message.error && <p className="rounded-xl bg-coral/10 p-3 text-sm text-coral">{message.error}</p>}

      {message.tools.length > 0 && (
        <ul className="space-y-1 border-t border-line pt-2 text-xs">
          {message.tools.map((tool) => (
            <li key={tool.id} className="flex flex-wrap gap-x-2">
              <span className={`font-semibold ${tool.ok ? "text-green" : "text-coral"}`}>{tool.name}</span>
              <span className="tabular text-muted">{seconds(tool.tookMs)} · {tool.source}{tool.joinedPrefetch ? " · reused a run already in flight" : ""}</span>
              <span className="w-full text-muted">{tool.summary}</span>
            </li>
          ))}
        </ul>
      )}

      {research && research.offers.length > 0 && (
        <div className="overflow-x-auto border-t border-line pt-2">
          <p className="text-xs text-muted">
            {research.mock ? "Example offers (mock)" : `Live offers, retrieved ${new Date(research.citations[0]?.retrievedAt ?? research.startedAt).toLocaleTimeString()}`} · your bill €{research.baselineMonthlyEur?.toFixed(0) ?? "?"}/mo · pages {research.pagesDone}/{research.pagesTotal}
          </p>
          <table className="tabular mt-1 w-full min-w-[420px] text-left text-xs">
            <thead><tr className="text-muted"><th className="py-1 font-medium">Offer</th><th className="font-medium">Est. €/mo</th><th className="font-medium">Saves €/yr</th><th className="font-medium">Source</th></tr></thead>
            <tbody>
              {research.offers.slice(0, 6).map((offer) => (
                <tr key={`${offer.provider}-${offer.plan}-${offer.sourceUrl}`} className={offer === research.best ? "font-semibold text-green" : ""}>
                  <td className="py-1 pr-2">{offer.provider} {offer.plan ?? ""}</td>
                  <td>{offer.comparable ? offer.estimatedMonthlyCostEur?.toFixed(2) : "not ranked"}</td>
                  <td>{offer.estimatedYearlySavingEur?.toFixed(0) ?? "–"}</td>
                  <td><a href={offer.sourceUrl} target="_blank" rel="noreferrer" className="underline">{host(offer.sourceUrl)}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {message.citations.length > 0 && !research && (
        <p className="border-t border-line pt-2 text-xs text-muted">
          Sources: {message.citations.map((c, i) => <a key={c.url} href={c.url} target="_blank" rel="noreferrer" className="underline">{i ? ", " : ""}{host(c.url)}</a>)}
        </p>
      )}

      {timings && (
        <p className="tabular border-t border-line pt-2 text-xs text-muted">
          {timings.sttMs !== null && <>heard in {seconds(timings.sttMs)} · </>}first word {seconds(timings.firstTokenMs)} · first sentence {seconds(timings.firstSentenceMs)} · done {seconds(timings.totalMs)} · {timings.modelSteps.length} model {timings.modelSteps.length === 1 ? "step" : "steps"} on {[...new Set(timings.modelSteps.map((step) => step.provider))].join(" + ")}{timings.modelSteps.some((step) => step.usedBackup) ? " (backup took over)" : ""}
        </p>
      )}
    </article>
  );
}
