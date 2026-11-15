// The customer's projects (watches) and their findings, for the Sisu tab's drawer, the project view and the watch
// approval card. A store (subscribe/getSnapshot, immutable snapshot) per coach session, so a new customer or new
// settings start clean.
//
// - `load()` reads `GET /api/watch`. `check(runNow)` sends `POST /api/watch/check`, which is what turns
//   Context.dev's changes into findings (nothing on the server does it on its own), then reloads.
// - While at least one screen is attached (`attach()`), the store checks every 60 s when the page is visible and a
//   project is active, and once more whenever the app comes back to the foreground.
// - Pause, resume, edit and mark-read are not on the hosted backend yet. They are probed once with side-effect-free
//   GETs (a POST-only route answers 405, a missing one 404) and their controls stay hidden until a probe says the
//   route exists. A call that still answers 404 hides its control again.
// - Unread findings: `read` from the server when it sends it, otherwise the ids seen on this device.
import { SisuError } from "@/web/core/API";
import type { CoachClient } from "@/web/core/CoachClient";
import { CoachErrors, Store } from "@/web/core/CoachSession";
import { sisuFetch } from "@/web/core/VisitorSession";
import { type PropertyWatch, type WatchNotification, type WatchRequirements, WatchStatus, projectStatusOf } from "@/web/core/WatchModels";
import { Keys } from "./AppState";
import type { SisuDefaults } from "./Defaults";

/** Controls whose routes the hosted backend may not have yet. */
export type ProjectFeature = "pause" | "resume" | "update" | "read";
export type ProjectBusy = "stop" | "pause" | "resume" | "update" | "check";

export interface ProjectsState {
  readonly customerId: string;
  readonly watches: readonly PropertyWatch[];
  /** Newest first, as the server sends them. */
  readonly notifications: readonly WatchNotification[];
  /** The first list has answered. */
  readonly loaded: boolean;
  readonly loading: boolean;
  readonly checking: boolean;
  /** When this device last finished a check (ISO). */
  readonly lastCheckAt: string | null;
  /** The last load or check failure, as a sentence. Earlier data stays. */
  readonly error: string | null;
  /** What the last check reported as not working (pages that could not be read…). */
  readonly checkProblems: readonly string[];
  /** True only once a probe showed the route exists. */
  readonly support: Readonly<Record<ProjectFeature, boolean>>;
  /** True only when the server says a scheduled process reviews the pages while the app is closed
   *  (`watchScheduler: "cron"` in /api/health or `scheduler: "cron"` in the list). Missing means on-open. */
  readonly scheduler: boolean;
  readonly busy: Readonly<Record<string, ProjectBusy>>;
  /** A sentence per watch id after a control failed. */
  readonly notices: Readonly<Record<string, string>>;
  /** Finding ids seen on this device. */
  readonly seen: readonly string[];
  /** Per watch: the findings that were unread when its project was last opened (they keep a "New" mark). */
  readonly fresh: Readonly<Record<string, readonly string[]>>;
}

/** Status of a side-effect-free GET, or null when it could not be sent. */
export type Prober = (path: string) => Promise<number | null>;

const POLL_MS = 60_000;
/** Coming back to the app checks again, but never more often than this (the server allows 12 checks a minute). */
const FOCUS_GAP_MS = 20_000;
const SEEN_KEY = Keys.projectsSeen;
const MAX_SEEN = 300;
const NO_SUPPORT = { pause: false, resume: false, update: false, read: false } as const;

export const ProjectFeatureText: Record<ProjectFeature, string> = { pause: "Pausing is not available on this server yet.",
  resume: "Resuming is not available on this server yet.", update: "Editing requirements is not available on this server yet.", read: "" };

const missingRoute = (error: unknown): boolean =>
  error instanceof SisuError && error.info.kind === "server" && error.info.status === 404 && error.info.message === "";

export const isActiveWatch = (watch: PropertyWatch): boolean => {
  const status = projectStatusOf(watch);
  return status === WatchStatus.active || status === WatchStatus.failing;
};

/** `watchScheduler: "cron"` (rework/api-projects) or the first draft's `services.watchScheduler: true`. */
export function schedulerRuns(report: unknown): boolean {
  if (!report || typeof report !== "object") return false;
  const r = report as { watchScheduler?: unknown; services?: { watchScheduler?: unknown } | null };
  return r.watchScheduler === "cron" || r.services?.watchScheduler === true;
}

export class ProjectStore extends Store<ProjectsState> {
  private static readonly registry = new WeakMap<object, ProjectStore>();

  /** The store for this coach session (made on first use). */
  static forSession(session: { customerId: string; client: CoachClient }, defaults: SisuDefaults | null): ProjectStore {
    const known = ProjectStore.registry.get(session);
    if (known) return known;
    const made = new ProjectStore(session.customerId, session.client, defaults);
    ProjectStore.registry.set(session, made);
    return made;
  }

  private attached = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastFocusCheck = 0;
  private probed = false;
  private healthAsked = false;
  private readonly onVisible = () => { if (this.visible()) void this.refreshOnFocus(); };

  constructor(customerId: string, readonly client: CoachClient, private readonly defaults: SisuDefaults | null,
    private readonly prober: Prober = ProjectStore.fetchProbe(client.baseURL), private readonly now: () => Date = () => new Date()) {
    super({
      customerId, watches: [], notifications: [], loaded: false, loading: false, checking: false, lastCheckAt: null, error: null,
      checkProblems: [], support: NO_SUPPORT, scheduler: false, busy: {}, notices: {}, seen: ProjectStore.readSeen(defaults, customerId), fresh: {},
    });
  }

  static fetchProbe(baseURL: string): Prober {
    return async (path) => {
      try {
        const response = await sisuFetch(`${baseURL}${path}`, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(8_000) });
        return response.status;
      } catch {
        return null;
      }
    };
  }

  // MARK: Derived

  get isLive(): boolean { return this.client.kind === "live"; }
  get hasActive(): boolean { return this.state.watches.some(isActiveWatch); }
  watch(id: string): PropertyWatch | null { return this.state.watches.find((w) => w.id === id) ?? null; }

  /** Findings of one watch, newest first. */
  findings(watchId: string): WatchNotification[] { return ProjectStore.findingsOf(this.state, watchId); }
  static findingsOf(state: ProjectsState, watchId: string): WatchNotification[] {
    return state.notifications.filter((n) => n.watchId === watchId).slice().sort((a, b) => (b.detectedAt ?? "").localeCompare(a.detectedAt ?? ""));
  }

  static isUnread(state: ProjectsState, n: WatchNotification): boolean { return n.read !== true && !n.readAt && !state.seen.includes(n.id); }
  static unreadCount(state: ProjectsState, watchId?: string): number {
    return state.notifications.filter((n) => (watchId === undefined || n.watchId === watchId) && ProjectStore.isUnread(state, n)).length;
  }

  // MARK: Lifecycle (polling while a screen is attached)

  /** A screen that shows projects attaches while mounted; returns the detach function. */
  attach(): () => void {
    this.attached += 1;
    if (this.attached === 1) this.startPolling();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.attached -= 1;
      if (this.attached === 0) this.stopPolling();
    };
  }

  private visible(): boolean { return typeof document === "undefined" || document.visibilityState === "visible"; }

  private startPolling(): void {
    void this.refreshOnFocus();
    this.timer = setInterval(() => { if (this.visible() && this.hasActive) void this.check(); }, POLL_MS);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.onVisible);
    if (typeof window !== "undefined") window.addEventListener("focus", this.onVisible);
  }

  private stopPolling(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onVisible);
    if (typeof window !== "undefined") window.removeEventListener("focus", this.onVisible);
  }

  /** Load, then check when a project is active; at most once per FOCUS_GAP_MS. */
  async refreshOnFocus(): Promise<void> {
    const at = this.now().getTime();
    if (at - this.lastFocusCheck < FOCUS_GAP_MS) return;
    this.lastFocusCheck = at;
    await this.load();
    if (this.hasActive) await this.check();
  }

  // MARK: Reading

  async load(): Promise<void> {
    if (this.state.loading) return;
    this.update({ loading: true });
    try {
      const list = await this.client.watchList(this.state.customerId);
      this.update({
        watches: list.watches, notifications: list.notifications, loaded: true, loading: false, error: null,
        ...(list.scheduler === "cron" ? { scheduler: true } : {}),
      });
      void this.probeOnce();
    } catch (error) {
      this.update({ loading: false, loaded: true, error: CoachErrors.sentence(error) || CoachErrors.generic });
    }
  }

  /** `POST /api/watch/check` (runNow also asks Context.dev to run its monitors; their result shows on a later
   *  check), then the list again. Skipped on the sample and while another check runs. */
  async check(runNow = false): Promise<void> {
    if (!this.isLive || this.state.checking) return;
    this.update({ checking: true });
    try {
      const result = await this.client.watchCheck(this.state.customerId, runNow);
      this.update({ checking: false, lastCheckAt: this.now().toISOString(), checkProblems: result.problems, error: null });
      await this.load();
    } catch (error) {
      this.update({ checking: false, error: CoachErrors.sentence(error) || CoachErrors.generic });
    }
  }

  /** Once per store, after the first list with a watch: which optional routes exist, and whether a scheduler runs. */
  private async probeOnce(): Promise<void> {
    const first = this.state.watches[0];
    if (!this.isLive || this.probed || !first) return;
    this.probed = true;
    const base = `/api/watch/${encodeURIComponent(first.id)}`;
    const paths: [ProjectFeature, string][] = [["pause", `${base}/pause`], ["resume", `${base}/resume`], ["update", base], ["read", `${base}/read`]];
    const statuses = await Promise.all(paths.map(([, path]) => this.prober(path)));
    const exists = (status: number | null) => status !== null && status !== 404 && status < 500;
    const support = Object.fromEntries(paths.map(([feature], i) => [feature, exists(statuses[i])])) as Record<ProjectFeature, boolean>;
    this.update({ support });
    await this.askHealth();
  }

  private async askHealth(): Promise<void> {
    if (this.healthAsked) return;
    this.healthAsked = true;
    try {
      const report: unknown = await this.client.health();
      if (schedulerRuns(report)) this.update({ scheduler: true });
    } catch { /* No health report: promise nothing. */ }
  }

  // MARK: Controls

  stop(id: string): Promise<boolean> { return this.change(id, "stop", () => this.client.watchStop(id, this.state.customerId)); }
  pause(id: string): Promise<boolean> { return this.change(id, "pause", () => this.client.watchPause(id, this.state.customerId), "pause"); }
  resume(id: string): Promise<boolean> { return this.change(id, "resume", () => this.client.watchResume(id, this.state.customerId), "resume"); }
  updateRequirements(id: string, requirements: WatchRequirements): Promise<boolean> {
    return this.change(id, "update", () => this.client.watchUpdate(id, this.state.customerId, requirements), "update");
  }

  /** Check now: asks Context.dev to run the monitors and reviews what has changed so far. */
  async checkNow(id: string): Promise<void> {
    if (this.state.busy[id]) return;
    this.setBusy(id, "check");
    try {
      await this.check(true);
    } finally {
      this.setBusy(id, null);
    }
  }

  /** The watch's findings are seen: on this device at once, and on the server when it has the route. `opening`
   *  (the project was just opened) starts its "New" marks afresh; otherwise new arrivals join them. */
  async markRead(watchId: string, opening = false): Promise<void> {
    const ids = this.findings(watchId).filter((n) => ProjectStore.isUnread(this.state, n)).map((n) => n.id);
    const marked = opening ? ids : [...(this.state.fresh[watchId] ?? []), ...ids];
    if (ids.length > 0 || opening) {
      const seen = [...this.state.seen, ...ids.filter((id) => !this.state.seen.includes(id))].slice(-MAX_SEEN);
      this.update({ seen, fresh: { ...this.state.fresh, [watchId]: marked } });
      if (ids.length > 0) this.writeSeen(seen);
    }
    if (!this.state.support.read || ids.length === 0) return;
    try {
      await this.client.watchMarkRead(watchId, this.state.customerId);
    } catch (error) {
      if (missingRoute(error)) this.update({ support: { ...this.state.support, read: false } });
    }
  }

  dismissNotice(id: string): void {
    if (id in this.state.notices) this.update({ notices: Object.fromEntries(Object.entries(this.state.notices).filter(([key]) => key !== id)) });
  }

  private async change(id: string, busy: ProjectBusy, call: () => Promise<{ watch: PropertyWatch | null }>, feature?: ProjectFeature): Promise<boolean> {
    if (this.state.busy[id]) return false;
    this.setBusy(id, busy);
    this.dismissNotice(id);
    try {
      const { watch } = await call();
      if (watch) this.update({ watches: this.state.watches.map((w) => (w.id === watch.id ? watch : w)) });
      await this.load();
      return true;
    } catch (error) {
      const gone = feature !== undefined && missingRoute(error);
      this.update({
        support: gone ? { ...this.state.support, [feature]: false } : this.state.support,
        notices: { ...this.state.notices, [id]: gone ? ProjectFeatureText[feature] : CoachErrors.sentence(error) || CoachErrors.generic },
      });
      return false;
    } finally {
      this.setBusy(id, null);
    }
  }

  private setBusy(id: string, busy: ProjectBusy | null): void {
    const rest = Object.fromEntries(Object.entries(this.state.busy).filter(([key]) => key !== id));
    this.update({ busy: busy === null ? rest : { ...rest, [id]: busy } });
  }

  // MARK: Seen ids (per customer, in the app's defaults)

  private static readSeen(defaults: SisuDefaults | null, customerId: string): string[] {
    const all = defaults?.json(SEEN_KEY);
    const mine = all && typeof all === "object" && !Array.isArray(all) ? (all as Record<string, unknown>)[customerId] : null;
    return Array.isArray(mine) ? mine.filter((id): id is string => typeof id === "string").slice(-MAX_SEEN) : [];
  }

  private writeSeen(seen: string[]): void {
    if (!this.defaults) return;
    const all = this.defaults.json(SEEN_KEY);
    const rest = all && typeof all === "object" && !Array.isArray(all) ? (all as Record<string, unknown>) : {};
    this.defaults.setJSON(SEEN_KEY, { ...rest, [this.state.customerId]: seen });
  }
}
