// Push to talk for any screen that has a `CoachSession`. It is `@Observable`, so an `@Observable` store can
// hold it and views that read `voice.state` update by themselves. In CoachStore (Sisu/Coach) it is:
//
//   private(set) var voice: VoiceController?                       // in use(_ next:): voice = VoiceController(session: next)
//   var voiceState: RiveBindings.VoiceState { voice?.state ?? .idle }
//   func voiceDown() { voice?.pressDown() }
//   func voiceUp() { voice?.pressUp() }
//
// and on screen: show `voice?.notice` when it is set, and a Rive `Toggle` bound to `voice.isMuted`.
// VoiceOver cannot hold a button: give the VoiceButton `.riveAccessible(voice.accessibilityLabel, isButton: true)
// { voice.toggleFromAccessibility() }` (first activation listens, the second sends).
//
// The controller installs a `SpeechPlayer` as `session.speech`, so replies are spoken (unless muted).
// Voice failing never blocks typing: every failure is a sentence in `notice`.
import Combine
import Observation
import SisuCore
import SwiftUI

@MainActor
@Observable
final class VoiceController {
    let session: CoachSession
    let player: SpeechPlayer

    /// What the Rive `VoiceButton` shows.
    private(set) var state: RiveBindings.VoiceState = .idle
    /// A sentence to show: microphone denied, too short a press, speech failed. Nil when all is well.
    var notice: String?
    /// Spoken clips that started playing (for the voice lab).
    private(set) var clipsPlayed = 0
    /// On: replies are not spoken; answers continue as text.
    var isMuted = false {
        didSet {
            guard isMuted != oldValue else { return }
            player.isMuted = isMuted
            if isMuted {
                session.speakReplies = false
                player.stop()
            }
            notice = isMuted ? VoiceText.muted : nil
        }
    }

    /// On: typed questions and investigations are spoken too. Off (the default): only a question asked by voice
    /// gets a spoken reply, so typing stays silent and spends no speech credit.
    var speakTypedReplies = false

    /// Call before a typed question or an investigation starts: sets whether that reply is spoken.
    func beginTypedTurn() {
        session.speakReplies = speakTypedReplies && !isMuted
    }

    /// Records from the microphone, or sends `fixture` when it is set (tests without a microphone).
    var fixture: VoiceRecording?

    @ObservationIgnored private let recorder = VoiceRecorder()
    @ObservationIgnored private var pressedAt: Date?
    private var isRecording = false { didSet { updateState() } }
    @ObservationIgnored private var cancellables: Set<AnyCancellable> = []

    init(session: CoachSession, fixture: VoiceRecording? = nil) {
        self.session = session
        self.fixture = fixture
        player = SpeechPlayer(client: session.client, session: session)
        session.speech = player
        session.speakReplies = false
        player.onFailure = { [weak self] sentence in self?.notice = sentence }
        player.onClipStarted = { [weak self] count in self?.clipsPlayed = count }
        recorder.onAutoStop = { [weak self] interrupted in
            guard let self else { return }
            if interrupted {
                self.recorder.discard()
                self.finishRecording()
                self.notice = VoiceText.interrupted
            } else {
                self.pressUp()
            }
        }
        session.objectWillChange
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.updateState() }
            .store(in: &cancellables)
    }

    /// The `VoiceButton`'s out triggers: `pressDown` and `pressUp`.
    func handle(_ trigger: String) {
        switch trigger {
        case "pressDown": pressDown()
        case "pressUp": pressUp()
        default: break
        }
    }

    /// VoiceOver cannot hold a button: the first activation starts listening, the second sends.
    func toggleFromAccessibility() {
        if isRecording { pressUp() } else { pressDown() }
    }

    var accessibilityLabel: String { "Talk to Sisu. " + VoiceButtonPresenter.label(state) }

    /// Starts listening. Asks for the microphone the first time. Stops anything Sisu is saying.
    func pressDown() {
        guard !isRecording else { return }
        notice = nil
        pressedAt = Date()
        isRecording = true
        session.setRecording(true)
        guard fixture == nil else { return }
        Task {
            guard await VoiceAudioSession.requestMicrophone() else {
                self.finishRecording()
                self.notice = VoiceText.microphoneDenied
                return
            }
            // The finger may have lifted while the permission alert was up.
            guard self.isRecording else { return }
            do {
                try self.recorder.start()
            } catch {
                self.finishRecording()
                self.notice = VoiceText.recordingFailed
            }
        }
    }

    /// Stops listening and sends what was heard, unless the press was too short or silent.
    func pressUp() {
        guard isRecording else { return }
        let held = pressedAt.map { Date().timeIntervalSince($0) } ?? 0
        let recording = fixture ?? recorder.stop()
        finishRecording()
        let outcome = VoicePressRule.outcome(pressedFor: held, bytes: recording?.data.count ?? 0)
        switch outcome {
        case .tooShort:
            notice = VoiceText.holdHint
        case .tooLarge:
            notice = VoiceText.tooLong
        case .send:
            guard let recording else { return }
            session.speakReplies = !isMuted
            session.sendVoice(audio: recording.data, fileName: recording.fileName, mimeType: recording.mimeType)
        }
    }

    private func finishRecording() {
        pressedAt = nil
        isRecording = false
        session.setRecording(false)
    }

    private func updateState() {
        let new = VoiceButtonPresenter.state(isRecording: isRecording, status: session.status)
        if new != state { state = new }
    }
}

extension VoiceRecording {
    /// A one-second bundled test clip (a soft tone as 16 kHz WAV), sent instead of the microphone in fixture mode.
    static var fixture: VoiceRecording {
        VoiceRecording(data: VoiceAudioFormat.testRecording(), seconds: 1, fileName: "speech.wav", mimeType: "audio/wav")
    }
}
