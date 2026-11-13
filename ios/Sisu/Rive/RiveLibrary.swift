// Loads each `.riv` file once and shares it with every view.
import Foundation
import RiveRuntime
import SisuCore

// `RiveFile` exists in both modules: SisuCore's enum names our two files, RiveRuntime's class is the legacy
// loader. Any file that imports both must write `SisuCore.RiveFile`.

/// Why a Rive file or one of its artboards cannot be shown. Views turn any of these into a fallback or a placeholder.
enum RiveLibraryError: Error, Equatable {
    /// The `.riv` is not in the app bundle (not produced yet, or not added to the target).
    case notBundled(String)
    /// The runtime refused the file or could not start. The text is the runtime's own message.
    case loadFailed(String)
}

/// The app's Rive files. One instance for the whole app: `RiveLibrary.shared`.
///
/// - `sisu_ui` loads on a plain worker, `sisu_3d` on a GPU-canvas worker (3D needs it). Each worker is created
///   once, and only when a file that needs it is really in the bundle.
/// - A file is loaded the first time someone asks for it and then kept.
/// - A failed load is remembered, so a missing file costs one attempt, not one per view.
@MainActor
final class RiveLibrary {
    static let shared = RiveLibrary()

    /// What is known about a file right now.
    enum Status: Equatable {
        case notRequested
        case loading
        case available
        case unavailable(RiveLibraryError)
    }

    private enum Slot {
        case loading(Task<File, Error>)
        case loaded(File)
        case failed(RiveLibraryError)
    }

    private let bundle: Bundle
    private var slots: [SisuCore.RiveFile: Slot] = [:]
    private var workers: [Bool: Task<Worker, Error>] = [:]

    init(bundle: Bundle = .main) {
        self.bundle = bundle
        #if DEBUG
        // Print the runtime's own warnings and errors (for example a write to a property the file does not have).
        RiveLog.logger = RiveLog.system(levels: [.warning, .error, .fault, .critical])
        #endif
    }

    /// The loaded file. Throws `RiveLibraryError` when it is missing or broken; never crashes.
    func file(_ id: SisuCore.RiveFile) async throws -> File {
        switch slots[id] {
        case .loaded(let file):
            return file
        case .failed(let error):
            throw error
        case .loading(let task):
            return try await task.value
        case nil:
            // Not tied to the caller's task: a view that disappears mid-load must not cancel the shared load.
            let task = Task { try await self.load(id) }
            slots[id] = .loading(task)
            return try await task.value
        }
    }

    /// True when the file is in the bundle and the runtime accepted it. Loads it if nobody has asked yet.
    func isAvailable(_ id: SisuCore.RiveFile) async -> Bool {
        (try? await file(id)) != nil
    }

    /// The current state without starting a load.
    func status(of id: SisuCore.RiveFile) -> Status {
        switch slots[id] {
        case nil: return .notRequested
        case .loading: return .loading
        case .loaded: return .available
        case .failed(let error): return .unavailable(error)
        }
    }

    /// True when the `.riv` is in the bundle at all. Cheap: it does not load anything.
    func isBundled(_ id: SisuCore.RiveFile) -> Bool {
        bundle.url(forResource: id.rawValue, withExtension: "riv") != nil
    }

    /// False once it is known that the file cannot be used: it is not bundled, or a load already failed.
    func canLoad(_ id: SisuCore.RiveFile) -> Bool {
        if case .failed = slots[id] { return false }
        return isBundled(id)
    }

    // MARK: - Loading

    private func load(_ id: SisuCore.RiveFile) async throws -> File {
        do {
            guard isBundled(id) else { throw RiveLibraryError.notBundled("\(id.rawValue).riv") }
            let worker = try await worker(gpuCanvas: id == .threeD)
            let file = try await File(source: .local(id.rawValue, bundle), worker: worker)
            slots[id] = .loaded(file)
            return file
        } catch {
            let failure = (error as? RiveLibraryError) ?? .loadFailed(error.localizedDescription)
            slots[id] = .failed(failure)
            #if DEBUG
            print("[Rive] \(id.rawValue).riv is unavailable: \(failure)")
            #endif
            throw failure
        }
    }

    /// One worker per rendering mode, shared by every file that needs it.
    private func worker(gpuCanvas: Bool) async throws -> Worker {
        if let task = workers[gpuCanvas] {
            return try await task.value
        }
        let task = Task { @MainActor in
            gpuCanvas ? try await Worker(configuration: .init(enableGPUCanvas: true)) : try await Worker()
        }
        workers[gpuCanvas] = task
        return try await task.value
    }
}
