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
import { CoachErrors, CoachSession, Store } from "@/web/core/CoachSession";
import { ActionStatus, type AgentAction, type TeachingCard } from "@/web/core/CoachModels";
import { CoachText, TeachingQuiz } from "@/web/core/CoachPresentation";
import type { RiveBindings } from "@/web/core/RiveContract";
import { ConversationController } from "@/web/voice/ConversationController";
import { VoiceController, fixtureRecording } from "@/web/voice/VoiceController";
import { VoiceLaunch } from "@/web/voice/VoiceLaunch";
import { TalkLaunch } from "@/web/features/Talk/TalkLaunch";

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
}

export class CoachStore extends Store<CoachStoreState> {
  /** Called with the euros a month freed by approved switches whenever the session's actions change. */
  onApprovedSaving: ((saving: number) => void) | null = null;

  private key: string | null = null;
  private watcher: (() => void) | null = null;

  constructor() {
    super({ session: null, voice: null, conversation: null, fellBackToSample: false, quizChoices: {}, deciding: [], decisionNotices: {}, cheering: false });
  }

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
    return true;
  }

  isDeciding(actionId: string): boolean { return this.state.deciding.includes(actionId); }

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

  /** Forgets the session (the customer was cleared). */
  clear(): void {
    this.state.conversation?.shutDown();
    this.state.session?.cancel();
    this.state.voice?.dispose();
    this.watcher?.();
    this.watcher = null;
    this.key = null;
    this.update({ session: null, voice: null, conversation: null });
    this.onApprovedSaving?.(0);
  }

  /** Resets the backend's demo state (or the sample's), then the conversation. */
  async resetDemo(): Promise<void> {
    const session = this.state.session;
    if (!session) return;
    session.reset();
    await session.client.resetDemo().catch(() => null);
    await session.refresh();
    this.onApprovedSaving?.(session.approvedMonthlySaving);
  }

  private use(next: CoachSession): void {
    this.state.conversation?.shutDown();
    this.state.session?.cancel();
    this.state.voice?.dispose();
    this.watcher?.();
    const fixture = VoiceLaunch.current().voiceFixture;
    const voice = new VoiceController(next, fixture ? fixtureRecording() : null);
    const conversation = new ConversationController(next, voice.player, fixture ? fixtureRecording() : null);
    conversation.repliesMuted = () => voice.isMuted;
    conversation.fixtureDelay = TalkLaunch.current().fixtureDelay;
    this.update({ session: next, voice, conversation, quizChoices: {}, decisionNotices: {}, cheering: false });
    // Swift watches `$actions`; here every change of the session is checked for a new actions array.
    let actions = next.getSnapshot().actions;
    this.watcher = next.subscribe(() => {
      const now = next.getSnapshot().actions;
      if (now === actions || this.state.session !== next) return;
      actions = now;
      this.onApprovedSaving?.(next.approvedMonthlySaving);
    });
  }
}
