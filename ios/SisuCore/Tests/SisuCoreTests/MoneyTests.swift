import XCTest
@testable import SisuCore

/// `Money.format`: the brand's euro format in English and Finnish.
final class MoneyTests: XCTestCase {
    private let nb = "\u{00A0}"
    private let minus = "\u{2212}"

    func testEnglishWholeEuros() {
        XCTAssertEqual(Money.format(64, language: .en), "€64")
        XCTAssertEqual(Money.format(1234, language: .en), "€1,234")
        XCTAssertEqual(Money.format(1234567.891, language: .en), "€1,234,568")
        XCTAssertEqual(Money.format(0.5, language: .en), "€1")
        XCTAssertEqual(Money.format(2.5, language: .en), "€3")
        XCTAssertEqual(Money.format(999.5, language: .en), "€1,000")
    }

    func testEnglishDecimals() {
        XCTAssertEqual(Money.format(1234.5, language: .en, decimals: true), "€1,234.50")
        XCTAssertEqual(Money.format(0.125, language: .en, decimals: true), "€0.13")
        XCTAssertEqual(Money.format(-0.125, language: .en, decimals: true), "\(minus)€0.13")
        XCTAssertEqual(Money.format(-1234.567, language: .en, decimals: true), "\(minus)€1,234.57")
        XCTAssertEqual(Money.format(3.98, language: .en, decimals: true), "€3.98")
    }

    func testFinnish() {
        XCTAssertEqual(Money.format(64, language: .fi), "64\(nb)€")
        XCTAssertEqual(Money.format(1234, language: .fi), "1\(nb)234\(nb)€")
        XCTAssertEqual(Money.format(1234.5, language: .fi, decimals: true), "1\(nb)234,50\(nb)€")
        XCTAssertEqual(Money.format(1234567.891, language: .fi, decimals: true), "1\(nb)234\(nb)567,89\(nb)€")
        XCTAssertEqual(Money.format(0.375, language: .fi, decimals: true), "0,38\(nb)€")
    }

    func testNegativeUsesARealMinusAndZeroIsNeverNegative() {
        XCTAssertEqual(Money.format(-12.2, language: .en), "\(minus)€12")
        XCTAssertEqual(Money.format(-12.2, language: .fi), "\(minus)12\(nb)€")
        XCTAssertEqual(Money.format(-0.4, language: .en), "€0")
        XCTAssertEqual(Money.format(-0.004, language: .en, decimals: true), "€0.00")
    }

    func testNoOrdinarySpaceOrHyphen() {
        for amount in [-1234567.891, -12.2, 0, 64, 1234.5] {
            for language in SisuLanguage.allCases {
                for decimals in [false, true] {
                    let text = Money.format(amount, language: language, decimals: decimals)
                    XCTAssertFalse(text.contains(" "), text)
                    XCTAssertFalse(text.contains("-"), text)
                    XCTAssertFalse(text.contains("\u{202F}"), text)
                }
            }
        }
    }

    func testNonFiniteValuesDoNotTrap() {
        for amount in [Double.nan, .infinity, -.infinity, 1e300] {
            XCTAssertFalse(Money.format(amount, language: .en).isEmpty)
            XCTAssertFalse(Money.format(amount, language: .fi, decimals: true).isEmpty)
        }
    }

    func testSignedAddsAPlusOnlyAboveZero() {
        XCTAssertEqual(Money.signed(12, language: .en), "+€12")
        XCTAssertEqual(Money.signed(-12, language: .en), "\(minus)€12")
        XCTAssertEqual(Money.signed(0.2, language: .en), "€0")
    }
}
