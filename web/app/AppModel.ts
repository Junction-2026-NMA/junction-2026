// The one model for the whole app: where the data comes from, which customer is shown, the loaded overview
// and the settings. Port of ios/Sisu/App/AppModel.swift. Views read its snapshot (AppState,
// through useApp()/useAppSelector() in AppProvider.tsx) and call its methods; they hold no logic of their own.
// The hooks and seams are listed in web/README.md ("App model"), with the Swift names they mirror.
import { FixtureAPI, LiveAPI, SisuError, type SisuAPI } from "@/web/core/API";
import { CoachClient } from "@/web/core/CoachClient";
import type { DemoCustomer, EvidenceFilter, RecurringBill, ScenarioInput, ScenarioResponse, TransactionList } from "@/web/core/Models";
import { Store } from "@/web/core/CoachSession";
import { CoachBillMatch } from "@/web/core/AppLogic/CoachAppLogic";
import { DayStamp } from "@/web/core/AppLogic/DayStamp";
import { OnboardingFlow } from "@/web/core/AppLogic/Onboarding";
import { SampleEvidence } from "@/web/core/AppLogic/SampleEvidence";
import { Dates } from "@/web/core/Presentation";
import { AppPrefs } from "./AppPrefs";
import { type AppState, type AppStored, Keys, billKey, clearPersonalData, derive, stringDictionary } from "./AppState";
import { type AppTab, type Celebration, EvidenceRequest, LoadState, type TodaySheet } from "./AppTypes";
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
      // As on a clean install: no chosen customer or finished first run, and none of the personal data
      // (names, preferences, voice languages, conversations, lesson progress).
      clearPersonalData(defaults);
      [Keys.customer, Keys.onboarding].forEach((key) => defaults.remove(key));
    }
    const storedFlow = OnboardingFlow.decode(defaults.json(Keys.onboarding));
    const onboarding = OnboardingFlow.atLaunch(storedFlow, launch.onboarding, LaunchOptions.skipsOnboardingByDefault(launch));
    const stored: AppStored = {
      baseURLString: launch.baseURL ?? defaults.string(Keys.baseURL) ?? AppModel.defaultBaseURL,
      sampleOnly: launch.sampleOnly ?? defaults.bool(Keys.sample),
      apiKind: "bundledSample",
      backendAnswered: null,
      customers: [],
      customersState: LoadState.idle,
      customer: null,
      restoringCustomer: !OnboardingFlow.isActive(onboarding) && (launch.customerId ?? defaults.string(Keys.customer)) !== null,
      overview: null,
      overviewState: LoadState.idle,
      tab: launch.tab ?? "sisu",
      historyOpen: false,
      openProjectId: null,
      onboarding,
      evidence: null,
      todaySheet: null,
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
    this.coach.attachDefaults(defaults);
    this.coach.setLanguage(stored.prefs.language);
    this.coach.setBuffer(stored.prefs.bufferEur);
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

  /** Changes some preferences (each value checked; an invalid one is ignored) and stores them. A new language or
   *  buffer applies to the coach session at once (the buffer goes with every question); the conversation and
   *  projects stay. */
  setPrefs(change: Partial<AppPrefs>): void {
    const prefs = AppPrefs.merge(this.state.prefs, change);
    if (AppPrefs.equals(prefs, this.state.prefs)) return;
    this.defaults.setJSON(Keys.prefs, prefs);
    if (prefs.language !== this.state.prefs.language) this.coach.setLanguage(prefs.language);
    if (prefs.bufferEur !== this.state.prefs.bufferEur) this.coach.setBuffer(prefs.bufferEur);
    this.set({ prefs });
  }

  // MARK: Navigation

  setTab(tab: AppTab): void { if (tab !== this.state.tab) this.set({ tab }); }
  /** The chat history drawer on the Sisu tab. */
  setHistoryOpen(historyOpen: boolean): void { if (historyOpen !== this.state.historyOpen) this.set({ historyOpen }); }
  /** Shows a project (a watch id) on the Sisu tab; null closes it. */
  setOpenProjectId(openProjectId: string | null): void { if (openProjectId !== this.state.openProjectId) this.set({ openProjectId }); }

  /** Asks Sisu from anywhere (a suggestion on Today, "Ask Sisu" in a lesson, a project): the Sisu tab with nothing
   *  over the conversation (no drawer or project), then the question through the coach (`coach.ask`, typed turn) in
   *  the same conversation. A hands-free conversation ends first (its microphone must not record over the answer).
   *  A blank question only opens the tab. */
  askSisu(question: string): void {
    this.set({ tab: "sisu", historyOpen: false, openProjectId: null });
    if (question.trim() === "") return;
    this.coach.conversation?.end();
    this.coach.ask(question);
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
   * Runs once; later calls return the same promise. `restoringCustomer` ends once that customer's overview and coach
   * session are there (`choose`), or when it turns out to be missing. */
  start(): Promise<void> {
    this.started ??= (async () => {
      await this.loadCustomers();
      // While the first run is on screen the user chooses the customer in it.
      if (OnboardingFlow.isActive(this.state.onboarding)) return this.endRestoring();
      const id = this.launch.customerId ?? this.defaults.string(Keys.customer);
      const match = id === null ? undefined : this.state.customers.find((c) => c.customerId === id);
      if (!match) return this.endRestoring();
      await this.choose(match);
    })();
    return this.started;
  }

  private endRestoring(): void {
    if (this.state.restoringCustomer) this.set({ restoringCustomer: false });
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
    // The coach session is made at once (before the server is warmed): a restore can show the main screen now.
    const coach = this.configureCoach();
    this.endRestoring();
    await coach;
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
      customer: null, restoringCustomer: false, overview: null, overviewState: LoadState.idle, historyOpen: false, openProjectId: null, tab: "sisu",
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

  /** "Look into my finances": the Sisu tab, where the investigation's stages arrive in the conversation.
   *  A hands-free conversation in progress ends first. */
  startInvestigation(): void {
    this.coach.conversation?.end();
    this.set({ tab: "sisu", historyOpen: false, openProjectId: null, investigationRequests: this.state.investigationRequests + 1 });
    this.coach.investigate();
  }

  resetDemo(): void {
    // The backend's demo state (actions, memory) and the conversation go too. A server that refuses the reset
    // (401/403 when SISU_RESET_TOKEN is set) changes nothing here: the demo still starts over locally.
    const session = this.coach.session;
    session?.reset();
    this.coach.clearHistory();
    const client = session?.client ?? (this.isLive ? CoachClient.live(this.state.baseURLString) : null);
    if (client) void client.resetDemo().catch(() => null);
    clearPersonalData(this.defaults);
    const prefs = AppPrefs.defaults;
    if (prefs.language !== this.state.prefs.language) this.coach.setLanguage(prefs.language);
    this.coach.setBuffer(prefs.bufferEur);
    this.set({ confirmedBillNames: {}, approvedMonthlySaving: 0, todaySheet: null, prefs });
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
