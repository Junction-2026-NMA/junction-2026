"use client";
// The approval card of a watch (property_watch, price_watch): what would be watched, how often it is really checked,
// and Approve / Decline. Approving starts a real watch, so it must not say "simulated". Scaffold: the Projects
// stream fills it in. Until `showsWatchCard` answers true, ActionCard keeps showing its own card for watches.
import type { AgentAction } from "@/web/core/CoachModels";

export interface WatchActionCardProps {
  /** A `property_watch` or `price_watch` action. Read `action.watch` with `WatchPlan.decode`. */
  action: AgentAction;
}

/** Whether `WatchActionCard` draws this action (it must then render something). False until the card is built. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the agreed signature, used once the card is built
export function showsWatchCard(action: AgentAction): boolean {
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the agreed props, used once the card is built
export function WatchActionCard(props: WatchActionCardProps) {
  return null;
}
