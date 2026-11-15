// The customer's projects (watches) and their findings, for the Sisu tab's drawer, the project view and the watch
// approval card. A store (subscribe/getSnapshot, immutable snapshot) per coach session, so a new customer or new
// settings start clean.
//
// - `load()` reads `GET /api/watch`. `check(runNow)` sends `POST /api/watch/check`, which is what turns
//   Context.dev's changes into findings (nothing on the server does it on its own), then reloads.
// - While at least one screen is attached (`attach()`), the store checks every 60 s when the page is visible and a
//   project is active, and once more whenever the app comes back to the foreground.
// - Pause, resume, edit, mark-read and `GET /api/watch/:id` are not on the hosted backend yet. Nothing is probed (the
//   probes logged 404/405s on every load): the backend that has them marks its list (`hasProjectRoutes`), read once.
//   A call that still answers 404 hides its control again.
// - While a project is open (`open(id)`), its detail is read then and after every check or change: the listings that
//   fit now (`currentMatches`, with their housing effect), kept in `matches`.
// - Unread findings: `read` from the server when it sends it, otherwise the ids seen on this device.
import type { CoachClient } from "@/web/core/CoachClient";
import { CoachErrors, Store } from "@/web/core/CoachSession";
import type { PropertyWatch, WatchNotification, WatchRequirements } from "@/web/core/WatchModels";
import type { CurrentMatch } from "@/web/core/WatchProject";
import type { HousingEvaluation } from "@/web/core/HousingModels";
import type { SisuDefaults } from "./Defaults";
import { ALL_SUPPORT, MAX_SEEN, NO_SUPPORT, type ProjectBusy, type ProjectFeature, ProjectFeatureText, hasProjectRoutes, isActiveWatch,
  missingRoute, readSeen, schedulerRuns, writeSeen } from "./ProjectRules";
export { type ProjectBusy, type ProjectFeature, ProjectFeatureText, hasProjectRoutes, isActiveWatch, schedulerRuns } from "./ProjectRules";

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
  /** The last `GET /api/watch` failed (the drawer then says it could not load the projects and offers Retry). */
  readonly listFailed: boolean;
  /** What the last check reported as not working (pages that could not be read…). */
  readonly checkProblems: readonly string[];
  /** True only once the server's list showed it is the backend with these routes. */
  readonly support: Readonly<Record<ProjectFeature, boolean>>;
  /** True only when the server says a scheduled process reviews the pages while the app is closed
   *  (`watchScheduler: "cron"` in /api/health or `scheduler: "cron"` in the list). Missing means on-open. */
  readonly scheduler: boolean;
  readonly busy: Readonly<Record<string, ProjectBusy>>;
  /** A sentence per watch id after a control failed; an edit's under `ProjectStore.noticeKey(id, "update")`. */
  readonly notices: Readonly<Record<string, string>>;
  /** Finding ids seen on this device. */
  readonly seen: readonly string[];
  /** Per watch: the findings that were unread when its project was last opened (they keep a "New" mark). */
  readonly fresh: Readonly<Record<string, readonly string[]>>;
  /** Per open watch: the listings that fit its requirements now, as last read (`GET /api/watch/:id`). */
  readonly matches: Readonly<Record<string, readonly CurrentMatch[]>>;
  /** v2 housing: per open watch, every listing judged against its requirements now (`GET /api/watch/:id`). */
  readonly evaluations?: Readonly<Record<string, HousingEvaluation | null>>;
}

const POLL_MS = 60_000;
/** Coming back to the app checks again, but never more often than this (the server allows 12 checks a minute). */
const FOCUS_GAP_MS = 20_000;

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
  private routesKnown = false;
  private healthAsked = false;
  /** Watch ids open on screen, with how many screens show each. */
  private readonly opened = new Map<string, number>();
  private readonly onVisible = () => { if (this.visible()) void this.refreshOnFocus(); };

  constructor(customerId: string, readonly client: CoachClient, private readonly defaults: SisuDefaults | null,
    private readonly now: () => Date = () => new Date()) {
    super({
      customerId, watches: [], notifications: [], loaded: false, loading: false, checking: false, lastCheckAt: null, error: null,
      listFailed: false, checkProblems: [], support: NO_SUPPORT, scheduler: false, busy: {}, notices: {}, seen: readSeen(defaults, customerId), fresh: {},
      matches: {},
    });
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
      const routes = this.isLive && !this.routesKnown;
      this.routesKnown ||= this.isLive;
      this.update({
        watches: list.watches, notifications: list.notifications, loaded: true, loading: false, error: null, listFailed: false,
        ...(list.scheduler === "cron" ? { scheduler: true } : {}),
        ...(routes ? { support: hasProjectRoutes(list) ? ALL_SUPPORT : NO_SUPPORT } : {}),
      });
      if (routes && this.state.support.project) void this.reloadOpen();
      if (list.watches.length > 0 && typeof list.scheduler !== "string") void this.askHealth();
    } catch (error) {
      this.update({ loading: false, loaded: true, listFailed: true, error: CoachErrors.sentence(error) || CoachErrors.generic });
    }
  }

  /** `POST /api/watch/check` (runNow also asks Context.dev to run its monitors; their result shows on a later
   *  check), then the list again. Skipped on the sample and while another check runs. Returns the failure as a
   *  sentence (the check's, or the list's after it), null when it worked or did not run. */
  async check(runNow = false): Promise<string | null> {
    if (!this.isLive || this.state.checking) return null;
    this.update({ checking: true });
    try {
      const result = await this.client.watchCheck(this.state.customerId, runNow);
      this.update({ checking: false, lastCheckAt: this.now().toISOString(), checkProblems: result.problems, error: null });
      await this.load();
      await this.reloadOpen();
      return this.state.error;
    } catch (error) {
      const sentence = CoachErrors.sentence(error) || CoachErrors.generic;
      this.update({ checking: false, error: sentence });
      return sentence;
    }
  }

  // MARK: An open project (its current matches)

  /** A project view shows `id` while mounted: its detail is read now and after every check or change. Returns the
   *  close function. */
  open(id: string): () => void {
    this.opened.set(id, (this.opened.get(id) ?? 0) + 1);
    void this.loadProject(id);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      const left = (this.opened.get(id) ?? 1) - 1;
      if (left > 0) this.opened.set(id, left);
      else this.opened.delete(id);
    };
  }

  /** `GET /api/watch/:id`: the listings that fit now. Skipped where the route is not known to exist; a failure keeps
   *  what was shown (the list and its findings still work), and a missing route hides it for good. */
  async loadProject(id: string): Promise<void> {
    if (!this.isLive || !this.state.support.project) return;
    try {
      const project = await this.client.watchProject(id, this.state.customerId);
      const watch = project.watch;
      this.update({
        matches: { ...this.state.matches, [id]: project.currentMatches },
        evaluations: { ...(this.state.evaluations ?? {}), [id]: project.evaluation ?? null },
        ...(watch && watch.id === id ? { watches: this.state.watches.map((w) => (w.id === id ? watch : w)) } : {}),
      });
    } catch (error) {
      if (missingRoute(error)) this.update({ support: { ...this.state.support, project: false } });
    }
  }

  private async reloadOpen(): Promise<void> {
    await Promise.all([...this.opened.keys()].map((id) => this.loadProject(id)));
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

  /** Check now: asks Context.dev to run the monitors and reviews what has changed so far. A failure is also kept
   *  as the watch's notice, so it shows next to the button, not only in the Checks card far above. */
  async checkNow(id: string): Promise<void> {
    if (this.state.busy[id]) return;
    this.setBusy(id, "check");
    this.dismissNotice(id);
    try {
      const failure = await this.check(true);
      if (failure) this.update({ notices: { ...this.state.notices, [id]: failure } });
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
      if (ids.length > 0) writeSeen(this.defaults, this.state.customerId, seen);
    }
    if (!this.state.support.read || ids.length === 0) return;
    try {
      await this.client.watchMarkRead(watchId, this.state.customerId);
    } catch (error) {
      if (missingRoute(error)) this.update({ support: { ...this.state.support, read: false } });
    }
  }

  /** Where a control's failure sentence is kept in `notices`: an edit's under its own key (shown next to Save),
   *  every other one under the watch id (shown with the controls). */
  static noticeKey(id: string, busy?: ProjectBusy): string { return busy === "update" ? `${id}#update` : id; }

  dismissNotice(...keys: string[]): void {
    if (keys.some((key) => key in this.state.notices)) {
      this.update({ notices: Object.fromEntries(Object.entries(this.state.notices).filter(([key]) => !keys.includes(key))) });
    }
  }

  private async change(id: string, busy: ProjectBusy, call: () => Promise<{ watch: PropertyWatch | null }>, feature?: ProjectFeature): Promise<boolean> {
    if (this.state.busy[id]) return false;
    this.setBusy(id, busy);
    this.dismissNotice(id, ProjectStore.noticeKey(id, "update"));
    try {
      const { watch } = await call();
      if (watch) this.update({ watches: this.state.watches.map((w) => (w.id === watch.id ? watch : w)) });
      await this.load();
      await this.reloadOpen();
      return true;
    } catch (error) {
      const gone = feature !== undefined && missingRoute(error);
      this.update({
        support: gone ? { ...this.state.support, [feature]: false } : this.state.support,
        notices: { ...this.state.notices, [ProjectStore.noticeKey(id, busy)]: gone ? ProjectFeatureText[feature] : CoachErrors.sentence(error) || CoachErrors.generic },
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
}
