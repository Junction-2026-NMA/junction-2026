import XCTest
@testable import SisuCore

/// `Dates.short` and `Dates.shortDateTime`.
final class DatesTests: XCTestCase {
    func testShortEnglishAndFinnish() {
        XCTAssertEqual(Dates.short("2026-11-13", language: .en), "13 Nov 2026")
        XCTAssertEqual(Dates.short("2026-09-05T08:00:00Z", language: .en), "5 Sep 2026")
        XCTAssertEqual(Dates.short("2026-11-13T23:30:00Z", language: .en), "13 Nov 2026")
        XCTAssertEqual(Dates.short("2026-11-13", language: .fi), "13.11.2026")
        XCTAssertEqual(Dates.short("2026-09-05", language: .fi), "5.9.2026")
        XCTAssertEqual(Dates.short("2024-02-29", language: .en), "29 Feb 2024")
    }

    func testAnythingElseIsReturnedUnchanged() {
        for text in ["2026-13-01", "2026-02-30", "2026-1-5", "13.11.2026", "not a date", "", "2026-02-29", "2026-00-10", "2026-01-00"] {
            XCTAssertEqual(Dates.short(text, language: .en), text)
            XCTAssertEqual(Dates.short(text, language: .fi), text)
        }
    }

    func testShortDateTimeInATimeZone() throws {
        let utc = try XCTUnwrap(TimeZone(identifier: "UTC"))
        let helsinki = try XCTUnwrap(TimeZone(identifier: "Europe/Helsinki"))
        XCTAssertEqual(Dates.shortDateTime("2026-11-14T09:30:00Z", language: .en, timeZone: utc), "14 Nov 2026, 09:30")
        XCTAssertEqual(Dates.shortDateTime("2026-11-14T09:30:00Z", language: .en, timeZone: helsinki), "14 Nov 2026, 11:30")
        XCTAssertEqual(Dates.shortDateTime("2026-11-14T09:30:00Z", language: .fi, timeZone: helsinki), "14.11.2026 klo 11.30")
        XCTAssertEqual(Dates.shortDateTime("2026-11-13T23:30:00Z", language: .en, timeZone: helsinki), "14 Nov 2026, 01:30")
        XCTAssertEqual(Dates.shortDateTime("2026-11-14T09:30:00.123Z", language: .en, timeZone: utc), "14 Nov 2026, 09:30")
        XCTAssertEqual(Dates.shortDateTime("2026-11-14T11:30:00+02:00", language: .en, timeZone: utc), "14 Nov 2026, 09:30")
        XCTAssertEqual(Dates.shortDateTime("2026-07-01T12:00:00Z", language: .en, timeZone: helsinki), "1 Jul 2026, 15:00")
        XCTAssertEqual(Dates.shortDateTime("2026-11-14T09:05:00Z", language: .fi, timeZone: utc), "14.11.2026 klo 9.05")
    }

    func testShortDateTimeLeavesOtherTextAlone() throws {
        let utc = try XCTUnwrap(TimeZone(identifier: "UTC"))
        for text in ["", "not a time", "2026-11-14", "2026-11-14T09:30:00", "2026-11-14T25:30:00Z", "2026-11-14T09:30:00Zjunk"] {
            XCTAssertEqual(Dates.shortDateTime(text, language: .en, timeZone: utc), text)
        }
    }
}
