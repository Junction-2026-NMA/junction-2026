// The v3 project journey without React: how often Sisu really checks (never "continuous" or "real-time"), the
// listings grouped by verdict (a failing listing is never a match), the requirements carried from the conversation
// into the confirmation card, and the alert and deep-link rules.
import { Money } from "@/web/core/Presentation";
import type { EvaluatedListing, ProjectAlert, RequirementCheck, SchedulerInfo } from "@/web/core/WatchExtras";
import type { PropertyWatch, WatchPlan } from "@/web/core/WatchModels";
import type { ProjectLine } from "./ProjectPresenter";

const money = (eur: number) => Money.format(eur, "en");
const num = (o: Readonly<Record<string, unknown>> | null | undefined, key: string): number | null =>
  o && typeof o[key] === "number" && Number.isFinite(o[key]) ? (o[key] as number) : null;
const str = (o: Readonly<Record<string, unknown>> | null | undefined, key: string): string | null =>
  o && typeof o[key] === "string" && (o[key] as string).trim() !== "" ? (o[key] as string).trim() : null;

const CONTEXT_DEV = "Context.dev re-checks the pages about every 6 hours.";

export const CheckFrequency = {
  /** What really checks the pages, and when. Old backend (no info): only what the app itself does. */
  text(info: SchedulerInfo | null): string {
    if (!info) return `Sisu reviews the pages when you open the app. ${CONTEXT_DEV}`;
    if (info.kind !== "cron") return `Sisu checks right after you approve and whenever you open the app. ${CONTEXT_DEV}`;
    const every = info.checkEveryMinutes;
    if (every !== null && every < 1440) {
      const step = every % 60 === 0 ? `${every / 60} hour${every === 60 ? "" : "s"}` : `${every} minutes`;
      return `Sisu checks right after you approve, then about every ${step} on its server, also while the app is closed. ${CONTEXT_DEV}`;
    }
    const at = info.dailyTimes[0];
    return `Sisu checks right after you approve, then once a day${at ? ` at ${at}` : ""} on its server, also while the app is closed. ${CONTEXT_DEV}`;
  },
  /** "Next scheduled check": Sisu's own when the server sends it, else Context.dev's, labelled as such. */
  next(watch: Pick<PropertyWatch, "nextScheduledCheckAt" | "nextCheckAt">): { label: string; at: string } | null {
    if (watch.nextScheduledCheckAt && !Number.isNaN(Date.parse(watch.nextScheduledCheckAt))) return { label: "Next scheduled check", at: watch.nextScheduledCheckAt };
    if (watch.nextCheckAt && !Number.isNaN(Date.parse(watch.nextCheckAt))) return { label: "Context.dev's next run", at: watch.nextCheckAt };
    return null;
  },
  notifyLine: "Notify me when a match is found",
  searching: "Searching on Sisu's server. You can close the app; Sisu will notify you.",
} as const;

export interface ListingGroups { matches: EvaluatedListing[]; verify: EvaluatedListing[]; alternatives: EvaluatedListing[] }

export const ListingGroups = {
  /** Matches only when every requirement is met; a failing listing always goes to the alternatives. */
  of(evaluated: readonly EvaluatedListing[]): ListingGroups {
    const failing = (e: EvaluatedListing) => e.verdict === "fails" || e.checks.some((c) => c.status === "failed");
    const unknown = (e: EvaluatedListing) => e.verdict === "needs_verification" || e.checks.some((c) => c.status === "unknown");
    const byRent = (a: EvaluatedListing, b: EvaluatedListing) => (a.listing.priceEur ?? Infinity) - (b.listing.priceEur ?? Infinity);
    return {
      matches: evaluated.filter((e) => !failing(e) && !unknown(e)).slice().sort(byRent),
      verify: evaluated.filter((e) => !failing(e) && unknown(e)).slice().sort(byRent),
      alternatives: evaluated.filter(failing).slice().sort(byRent),
    };
  },
  /** The details a "Needs verification" listing does not state, by requirement name. */
  missing(checks: readonly RequirementCheck[]): string[] { return checks.filter((c) => c.status === "unknown").map((c) => c.requirement); },
  noMatches: "No matches yet",
} as const;

/** The two affordability lines kept apart: the rent limit, and the savings goal. */
export function affordabilityLines(checks: readonly RequirementCheck[]): { label: string; status: RequirementCheck["status"]; detail: string }[] {
  const rent = checks.find((c) => /rent/i.test(c.requirement) && !/saving/i.test(c.requirement));
  const saving = checks.find((c) => /saving/i.test(c.requirement));
  const say = (status: RequirementCheck["status"], yes: string, no: string, unsure: string) => (status === "met" ? yes : status === "failed" ? no : unsure);
  return [
    ...(rent ? [{ label: say(rent.status, "Within your rent limit", "Over your rent limit", "Rent not confirmed"), status: rent.status, detail: rent.detail }] : []),
    ...(saving ? [{ label: say(saving.status, "Affordable while meeting your savings goal", "Would not leave your monthly savings", "Savings goal not confirmed"), status: saving.status, detail: saving.detail }] : []),
  ];
}

/** Everything carried from the conversation into the confirmation card, as label and value rows. */
export function confirmRows(plan: Pick<WatchPlan, "city" | "budgetEur" | "minRooms" | "requirements">): ProjectLine[] {
  const req = plan.requirements ?? {};
  const rows: ProjectLine[] = [];
  rows.push({ label: "Location", value: plan.city ?? "Not set" });
  if (plan.budgetEur != null) rows.push({ label: "Maximum rent", value: `${money(plan.budgetEur)} a month` });
  const area = num(req, "minAreaM2");
  rows.push({ label: "Minimum floor area", value: area !== null ? `${area} m²` : "Not set" });
  if (plan.minRooms != null) rows.push({ label: "Rooms at least", value: String(plan.minRooms) });
  const monthly = num(req, "monthlySavingsEur");
  if (monthly !== null) rows.push({ label: "Keep saving each month", value: `${money(monthly)} (a limit, no money is moved)` });
  const goal = num(req, "savingsGoalEur");
  if (goal !== null) rows.push({ label: "Savings goal", value: money(goal) });
  const moveBy = str(req, "moveBy");
  if (moveBy) rows.push({ label: "Move in by", value: moveBy });
  const commute = num(req, "maxCommuteMinutes");
  const to = str(req, "commuteTo");
  if (commute !== null || to) rows.push({ label: "Commute", value: `${commute !== null ? `${commute} min or less` : "Limit not set"}${to ? ` to ${to}` : ""} (you check it)` });
  return rows;
}

export const AlertRules = {
  unread(alerts: readonly ProjectAlert[], seen: readonly string[]): ProjectAlert[] {
    return alerts.filter((a) => !a.readAt && !seen.includes(a.id)).slice().sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },
  simulatedLabel: "Simulated for demo",
} as const;

/** `?project=<watch id>&finding=<finding id>` (also the URL a tapped notification opens). */
export function parseProjectLink(query: URLSearchParams): { project: string; finding: string | null } | null {
  const clean = (value: string | null) => {
    const text = value?.trim() ?? "";
    return text !== "" && text.length <= 80 && /^[\w-]+$/.test(text) ? text : null;
  };
  const project = clean(query.get("project"));
  return project ? { project, finding: clean(query.get("finding")) } : null;
}
