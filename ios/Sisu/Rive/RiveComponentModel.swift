// Loads one Rive component, keeps its view model instance, and moves values and triggers in and out.
import Combine
import Foundation
import RiveRuntime
import SisuCore

@MainActor
final class RiveComponentModel: ObservableObject {
    enum Phase: Equatable {
        case loading
        /// On screen. `shown` is the requested component or, when its file is missing, its fallback.
        case ready(shown: RiveComponent)
        /// Neither the component nor a fallback could be loaded. The view draws a placeholder.
        case unavailable
    }

    @Published private(set) var phase: Phase = .loading
    /// The thing `RiveUIViewRepresentable` draws. Nil unless `phase` is `.ready`.
    @Published private(set) var rive: Rive?

    /// Sends the name of each out trigger the Rive file fires. Always on the main actor.
    let firedTriggers = PassthroughSubject<String, Never>()

    private var library: RiveLibrary
    private var request: RiveComponentRequest?
    private var loadTask: Task<Void, Never>?
    private var generation = 0

    private var instance: ViewModelInstance?
    /// The properties of the bound view model, by name. Nil when the file would not list them.
    private var properties: [String: ViewModelProperty.DataType]?
    private var values: [String: RiveValue] = [:]
    private var written: [String: RiveValue] = [:]
    private var queuedTriggers: [String] = []
    private var listeners: [Task<Void, Never>] = []

    init(library: RiveLibrary? = nil) {
        self.library = library ?? .shared
    }

    deinit {
        loadTask?.cancel()
        listeners.forEach { $0.cancel() }
    }

    // MARK: - Called by the view

    /// Starts loading. Calling it again with the same request does nothing, so it is safe on every appear.
    /// `library` is where the files come from; nil keeps the one the model already has (`RiveLibrary.shared`).
    func load(_ request: RiveComponentRequest, from library: RiveLibrary? = nil) {
        let library = library ?? self.library
        let sameLibrary = library === self.library
        guard request != self.request || !sameLibrary else { return }
        if sameLibrary, let rive, let old = self.request, old.component == request.component,
           old.extraOutTriggers == request.extraOutTriggers, case .ready(let shown) = phase {
            // Only the sizing changed: keep the artboard and switch its fit.
            self.request = request
            rive.fit = Self.fit(for: request.sizing(for: shown))
            return
        }
        self.library = library
        self.request = request
        generation += 1
        let current = generation
        loadTask?.cancel()
        tearDown()
        phase = .loading
        // Not the view's own task: a view that scrolls away mid-load still finishes loading.
        loadTask = Task { [weak self] in
            await self?.run(request, generation: current)
        }
    }

    /// The component whose design size the view takes right now: the one on screen, or while loading the first
    /// candidate whose file is there, so the layout does not jump when a fallback is used.
    func sizedAs(_ request: RiveComponentRequest, in library: RiveLibrary? = nil) -> RiveComponent {
        let library = library ?? self.library
        switch phase {
        case .ready(let shown): return shown
        case .unavailable: return request.component
        case .loading: return request.candidates.first { library.canLoad($0.contract.file) } ?? request.component
        }
    }

    /// The values the artboard should show. Only properties whose value changed are written.
    func setValues(_ new: [String: RiveValue]) {
        values = new
        write()
    }

    /// Fires `in` triggers by name. While the artboard is loading they wait; if it cannot load they are dropped.
    func fire(_ names: [String]) {
        guard !names.isEmpty, phase != .unavailable else { return }
        guard let instance else {
            queuedTriggers.append(contentsOf: names)
            return
        }
        for name in names {
            guard has(name, .trigger) else {
                Self.log("no trigger named '\(name)' on this artboard; not fired")
                continue
            }
            instance.fire(trigger: TriggerProperty(path: name))
        }
    }

    // MARK: - Loading

    private func run(_ request: RiveComponentRequest, generation: Int) async {
        for candidate in request.candidates {
            do {
                let loaded = try await build(candidate, sizing: request.sizing(for: candidate))
                guard generation == self.generation else { return }
                adopt(loaded, shown: candidate, request: request)
                return
            } catch {
                guard generation == self.generation else { return }
                Self.log("\(candidate.rawValue) cannot be shown: \(error)")
            }
        }
        queuedTriggers = []
        phase = .unavailable
    }

    private struct Loaded {
        var rive: Rive
        var instance: ViewModelInstance
        var properties: [String: ViewModelProperty.DataType]?
    }

    private func build(_ component: RiveComponent, sizing: RiveSizing) async throws -> Loaded {
        let file = try await library.file(component.contract.file)
        let artboard = try await file.createArtboard(component.rawValue)
        let instance = try await file.createViewModelInstance(.viewModelDefault(from: .artboardDefault(artboard)))
        let stateMachine = try await artboard.createStateMachine(binding: instance)
        let rive = try await Rive(file: file, artboard: artboard, stateMachine: stateMachine, fit: Self.fit(for: sizing))
        return Loaded(rive: rive, instance: instance, properties: await Self.properties(of: artboard, in: file))
    }

    private static func properties(of artboard: Artboard, in file: File) async -> [String: ViewModelProperty.DataType]? {
        guard let viewModel = try? await file.getDefaultViewModelInfo(for: artboard).viewModelName,
              let list = try? await file.getProperties(of: viewModel) else { return nil }
        return Dictionary(list.map { ($0.name, $0.type) }, uniquingKeysWith: { first, _ in first })
    }

    private func adopt(_ loaded: Loaded, shown: RiveComponent, request: RiveComponentRequest) {
        instance = loaded.instance
        properties = loaded.properties
        written = [:]
        // Values first, so the first frame already shows them instead of the file's default text.
        write()
        let queued = queuedTriggers
        queuedTriggers = []
        var outTriggers: [String] = []
        for name in request.component.contract.outTriggers + shown.contract.outTriggers + request.extraOutTriggers
        where !outTriggers.contains(name) {
            guard has(name, .trigger) else {
                Self.log("\(shown.rawValue) has no trigger named '\(name)'; not listening")
                continue
            }
            outTriggers.append(name)
        }
        listeners = outTriggers.map { listen(to: $0, on: loaded.instance) }
        rive = loaded.rive
        phase = .ready(shown: shown)
        fire(queued)
    }

    private func tearDown() {
        listeners.forEach { $0.cancel() }
        listeners = []
        instance = nil
        properties = nil
        written = [:]
        rive = nil
    }

    // MARK: - Values and triggers

    private func write() {
        guard let instance else { return }
        for (name, value) in values where written[name] != value {
            written[name] = value
            switch value {
            case .string(let text) where has(name, .string):
                instance.setValue(of: StringProperty(path: name), to: text)
            case .number(let number) where has(name, .number):
                instance.setValue(of: NumberProperty(path: name), to: Float(number))
            case .bool(let flag) where has(name, .boolean):
                instance.setValue(of: BoolProperty(path: name), to: flag)
            case .enumCase(let caseName) where has(name, .enum):
                instance.setValue(of: EnumProperty(path: name), to: caseName)
            default:
                // Expected on a fallback (Jar3D → Jar has no such key); otherwise a contract mismatch.
                Self.log("no \(value) property named '\(name)' on this artboard; value skipped")
            }
        }
    }

    /// True when the bound view model has a property of that name and type. When the file would not list its
    /// properties, everything is allowed through and the runtime decides.
    private func has(_ name: String, _ type: ViewModelProperty.DataType) -> Bool {
        guard let properties else { return true }
        return properties[name] == type
    }

    private func listen(to name: String, on instance: ViewModelInstance) -> Task<Void, Never> {
        let stream = instance.stream(of: TriggerProperty(path: name))
        return Task { [weak self] in
            do {
                for try await _ in stream {
                    self?.firedTriggers.send(name)
                }
            } catch {
                Self.log("stopped listening to '\(name)': \(error)")
            }
        }
    }

    /// The artboard resizes to the view for `flexibleWidth` and `fill`, and is scaled to fit otherwise.
    static func fit(for sizing: RiveSizing) -> Fit {
        switch sizing {
        case .flexibleWidth, .fill: return .layout(scaleFactor: .automatic)
        case .fixed, .contain: return .contain(alignment: .center)
        }
    }

    private static func log(_ message: @autoclosure () -> String) {
        #if DEBUG
        print("[Rive] \(message())")
        #endif
    }
}
