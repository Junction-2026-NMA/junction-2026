// The housing effect as the newer backend sends it on a finding (`WatchNotification.housing`, lib/finance/housing.ts
// on rework/api-projects): every month (rent, the change against housing today), once (deposit, moving costs),
// the buffer after the upfront costs and the savings goal. Read defensively, because today's hosted backend sends
// none of it: a figure the server left null stays unknown and its `missing` sentences are shown as they are.
// Pure; no figure is computed here beyond picking and formatting the server's own numbers.
import { Money } from "@/web/core/Presentation";
import type { WatchNotification } from "@/web/core/WatchModels";
import type { HousingView, ProjectLine } from "./ProjectPresenter";

type Obj = Record<string, unknown>;

const money = (eur: number) => Money.format(eur, "en");
const obj = (value: unknown): Obj | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : null);
const num = (o: Obj | null, key: string): number | null =>
  o && typeof o[key] === "number" && Number.isFinite(o[key]) ? (o[key] as number) : null;
const texts = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : []);
/** `{ low, high }` as "€1,000" or "€1,000 to €3,000"; null when either end is missing. */
const range = (value: unknown): string | null => {
  const r = obj(value);
  const low = num(r, "low"), high = num(r, "high");
  if (low === null || high === null) return null;
  return Math.round(low) === Math.round(high) ? money(low) : `${money(low)} to ${money(high)}`;
};
const signedMonth = (eur: number) => (Math.round(eur) === 0 ? "the same as today" : `${Money.signed(eur, "en")} a month`);

export const BackendHousing = {
  /** The backend's shape: `recurring` and `upfront` objects beside `rentEur`. */
  matches(value: unknown): boolean {
    const o = obj(value);
    return !!o && obj(o.recurring) !== null && obj(o.upfront) !== null;
  },

  /** The finding's own "Why it matters" rows already say what an average month leaves over: not repeated here. */
  view(value: unknown, n: Pick<WatchNotification, "leftOverAfterEur">): HousingView {
    const o = obj(value) ?? {};
    const recurring = obj(o.recurring), upfront = obj(o.upfront), buffer = obj(o.buffer), goal = obj(o.savingsGoal);
    const monthly: ProjectLine[] = [];
    const once: ProjectLine[] = [];
    const totals: ProjectLine[] = [];

    const rent = num(o, "rentEur");
    if (rent !== null) monthly.push({ label: "Rent", value: `${money(rent)} a month` });
    const today = num(recurring, "currentHousingEur");
    if (today !== null) monthly.push({ label: "Your housing today", value: `${money(today)} a month` });
    const utilities = num(recurring, "utilitiesChangeEur");
    if (utilities !== null) monthly.push({ label: "Water and other charges", value: signedMonth(utilities) });
    const transport = num(recurring, "transportChangeEur");
    if (transport !== null) monthly.push({ label: "Transport", value: signedMonth(transport) });
    const change = num(recurring, "knownChangeEur");
    if (change !== null) totals.push({ label: "Compared with your housing today", value: signedMonth(change) });
    const leftAfter = num(recurring, "leftOverAfterEur");
    if (leftAfter !== null && n.leftOverAfterEur == null) {
      totals.push(leftAfter >= 0
        ? { label: "An average month would leave you", value: `about ${money(leftAfter)}` }
        : { label: "An average month would be short by", value: `about ${money(-leftAfter)}` });
    }

    const deposit = num(upfront, "depositEur");
    const assumed = range(upfront?.depositAssumedEur);
    if (deposit !== null) once.push({ label: "Deposit", value: money(deposit) });
    else if (assumed !== null) once.push({ label: "Deposit (assumed)", value: assumed });
    const moving = num(upfront, "movingCostEur");
    if (moving !== null) once.push({ label: "Moving costs (your estimate)", value: money(moving) });
    const upfrontTotal = range(upfront?.rangeEur);
    if (upfrontTotal !== null) totals.push({ label: "Once, before moving in", value: upfrontTotal });

    const after = range(buffer?.afterUpfrontEur);
    if (after !== null) totals.push({ label: "Your balance after the upfront costs", value: after });
    const keep = num(buffer, "keepEur");
    if (keep !== null) {
      const keeps = buffer?.keeps === "yes" ? "kept" : buffer?.keeps === "no" ? "not kept" : buffer?.keeps === "depends" ? "depends on the deposit" : null;
      totals.push({ label: `The ${money(keep)} you want to keep`, value: keeps ?? "not worked out" });
    }
    const goalEur = num(goal, "goalEur");
    if (goalEur !== null) {
      const months = (value: number | null) => (value === null ? "not reachable from what a month leaves" : `${value} month${value === 1 ? "" : "s"}`);
      totals.push({ label: `Months to your ${money(goalEur)} savings goal`, value: `${months(num(goal, "monthsNow"))} now, ${months(num(goal, "monthsAfter"))} after moving` });
    }

    const assumptions = texts(o.assumptions).filter((line) => /assum/i.test(line));
    return { monthly, upfront: once, totals, missing: texts(o.missing), note: assumptions.length ? assumptions.join(" ") : null, fromServer: true };
  },
} as const;
