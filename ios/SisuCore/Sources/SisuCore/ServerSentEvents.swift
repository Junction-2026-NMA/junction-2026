// An incremental parser for server-sent events (the `text/event-stream` format the agent endpoints answer in).
import Foundation

/// One message of an event stream: the joined `data:` lines, and the optional `event:` and `id:` fields.
public struct ServerSentEvent: Equatable, Sendable {
    public var data: String
    public var event: String?
    public var id: String?

    public init(data: String, event: String? = nil, id: String? = nil) {
        self.data = data; self.event = event; self.id = id
    }
}

/// Feed it bytes (in chunks of any size) or whole lines; it gives back each message as soon as its blank
/// separator line has arrived.
///
/// - Lines end with LF, CRLF or CR. A line split across two chunks is carried over, also in the middle of a
///   multi-byte character or between the CR and the LF.
/// - Several `data:` lines of one message are joined with a newline.
/// - Lines that start with `:` are comments (keep-alives) and are ignored, like `retry:` and unknown fields.
/// - One space after the colon is dropped (`data: x` and `data:x` both give `x`).
/// - A message without any `data:` line is not reported.
public struct SSEParser: Sendable {
    private var line: [UInt8] = []
    private var lastWasCR = false
    private var dataLines: [String] = []
    private var eventName: String?
    private var lastId: String?
    private var atStart = true

    public init() {}

    /// Feeds raw bytes and returns the messages they complete.
    public mutating func feed(_ bytes: Data) -> [ServerSentEvent] {
        var out: [ServerSentEvent] = []
        for byte in bytes {
            if byte == 0x0A {
                if lastWasCR { lastWasCR = false; continue }
                if let event = endLine() { out.append(event) }
            } else if byte == 0x0D {
                lastWasCR = true
                if let event = endLine() { out.append(event) }
            } else {
                lastWasCR = false
                line.append(byte)
            }
        }
        return out
    }

    /// Feeds text (for example one chunk decoded elsewhere).
    public mutating func feed(_ text: String) -> [ServerSentEvent] {
        feed(Data(text.utf8))
    }

    /// Feeds one complete line, without its line ending. Returns a message when the line is the blank
    /// separator that ends one.
    public mutating func feed(line text: String) -> ServerSentEvent? {
        process(text)
    }

    /// Call when the stream has ended: a last line without a line ending is read, and a message that was not
    /// followed by a blank line is still reported.
    public mutating func finish() -> [ServerSentEvent] {
        var out: [ServerSentEvent] = []
        if !line.isEmpty, let event = endLine() { out.append(event) }
        if let event = dispatch() { out.append(event) }
        lastWasCR = false
        return out
    }

    private mutating func endLine() -> ServerSentEvent? {
        let text = String(decoding: line, as: UTF8.self)
        line.removeAll(keepingCapacity: true)
        return process(text)
    }

    private mutating func process(_ raw: String) -> ServerSentEvent? {
        var text = raw
        if atStart {
            atStart = false
            if text.hasPrefix("\u{FEFF}") { text.removeFirst() }
        }
        if text.isEmpty { return dispatch() }
        if text.hasPrefix(":") { return nil }
        let field: Substring
        var value: Substring
        if let colon = text.firstIndex(of: ":") {
            field = text[text.startIndex..<colon]
            value = text[text.index(after: colon)...]
            if value.hasPrefix(" ") { value = value.dropFirst() }
        } else {
            field = Substring(text)
            value = ""
        }
        switch field {
        case "data": dataLines.append(String(value))
        case "event": eventName = String(value)
        case "id": lastId = String(value)
        default: break
        }
        return nil
    }

    private mutating func dispatch() -> ServerSentEvent? {
        defer { dataLines.removeAll(); eventName = nil }
        guard !dataLines.isEmpty else { return nil }
        return ServerSentEvent(data: dataLines.joined(separator: "\n"), event: eventName, id: lastId)
    }
}

/// Turns the bytes of an agent stream into `SisuEvent`s.
public struct SisuEventStreamParser: Sendable {
    private var parser = SSEParser()

    public init() {}

    /// Feeds raw bytes and returns the events they complete. Messages that are not a JSON object with a `type`
    /// are skipped; unknown types come back as `.unknown(type:)`.
    public mutating func feed(_ bytes: Data) -> [SisuEvent] {
        parser.feed(bytes).compactMap { SisuEvent.decode($0.data) }
    }

    public mutating func finish() -> [SisuEvent] {
        parser.finish().compactMap { SisuEvent.decode($0.data) }
    }

    /// Parses a whole recorded stream at once.
    public static func events(in data: Data) -> [SisuEvent] {
        var parser = SisuEventStreamParser()
        return parser.feed(data) + parser.finish()
    }
}
