// The coach's store: one CoachSession for the chosen customer, rebuilt when the customer or the data source
// changes. Port of ios/Sisu/Coach/CoachStore.swift. Live from the app's base URL (same origin on the web),
// falling back to the bundled sample the first time the server cannot be reached (the session announces it once
// through `fallbackNotice`), or the bundled sample in sample mode.
//
// A store (subscribe/getSnapshot) with an immutable `CoachStoreState`. The session and the voice controller are
// stores of their own: read them with `useCoachSession()` / `useVoice()` (web/app/AppProvider.tsx), so a
// streaming answer re-renders only what reads the session.
//
// VOICE: `voice` is the push-to-talk controller of the current session (web/voice). The seam it fills:
//   voiceState        what the Rive VoiceButton shows (`useVoiceState()` in a component)
//   voiceDown()       the VoiceButton's `pressDown`: start recording here.
//   voiceUp()         the VoiceButton's `pressUp`: stop recording and send it here.
// `conversation` is the hands-free conversation of the Talk screen for the same session (web/voice/
// ConversationController.ts). It shares the voice controller's speech player, so "Speak replies" applies to it too.
//
// HISTORY: the conversation on screen is saved to this device after every answer (`Keys.conversations`, per
// customer, web/core/ConversationHistory.ts). `newConversation()` starts a fresh one, `openConversation(id)` puts a
// saved one back into the session (with its model context), `deleteConversation(id)` forgets one.
import { CoachErrors, CoachSession, Store, makeUUID, type CoachMessage } from "@/web/core/CoachSession";
import { ConversationHistory, type ConversationArchive, type SavedConversation } from "@/web/core/ConversationHistory";
import { ActionStatus, type AgentAction, type TeachingCard } from "@/web/core/CoachModels";
import { CoachText, TeachingQuiz } from "@/web/core/CoachPresentation";
import type { RiveBindings } from "@/web/core/RiveContract";
import { ConversationController } from "@/web/voice/ConversationController";
import { VoiceController, fixtureRecording } from "@/web/voice/VoiceController";
import { VoiceLaunch } from "@/web/voice/VoiceLaunch";
import { TalkLaunch } from "@/web/features/Talk/TalkLaunch";
import { Keys } from "./AppState";
import { paydayStore } from "./PaydayStore";
import type { SisuDefaults } from "./Defaults";

export interface CoachStoreState {
  /** The conversation for the chosen customer. Null before a customer is chosen. */
  readonly session: CoachSession | null;
  /** Push to talk for the current session. Null with no session. */
  readonly voice: VoiceController | null;
  /** The hands-free conversation of the Talk screen for the current session. Null with no session. */
  readonly conversation: ConversationController | null;
  /** True when the session answers from the bundled sample because the backend could not be reached. */
  readonly fellBackToSample: boolean;
  // Screen state that outlives a tab switch.
  /** The option the user picked per teaching card id. Nothing is revealed before a pick. */
  readonly quizChoices: Readonly<Record<string, number>>;
  /** Actions whose Approve or Decline is on its way. */
  readonly deciding: readonly string[];
  /** The sentence of a failed decision, per action id (410: expired, 409: the server's sentence). */
  readonly decisionNotices: Readonly<Record<string, string>>;
  /** True from an approval until the next question: Liito cheers. */
  readonly cheering: boolean;
  /** The id of the conversation on screen (its entry in `savedConversations` once it has an answer). */
  readonly conversationId: string;
  /** This customer's saved conversations, newest first (the chat history drawer). */
  readonly savedConversations: readonly SavedConversation[];
}

export class CoachStore extends Store<CoachStoreState> {
  /** Called with the euros a month freed by approved switches whenever the session's actions change. */
  onApprovedSaving: ((saving: number) => void) | null = null;

  private key: string | null = null;
  private watcher: (() => void) | null = null;
  private defaults: SisuDefaults | null = null;
  /** The messages saved last, so an unchanged conversation is not written again. */
  private savedMessages: readonly CoachMessage[] | null = null;
  private restoring = false;
  /** The answer language for every session (AppPrefs.language): `auto` or a code such as `fi`. */
  private language = "auto";
  /** The protected buffer for every session (AppPrefs.bufferEur), in euros; null when none was set. */
  private bufferEur: number | null = null;
  /** The Sisu tab's unsent text, by conversation id: it outlives a tab switch (the screen unmounts). Not state, so
   *  typing re-renders only the field. */
  private drafts = new Map<string, string>();

  constructor() {
    super({
      session: null, voice: null, conversation: null, fellBackToSample: false, quizChoices: {}, deciding: [], decisionNotices: {}, cheering: false,
      conversationId: makeUUID(), savedConversations: [],
    });
  }

  /** Where conversations are saved (the app's defaults). Without it nothing is stored. */
  attachDefaults(defaults: SisuDefaults): void { this.defaults = defaults; }

  get session(): CoachSession | null { return this.state.session; }
  get voice(): VoiceController | null { return this.state.voice; }
  get conversation(): ConversationController | null { return this.state.conversation; }
  get fellBackToSample(): boolean { return this.state.fellBackToSample; }

  /** The "Mock data" / "Sample data" tag, null when live. Reads the session now (use `useCoachDataTag()` in React). */
  get dataTag(): string | null {
    const session = this.state.session;
    return session ? CoachText.dataTag(session.dataLabel) : null;
  }

  /** When the session switched from the live server to the recordings, if it did. */
  get fallenBackAt(): Date | null { return this.state.session?.client.fallenBackAt ?? null; }

  // MARK: Screen state

  /** The teaching quiz of a card, with the user's pick applied. */
  quiz(card: TeachingCard): TeachingQuiz {
    const quiz = TeachingQuiz.make(card);
    const index = this.state.quizChoices[card.id];
    return index === undefined ? quiz : TeachingQuiz.choose(quiz, index);
  }

  /** Records a pick. Returns false when the card was already answered. */
  choose(index: number, card: TeachingCard): boolean {
    if (this.state.quizChoices[card.id] !== undefined || !Number.isInteger(index) || index < 0 || index >= card.options.length) return false;
    this.update({ quizChoices: { ...this.state.quizChoices, [card.id]: index } });
    this.savedMessages = null;
    this.saveConversation();
    return true;
  }

  isDeciding(actionId: string): boolean { return this.state.deciding.includes(actionId); }

  /** The unsent text of a conversation (the one on screen by default), "" when there is none. */
  draft(conversationId: string = this.state.conversationId): string { return this.drafts.get(conversationId) ?? ""; }

  /** Keeps the unsent text of a conversation; "" forgets it (sent, or cleared). */
  setDraft(text: string, conversationId: string = this.state.conversationId): void {
    if (text === "") this.drafts.delete(conversationId);
    else this.drafts.set(conversationId, text);
  }

  setCheering(cheering: boolean): void {
    if (cheering !== this.state.cheering) this.update({ cheering });
  }

  /** Approve or decline. Returns the decided action, or null (the sentence is in `decisionNotices`). */
  async decide(actionId: string, approve: boolean): Promise<AgentAction | null> {
    const session = this.state.session;
    if (!session || this.state.deciding.includes(actionId)) return null;
    this.update({ deciding: [...this.state.deciding, actionId] });
    try {
      const result = approve ? await session.approve(actionId) : await session.decline(actionId);
      const rest = Object.fromEntries(Object.entries(this.state.decisionNotices).filter(([id]) => id !== actionId));
      if (result === null) {
        this.update({ decisionNotices: { ...rest, [actionId]: session.getSnapshot().notice ?? CoachErrors.generic } });
      } else {
        this.update({ decisionNotices: rest, cheering: approve && result.status === ActionStatus.executedSimulated ? true : this.state.cheering });
      }
      return result;
    } finally {
      this.update({ deciding: this.state.deciding.filter((id) => id !== actionId) });
    }
  }

  // MARK: Voice seam

  /** What the Rive VoiceButton shows (read now; `useVoiceState()` in React). */
  get voiceState(): RiveBindings.VoiceState { return this.state.voice?.getSnapshot().state ?? "idle"; }

  /** The VoiceButton was pressed down: start listening. */
  voiceDown(): void { this.state.voice?.pressDown(); }

  /** The VoiceButton was released: stop and send what was heard. */
  voiceUp(): void { this.state.voice?.pressUp(); }

  /** A typed question. Typed turns are silent unless the voice controller is set to speak them. The stand-in of a
   *  voice question that was never heard ("(nothing heard)") is not a question: "Try again" on it sends nothing. */
  ask(text: string): void {
    if (CoachSession.isUnheard(text)) return;
    this.state.voice?.beginTypedTurn();
    void this.state.session?.ask(text);
  }

  /** Sisu works through a whole case on its own. */
  investigate(): void {
    this.state.voice?.beginTypedTurn();
    void this.state.session?.investigate();
  }

  // MARK: Session

  /** The language Sisu answers in (and hears, for voice), for this session and the next ones. The conversation stays. */
  setLanguage(language: string): void {
    this.language = language;
    const session = this.state.session;
    if (session) session.language = language;
  }

  /** The person's protected buffer (AppPrefs.bufferEur), for this session and the next ones: every typed and spoken
   *  question carries it, so Sisu's answer keeps the buffer Today uses. Null leaves it out. */
  setBuffer(bufferEur: number | null): void {
    this.bufferEur = CoachSession.validBuffer(bufferEur);
    const session = this.state.session;
    if (session) session.bufferEur = this.bufferEur;
  }

  /**
   * Makes (or keeps) the session for this customer and source. `baseURL` null means the bundled sample.
   * @param unreachable the app already found the backend unreachable and fell back to the sample.
   */
  async configure(customerId: string, baseURL: string | null, unreachable = false): Promise<void> {
    const newKey = customerId + "|" + (baseURL ?? "sample");
    if (newKey === this.key) {
      const fell = baseURL === null ? unreachable : this.state.fellBackToSample;
      if (fell !== this.state.fellBackToSample) this.update({ fellBackToSample: fell });
      return;
    }
    this.key = newKey;
    this.update({ fellBackToSample: baseURL === null && unreachable });
    if (baseURL !== null) {
      // Live until the server cannot be reached; then the session switches to the recordings for good and
      // publishes `fallbackNotice` once, which the Ask screen says in place.
      const live = CoachSession.liveWithSampleFallback(customerId, baseURL);
      this.use(live);
      await live.warm();
      if (this.key === newKey && live.client.fallenBackAt !== null) this.update({ fellBackToSample: true });
    } else {
      this.use(CoachSession.sample(customerId));
    }
    const session = this.state.session;
    if (this.key !== newKey || !session) return;
    await session.refresh();
  }

  // MARK: History

  /** "New chat": the conversation on screen is kept in the history (its unsent draft goes) and a fresh one starts. A hands-free
   *  conversation keeps listening; an answer on its way stops. */
  newConversation(): void {
    this.saveConversation();
    this.drafts.delete(this.state.conversationId);
    const session = this.state.session;
    if (this.state.conversation) this.state.conversation.newConversation();
    else session?.reset();
    this.savedMessages = null;
    this.update({ conversationId: makeUUID(), quizChoices: {}, decisionNotices: {}, cheering: false });
  }

  /** Opens a saved conversation: its messages and context come back into the session, so the next question (typed or
   *  spoken) continues it. The one on screen is saved first. Returns false when there is no such conversation. */
  openConversation(id: string): boolean {
    const session = this.state.session;
    const entry = this.state.savedConversations.find((c) => c.id === id);
    if (!session || !entry) return false;
    if (id === this.state.conversationId) return true;
    this.saveConversation();
    const talk = this.state.conversation;
    if (talk?.flow.isAnswering) talk.interrupt();
    // The restore must not be saved under the id of the conversation it replaces.
    this.restoring = true;
    try {
      session.restore(entry.messages);
    } finally {
      this.restoring = false;
    }
    this.savedMessages = session.getSnapshot().messages;
    this.update({ conversationId: entry.id, quizChoices: entry.quizChoices, decisionNotices: {}, cheering: false });
    // Approval cards in it show the server's current state of their action.
    void session.refresh();
    return true;
  }

  /** Forgets a saved conversation. The one on screen stays on screen (and is saved again after its next answer). */
  deleteConversation(id: string): void {
    const session = this.state.session;
    if (!session) return;
    const list = ConversationHistory.remove(this.state.savedConversations, id);
    if (id === this.state.conversationId) this.savedMessages = null;
    this.writeHistory(session.customerId, list);
  }

  /** Forgets every saved conversation of every customer (the demo starts over). */
  clearHistory(): void {
    this.defaults?.remove(Keys.conversations);
    this.savedMessages = null;
    this.update({ savedConversations: [] });
  }

  /** Saves the conversation on screen when it has settled (nothing pending) and changed since the last save. */
  private saveConversation(): void {
    const session = this.state.session;
    if (!session || !this.defaults || this.restoring) return;
    const messages = session.getSnapshot().messages;
    if (messages === this.savedMessages || messages.some((m) => m.pending)) return;
    const id = this.state.conversationId;
    const existing = this.state.savedConversations.find((c) => c.id === id) ?? null;
    const entry = ConversationHistory.entry(id, messages, this.state.quizChoices, existing, new Date());
    if (!entry) return;
    this.savedMessages = messages;
    this.writeHistory(session.customerId, ConversationHistory.upsert(this.state.savedConversations, entry));
  }

  private writeHistory(customerId: string, list: readonly SavedConversation[]): void {
    const archive = ConversationHistory.store(this.archive(), customerId, list);
    this.defaults?.setJSON(Keys.conversations, archive);
    this.update({ savedConversations: archive[customerId] ?? [] });
  }

  private archive(): ConversationArchive {
    return this.defaults ? ConversationHistory.decodeArchive(this.defaults.json(Keys.conversations)) : {};
  }

  /** Forgets the session (the customer was cleared). */
  clear(): void {
    this.saveConversation();
    this.state.conversation?.shutDown();
    this.state.session?.cancel();
    this.state.voice?.dispose();
    this.watcher?.();
    this.watcher = null;
    this.key = null;
    this.update({ session: null, voice: null, conversation: null, savedConversations: [] });
    this.onApprovedSaving?.(0);
  }

  /** Resets the backend's demo state (or the sample's), then the conversation. */
  async resetDemo(): Promise<void> {
    const session = this.state.session;
    if (!session) return;
    session.reset();
    this.savedMessages = null;
    this.update({ conversationId: makeUUID(), quizChoices: {} });
    await session.client.resetDemo().catch(() => null);
    await session.refresh();
    this.onApprovedSaving?.(session.approvedMonthlySaving);
  }

  private use(next: CoachSession): void {
    this.saveConversation();
    this.state.conversation?.shutDown();
    this.state.session?.cancel();
    this.state.voice?.dispose();
    this.watcher?.();
    next.language = this.language;
    next.bufferEur = this.bufferEur;
    next.paydayFor = paydayStore.get; // v2 payday: the payday and bills confirmed on Today go with every question
    const fixture = VoiceLaunch.current().voiceFixture;
    const voice = new VoiceController(next, fixture ? fixtureRecording() : null);
    const conversation = new ConversationController(next, voice.player, fixture ? fixtureRecording() : null);
    conversation.repliesMuted = () => voice.isMuted;
    conversation.fixtureDelay = TalkLaunch.current().fixtureDelay;
    this.savedMessages = null;
    this.update({
      session: next, voice, conversation, quizChoices: {}, decisionNotices: {}, cheering: false,
      conversationId: makeUUID(), savedConversations: this.archive()[next.customerId] ?? [],
    });
    // Swift watches `$actions`; here every change of the session is checked for a new actions array. A settled
    // conversation is saved to the history.
    let actions = next.getSnapshot().actions;
    this.watcher = next.subscribe(() => {
      if (this.state.session !== next) return;
      this.saveConversation();
      const now = next.getSnapshot().actions;
      if (now === actions) return;
      actions = now;
      this.onApprovedSaving?.(next.approvedMonthlySaving);
    });
  }
}
