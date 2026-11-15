import XCTest
@testable import SisuCore

/// `CoachEndpoints`: the request of every coach endpoint, built without a network.
final class CoachEndpointsTests: XCTestCase {
    private let base = URL(string: "http://localhost:3000")!

    private func body(_ request: URLRequest) -> [String: Any] {
        guard let data = request.httpBody else { return [:] }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }

    private func check(_ request: URLRequest, _ method: String, _ url: String, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(request.httpMethod, method, file: file, line: line)
        XCTAssertEqual(request.url?.absoluteString, "http://localhost:3000" + url, file: file, line: line)
    }

    func testServerAndCoachRoutes() {
        check(CoachEndpoints.warm(baseURL: base), "GET", "/api/agent/warm")
        check(CoachEndpoints.health(baseURL: base), "GET", "/api/health")
        check(CoachEndpoints.patterns(baseURL: base, customerId: "CUST04974"), "GET", "/api/coach/patterns?customerId=CUST04974")
        check(CoachEndpoints.cashFlow(baseURL: base, customerId: "CUST04974"), "GET", "/api/coach/cash-flow?customerId=CUST04974")
        check(CoachEndpoints.affordability(baseURL: base, customerId: "CUST04974", amountEur: 200), "GET", "/api/coach/affordability?customerId=CUST04974&amountEur=200")
        check(CoachEndpoints.affordability(baseURL: base, customerId: "C", amountEur: 199.5), "GET", "/api/coach/affordability?customerId=C&amountEur=199.5")
        check(CoachEndpoints.teaching(baseURL: base, customerId: "C"), "GET", "/api/coach/teaching?customerId=C")
        check(CoachEndpoints.teaching(baseURL: base, customerId: "C", concept: .bufferFirst), "GET", "/api/coach/teaching?customerId=C&concept=buffer-first")
        check(CoachEndpoints.mortgage(baseURL: base, customerId: "C"), "GET", "/api/coach/mortgage?customerId=C")
        check(CoachEndpoints.voiceOptions(baseURL: base), "GET", "/api/voice/tts")
        XCTAssertEqual(CoachEndpoints.health(baseURL: base).timeoutInterval, CoachEndpoints.quickTimeout)
        XCTAssertEqual(CoachEndpoints.quickTimeout, 10, "long enough for a hosted server to wake up")
    }

    func testDemoResetSendsTheTokenOnlyWhenGiven() {
        let plain = CoachEndpoints.demoReset(baseURL: base)
        check(plain, "POST", "/api/demo/reset")
        XCTAssertNil(plain.value(forHTTPHeaderField: "x-sisu-reset-token"))
        XCTAssertEqual(CoachEndpoints.demoReset(baseURL: base, token: "abc").value(forHTTPHeaderField: "x-sisu-reset-token"), "abc")
    }

    func testResearch() {
        let noWait = CoachEndpoints.research(baseURL: base, ResearchRequest(customerId: "C", billType: .electricity, wait: false))
        check(noWait, "POST", "/api/research")
        XCTAssertEqual(body(noWait)["wait"] as? Bool, false)
        XCTAssertEqual(body(noWait)["billType"] as? String, "electricity")
        XCTAssertEqual(noWait.value(forHTTPHeaderField: "Content-Type"), "application/json")
        let waiting = CoachEndpoints.research(baseURL: base, ResearchRequest(customerId: "C", billType: .mobile))
        XCTAssertEqual(Set(body(waiting).keys), ["customerId", "billType"])
        XCTAssertGreaterThan(waiting.timeoutInterval, 9)
        check(CoachEndpoints.researchSnapshot(baseURL: base, customerId: "C", billType: .internet), "GET", "/api/research?customerId=C&billType=internet")
    }

    func testMemory() {
        check(CoachEndpoints.memory(baseURL: base, customerId: "C"), "GET", "/api/memory?customerId=C")
        let save = CoachEndpoints.saveMemory(baseURL: base, MemorySaveRequest(customerId: "C", kind: .billName, key: "utilities-1", value: "Helen", billType: .electricity))
        check(save, "POST", "/api/memory")
        XCTAssertEqual(body(save) as? [String: String], ["customerId": "C", "kind": "bill_name", "key": "utilities-1", "value": "Helen", "billType": "electricity"])
        let consent = CoachEndpoints.memoryConsent(baseURL: base, MemoryConsentRequest(customerId: "C", consent: false))
        XCTAssertEqual(body(consent)["consent"] as? Bool, false)
        XCTAssertEqual(Set(body(consent).keys), ["customerId", "consent"])
        check(CoachEndpoints.forgetMemory(baseURL: base, customerId: "C"), "DELETE", "/api/memory?customerId=C")
        check(CoachEndpoints.forgetMemory(baseURL: base, customerId: "C", itemId: "i 1"), "DELETE", "/api/memory?customerId=C&itemId=i%201")
    }

    func testActions() {
        let prepare = CoachEndpoints.prepareAction(baseURL: base, PrepareActionRequest(customerId: "C", kind: .switchContract, billType: .electricity, provider: "Oomi"))
        check(prepare, "POST", "/api/actions/prepare")
        XCTAssertEqual(body(prepare) as? [String: String], ["customerId": "C", "kind": "switch_contract", "billType": "electricity", "provider": "Oomi"])
        let approve = CoachEndpoints.approveAction(baseURL: base, customerId: "C", actionId: "a-1")
        check(approve, "POST", "/api/actions/a-1/approve")
        XCTAssertEqual(body(approve)["confirm"] as? Bool, true)
        XCTAssertEqual(body(approve)["customerId"] as? String, "C")
        let decline = CoachEndpoints.declineAction(baseURL: base, customerId: "C", actionId: "a/1")
        check(decline, "POST", "/api/actions/a%2F1/decline")
        XCTAssertEqual(Set(body(decline).keys), ["customerId"])
        check(CoachEndpoints.actions(baseURL: base, customerId: "C"), "GET", "/api/actions?customerId=C")
        check(CoachEndpoints.audit(baseURL: base, customerId: "C"), "GET", "/api/audit?customerId=C")
    }

    func testAgentStreams() {
        let query = CoachEndpoints.agentQuery(baseURL: base, AgentRequest(customerId: "C", text: "Hi", mode: "voice", history: [ChatTurn(role: "user", content: "a")], focusBill: .mobile, language: "fi"))
        check(query, "POST", "/api/agent/query")
        XCTAssertEqual(query.value(forHTTPHeaderField: "Accept"), "text/event-stream")
        XCTAssertEqual(Set(body(query).keys), ["customerId", "text", "mode", "history", "focusBill", "language"])
        XCTAssertGreaterThanOrEqual(query.timeoutInterval, 60)
        let investigate = CoachEndpoints.agentInvestigate(baseURL: base, InvestigateRequest(customerId: "C", text: "my mobile bill"))
        check(investigate, "POST", "/api/agent/investigate")
        XCTAssertEqual(body(investigate) as? [String: String], ["customerId": "C", "mode": "text", "text": "my mobile bill"])
    }

    func testVoiceForms() throws {
        let audio = Data([0xFF, 0x00, 0x41])
        let turn = CoachEndpoints.voiceTurn(baseURL: base, customerId: "CUST04974", audio: audio, fileName: "speech.m4a", mimeType: "audio/mp4",
                                            history: [ChatTurn(role: "user", content: "Hi")], focusBill: .electricity, language: "fi", boundary: "BOUND")
        check(turn, "POST", "/api/voice/turn")
        XCTAssertEqual(turn.value(forHTTPHeaderField: "Content-Type"), "multipart/form-data; boundary=BOUND")
        var expected = Data("--BOUND\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"speech.m4a\"\r\nContent-Type: audio/mp4\r\n\r\n".utf8)
        expected.append(audio)
        expected.append(Data("\r\n--BOUND\r\nContent-Disposition: form-data; name=\"customerId\"\r\n\r\nCUST04974\r\n".utf8))
        expected.append(Data("--BOUND\r\nContent-Disposition: form-data; name=\"history\"\r\n\r\n[{\"content\":\"Hi\",\"role\":\"user\"}]\r\n".utf8))
        expected.append(Data("--BOUND\r\nContent-Disposition: form-data; name=\"focusBill\"\r\n\r\nelectricity\r\n".utf8))
        expected.append(Data("--BOUND\r\nContent-Disposition: form-data; name=\"language\"\r\n\r\nfi\r\n--BOUND--\r\n".utf8))
        XCTAssertEqual(turn.httpBody, expected)
        XCTAssertEqual(ReplayTransport.multipartField("customerId", in: turn.httpBody), "CUST04974")

        let plain = CoachEndpoints.voiceTurn(baseURL: base, customerId: "C", audio: audio, fileName: "a.wav", mimeType: "audio/wav", boundary: "B")
        let text = String(decoding: try XCTUnwrap(plain.httpBody), as: UTF8.self)
        XCTAssertFalse(text.contains("focusBill"))
        XCTAssertTrue(text.contains("name=\"history\"\r\n\r\n[]\r\n"))
        XCTAssertTrue(text.contains("name=\"language\"\r\n\r\nauto\r\n"))

        let stt = CoachEndpoints.speechToText(baseURL: base, audio: audio, fileName: "a.m4a", mimeType: "audio/mp4", boundary: "B")
        check(stt, "POST", "/api/voice/stt")
        XCTAssertTrue(String(decoding: try XCTUnwrap(stt.httpBody), as: UTF8.self).contains("name=\"audio\"; filename=\"a.m4a\""))

        let tts = CoachEndpoints.textToSpeech(baseURL: base, SpeechRequest(text: "Hello.", previousText: "Before.", language: "fi"))
        check(tts, "POST", "/api/voice/tts")
        XCTAssertEqual(body(tts) as? [String: String], ["text": "Hello.", "format": "mp3", "previousText": "Before.", "language": "fi"])
    }

    func testABaseURLWithAPathPrefixIsKept() {
        let request = CoachEndpoints.actions(baseURL: URL(string: "https://example.org/sisu/")!, customerId: "C")
        XCTAssertEqual(request.url?.absoluteString, "https://example.org/sisu/api/actions?customerId=C")
    }
}
