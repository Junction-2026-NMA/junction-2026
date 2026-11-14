// The microphone: push to talk into a temporary AAC file (.m4a, 16 kHz mono, about 24 kbit/s, so a full minute
// stays far under the backend's 5 MB limit). Also owns the shared audio session for recording and playback.
import AVFoundation
import SisuCore

/// One finished recording.
struct VoiceRecording {
    let data: Data
    let seconds: TimeInterval
    let fileName: String
    let mimeType: String
}

enum VoiceAudioSession {
    /// Recording and playback together: the speaker (not the earpiece), Bluetooth headsets allowed, and other
    /// apps' audio ducked while Sisu talks.
    static func activate() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default,
                                options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP, .duckOthers])
        try session.setActive(true)
    }

    /// Asks once; the system remembers the answer.
    static func requestMicrophone() async -> Bool {
        switch AVAudioApplication.shared.recordPermission {
        case .granted: return true
        case .denied: return false
        default: return await AVAudioApplication.requestRecordPermission()
        }
    }
}

@MainActor
final class VoiceRecorder: NSObject, AVAudioRecorderDelegate {
    private var recorder: AVAudioRecorder?
    private var startedAt: Date?
    private var url: URL?
    /// Called when recording stopped on its own: the 60 second limit or an interruption.
    var onAutoStop: ((_ interrupted: Bool) -> Void)?

    var isRecording: Bool { recorder?.isRecording == true }

    override init() {
        super.init()
        NotificationCenter.default.addObserver(self, selector: #selector(interruption(_:)),
                                               name: AVAudioSession.interruptionNotification, object: nil)
    }

    func start() throws {
        try VoiceAudioSession.activate()
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("sisu-voice-\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 16_000,
            AVNumberOfChannelsKey: 1,
            AVEncoderBitRateKey: 24_000,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
        ]
        let recorder = try AVAudioRecorder(url: url, settings: settings)
        recorder.delegate = self
        guard recorder.record(forDuration: VoicePressRule.maximumSeconds) else { throw SisuError.invalidState("recorder did not start") }
        self.recorder = recorder
        self.url = url
        startedAt = Date()
    }

    /// Stops and returns what was recorded (nil when nothing was).
    func stop() -> VoiceRecording? {
        guard let recorder, let url else { return nil }
        let seconds = startedAt.map { Date().timeIntervalSince($0) } ?? recorder.currentTime
        recorder.delegate = nil
        recorder.stop()
        self.recorder = nil
        self.url = nil
        startedAt = nil
        defer { try? FileManager.default.removeItem(at: url) }
        guard let data = try? Data(contentsOf: url) else { return nil }
        return VoiceRecording(data: data, seconds: seconds, fileName: "speech.m4a", mimeType: "audio/mp4")
    }

    /// Throws the recording away.
    func discard() {
        _ = stop()
    }

    nonisolated func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        Task { @MainActor in
            guard self.recorder === recorder else { return }
            self.onAutoStop?(false)
        }
    }

    @objc nonisolated private func interruption(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              AVAudioSession.InterruptionType(rawValue: raw) == .began else { return }
        Task { @MainActor in
            guard self.isRecording else { return }
            self.onAutoStop?(true)
        }
    }
}
