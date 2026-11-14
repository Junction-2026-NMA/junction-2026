// Lets the model put a picture on screen. The model chooses which one; code builds it from the customer's figures.
import { CHART_KINDS, type ChartKind, chartFor } from "../visuals";
import { type ToolContext, type ToolOutcome, factsForModel, failure, outcome } from "./types";

export function showChart(args: Record<string, unknown>, ctx: ToolContext): ToolOutcome {
  const kind = CHART_KINDS.includes(args.chart as ChartKind) ? (args.chart as ChartKind) : null;
  if (!kind) return failure("finance", `show_chart needs chart: ${CHART_KINDS.join(", ")}.`);
  const visual = chartFor(kind, ctx.overview);
  if (!visual) return failure("finance", "There is not enough data to draw that chart.");
  return outcome({
    content: JSON.stringify({ shownOnScreen: visual.title, whatItShows: visual.summary, covers: visual.caption, someFiguresInIt: factsForModel(visual.facts).slice(0, 8), say: "The chart is on the customer's screen now. Tell them what it shows in one or two sentences, from whatItShows. Do not read out every number, and do not describe anything whatItShows does not say." }),
    summary: `Chart on screen: ${visual.title}`,
    facts: visual.facts,
    visual,
  });
}
