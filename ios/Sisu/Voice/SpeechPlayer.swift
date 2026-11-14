// Sisu's voice: SisuCore's `SpeechOutput` for the app. Each sentence is fetched from the backend's text to
// speech (through `CoachClient.speech`) as soon as it arrives, and the clips play strictly in order with no
// gap, even when a later clip finishes downloading first (`VoiceClipQueue`). `stop()` is immediate.
import AVFoundation
import SisuCore

/// One downloaded sentence, with the file type its content type names.
struct SpeechClip: Sendable {
    let data: Data
    let fileType: AVFileType?
}

@MainActor
final class SpeechPlayer: NSObject, SpeechOutput, AVAudioPlayerDelegate {
    private let client: CoachClient
    /// The session owns the player (`session.speech`), so the player holds it weakly.
    weak var session: CoachSession?
    /// Off: sentences are dropped and nothing is fetched.
    var isMuted = false
    /// Called with a sentence when a clip could not be fetched or played.
    var onFailure: ((String) -> Void)?
    /// Counts clips that started playing, for the voice lab and its UI test.
    private(set) var clipsPlayed = 0
    var onClipStarted: ((Int) -> Void)?

    private var queue = VoiceClipQueue<SpeechClip>()
    private var downloads: [Task<Void, Never>] = []
    private var player: AVAudioPlayer?
    private var previousText: String?

    init(client: CoachClient, session: CoachSession? = nil) {
        self.client = client
        self.session = session
        super.init()
        NotificationCenter.default.addObserver(self, selector: #selector(interruption(_:)),
                                               name: AVAudioSession.interruptionNotification, object: nil)
    }

    /// A call or another app took the audio: stop talking and drop the rest of this answer (it stays as text).
    @objc nonisolated private func interruption(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              AVAudioSession.InterruptionType(rawValue: raw) == .began else { return }
        Task { @MainActor in self.stop() }
    }

    // MARK: SpeechOutput

    func speak(_ text: String, order: Int) {
        guard !isMuted else { return }
        let generation = queue.generation
        let request = SpeechRequest(text: text, format: "mp3", previousText: previousText)
        previousText = text
        let client = client
        downloads.append(Task { [weak self] in
            let clip: SpeechClip?
            do {
                let audio = try await client.speech(request)
                clip = Self.playable(audio)
            } catch {
                clip = nil
            }
            guard !Task.isCancelled, let self else { return }
            if clip == nil { self.onFailure?(VoiceText.speechFailed) }
            if self.queue.deliver(clip, order: order, generation: generation) { self.playNextIfIdle() }
        })
    }

    func stop() {
        queue.stop()
        downloads.forEach { $0.cancel() }
        downloads = []
        previousText = nil
        if let player {
            player.delegate = nil
            player.stop()
        }
        player = nil
        session?.setSpeaking(false)
    }

    // MARK: Playback

    /// Bytes AVAudioPlayer can open, by the response's content type. Raw PCM gets a WAV header.
    nonisolated private static func playable(_ audio: SpeechAudio) -> SpeechClip? {
        guard !audio.data.isEmpty else { return nil }
        if VoiceAudioFormat.isPCM(contentType: audio.contentType) {
            let wav = VoiceAudioFormat.wav(fromPCM: audio.data, sampleRate: VoiceAudioFormat.pcmRate(contentType: audio.contentType))
            return SpeechClip(data: wav, fileType: .wav)
        }
        let fileType: AVFileType? = switch VoiceAudioFormat.fileTypeHint(contentType: audio.contentType) {
        case "mp3": .mp3
        case "wav": .wav
        case "m4a": .m4a
        default: nil
        }
        return SpeechClip(data: audio.data, fileType: fileType)
    }

    private func playNextIfIdle() {
        guard player == nil else { return }
        while let clip = queue.next() {
            do {
                try VoiceAudioSession.activate()
                let player = try clip.fileType.map { try AVAudioPlayer(data: clip.data, fileTypeHint: $0.rawValue) }
                    ?? AVAudioPlayer(data: clip.data)
                player.delegate = self
                guard player.play() else { continue }
                self.player = player
                clipsPlayed += 1
                onClipStarted?(clipsPlayed)
                session?.setSpeaking(true)
                return
            } catch {
                onFailure?(VoiceText.speechFailed)
            }
        }
        // Nothing ready. Keep "speaking" only while the turn may still send sentences.
        session?.setSpeaking(false)
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in self.finished(player) }
    }

    nonisolated func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        Task { @MainActor in
            self.onFailure?(VoiceText.speechFailed)
            self.finished(player)
        }
    }

    private func finished(_ finishedPlayer: AVAudioPlayer) {
        guard player === finishedPlayer else { return }
        player = nil
        playNextIfIdle()
    }
}
