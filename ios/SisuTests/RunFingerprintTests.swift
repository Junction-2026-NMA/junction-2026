// Says which build the simulator is really running, so ios/scripts/test-app.sh can prove the results are fresh.
import CryptoKit
import XCTest

/// Xcode now and then starts the tests on a copy of the app that the simulator installed during an earlier run.
/// Everything passes, but a new test or a new `.riv` is silently not in it. This "test" prints a checksum of the
/// code and Rive files it runs from; the script compares them with what it has just built and runs again on a
/// mismatch. It never fails by itself.
final class RunFingerprintTests: XCTestCase {
    func testReportsWhichBuildIsRunning() throws {
        let app = Bundle.main.bundleURL
        var files = [Bundle(for: Self.self).executableURL, Bundle.main.executableURL]
        files.append(Bundle.main.url(forResource: "Sisu.debug", withExtension: "dylib"))
        files += (Bundle.main.urls(forResourcesWithExtension: "riv", subdirectory: nil) ?? []).map(Optional.some)

        for file in files.compactMap({ $0 }) {
            let path = file.resolvingSymlinksInPath().path
            let root = app.resolvingSymlinksInPath().path + "/"
            guard path.hasPrefix(root) else { continue }
            let digest = SHA256.hash(data: try Data(contentsOf: file))
            print("[RunFingerprint] \(digest.map { String(format: "%02x", $0) }.joined())  \(path.dropFirst(root.count))")
        }
    }
}
