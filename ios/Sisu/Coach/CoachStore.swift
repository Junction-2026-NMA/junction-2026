// The coach's store: one CoachSession for the chosen customer, rebuilt when the customer or the data source
// changes. Live from the app's base URL (falling back to the bundled sample the first time the server cannot be
// reached, which the session announces once through `fallbackNotice`), or the bundled sample in sample mode.
//
// VOICE: `voice` is the push-to-talk controller of the current session (ios/Sisu/Voice). The seam it fills:
//   voiceState: RiveBindings.VoiceState   what the Rive VoiceButton shows. Follows the session's status
//                                         (recording / thinking / speaking) once a recorder reports to it.
//   voiceDown()                           the VoiceButton's `pressDown`: start recording here.
//   voiceUp()                             the VoiceButton's `pressUp`: stop recording and send it here.
//   session.setRecording(_:), session.sendVoice(audio:...), session.speech, session.speakReplies
//                                         are the CoachSession calls the recorder and speaker need.
import Combine
import Foundation
import Observation
import SisuCore

@MainActor
@Observable
final class CoachStore {
    /// The conversation for the chosen customer. Nil before a customer is chosen.
    private(set) var session: CoachSession?
    /// True when the session answers from the bundled sample because the backend could not be reached.
    private(set) var fellBackToSample = false
    /// The "Mock data" / "Sample data" tag, nil when live. Shown in Settings > Data and sources, not as a badge.
    var dataTag: String? { session.flatMap { CoachText.dataTag(for: $0.dataLabel) } }
    /// When the session switched from the live server to the recordings, if it did.
    var fallenBackAt: Date? { session?.client.fallenBackAt }

    /// Called with the euros a month freed by approved switches whenever the session's actions change.
    @ObservationIgnored var onApprovedSaving: ((Double) -> Void)?

    @ObservationIgnored private var key: String?
    @ObservationIgnored private var watcher: AnyCancellable?

    // MARK: Screen state that outlives a tab switch

    /// The option the user picked per teaching card id. Nothing is revealed before a pick.
    var quizChoices: [String: Int] = [:]
    /// Actions whose Approve or Decline is on its way.
    var deciding: Set<String> = []
    /// The sentence of a failed decision, per action id (410: expired, 409: the server's sentence).
    var decisionNotices: [String: String] = [:]
    /// True from an approval until the next question: Liito cheers.
    var cheering = false

    /// The teaching quiz of a card, with the user's pick applied.
    func quiz(for card: TeachingCard) -> TeachingQuiz {
        var quiz = TeachingQuiz(card: card)
        if let index = quizChoices[card.id] { quiz.choose(index) }
        return quiz
    }

    /// Records a pick. Returns false when the card was already answered.
    @discardableResult
    func choose(_ index: Int, on card: TeachingCard) -> Bool {
        guard quizChoices[card.id] == nil, card.options.indices.contains(index) else { return false }
        quizChoices[card.id] = index
        return true
    }

    /// Approve or decline. Returns the decided action, or nil (the sentence is in `decisionNotices`).
    func decide(_ actionId: String, approve: Bool) async -> AgentAction? {
        guard let session, !deciding.contains(actionId) else { return nil }
        deciding.insert(actionId)
        defer { deciding.remove(actionId) }
        let result = approve ? await session.approve(actionId) : await session.decline(actionId)
        if result == nil {
            decisionNotices[actionId] = session.notice ?? CoachErrors.generic
        } else {
            decisionNotices[actionId] = nil
            if approve, result?.status == .executedSimulated { cheering = true }
        }
        return result
    }

    // MARK: Voice seam

    /// Push to talk for the current session: the recorder and the speech player (ios/Sisu/Voice).
    private(set) var voice: VoiceController?

    /// What the Rive VoiceButton shows.
    var voiceState: RiveBindings.VoiceState { voice?.state ?? .idle }

    /// The VoiceButton was pressed down: start listening.
    func voiceDown() { voice?.pressDown() }

    /// The VoiceButton was released: stop and send what was heard.
    func voiceUp() { voice?.pressUp() }

    /// A typed question. Typed turns are silent unless the voice controller is set to speak them.
    func ask(_ text: String) {
        voice?.beginTypedTurn()
        session?.ask(text)
    }

    /// Sisu works through a whole case on its own.
    func investigate() {
        voice?.beginTypedTurn()
        session?.investigate()
    }

    // MARK: Session

    /// Makes (or keeps) the session for this customer and source. `baseURL` nil means the bundled sample.
    /// - Parameter unreachable: the app already found the backend unreachable and fell back to the sample.
    func configure(customerId: String, baseURL: URL?, unreachable: Bool = false) async {
        let newKey = customerId + "|" + (baseURL?.absoluteString ?? "sample")
        guard newKey != key else {
            fellBackToSample = baseURL == nil ? unreachable : fellBackToSample
            return
        }
        key = newKey
        fellBackToSample = baseURL == nil && unreachable
        if let baseURL {
            // Live until the server cannot be reached; then the session switches to the recordings for good and
            // publishes `fallbackNotice` once, which the Ask screen says in place.
            let live = CoachSession.liveWithSampleFallback(customerId: customerId, baseURL: baseURL)
            use(live)
            _ = await live.warm()
            if key == newKey, live.client.fallenBackAt != nil { fellBackToSample = true }
        } else {
            use(CoachSession.sample(customerId: customerId))
        }
        guard key == newKey, let session else { return }
        await session.refresh()
    }

    /// Forgets the session (the customer was cleared).
    func clear() {
        session?.cancel()
        session = nil
        voice = nil
        key = nil
        watcher = nil
        onApprovedSaving?(0)
    }

    /// Resets the backend's demo state (or the sample's), then the conversation.
    func resetDemo() async {
        guard let session else { return }
        session.reset()
        _ = try? await session.client.resetDemo()
        await session.refresh()
        onApprovedSaving?(session.approvedMonthlySaving)
    }

    private func use(_ next: CoachSession) {
        session?.cancel()
        session = next
        voice = VoiceController(session: next, fixture: VoiceLaunch.current.voiceFixture ? .fixture : nil)
        quizChoices = [:]
        decisionNotices = [:]
        cheering = false
        // `$actions` fires before the value is stored: read the derived saving on the next main-queue turn.
        watcher = next.$actions
            .receive(on: DispatchQueue.main)
            .sink { [weak self, weak next] _ in
                guard let self, let next, self.session === next else { return }
                self.onApprovedSaving?(next.approvedMonthlySaving)
            }
    }
}
