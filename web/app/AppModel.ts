// The one model for the whole app: where the data comes from, which customer is shown, the loaded overview
// and the settings. Port of ios/Sisu/App/AppModel.swift. Views read its snapshot (AppState,
// through useApp()/useAppSelector() in AppProvider.tsx) and call its methods; they hold no logic of their own.
// The hooks and seams are listed in web/README.md ("App model"), with the Swift names they mirror.
import { FixtureAPI, LiveAPI, SisuError, type SisuAPI } from "@/web/core/API";
import { CoachClient } from "@/web/core/CoachClient";
import type { DemoCustomer, EvidenceFilter, RecurringBill, ScenarioInput, ScenarioResponse, TransactionList } from "@/web/core/Models";
import { Store } from "@/web/core/CoachSession";
import { CoachBillMatch, type CoachRewards } from "@/web/core/AppLogic/CoachAppLogic";
import { DailyProgress, DayStamp } from "@/web/core/AppLogic/DailyProgress";
import { OnboardingFlow } from "@/web/core/AppLogic/Onboarding";
import { SampleEvidence } from "@/web/core/AppLogic/SampleEvidence";
import { Dates } from "@/web/core/Presentation";
import { AppPrefs } from "./AppPrefs";
import { type AppState, type AppStored, Keys, billKey, derive, stringDictionary } from "./AppState";
import { type AppTab, type Celebration, EvidenceRequest, LoadState, type TodaySheet } from "./AppTypes";
import { TalkLaunch } from "@/web/features/Talk/TalkLaunch";
import { CoachStore } from "./CoachStore";
import { LaunchOptions } from "./LaunchOptions";

export class AppModel extends Store<AppState> {
  /** "" = this site's own API routes (iOS: http://localhost:3000). */
  static readonly defaultBaseURL = "";

  /** The coach session for the chosen customer and the voice seam. */
  readonly coach = new CoachStore();
  readonly launch: LaunchOptions;
  private readonly now: () => Date;
  private readonly timeZone: string;
  private api: SisuAPI = new FixtureAPI();
  private started: Promise<void> | null = null;
  /** The stored half of the snapshot (the snapshot adds the derived values). */
  private stored: AppStored;

  constructor(launch: LaunchOptions = LaunchOptions.current(), now: () => Date = () => new Date(), timeZone: string = Dates.currentTimeZone()) {
    const defaults = launch.defaults;
    if (launch.onboarding === "reset") {
      // As on a clean install: no names, old progress, chosen customer, preferences or finished first run.
      [Keys.progress, Keys.billNames, Keys.coachRewards, Keys.customer, Keys.onboarding, Keys.prefs].forEach((key) => defaults.remove(key));
    }
    const storedFlow = OnboardingFlow.decode(defaults.json(Keys.onboarding));
    const stored: AppStored = {
      baseURLString: launch.baseURL ?? defaults.string(Keys.baseURL) ?? AppModel.defaultBaseURL,
      sampleOnly: launch.sampleOnly ?? defaults.bool(Keys.sample),
      apiKind: "bundledSample",
      backendAnswered: null,
      customers: [],
      customersState: LoadState.idle,
      customer: null,
      overview: null,
      overviewState: LoadState.idle,
      tab: launch.tab ?? "sisu",
      conversationShown: TalkLaunch.current().opensConversation,
      historyOpen: false,
      openProjectId: null,
      onboarding: OnboardingFlow.atLaunch(storedFlow, launch.onboarding, LaunchOptions.skipsOnboardingByDefault(launch)),
      evidence: null,
      todaySheet: null,
      progress: DailyProgress.decode(defaults.json(Keys.progress)) ?? DailyProgress.make(),
      confirmedBillNames: stringDictionary(defaults.json(Keys.billNames)),
      approvedMonthlySaving: 0,
      investigationRequests: 0,
      celebration: null,
      prefs: AppPrefs.decode(defaults.json(Keys.prefs)),
    };
    super(derive(stored, DayStamp.from(now(), timeZone)));
    this.stored = stored;
    this.launch = launch;
    this.now = now;
    this.timeZone = timeZone;
    this.coach.setLanguage(stored.prefs.language);
    this.coach.onApprovedSaving = (saving) => {
      if (this.state.approvedMonthlySaving !== saving) this.set({ approvedMonthlySaving: saving });
    };
  }

  private get defaults() { return this.launch.defaults; }
  private get today(): DayStamp { return DayStamp.from(this.now(), this.timeZone); }

  /** Every change goes through here: the derived values are recomputed, then listeners are told. */
  private set(change: Partial<AppStored>): void {
    this.stored = { ...this.stored, ...change };
    this.update(derive(this.stored, this.today));
  }

  /** Recomputes the day-dependent values (call when the app comes back to the foreground). */
  refreshDay(): void {
    if (!DayStamp.equals(this.today, this.state.today)) this.set({});
  }

  get isLive(): boolean { return this.api.kind === "live"; }
  /** The data source in use (SisuAPI). */
  get dataSource(): SisuAPI { return this.api; }

  // MARK: Settings

  /** Swift `baseURLString { didSet }`. Call `applySettings()` after. */
  setBaseURLString(value: string): void {
    this.defaults.setString(Keys.baseURL, value);
    this.set({ baseURLString: value });
  }

  /** Swift `sampleOnly { didSet }`. Call `applySettings()` after. */
  setSampleOnly(value: boolean): void {
    this.defaults.setBool(Keys.sample, value);
    this.set({ sampleOnly: value });
  }

  /** Changes some preferences (each value checked; an invalid one is ignored) and stores them. A new language
   *  applies to the coach session at once; the conversation and projects stay. */
  setPrefs(change: Partial<AppPrefs>): void {
    const prefs = AppPrefs.merge(this.state.prefs, change);
    if (AppPrefs.equals(prefs, this.state.prefs)) return;
    this.defaults.setJSON(Keys.prefs, prefs);
    if (prefs.language !== this.state.prefs.language) this.coach.setLanguage(prefs.language);
    this.set({ prefs });
  }

  // MARK: Navigation

  setTab(tab: AppTab): void { if (tab !== this.state.tab) this.set({ tab }); }
  /** Swift `model.conversationShown = …`: the written conversation as a sheet over Talk. */
  setConversationShown(conversationShown: boolean): void {
    if (conversationShown !== this.state.conversationShown) this.set({ conversationShown });
  }
  /** The chat history drawer on the Sisu tab. */
  setHistoryOpen(historyOpen: boolean): void { if (historyOpen !== this.state.historyOpen) this.set({ historyOpen }); }
  /** Shows a project (a watch id) on the Sisu tab; null closes it. */
  setOpenProjectId(openProjectId: string | null): void { if (openProjectId !== this.state.openProjectId) this.set({ openProjectId }); }

  /** Asks Sisu from anywhere (a suggestion on Today, "Ask Sisu" in a lesson, a project): the Sisu tab with nothing
   *  over the conversation (no sheet, drawer or project), then the question through the coach (`coach.ask`, typed
   *  turn). A blank question only opens the tab. */
  askSisu(question: string): void {
    this.set({ tab: "sisu", conversationShown: false, historyOpen: false, openProjectId: null });
    if (question.trim() !== "") this.coach.ask(question);
  }

  /** Swift `model.evidence = …` (null closes the sheet). */
  setEvidence(evidence: EvidenceRequest | null): void { this.set({ evidence }); }
  /** `model.evidence = EvidenceRequest(title:filter:)`. */
  showEvidence(title: string, filter: EvidenceFilter | null): void { this.set({ evidence: EvidenceRequest.make(title, filter) }); }
  /** Swift `model.todaySheet = …`. */
  setTodaySheet(todaySheet: TodaySheet | null): void { this.set({ todaySheet }); }
  /** Swift `model.celebration = nil` (MainScreen, once it has shown). */
  clearCelebration(): void { if (this.state.celebration) this.set({ celebration: null }); }
  /** Swift `model.celebration = (headline:detail:)` (the Ask approval). */
  setCelebration(celebration: Celebration): void { this.set({ celebration }); }
  /** Swift `model.approvedMonthlySaving = …`. The coach session also sets it when an approval lands. */
  setApprovedMonthlySaving(value: number): void { if (value !== this.state.approvedMonthlySaving) this.set({ approvedMonthlySaving: value }); }

  // MARK: Loading

  /** Loads the customers (live, falling back to the bundled sample), then the chosen customer if one is set.
   * Runs once; later calls return the same promise. */
  start(): Promise<void> {
    this.started ??= (async () => {
      await this.loadCustomers();
      // While the first run is on screen the user chooses the customer in it.
      if (OnboardingFlow.isActive(this.state.onboarding)) return;
      const id = this.launch.customerId ?? this.defaults.string(Keys.customer);
      const match = id === null ? undefined : this.state.customers.find((c) => c.customerId === id);
      if (match) await this.choose(match);
    })();
    return this.started;
  }

  async loadCustomers(): Promise<void> {
    this.set({ customersState: LoadState.loading });
    if (!this.state.sampleOnly) {
      const live = new LiveAPI(this.state.baseURLString);
      try {
        const customers = await live.demoCustomers();
        this.api = live;
        this.set({ customers, apiKind: live.kind, backendAnswered: true, customersState: LoadState.loaded });
        return;
      } catch {
        this.set({ backendAnswered: false });
      }
    } else {
      this.set({ backendAnswered: null });
    }
    this.api = new FixtureAPI();
    try {
      const customers = await this.api.demoCustomers();
      this.set({ customers, apiKind: this.api.kind, customersState: LoadState.loaded });
    } catch {
      this.set({ apiKind: this.api.kind, customersState: LoadState.failed("The demo profiles could not be loaded.") });
    }
  }

  async choose(customer: DemoCustomer): Promise<void> {
    this.set({ customer });
    this.defaults.setString(Keys.customer, customer.customerId);
    await this.loadOverview();
    await this.configureCoach();
  }

  /** Points the coach at the chosen customer and the data source in use (live or the bundled sample). */
  async configureCoach(): Promise<void> {
    const customer = this.state.customer;
    if (!customer) return;
    await this.coach.configure(customer.customerId, this.isLive ? this.state.baseURLString : null, this.state.backendAnswered === false);
  }

  async loadOverview(): Promise<void> {
    const customer = this.state.customer;
    if (!customer) return;
    this.set({ overviewState: LoadState.loading });
    const failed = LoadState.failed("Sisu could not load this profile.");
    try {
      const overview = await this.api.overview(customer.customerId);
      this.set({ overview, overviewState: LoadState.loaded });
    } catch {
      if (!this.isLive) return this.set({ overviewState: failed });
      // The backend went away: fall back to the bundled sample, which is labelled as such.
      this.api = new FixtureAPI();
      this.set({ backendAnswered: false, apiKind: this.api.kind });
      try {
        const overview = await this.api.overview(customer.customerId);
        this.set({ overview, overviewState: LoadState.loaded });
      } catch {
        this.set({ overviewState: failed });
      }
    }
  }

  /** Tries again after a failure, from the customers on. */
  async retry(): Promise<void> {
    await this.loadCustomers();
    if (this.state.customer) {
      await this.loadOverview();
      await this.configureCoach();
    }
  }

  /** Re-reads the data source after the settings changed. */
  applySettings(): Promise<void> { return this.retry(); }

  async transactions(filter: EvidenceFilter | null): Promise<TransactionList> {
    const { customer, overview } = this.state;
    if (!customer) throw SisuError.invalidState("no customer");
    if (this.isLive || !filter || !overview) return this.api.transactions(customer.customerId, filter);
    // Sample data: read the basket file that holds these rows, then keep only the rows of this figure.
    const basket = SampleEvidence.basket(filter, overview);
    const source = await this.api.transactions(customer.customerId, basket === null ? null : { from: filter.from, to: filter.to, basket });
    return SampleEvidence.narrow(source, filter);
  }

  async scenario(input: ScenarioInput): Promise<ScenarioResponse> {
    const customer = this.state.customer;
    if (!customer) throw SisuError.invalidState("no customer");
    return this.api.scenario(customer.customerId, input);
  }

  switchCustomer(): void {
    this.coach.clear();
    this.defaults.remove(Keys.customer);
    this.set({
      customer: null, overview: null, overviewState: LoadState.idle, conversationShown: false, historyOpen: false, openProjectId: null, tab: "sisu",
    });
  }

  // MARK: Hooks (see web/README.md, "App model")

  get flaggedBill(): RecurringBill | null { return this.state.flaggedBill; }

  confirmedName(bill: RecurringBill): string | null {
    const customer = this.state.customer;
    return customer ? this.state.confirmedBillNames[billKey(customer.customerId, bill.id)] ?? null : null;
  }

  billConfirmed(bill: RecurringBill, name: string): void {
    const customer = this.state.customer;
    if (!customer) return;
    const trimmed = name.trim();
    const saved = trimmed === "" ? bill.guessLabel : trimmed;
    const confirmedBillNames = { ...this.state.confirmedBillNames, [billKey(customer.customerId, bill.id)]: saved };
    this.defaults.setJSON(Keys.billNames, confirmedBillNames);
    this.set({ confirmedBillNames });
    // Save the name on the server and start offer research early, so offers are ready before the question.
    const session = this.coach.session;
    if (session) {
      const type = CoachBillMatch.billTypeOfText(saved) ?? CoachBillMatch.billType(bill);
      void session.confirmBill(bill.id, saved, type);
    }
  }

  /** "Look into my finances": Sisu with the written conversation open, where the
   *  investigation's stage cards are. A hands-free conversation in progress ends first. */
  startInvestigation(): void {
    this.coach.conversation?.end();
    this.set({ tab: "sisu", conversationShown: true, investigationRequests: this.state.investigationRequests + 1 });
    this.coach.investigate();
  }

  /** @deprecated The daily actions are gone (2026-11-15): every one counts as done, so callers skip `complete`. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isDone(_action: string): boolean { return true; }
  /** @deprecated The daily actions are gone (2026-11-15): completing one does nothing. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  complete(_action: string): void {}

  /** @deprecated Rewards are gone (2026-11-15): a coach moment (quiz answered, action decided) earns nothing.
   *  Kept as a no-op so callers in Ask still compile until they drop the call. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  coachMoment(_moment: CoachRewards.Moment, _id: string): void {}

  resetDemo(): void {
    // The backend's demo state (actions, memory) and the conversation go too. A server that refuses the reset
    // (401/403 when SISU_RESET_TOKEN is set) changes nothing here: the demo still starts over locally.
    const session = this.coach.session;
    session?.reset();
    const client = session?.client ?? (this.isLive ? CoachClient.live(this.state.baseURLString) : null);
    if (client) void client.resetDemo().catch(() => null);
    [Keys.progress, Keys.billNames, Keys.coachRewards].forEach((key) => this.defaults.remove(key));
    this.set({
      progress: DailyProgress.make(), confirmedBillNames: {},
      approvedMonthlySaving: 0, todaySheet: null,
    });
    this.switchCustomer();
    this.saveOnboarding(OnboardingFlow.restart(this.state.onboarding));
  }

  // MARK: Onboarding

  onboardingContinue(): void { this.saveOnboarding(OnboardingFlow.advance(this.state.onboarding)); }
  onboardingBack(): void { this.saveOnboarding(OnboardingFlow.back(this.state.onboarding)); }
  onboardingSkip(): void { this.saveOnboarding(OnboardingFlow.skipIntro(this.state.onboarding)); }

  /** The profile step's choice: show the reading moment and load the profile's overview. */
  chooseInOnboarding(customer: DemoCustomer): void {
    this.saveOnboarding(OnboardingFlow.profileChosen(this.state.onboarding));
    void this.choose(customer);
  }

  /** The profile could not be read: back to the profile step, with no customer chosen. */
  onboardingReadingFailed(): void {
    this.saveOnboarding(OnboardingFlow.readingFailed(this.state.onboarding));
    this.switchCustomer();
  }

  /** The overview is read and the user goes on: Sisu, the main page, where Liito says the first insight. Today still
   *  highlights it until it is tapped away. */
  finishOnboarding(): void {
    this.set({ tab: "sisu" });
    this.saveOnboarding(OnboardingFlow.finish(this.state.onboarding));
  }

  /** The first-insight callout on Today was tapped away. */
  dismissFirstInsight(): void { this.saveOnboarding(OnboardingFlow.dismissFirstInsight(this.state.onboarding)); }

  private saveOnboarding(onboarding: OnboardingFlow): void {
    this.defaults.setJSON(Keys.onboarding, onboarding);
    if (!OnboardingFlow.equals(onboarding, this.state.onboarding)) this.set({ onboarding });
  }
}
