// Launch options of the coach screen (screenshots and UI checks): ask or investigate, then answer the quiz,
// decide the action and scroll to a card. Port of CoachConversation.runLaunch in AskScreen.swift.
import type { AppModel } from "@/web/app/AppModel";
import { CoachLaunch } from "@/web/app/CoachLaunch";
import type { CoachStore } from "@/web/app/CoachStore";
import type { CoachMessage, CoachSession } from "@/web/core/CoachSession";
import { decideAction } from "./answerActions";

/** The bottom sentinel of the conversation (Swift `Self.bottom`). */
export const COACH_BOTTOM = "coach-bottom";

/** Sessions whose launch already ran: once per session, also when the tab is shown again. */
const launched = new WeakSet<CoachSession>();

export interface LaunchDeps {
  session: CoachSession;
  store: CoachStore;
  model: AppModel;
  setFollowing: (following: boolean) => void;
  scrollToAnchor: (id: string, anchor: "top" | "bottom") => boolean;
  /** True once the screen has gone; the run stops. */
  cancelled: () => boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

function newest(session: CoachSession): CoachMessage | null {
  const messages = session.getSnapshot().messages;
  for (let index = messages.length - 1; index >= 0; index -= 1) if (messages[index].role === "assistant") return messages[index];
  return null;
}

export async function runLaunch({ session, store, model, setFollowing, scrollToAnchor, cancelled }: LaunchDeps): Promise<void> {
  const launch = CoachLaunch.current();
  if (CoachLaunch.isEmpty(launch) || launched.has(session)) return;
  launched.add(session);
  await sleep(600);
  if (cancelled()) return;
  const empty = session.getSnapshot().messages.length === 0;
  if (launch.investigate) {
    if (empty) store.investigate();
  } else if (launch.ask !== null && empty) {
    store.ask(launch.ask);
  }
  // Wait for the answer to finish.
  await sleep(300);
  for (let tries = 0; tries < 200 && session.getSnapshot().isThinking; tries += 1) {
    if (cancelled()) return;
    await sleep(100);
  }
  const reply = newest(session);
  if (!reply || cancelled()) return;
  const card = reply.teaching ?? reply.stages.flatMap((stage) => (stage.data.kind === "teaching" ? [stage.data.card] : []))[0] ?? null;
  if (launch.quiz !== null && card) {
    if (store.choose(launch.quiz, card)) model.coachMoment("quizAnswered", card.id);
  }
  const action = reply.action ?? reply.stages.flatMap((stage) => (stage.data.kind === "action" ? [stage.data.action] : []))[0] ?? null;
  if (launch.decide !== null && action) {
    await decideAction(action, launch.decide === "approve", store, model);
  }
  await sleep(400);
  if (cancelled() || launch.scroll === null) return;
  let target = launch.scroll;
  setFollowing(target === "end");
  const kinds = new Set(reply.stages.map((stage) => String(stage.kind)));
  if (target === "offers" && kinds.has("extraction")) target = "extraction";
  if (target === "quiz" && kinds.has("teaching")) target = "teaching";
  let anchor: "top" | "bottom" = "top";
  if (target.endsWith("-bottom")) {
    target = target.slice(0, -"-bottom".length);
    anchor = "bottom";
  }
  const id = target === "end" ? COACH_BOTTOM : target === "top" ? reply.id : `${reply.id}-${target}`;
  scrollToAnchor(id, target === "end" ? "bottom" : anchor);
}
