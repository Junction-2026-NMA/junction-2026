// Watches (Projects): the models of the watch routes, mirroring the "Watches" block of lib/types.ts on main
// (Listing, WatchPlan, WatchedPage, PropertyWatch, WatchNotification, WatchList, WatchCheck), plus fields the
// backend does not send yet (goal, requirements, paused/failing status, lastSuccessAt, nextCheckAt, read,
// housingEffect). Everything is optional: the hosted backend runs main, so a field may be missing today and a
// screen must say "not known" rather than invent it.
//
// Decoding is tolerant: a field of the wrong type is dropped (undefined), arrays are always arrays (entries that
// are not objects are skipped), and a watch or notification without an `id` is skipped. Only a body that is not
// an object at all throws (CoachClient turns that into `SisuError.invalidResponse`).
import type { Fact } from "./CoachModels";
import { DecodingError, type JSONObject, JSONRead } from "./Models";
import { WatchMonitoring } from "./WatchMonitoring";

/** `EUR/month` (a rent) or `EUR` (a price paid once). */
export type PriceUnit = "EUR/month" | "EUR" | (string & {});
export const PriceUnit = { perMonth: "EUR/month", once: "EUR" } as const;

/** `active` or `stopped` today; `paused` and `failing` once the backend sends them. */
export type WatchStatus = "active" | "stopped" | "paused" | "failing" | (string & {});
export const WatchStatus = { active: "active", stopped: "stopped", paused: "paused", failing: "failing" } as const;

/** The status to draw: the newer backend's derived `projectStatus` (active, paused, stopped or failing) when sent,
 *  else `status` (today's hosted backend: active or stopped). */
export function projectStatusOf(w: { status?: WatchStatus | null; projectStatus?: WatchStatus | null }): WatchStatus {
  return w.projectStatus ?? w.status ?? WatchStatus.active;
}

/** `property_watch` (a flat to rent) or `price_watch` (anything else with a price): an action whose approval really
 *  starts a watch (not simulated). */
export function isWatchKind(kind: string | null | undefined): boolean {
  return kind === "property_watch" || kind === "price_watch";
}

/** `monitor`: Context.dev watches the pages and Sisu reads its changes. `reread`: Sisu re-reads the pages itself. */
export type WatchMode = "monitor" | "reread" | (string & {});

/** `price_drop` or `new_listing`. */
export type WatchNotificationKind = "price_drop" | "new_listing" | (string & {});

/** `context.dev monitor`, `context.dev re-read` or `simulation`. */
export type WatchDetectedBy = "context.dev monitor" | "context.dev re-read" | "simulation" | (string & {});

/** What the user asked for (max rent, move date, rooms, commute…). Not defined by the backend yet: read keys
 *  defensively and show only what is there. */
export type WatchRequirements = Readonly<Record<string, unknown>>;

/** The total effect of a housing finding (rent, utilities, transport, deposit, moving costs…). Not defined by the
 *  backend yet: read keys defensively; a missing figure is unknown, never zero. */
export type HousingEffect = Readonly<Record<string, unknown>>;

/** A flat (or an offer) as read from a page. */
export interface Listing {
  /** Street address or the listing's own short title; for a price watch, the item's name. */
  title?: string | null;
  /** Rent per month for a flat, the full price otherwise (see the watch's `priceUnit`). */
  priceEur?: number | null;
  rooms?: number | null;
  areaM2?: number | null;
  district?: string | null;
  city?: string | null;
  /** As the page states it. */
  availableFrom?: string | null;
  /** Price watch: a few words that tell this offer apart. */
  details?: string | null;
  /** The listing's own page, or the page it was read from. */
  url?: string | null;
  /** The page Context.dev read it from. */
  pageUrl?: string | null;
}

/** What a watch action would watch once approved (`AgentAction.watch`). */
export interface WatchPlan {
  city?: string | null;
  topic?: string | null;
  priceUnit?: PriceUnit | null;
  budgetEur?: number | null;
  minRooms?: number | null;
  urls: string[];
  /** The listings read when the watch was prepared. */
  seen: Listing[];
  /** Future: the goal in the user's words. */
  goal?: string | null;
  /** Future: the requirements the user agreed to. */
  requirements?: WatchRequirements | null;
}

/** One watched page. */
export interface WatchedPage {
  url?: string | null;
  /** Null when the page is re-read on a timer instead. */
  monitorId?: string | null;
  /** The page as last read. */
  listings: Listing[];
  /** The last successful read. */
  lastReadAt?: string | null;
  /** When Context.dev last reported a change. */
  lastChangeAt?: string | null;
  lastError?: string | null;
  /** Newer backends: the page's title, and when Context.dev runs its monitor next. */
  title?: string | null;
  monitorNextRunAt?: string | null;
}

/** A running (or stopped) watch: what the Projects screens show. */
export interface PropertyWatch {
  id: string;
  /** The approved action that started it. */
  actionId?: string | null;
  customerId?: string | null;
  city?: string | null;
  topic?: string | null;
  priceUnit?: PriceUnit | null;
  /** The limit the customer said: rent per month, or a full price. */
  budgetEur?: number | null;
  minRooms?: number | null;
  status?: WatchStatus | null;
  mode?: WatchMode | null;
  pages: WatchedPage[];
  searchMonitorId?: string | null;
  createdAt?: string | null;
  /** The last poll, set even when every page failed. Not the last success: see `lastSuccessAt`. */
  lastCheckedAt?: string | null;
  problems: string[];
  /** Future: the goal in the user's words. */
  goal?: string | null;
  /** Future: editable requirements. */
  requirements?: WatchRequirements | null;
  /** Future: the last check that read every page it tried. */
  lastSuccessAt?: string | null;
  /** Future: when the next scheduled check runs. Absent: there is no schedule to promise. */
  nextCheckAt?: string | null;
  /** Newer backends: `status` plus the pages' errors (`failing`). Draw it through `projectStatusOf`. */
  projectStatus?: WatchStatus | null;
}

/** A finding: a listing that fits now (new, or its price fell). */
export interface WatchNotification {
  id: string;
  watchId?: string | null;
  customerId?: string | null;
  kind?: WatchNotificationKind | null;
  title?: string | null;
  summary?: string | null;
  listing?: Listing | null;
  previousPriceEur?: number | null;
  budgetEur?: number | null;
  underBudgetByEur?: number | null;
  /** A rent: what an average month would leave over with it, from the customer's own figures. */
  leftOverAfterEur?: number | null;
  /** A price paid once: the expected balance just before payday after paying it. */
  balanceAfterEur?: number | null;
  detectedAt?: string | null;
  detectedBy?: WatchDetectedBy | null;
  /** True when the change was made up by the demo's simulate button. Show it. */
  simulated?: boolean | null;
  facts: Fact[];
  /** Future: seen by the user. Newer backends send `readAt` instead (set = read). */
  read?: boolean | null;
  readAt?: string | null;
  /** The total effect of a housing finding: `housing` on newer backends (lib/finance/housing.ts), `housingEffect`
   *  in the shape this client first expected. Read through HousingText.view. */
  housingEffect?: HousingEffect | null;
  housing?: HousingEffect | null;
}

/** Answer of `GET /api/watch`: the watches and the findings, newest first. */
export interface WatchList {
  customerId?: string | null; watches: PropertyWatch[]; notifications: WatchNotification[];
  /** Newer backends: `cron` when a scheduled review runs while the app is closed; missing means `on-open`. */
  scheduler?: string | null;
}

/** Answer of `POST /api/watch/check`: `notifications` holds only the new findings of this check. */
export interface WatchCheck {
  customerId?: string | null;
  checked?: number | null;
  changesSeen?: number | null;
  pagesReread?: number | null;
  notifications: WatchNotification[];
  problems: string[];
}

/** Answer of stop, pause, resume and update: `{ watch }`. */
export interface WatchChange { watch: PropertyWatch | null }

/** Answer of mark read (not on the backend yet): the watch and its findings, when sent. */
export interface WatchReadResult { watch: PropertyWatch | null; notifications: WatchNotification[] }

/** Answer of `POST /api/watch/:id/simulate-drop`: `{ notification }` (labelled simulated). */
export interface SimulatedDrop { notification: WatchNotification | null }

// MARK: - Tolerant readers

const text = (o: JSONObject, key: string): string | null | undefined =>
  o[key] === null ? null : typeof o[key] === "string" ? (o[key] as string) : undefined;
const number = (o: JSONObject, key: string): number | null | undefined =>
  o[key] === null ? null : typeof o[key] === "number" && Number.isFinite(o[key]) ? (o[key] as number) : undefined;
const flag = (o: JSONObject, key: string): boolean | null | undefined =>
  o[key] === null ? null : typeof o[key] === "boolean" ? (o[key] as boolean) : undefined;
const record = (o: JSONObject, key: string): Readonly<Record<string, unknown>> | null | undefined =>
  o[key] === null ? null : JSONRead.isObject(o[key]) ? (o[key] as JSONObject) : undefined;
const texts = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
const many = <T>(value: unknown, decode: (json: unknown) => T | null): T[] =>
  Array.isArray(value) ? value.map(decode).filter((v): v is T => v !== null) : [];
const facts = (value: unknown): Fact[] =>
  many(value, (json) => (JSONRead.isObject(json) && typeof json.label === "string" && typeof json.value === "number" ? (json as unknown as Fact) : null));
const top = (json: unknown): JSONObject => {
  if (!JSONRead.isObject(json)) throw new DecodingError("Expected an object.");
  return json;
};

export const Listing = {
  decode(json: unknown): Listing | null {
    if (!JSONRead.isObject(json)) return null;
    const o = json;
    return {
      title: text(o, "title"), priceEur: number(o, "priceEur"), rooms: number(o, "rooms"), areaM2: number(o, "areaM2"),
      district: text(o, "district"), city: text(o, "city"), availableFrom: text(o, "availableFrom"), details: text(o, "details"),
      url: text(o, "url"), pageUrl: text(o, "pageUrl"),
    };
  },
} as const;

export const WatchPlan = {
  /** Read `AgentAction.watch` through this: it arrives raw from the server. */
  decode(json: unknown): WatchPlan | null {
    if (!JSONRead.isObject(json)) return null;
    const o = json;
    return {
      city: text(o, "city"), topic: text(o, "topic"), priceUnit: text(o, "priceUnit"), budgetEur: number(o, "budgetEur"),
      minRooms: number(o, "minRooms"), urls: texts(o.urls), seen: many(o.seen, Listing.decode),
      goal: text(o, "goal"), requirements: record(o, "requirements"),
    };
  },
} as const;

export const WatchedPage = {
  decode(json: unknown): WatchedPage | null {
    if (!JSONRead.isObject(json)) return null;
    const o = json;
    return {
      url: text(o, "url"), monitorId: text(o, "monitorId"), listings: many(o.listings, Listing.decode),
      lastReadAt: text(o, "lastReadAt"), lastChangeAt: text(o, "lastChangeAt"), lastError: text(o, "lastError"),
      title: text(o, "title"), monitorNextRunAt: text(o, "monitorNextRunAt"),
      ...WatchMonitoring.page(o),
    };
  },
} as const;

export const PropertyWatch = {
  /** Null without a text `id` (nothing could be done with it). */
  decode(json: unknown): PropertyWatch | null {
    if (!JSONRead.isObject(json) || typeof json.id !== "string" || json.id === "") return null;
    const o = json;
    return {
      id: o.id as string, actionId: text(o, "actionId"), customerId: text(o, "customerId"), city: text(o, "city"),
      topic: text(o, "topic"), priceUnit: text(o, "priceUnit"), budgetEur: number(o, "budgetEur"), minRooms: number(o, "minRooms"),
      status: text(o, "status"), mode: text(o, "mode"), pages: many(o.pages, WatchedPage.decode),
      searchMonitorId: text(o, "searchMonitorId"), createdAt: text(o, "createdAt"), lastCheckedAt: text(o, "lastCheckedAt"),
      problems: texts(o.problems), goal: text(o, "goal"), requirements: record(o, "requirements"),
      lastSuccessAt: text(o, "lastSuccessAt"), nextCheckAt: text(o, "nextCheckAt"), projectStatus: text(o, "projectStatus"),
      ...WatchMonitoring.watch(o),
    };
  },
} as const;

export const WatchNotification = {
  /** Null without a text `id`. */
  decode(json: unknown): WatchNotification | null {
    if (!JSONRead.isObject(json) || typeof json.id !== "string" || json.id === "") return null;
    const o = json;
    return {
      id: o.id as string, watchId: text(o, "watchId"), customerId: text(o, "customerId"), kind: text(o, "kind"),
      title: text(o, "title"), summary: text(o, "summary"), listing: Listing.decode(o.listing),
      previousPriceEur: number(o, "previousPriceEur"), budgetEur: number(o, "budgetEur"), underBudgetByEur: number(o, "underBudgetByEur"),
      leftOverAfterEur: number(o, "leftOverAfterEur"), balanceAfterEur: number(o, "balanceAfterEur"), detectedAt: text(o, "detectedAt"),
      detectedBy: text(o, "detectedBy"), simulated: flag(o, "simulated"), facts: facts(o.facts), read: flag(o, "read"),
      readAt: text(o, "readAt"), housingEffect: record(o, "housingEffect"), housing: record(o, "housing"),
    };
  },
} as const;

export const WatchList = {
  /** No watches and no findings (the sample data, or a customer who never approved one). */
  empty(customerId: string | null = null): WatchList { return { customerId, watches: [], notifications: [] }; },
  decode(json: unknown): WatchList {
    const o = top(json);
    return {
      customerId: text(o, "customerId"), watches: many(o.watches, PropertyWatch.decode),
      notifications: many(o.notifications, WatchNotification.decode), scheduler: text(o, "scheduler"),
    };
  },
} as const;

export const WatchCheck = {
  decode(json: unknown): WatchCheck {
    const o = top(json);
    return {
      customerId: text(o, "customerId"), checked: number(o, "checked"), changesSeen: number(o, "changesSeen"),
      pagesReread: number(o, "pagesReread"), notifications: many(o.notifications, WatchNotification.decode), problems: texts(o.problems),
    };
  },
} as const;

export const WatchChange = {
  decode(json: unknown): WatchChange { return { watch: PropertyWatch.decode(top(json).watch) }; },
} as const;

export const WatchReadResult = {
  decode(json: unknown): WatchReadResult {
    const o = top(json);
    return { watch: PropertyWatch.decode(o.watch), notifications: many(o.notifications, WatchNotification.decode) };
  },
} as const;

export const SimulatedDrop = {
  decode(json: unknown): SimulatedDrop { return { notification: WatchNotification.decode(top(json).notification) }; },
} as const;
