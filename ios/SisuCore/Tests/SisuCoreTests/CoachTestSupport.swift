import Foundation
import XCTest
@testable import SisuCore

/// A transport whose answers the test writes. It records every request.
final class ScriptedTransport: SisuTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var recorded: [URLRequest] = []
    var kind: DataSourceKind = .live
    var onSend: (URLRequest) throws -> TransportResponse = { _ in TransportResponse(status: 404, body: Data(#"{"error":"Not scripted."}"#.utf8)) }
    var onOpen: (URLRequest) throws -> TransportStream = { _ in ScriptedTransport.finished([]) }

    var requests: [URLRequest] {
        lock.lock(); defer { lock.unlock() }
        return recorded
    }

    private func record(_ request: URLRequest) {
        lock.lock(); defer { lock.unlock() }
        recorded.append(request)
    }

    func send(_ request: URLRequest) async throws -> TransportResponse {
        record(request)
        return try onSend(request)
    }

    func open(_ request: URLRequest) async throws -> TransportStream {
        record(request)
        return try onOpen(request)
    }

    /// One server-sent message per JSON text.
    static func sse(_ events: [String]) -> Data {
        Data(events.map { "data: \($0)\n\n" }.joined().utf8)
    }

    /// A stream that sends the events and ends.
    static func finished(_ events: [String], status: Int = 200) -> TransportStream {
        let data = sse(events)
        return TransportStream(status: status, chunks: AsyncThrowingStream { continuation in
            if !data.isEmpty { continuation.yield(data) }
            continuation.finish()
        })
    }

    /// An answer that is not a stream (an HTTP error with a JSON body).
    static func failed(status: Int, body: String) -> TransportStream {
        TransportStream(status: status, chunks: AsyncThrowingStream { continuation in
            continuation.yield(Data(body.utf8))
            continuation.finish()
        })
    }

    static func json(_ request: URLRequest) -> [String: Any] {
        guard let body = request.httpBody else { return [:] }
        return (try? JSONSerialization.jsonObject(with: body)) as? [String: Any] ?? [:]
    }
}

/// Records what the session asks the app to say.
@MainActor
final class RecordingSpeech: SpeechOutput {
    var spoken: [String] = []
    var orders: [Int] = []
    var stops = 0

    func speak(_ text: String, order: Int) {
        spoken.append(text)
        orders.append(order)
    }

    func stop() {
        stops += 1
    }
}

enum Recorded {
    /// The events of a bundled stream recording.
    static func events(_ name: String) -> [SisuEvent] {
        SisuEventStreamParser.events(in: ReplayTransport.fixture("coach/\(name)") ?? Data())
    }

    static func doneText(_ name: String) -> String {
        for event in events(name) {
            if case .done(let text, _, _) = event { return text }
        }
        return ""
    }
}
