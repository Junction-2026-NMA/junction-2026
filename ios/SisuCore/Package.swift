// swift-tools-version: 6.0
// SisuCore: all app logic that does not need UIKit, SwiftUI or Rive.
// It has NO dependencies on purpose, so `swift test` runs offline.
import PackageDescription

let package = Package(
    name: "SisuCore",
    defaultLocalization: "en",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "SisuCore", targets: ["SisuCore"])],
    targets: [
        .target(name: "SisuCore", resources: [.copy("Fixtures")]),
        .testTarget(name: "SisuCoreTests", dependencies: ["SisuCore"]),
    ],
    swiftLanguageModes: [.v5]
)
