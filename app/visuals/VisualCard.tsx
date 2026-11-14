"use client";

// One card for any picture the agent sends. Give it a Visual from the stream (the "visual" event, or
// message.visuals from useSisu) and it draws the right chart, animated, with its title and where the figures came from.
import type { Visual } from "@/lib/types";
import { MonthBars, OfferBars, PeerBars, Waterfall } from "./Bars";
import { Donut } from "./Donut";
import { FuturesLines } from "./Lines";
import "./visuals.css";

const SOURCE: Record<Visual["source"], string> = { "bank-data": "From your S-Pankki account", exa: "From a live web search", "context.dev": "From provider pages read today", calculation: "Worked out in code from your account", assumption: "An assumption", "customer-stated": "From what you told Sisu" };

function Chart({ visual }: { visual: Visual }) {
  switch (visual.kind) {
    case "budget_donut":
      return <Donut visual={visual} />;
    case "peer_bars":
      return <PeerBars visual={visual} />;
    case "month_bars":
      return <MonthBars visual={visual} />;
    case "waterfall":
      return <Waterfall visual={visual} />;
    case "futures_lines":
      return <FuturesLines visual={visual} />;
    case "offer_bars":
      return <OfferBars visual={visual} />;
  }
}

export function VisualCard({ visual, className = "" }: { visual: Visual; className?: string }) {
  return (
    <figure className={`viz viz-fade space-y-3 rounded-2xl border border-line bg-card p-4 ${className}`}>
      <figcaption>
        <p className="font-semibold leading-snug">{visual.title}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted">{visual.caption}</p>
      </figcaption>
      <Chart visual={visual} />
      <p className="text-[11px] text-muted">{SOURCE[visual.source]}</p>
    </figure>
  );
}
