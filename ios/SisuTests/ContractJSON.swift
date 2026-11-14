// rive/contract.json as the tests read it.
// project.yml bundles the real file into this test target, so there is no second copy to keep in sync.
import Foundation
import XCTest

struct ContractJSON: Decodable {
    struct FileSpec: Decodable {
        let artboards: [ArtboardSpec]
    }

    struct ArtboardSpec: Decodable {
        let name: String
        let size: [Double]
        let sizing: String
        let properties: [PropertySpec]
    }

    struct PropertySpec: Decodable {
        let name: String
        /// `string`, `number`, `boolean`, `enum` or `trigger`.
        let type: String
        /// `in`, `out` or `inout`.
        let direction: String
        let enumName: String?
        let defaultValue: Value?
        let range: [Double]?

        enum CodingKeys: String, CodingKey {
            case name, type, direction, range
            case enumName = "enum"
            case defaultValue = "default"
        }

        /// True when the app writes this property.
        var isWritten: Bool { direction == "in" || direction == "inout" }
        /// True when the Rive file fires or writes it and the app listens.
        var isOut: Bool { direction == "out" || direction == "inout" }
    }

    enum Value: Decodable, Equatable {
        case bool(Bool)
        case number(Double)
        case string(String)

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let flag = try? container.decode(Bool.self) {
                self = .bool(flag)
            } else if let number = try? container.decode(Double.self) {
                self = .number(number)
            } else {
                self = .string(try container.decode(String.self))
            }
        }
    }

    let enums: [String: [String]]
    let files: [String: FileSpec]

    /// Every artboard of every file, with the name of the file it is in.
    var allArtboards: [(file: String, artboard: ArtboardSpec)] {
        files.keys.sorted().flatMap { file in (files[file]?.artboards ?? []).map { (file, $0) } }
    }

    static func load() throws -> ContractJSON {
        let bundle = Bundle(for: RiveContractTests.self)
        let url = try XCTUnwrap(
            bundle.url(forResource: "contract", withExtension: "json"),
            "rive/contract.json is not bundled into the test target. Check the SisuTests sources in ios/project.yml."
        )
        return try JSONDecoder().decode(ContractJSON.self, from: Data(contentsOf: url))
    }
}
