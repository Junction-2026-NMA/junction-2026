// A housing question's turn: the intake card and one short sentence, built in code with no model call, so the
// same card comes back typed or spoken, in mock mode and live. The search runs only once the customer submits the
// card (POST /api/housing/search).
import { checkGrounding } from "@/lib/agent/grounding";
import type { AgentRequest, Overview, SisuEvent, Stage } from "@/lib/types";
import { INTAKE_TEXT, buildIntake } from "./intake";
import { isHousingQuestion } from "./intent";

// The card is shown once per conversation: once Sisu has asked, a follow-up in words goes to the model as before.
export const wantsIntake = (request: AgentRequest): boolean =>
  request.investigate !== true && isHousingQuestion(request.text) && !(request.history ?? []).some((turn) => turn.role === "assistant" && turn.content.includes(INTAKE_TEXT));

export function* intakeTurn(request: AgentRequest, overview: Overview, homeCity: string | null, turnId: string, sinceStart: () => number, sttMs: number | null): Generator<SisuEvent> {
  const intake = buildIntake(overview, request.text, homeCity);
  const stage: Stage = {
    id: `${turnId}:0`,
    kind: "housing_intake",
    title: "A few details before I search",
    summary: intake.budget.reasoning,
    source: "calculation",
    toolCallId: null,
    atMs: sinceStart(),
    facts: intake.budget.facts,
    data: { kind: "housing_intake", intake },
  };
  yield { type: "stage", stage };
  yield { type: "delta", text: INTAKE_TEXT };
  yield { type: "sentence", index: 0, text: INTAKE_TEXT };
  yield { type: "grounding", grounding: checkGrounding(INTAKE_TEXT, intake.budget.facts, [], [request.text]), facts: intake.budget.facts };
  const totalMs = sinceStart();
  yield { type: "done", text: INTAKE_TEXT, citations: [], timings: { sttMs, firstTokenMs: totalMs, firstSentenceMs: totalMs, totalMs, modelSteps: [] } };
}
