// Pure rules behind push-to-talk and Sisu's spoken replies. The app's recorder and player (ios/Sisu/Voice) only
// move audio; every decision they make comes from here.
import Foundation

/// What to do with a finished press of the talk button.
public enum VoicePressOutcome: Equatable, Sendable {
    /// Send the recording.
    case send
    /// Too short or silent: send nothing and show `VoiceText.holdHint`.
    case tooShort
    /// Over the server's size limit: send nothing and show `VoiceText.tooLong`.
    case tooLarge
}

/// The press-length rule: a press shorter than `minimumSeconds`, or an empty recording, sends nothing.
public enum VoicePressRule {
    /// About 0.3 seconds: anything shorter is a tap, not speech.
    public static let minimumSeconds: TimeInterval = 0.3
    /// Recording stops on its own after this long.
    public static let maximumSeconds: TimeInterval = 60
    /// The backend's limit for one recording (`MAX_AUDIO_BYTES` in the backend's `lib/agent/speech.ts`).
    public static let maximumBytes = 5 * 1024 * 1024

    public static func outcome(pressedFor seconds: TimeInterval, bytes: Int) -> VoicePressOutcome {
        guard seconds.isFinite, seconds >= minimumSeconds, bytes > 0 else { return .tooShort }
        return bytes > maximumBytes ? .tooLarge : .send
    }
}

/// The state of the Rive `VoiceButton`, from the microphone and the session.
public enum VoiceButtonPresenter {
    /// The recorder wins (it is the user's finger on the button); otherwise the session's status decides.
    public static func state(isRecording: Bool, status: CoachStatus) -> RiveBindings.VoiceState {
        if isRecording { return .recording }
        switch status {
        case .idle: return .idle
        case .recording: return .recording
        case .thinking: return .thinking
        case .speaking: return .speaking
        }
    }

    /// A short line for the state, for screen readers and the lab screen.
    public static func label(_ state: RiveBindings.VoiceState) -> String {
        switch state {
        case .idle: return "Hold to talk"
        case .recording: return "Listening"
        case .thinking: return "Thinking"
        case .speaking: return "Speaking"
        }
    }
}

/// The app's sentences about voice. Calm, one next step, typing always works.
public enum VoiceText {
    public static let holdHint = "Hold the button while you speak."
    public static let microphoneDenied = "Sisu cannot hear you: allow the microphone in Settings. You can still type."
    public static let recordingFailed = "Sisu could not record that. Try again, or type your question."
    public static let tooLong = "That was a long one. Keep it under a minute, or type it."
    public static let speechFailed = "Sisu could not speak this answer. It is here as text."
    public static let interrupted = "The recording stopped because another sound took over. Try again."
    public static let muted = "Spoken replies are off. Answers come as text."

    /// The line under the "Speak replies" switch.
    public static func speakRepliesDetail(muted: Bool) -> String {
        muted ? "Off: answers come as text only." : "On: Sisu reads each answer aloud."
    }

    /// `1 spoken clip played`, `3 spoken clips played` (the voice lab).
    public static func clipsPlayed(_ count: Int) -> String {
        count == 1 ? "1 spoken clip played" : "\(count) spoken clips played"
    }
}

/// Puts spoken clips back in order. Sentences are fetched in parallel, so clip 2 can arrive before clip 1;
/// the player asks `next()` and gets clips strictly by `order`, never skipping one that has not arrived.
/// A clip that failed to download is delivered as nil and is skipped. `stop()` drops everything and makes
/// any clip that arrives later (from the old turn) count for nothing.
public struct VoiceClipQueue<Clip>: Sendable where Clip: Sendable {
    /// Bumped by `stop()`. Tag each download with it and pass it back to `deliver`.
    public private(set) var generation = 0
    private var expected = 0
    private var arrived: [Int: Clip?] = [:]

    public init() {}

    /// Stores the clip of sentence `order` from the download started in `generation`. Returns false when it
    /// belongs to a stopped turn or was already played.
    @discardableResult
    public mutating func deliver(_ clip: Clip?, order: Int, generation: Int) -> Bool {
        guard generation == self.generation, order >= expected, arrived[order] == nil else { return false }
        arrived[order] = .some(clip)
        return true
    }

    /// The next clip to play, if it has arrived. Failed clips are passed over on the way.
    public mutating func next() -> Clip? {
        while let slot = arrived.removeValue(forKey: expected) {
            expected += 1
            if let clip = slot { return clip }
        }
        return nil
    }

    /// True when a clip is waiting at the head of the line.
    public var hasNext: Bool { arrived[expected] != nil }

    /// The order the queue waits for next.
    public var waitingFor: Int { expected }

    /// Drops what is queued and starts over at order 0 for the next turn.
    public mutating func stop() {
        generation += 1
        expected = 0
        arrived = [:]
    }
}

/// Audio formats the backend may send for one sentence.
public enum VoiceAudioFormat {
    /// A file type hint for AVAudioPlayer from a response's content type (`audio/mpeg` → `mp3`).
    /// Nil for raw PCM, which needs `wav(fromPCM:sampleRate:)` first.
    public static func fileTypeHint(contentType: String) -> String? {
        let type = contentType.lowercased().split(separator: ";").first.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
        switch type {
        case "audio/mpeg", "audio/mp3": return "mp3"
        case "audio/wav", "audio/wave", "audio/x-wav", "audio/vnd.wave": return "wav"
        case "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac": return "m4a"
        case "audio/ogg", "audio/opus": return nil
        default: return nil
        }
    }

    /// True for `audio/pcm` (16-bit little-endian mono, the rate in `rate=`).
    public static func isPCM(contentType: String) -> Bool {
        contentType.lowercased().hasPrefix("audio/pcm") || contentType.lowercased().hasPrefix("audio/l16")
    }

    /// The `rate=` parameter of a PCM content type, or 24 000 (the backend's PCM rate) when it is missing.
    public static func pcmRate(contentType: String) -> Int {
        for part in contentType.split(separator: ";") {
            let pair = part.split(separator: "=", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            if pair.count == 2, pair[0].lowercased() == "rate", let rate = Int(pair[1]), rate > 0 { return rate }
        }
        return 24_000
    }

    /// Wraps 16-bit mono PCM in a WAV header so AVAudioPlayer can play it.
    public static func wav(fromPCM pcm: Data, sampleRate: Int) -> Data {
        var data = Data()
        func append32(_ value: UInt32) { var v = value.littleEndian; data.append(Data(bytes: &v, count: 4)) }
        func append16(_ value: UInt16) { var v = value.littleEndian; data.append(Data(bytes: &v, count: 2)) }
        let bytes = UInt32(pcm.count)
        data.append(contentsOf: Array("RIFF".utf8)); append32(36 + bytes)
        data.append(contentsOf: Array("WAVE".utf8))
        data.append(contentsOf: Array("fmt ".utf8)); append32(16); append16(1); append16(1)
        append32(UInt32(sampleRate)); append32(UInt32(sampleRate * 2)); append16(2); append16(16)
        data.append(contentsOf: Array("data".utf8)); append32(bytes)
        data.append(pcm)
        return data
    }

    /// A one-second test recording: a soft 440 Hz tone, 16 kHz mono 16-bit WAV. Used by the voice lab's
    /// fixture mode instead of the microphone.
    public static func testRecording(seconds: Double = 1, sampleRate: Int = 16_000) -> Data {
        let count = max(1, Int(Double(sampleRate) * seconds))
        var pcm = Data(capacity: count * 2)
        for index in 0..<count {
            let sample = Int16(sin(2 * Double.pi * 440 * Double(index) / Double(sampleRate)) * 6_000)
            var little = sample.littleEndian
            pcm.append(Data(bytes: &little, count: 2))
        }
        return wav(fromPCM: pcm, sampleRate: sampleRate)
    }
}
