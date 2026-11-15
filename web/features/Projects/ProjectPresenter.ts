// What the project screens say about a watch and its findings. Pure functions, no React. Every figure comes from
// the server (the watch, its findings and their facts); nothing here estimates a cost, and a missing figure is
// named as missing, never shown as zero.
import { Money } from "@/web/core/Presentation";
import type { Citation } from "@/web/core/CoachModels";
import { type Listing, type PropertyWatch, type WatchNotification, type WatchPlan, PriceUnit, WatchStatus } from "@/web/core/WatchModels";

export type ProjectTone = "active" | "paused" | "stopped" | "attention";
export interface ProjectLine { label: string; value: string }
export interface ProjectSource { title: string; url: string; host: string; detail: string | null; problem: string | null }

/** The few fields a watch and a watch plan share (a project before and after approval). */
type Subject = Pick<WatchPlan, "city" | "topic" | "priceUnit" | "budgetEur" | "minRooms" | "goal" | "requirements">;

const money = (eur: number) => Money.format(eur, "en");
const isRent = (s: Pick<Subject, "priceUnit" | "topic">) => s.priceUnit === PriceUnit.perMonth || (s.priceUnit == null && !s.topic);
/** "flats" → "Flats"; "iPhone 15" stays as written. */
const capital = (text: string) => (text === "" || /^[a-z][A-Z]/.test(text) ? text : text[0].toUpperCase() + text.slice(1));

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Opens only http(s) links (a page's text could carry anything). */
export const safeLink = (url: string | null | undefined): string | null => (url && /^https?:\/\//i.test(url) ? url : null);

export const ProjectText = {
  /** The goal in the user's words, else "Homes in Espoo under €900" / "iPhone 15 under €500". */
  title(s: Subject): string {
    if (s.goal && s.goal.trim() !== "") return s.goal.trim();
    const limit = s.budgetEur != null ? ` under ${money(s.budgetEur)}` : "";
    if (s.topic) return `${capital(s.topic)}${limit}`;
    if (s.city) return `Homes in ${s.city}${limit}`;
    return "Project";
  },

  /** Active / Paused / Stopped / Needs attention (a failing status, a page that could not be read, or a problem). */
  status(w: PropertyWatch): { label: string; tone: ProjectTone } {
    if (w.status === WatchStatus.stopped) return { label: "Stopped", tone: "stopped" };
    if (w.status === WatchStatus.paused) return { label: "Paused", tone: "paused" };
    const troubled = w.status === WatchStatus.failing || w.problems.length > 0 || w.pages.some((p) => !!p.lastError);
    return troubled ? { label: "Needs attention", tone: "attention" } : { label: "Active", tone: "active" };
  },

  /** The last check that read a page: `lastSuccessAt` when the server sends it, else the newest page read. */
  lastSuccess(w: PropertyWatch): string | null {
    if (w.lastSuccessAt) return w.lastSuccessAt;
    const reads = w.pages.map((p) => p.lastReadAt).filter((at): at is string => !!at && !Number.isNaN(Date.parse(at)));
    return reads.sort().at(-1) ?? null;
  },

  /** What checks the pages and when, said honestly. A schedule is promised only when the server names one. */
  schedule(w: PropertyWatch, scheduler: boolean, now: Date = new Date()): string {
    if (w.status === WatchStatus.stopped) return "Stopped. Nothing is being checked.";
    if (w.status === WatchStatus.paused) return "Paused. Nothing is checked until you resume.";
    if (w.nextCheckAt && !Number.isNaN(Date.parse(w.nextCheckAt))) return `Next check ${ProjectText.when(w.nextCheckAt, now)}.`;
    if (scheduler) return "Sisu's server checks these pages on a schedule, also while the app is closed.";
    if (w.pages.some((p) => !!p.monitorId)) return "Context.dev re-checks these pages about every 6 hours. Sisu reviews the changes when you open the app.";
    return "Sisu re-reads these pages itself when you open the app, at most every 30 minutes. Nothing checks them while the app is closed.";
  },

  /** What would be watched / is watched, as label and value rows. */
  requirements(s: Subject): ProjectLine[] {
    const rent = isRent(s);
    const rows: ProjectLine[] = [];
    if (s.city) rows.push({ label: "Where", value: s.city });
    if (s.topic) rows.push({ label: "What", value: capital(s.topic) });
    if (s.budgetEur != null) rows.push({ label: rent ? "Rent at most" : "Price at most", value: rent ? `${money(s.budgetEur)} a month` : money(s.budgetEur) });
    if (s.minRooms != null) rows.push({ label: "Rooms", value: `${s.minRooms} or more` });
    const covered = new Set(["city", "topic", "budgetEur", "minRooms", "priceUnit", "goal"]);
    Object.entries(s.requirements ?? {}).forEach(([key, value]) => {
      const text = ProjectText.value(value);
      if (!covered.has(key) && text !== null) rows.push({ label: ProjectText.label(key), value: text });
    });
    return rows;
  },

  /** "moveDate" → "Move date". */
  label(key: string): string { return capital(key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase().replace(/ eur$/, "")); },

  /** A requirement's value as text; null for anything that is not a plain value or a list of them. */
  value(value: unknown): string | null {
    if (typeof value === "string") return value.trim() === "" ? null : value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) {
      const items = value.map((item) => ProjectText.value(item)).filter((item): item is string => item !== null);
      return items.length ? items.join(", ") : null;
    }
    return null;
  },

  /** The watched pages, with when each was last read and what went wrong. */
  sources(w: PropertyWatch, now: Date = new Date()): ProjectSource[] {
    return w.pages.flatMap((p) => {
      const url = safeLink(p.url);
      if (!url) return [];
      const read = p.lastReadAt ? `Last read ${ProjectText.when(p.lastReadAt, now)}` : "Not read yet";
      const how = p.monitorId ? "Context.dev monitor" : "Re-read by Sisu";
      return [{ title: hostOf(url), url, host: hostOf(url), detail: `${how} · ${read}`, problem: p.lastError ?? null }];
    });
  },

  /** The pages of a proposal (before approval): its sources, else its URLs. */
  planSources(plan: WatchPlan, sources: Citation[]): { title: string; url: string }[] {
    const cited = sources.map((s) => ({ title: s.title || hostOf(s.url), url: safeLink(s.url) })).filter((s): s is { title: string; url: string } => !!s.url);
    if (cited.length) return cited;
    return plan.urls.map(safeLink).filter((u): u is string => !!u).map((url) => ({ title: hostOf(url), url }));
  },

  /** "just now", "12 min ago", "today at 14:05", "yesterday at 09:10", "14 Nov at 23:13"; future: "in 5 min"… */
  when(iso: string, now: Date = new Date()): string {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return iso;
    const minutes = Math.round((at.getTime() - now.getTime()) / 60_000);
    if (Math.abs(minutes) < 1) return "just now";
    if (minutes < 0 && minutes > -60) return `${-minutes} min ago`;
    if (minutes > 0 && minutes < 60) return `in ${minutes} min`;
    const clock = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
    const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((day(at) - day(now)) / 86_400_000);
    if (days === 0) return `today at ${clock}`;
    if (days === -1) return `yesterday at ${clock}`;
    if (days === 1) return `tomorrow at ${clock}`;
    const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][at.getMonth()];
    return `${at.getDate()} ${month} at ${clock}`;
  },
} as const;

// MARK: Findings

export const FindingText = {
  isSimulated(n: WatchNotification): boolean { return n.simulated === true || n.detectedBy === "simulation"; },

  title(n: WatchNotification): string { return n.title || n.listing?.title || "A listing that fits"; },

  /** "€870 a month · 2 rooms · 48 m² · Tapiola". */
  listingLine(l: Listing | null | undefined, rent: boolean): string | null {
    if (!l) return null;
    const parts = [
      l.priceEur != null ? (rent ? `${money(l.priceEur)} a month` : money(l.priceEur)) : null,
      l.rooms != null ? `${l.rooms} room${l.rooms === 1 ? "" : "s"}` : null,
      l.areaM2 != null ? `${l.areaM2} m²` : null,
      l.district ?? l.city ?? null,
      l.details ?? null,
    ].filter((part): part is string => !!part);
    return parts.length ? parts.join(" · ") : null;
  },

  /** Why it matters, in the server's figures only. */
  why(n: WatchNotification, rent: boolean): ProjectLine[] {
    const rows: ProjectLine[] = [];
    if (n.previousPriceEur != null && n.listing?.priceEur != null && n.previousPriceEur > n.listing.priceEur) {
      rows.push({ label: "Price before", value: rent ? `${money(n.previousPriceEur)} a month` : money(n.previousPriceEur) });
    }
    if (n.underBudgetByEur != null) rows.push({ label: "Under your limit by", value: money(n.underBudgetByEur) });
    if (n.leftOverAfterEur != null) {
      rows.push(n.leftOverAfterEur >= 0
        ? { label: "An average month leaves you", value: `about ${money(n.leftOverAfterEur)}` }
        : { label: "An average month would be short by", value: `about ${money(-n.leftOverAfterEur)}` });
    }
    if (n.balanceAfterEur != null) rows.push({ label: "Balance before payday after paying it", value: `about ${money(n.balanceAfterEur)}` });
    return rows;
  },

  /** "Context.dev monitor · today at 14:05" (or "Simulated for the demo · …"). */
  provenance(n: WatchNotification, now: Date = new Date()): string {
    const by = FindingText.isSimulated(n) ? "Made up by the demo button"
      : n.detectedBy === "context.dev monitor" ? "Found by a Context.dev monitor"
        : n.detectedBy === "context.dev re-read" ? "Found when Sisu re-read the page" : "Found by Sisu";
    return n.detectedAt ? `${by} · ${ProjectText.when(n.detectedAt, now)}` : by;
  },

  /** A message the user can copy and send themselves. Asks for what is not known; says nothing private. */
  enquiry(n: WatchNotification): string {
    const l = n.listing;
    const what = [l?.title, l?.rooms != null ? `${l.rooms} room${l.rooms === 1 ? "" : "s"}` : null, l?.areaM2 != null ? `${l.areaM2} m²` : null].filter(Boolean).join(", ");
    const price = l?.priceEur != null ? ` at ${money(l.priceEur)} a month` : "";
    return [
      "Hello,",
      "",
      `I saw your listing${what ? ` for ${what}` : ""}${price}. Is it still available? I would like to come to a viewing.`,
      "Could you also tell me the deposit, what water and electricity cost on top of the rent, and the earliest move-in date?",
      "",
      "Thank you,",
    ].join("\n");
  },
} as const;

// MARK: Housing effect

export interface HousingView {
  /** Known figures: [label, value]. */
  monthly: ProjectLine[];
  upfront: ProjectLine[];
  totals: ProjectLine[];
  missing: string[];
  note: string | null;
  /** True when the server computed the effect; false when only the rent and the server's month figure are known. */
  fromServer: boolean;
}

const DEFAULT_MISSING = ["Deposit", "Utilities (water, electricity)", "Transport change", "Moving costs"];

const num = (o: Record<string, unknown>, ...keys: string[]): number | null => {
  for (const key of keys) if (typeof o[key] === "number" && Number.isFinite(o[key])) return o[key] as number;
  return null;
};

export const HousingText = {
  /** The total effect of a rent finding: the server's `housingEffect` when sent, else what is known and a list of
   *  what is not. Null for a price watch. */
  view(n: WatchNotification, rent: boolean): HousingView | null {
    if (!rent) return null;
    const effect = n.housingEffect;
    if (effect && typeof effect === "object") return HousingText.fromServer(effect as Record<string, unknown>);
    // Only the rent is known, and the listing line and "Why it matters" already show it and what a month leaves:
    // nothing is repeated here, only what is missing.
    return { monthly: [], upfront: [], totals: [], missing: DEFAULT_MISSING, note: "Only the rent is known. Ask the landlord before you count on this home: Sisu does not guess these costs.", fromServer: false };
  },

  /** Reads the server's effect defensively: `items: [{label, amountEur|null, timing: "monthly"|"once"}]`,
   *  `recurringMonthlyEur`, `upfrontEur`, `savingsGoal` / `buffer` sentences and `missing: string[]`. */
  fromServer(o: Record<string, unknown>): HousingView {
    const monthly: ProjectLine[] = [];
    const upfront: ProjectLine[] = [];
    const missing = Array.isArray(o.missing) ? o.missing.filter((m): m is string => typeof m === "string") : [];
    (Array.isArray(o.items) ? o.items : []).forEach((item) => {
      if (!item || typeof item !== "object") return;
      const i = item as Record<string, unknown>;
      const label = typeof i.label === "string" ? i.label : null;
      if (!label) return;
      const amount = num(i, "amountEur", "eur", "value");
      const once = i.timing === "once" || i.timing === "upfront" || i.recurring === false;
      if (amount === null) {
        if (!missing.includes(label)) missing.push(label);
        return;
      }
      (once ? upfront : monthly).push({ label, value: once ? money(amount) : `${money(amount)} a month` });
    });
    const totals: ProjectLine[] = [];
    const recurring = num(o, "recurringMonthlyEur", "monthlyTotalEur");
    const once = num(o, "upfrontEur", "upfrontTotalEur");
    const change = num(o, "monthlyChangeEur", "changePerMonthEur");
    const buffer = num(o, "bufferAfterEur", "balanceAfterUpfrontEur");
    if (recurring !== null) totals.push({ label: "Every month, known costs", value: money(recurring) });
    if (change !== null) totals.push({ label: "Compared with your housing today", value: `${Money.signed(change, "en")} a month` });
    if (once !== null) totals.push({ label: "Once, before moving in", value: money(once) });
    if (buffer !== null) totals.push({ label: "Your buffer after the upfront costs", value: money(buffer) });
    const note = [o.savingsGoal, o.summary].find((s): s is string => typeof s === "string" && s.trim() !== "") ?? null;
    return { monthly, upfront, totals, missing, note, fromServer: true };
  },
} as const;
