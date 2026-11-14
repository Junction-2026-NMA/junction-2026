import XCTest
@testable import SisuCore

/// `SSEParser`: lines in, messages out, whatever the chunk boundaries.
final class ServerSentEventsTests: XCTestCase {
    private func feed(_ text: String, chunk: Int) -> [ServerSentEvent] {
        var parser = SSEParser()
        var out: [ServerSentEvent] = []
        let bytes = Array(text.utf8)
        var index = 0
        while index < bytes.count {
            let end = min(index + chunk, bytes.count)
            out += parser.feed(Data(bytes[index..<end]))
            index = end
        }
        return out + parser.finish()
    }

    func testOneMessagePerBlankLine() {
        let text = "data: {\"a\":1}\n\ndata: {\"b\":2}\n\n"
        XCTAssertEqual(feed(text, chunk: 1000).map(\.data), ["{\"a\":1}", "{\"b\":2}"])
    }

    func testEveryChunkSizeGivesTheSameMessages() {
        let text = ": keep-alive\r\ndata: first line\r\ndata: second line\r\n\r\nevent: note\nid: 7\ndata:no space\n\n:\n\ndata: päivää €5\n\nretry: 100\n\n"
        let expected = [
            ServerSentEvent(data: "first line\nsecond line"),
            ServerSentEvent(data: "no space", event: "note", id: "7"),
            ServerSentEvent(data: "päivää €5", id: "7"),
        ]
        for chunk in 1...text.utf8.count {
            XCTAssertEqual(feed(text, chunk: chunk), expected, "chunk size \(chunk)")
        }
    }

    func testAPartialLastLineIsCarriedOver() {
        var parser = SSEParser()
        XCTAssertEqual(parser.feed(Data("data: {\"type\":\"de".utf8)), [])
        XCTAssertEqual(parser.feed(Data("lta\"}\n".utf8)), [])
        XCTAssertEqual(parser.feed(Data("\ndata: next".utf8)).map(\.data), ["{\"type\":\"delta\"}"])
        XCTAssertEqual(parser.finish().map(\.data), ["next"])
        XCTAssertEqual(parser.finish(), [])
    }

    func testCarriageReturnAndLineFeedSplitAcrossChunks() {
        var parser = SSEParser()
        XCTAssertEqual(parser.feed(Data("data: a\r".utf8)), [])
        XCTAssertEqual(parser.feed(Data("\n\r".utf8)).map(\.data), ["a"])
        XCTAssertEqual(parser.feed(Data("\ndata: b\r\r".utf8)).map(\.data), ["b"])
    }

    func testCommentsAndEmptyMessagesAreNotReported() {
        XCTAssertEqual(feed(": ping\n\n: ping\n\n\n\nevent: only\n\n", chunk: 3), [])
    }

    func testWholeLines() {
        var parser = SSEParser()
        XCTAssertNil(parser.feed(line: "data: x"))
        XCTAssertNil(parser.feed(line: ": comment"))
        XCTAssertEqual(parser.feed(line: ""), ServerSentEvent(data: "x"))
        XCTAssertNil(parser.feed(line: ""))
    }

    func testARecordedStreamParsesTheSameInAwkwardChunks() throws {
        let data = try XCTUnwrap(ReplayTransport.fixture("coach/stream-electricity-CUST04974.sse"))
        let whole = SisuEventStreamParser.events(in: data)
        XCTAssertGreaterThan(whole.count, 40)
        XCTAssertEqual(whole.filter { $0.type == "visual" }.count, 1)
        for size in [1, 7, 64, 1021] {
            var parser = SisuEventStreamParser()
            var events: [SisuEvent] = []
            var index = data.startIndex
            while index < data.endIndex {
                let end = min(index + size, data.endIndex)
                events += parser.feed(data.subdata(in: index..<end))
                index = end
            }
            events += parser.finish()
            XCTAssertEqual(events, whole, "chunk size \(size)")
        }
    }
}
