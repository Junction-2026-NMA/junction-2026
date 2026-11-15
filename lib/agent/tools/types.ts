import type { AgentAction, CashFlow, Citation, CustomerMemory, Fact, MemoryItem, Overview, PaydayOverrides, ResearchResult, Stage, TeachingCard, ToolTrace, Visual } from "@/lib/types";
import type { ToolCall } from "../model";

// Everything a tool may use. Built once per turn by the orchestrator.
export type ToolContext = {
  customerId: string;
  overview: Overview;
  city: string;
  memory: CustomerMemory;
  cashFlow: () => CashFlow; // worked out on first use, with the buffer below when the customer set one
  bufferEur?: number | null; // the protected buffer the customer set in the app (Today or Settings); null or missing = none set, the default is assumed
  userTexts: string[]; // what the user has actually said this conversation; used to check "remember" requests
  sisuTexts: string[]; // what Sisu said earlier in this conversation (answers that already passed the number check)
  signal?: AbortSignal;
  payday?: PaydayOverrides; // v2 payday: the payday date and bills the customer confirmed in the app
};

// A stage before the orchestrator stamps it with its time and tool call.
export type StageDraft = Pick<Stage, "kind" | "title" | "summary" | "source" | "data"> & { facts?: Fact[] };

export type ToolOutcome = {
  content: string; // JSON the model reads
  ok: boolean;
  summary: string; // one line for the trace drawer
  source: ToolTrace["source"];
  joinedPrefetch: boolean;
  citations: Citation[];
  facts: Fact[]; // receipts for every number in `content`
  stages: StageDraft[];
  research?: ResearchResult;
  action?: AgentAction;
  teaching?: TeachingCard;
  memory?: MemoryItem;
  visual?: Visual; // a chart to draw with the answer
};

export const outcome = (partial: Pick<ToolOutcome, "content" | "summary"> & Partial<ToolOutcome>): ToolOutcome => ({
  ok: true,
  source: "finance",
  joinedPrefetch: false,
  citations: [],
  facts: [],
  stages: [],
  ...partial,
});

export const failure = (source: ToolTrace["source"], message: string): ToolOutcome => outcome({ content: JSON.stringify({ error: message }), ok: false, summary: message, source });

export function parseArgs(call: ToolCall): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(call.function.arguments || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// The model sees facts without their ids or filters: just what each number is and where it came from.
export const factsForModel = (facts: Fact[]) => facts.map((f) => ({ what: f.label, value: f.value, unit: f.unit, from: f.source }));
