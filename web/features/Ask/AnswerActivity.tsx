"use client";
// The visible tool trace of one answer, drawn with beUI's AgentActivity (web/agents). While the answer is on its
// way, the live line is beUI's AgentProgress: a pulsing grid, what Sisu is doing (the server's filler, else "Sisu
// is thinking…", with the shimmer) and the real time since the question was asked. Under it come one row per tool
// call, in order, and after a web search the query exactly as it was sent with the pages that came back (the
// research stage of that tool call, `Stage.toolCallId`), labelled when they are mock data. Once the answer is done
// it folds into "What Sisu did · 3 steps · Answered in 4.2 s", which opens the rows again. Step rows come from
// SisuCore's StepPresenter while pending and from the answer view afterwards (AnswerView.steps: humanized, results
// that only repeat the card's numbers left out). The Details do not list the steps, so the trace is said once.
import { useState } from "react";
import { AgentActivity, type AgentActivityItem, type AgentActivitySearch, type AgentActivityStep } from "@/web/agents/AgentActivity";
import { AgentProgress } from "@/web/agents/AgentProgress";
import { citationDomain } from "@/web/agents/Citations";
import { ThinkingShimmer } from "@/web/agents/ThinkingShimmer";
import { CoachProviderName } from "@/web/core/AppLogic/CoachAppLogic";
import type { AnswerView } from "@/web/core/AnswerPresentation";
import { StepPresenter, type StepRow } from "@/web/core/ChartPresentation";
import { CoachText } from "@/web/core/CoachPresentation";
import type { CoachMessage } from "@/web/core/CoachSession";
import { validURL } from "./CardParts";

const language = "en";
/** Pages listed under a search; the rest are counted ("+2 more"). */
const SHOWN_PAGES = 3;

const STATUS: Record<StepRow.State, { status: AgentActivityStep["status"]; label: string }> = {
  running: { status: "active", label: "Running" },
  done: { status: "complete", label: "Done" },
  failed: { status: "failed", label: "Did not finish" },
};

/** When each answer started, by message id: kept across remounts (a tab switch), so the clock does not restart. */
const startedAt = new Map<string, number>();

function useStartedAt(id: string): number {
  const [time] = useState(() => {
    const known = startedAt.get(id);
    if (known !== undefined) return known;
    const now = Date.now();
    startedAt.set(id, now);
    return now;
  });
  return time;
}

export function AnswerActivity({ message, view }: { message: CoachMessage; view: AnswerView }) {
  const started = useStartedAt(message.id);
  const rows = message.pending ? StepPresenter.rows(message, language) : view.steps;
  const searches = searchesOf(message);
  if (!message.pending && rows.length === 0) return null;
  const items: AgentActivityItem[] = [];
  for (const row of rows) {
    items.push({
      type: "step",
      id: row.id,
      label: row.label,
      status: STATUS[row.state].status,
      statusLabel: STATUS[row.state].label,
      detail: row.result ?? undefined,
      meta: row.duration ?? undefined,
    });
    items.push(...searches.filter((search) => search.toolCallId === row.id).map((search) => search.item));
  }
  items.push(...searches.filter((search) => !rows.some((row) => row.id === search.toolCallId)).map((search) => search.item));
  const count = `${rows.length} ${rows.length === 1 ? "step" : "steps"}`;
  const summary = [StepPresenter.heading(false, language), count, view.timing].filter(Boolean).join(" · ");
  const label = message.filler ?? "Sisu is thinking…";
  return (
    <AgentActivity items={items} working={message.pending} activeLabel={label} summary={summary} maxHeight={200} testId="ask.steps"
      status={<AgentProgress startedAt={started} label={<ThinkingShimmer>{label}</ThinkingShimmer>} />} />
  );
}

/** The web searches of the answer (research stages): the query as sent, the pages read, and the tool call. */
function searchesOf(message: CoachMessage): { toolCallId: string | null; item: AgentActivitySearch }[] {
  return message.stages.flatMap((stage) => {
    if (stage.data.kind !== "research") return [];
    const pages = stage.data.pages.filter((page, index, all) => page.url !== "" && all.findIndex((other) => other.url === page.url) === index);
    const provider = stage.data.searchedWith ? CoachProviderName.display(stage.data.searchedWith) : null;
    const meta = [provider, stage.data.mock ? CoachText.mockDataTag(language) : null].filter(Boolean).join(" · ");
    return [{
      toolCallId: stage.toolCallId ?? null,
      item: {
        type: "search" as const,
        id: `search-${stage.id}`,
        query: stage.data.query,
        meta: meta === "" ? undefined : meta,
        results: pages.slice(0, SHOWN_PAGES).map((page) => ({
          id: page.url,
          title: page.title || page.url,
          domain: citationDomain(page.url) ?? undefined,
          url: validURL(page.url) ?? undefined,
        })),
        moreCount: Math.max(0, pages.length - SHOWN_PAGES) || undefined,
      },
    }];
  });
}
