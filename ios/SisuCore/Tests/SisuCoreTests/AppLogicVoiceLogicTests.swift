import SisuCore
import XCTest

final class AppLogicVoiceLogicTests: XCTestCase {
    func testClipsArriveOutOfOrderPlayInOrder() {
        var queue = VoiceClipQueue<String>()
        let generation = queue.generation
        queue.deliver("two", order: 2, generation: generation)
        queue.deliver("one", order: 1, generation: generation)
        XCTAssertNil(queue.next(), "order 0 has not arrived")
        queue.deliver("zero", order: 0, generation: generation)
        XCTAssertEqual(queue.next(), "zero")
        XCTAssertEqual(queue.next(), "one")
        XCTAssertEqual(queue.next(), "two")
        XCTAssertNil(queue.next())
    }

    func testFailedClipIsSkipped() {
        var queue = VoiceClipQueue<String>()
        queue.deliver("zero", order: 0, generation: 0)
        queue.deliver(nil, order: 1, generation: 0)
        queue.deliver("two", order: 2, generation: 0)
        XCTAssertEqual(queue.next(), "zero")
        XCTAssertEqual(queue.next(), "two")
    }

    func testStopDropsQueueAndLateClips() {
        var queue = VoiceClipQueue<String>()
        let old = queue.generation
        queue.deliver("one", order: 1, generation: old)
        queue.stop()
        XCTAssertFalse(queue.deliver("zero", order: 0, generation: old))
        XCTAssertNil(queue.next())
        XCTAssertTrue(queue.deliver("new", order: 0, generation: queue.generation))
        XCTAssertEqual(queue.next(), "new")
    }

    func testPlayedOrderCannotBeDeliveredAgain() {
        var queue = VoiceClipQueue<String>()
        queue.deliver("zero", order: 0, generation: 0)
        _ = queue.next()
        XCTAssertFalse(queue.deliver("again", order: 0, generation: 0))
    }

    func testPressLengthRule() {
        XCTAssertEqual(VoicePressRule.outcome(pressedFor: 0.1, bytes: 4_000), .tooShort)
        XCTAssertEqual(VoicePressRule.outcome(pressedFor: 1.2, bytes: 0), .tooShort)
        XCTAssertEqual(VoicePressRule.outcome(pressedFor: .nan, bytes: 100), .tooShort)
        XCTAssertEqual(VoicePressRule.outcome(pressedFor: 0.3, bytes: 100), .send)
        XCTAssertEqual(VoicePressRule.outcome(pressedFor: 2, bytes: VoicePressRule.maximumBytes + 1), .tooLarge)
    }

    func testButtonState() {
        XCTAssertEqual(VoiceButtonPresenter.state(isRecording: true, status: .speaking), .recording)
        XCTAssertEqual(VoiceButtonPresenter.state(isRecording: false, status: .thinking), .thinking)
        XCTAssertEqual(VoiceButtonPresenter.state(isRecording: false, status: .speaking), .speaking)
        XCTAssertEqual(VoiceButtonPresenter.state(isRecording: false, status: .idle), .idle)
        XCTAssertEqual(VoiceButtonPresenter.state(isRecording: false, status: .recording), .recording)
    }

    func testAudioFormats() {
        XCTAssertEqual(VoiceAudioFormat.fileTypeHint(contentType: "audio/mpeg"), "mp3")
        XCTAssertEqual(VoiceAudioFormat.fileTypeHint(contentType: "audio/wav"), "wav")
        XCTAssertTrue(VoiceAudioFormat.isPCM(contentType: "audio/pcm;rate=24000"))
        XCTAssertEqual(VoiceAudioFormat.pcmRate(contentType: "audio/pcm;rate=16000"), 16_000)
        XCTAssertEqual(VoiceAudioFormat.pcmRate(contentType: "audio/pcm"), 24_000)
        let wav = VoiceAudioFormat.wav(fromPCM: Data(count: 100), sampleRate: 24_000)
        XCTAssertEqual(wav.count, 144)
        XCTAssertEqual(String(decoding: wav.prefix(4), as: UTF8.self), "RIFF")
        XCTAssertEqual(VoiceAudioFormat.testRecording().count, 44 + 32_000)
    }
}
