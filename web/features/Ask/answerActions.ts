// Approve / decline, then the celebration of an approved simulation. Port of AnswerActions in AskCards.swift.
import type { AppModel } from "@/web/app/AppModel";
import type { Celebration } from "@/web/app/AppTypes";
import type { CoachStore } from "@/web/app/CoachStore";
import { ActionStatus, type AgentAction } from "@/web/core/CoachModels";
import { ActionPresenter } from "@/web/core/CoachPresentation";

export async function decideAction(action: AgentAction, approve: boolean, store: CoachStore, model: AppModel): Promise<void> {
  const decided = await store.decide(action.id, approve);
  if (!decided) return;
  if (approve && decided.status === ActionStatus.executedSimulated) {
    const card = ActionPresenter.card(decided, "en");
    showCelebration(model, { headline: "Approved.", detail: `${card.monthly} freed. ${card.simulatedTag}.` });
  }
}

/** Swift assigns `model.celebration = (headline:detail:)` directly. */
function showCelebration(model: AppModel, celebration: Celebration): void {
  model.setCelebration(celebration);
}
