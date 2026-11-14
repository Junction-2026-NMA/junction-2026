// The first-run flow: a welcome, what Sisu does, choosing a demo profile, and a short "reading your
// transactions" moment that waits for the real overview, then Today with the first insight highlighted.
// Pure state: the app stores `OnboardingFlow` in UserDefaults and decides the first screen with
// `OnboardingFlow.atLaunch(stored:launch:skipsByDefault:)`.
import Foundation

/// The screens of the first run, in order. Today follows the last one.
public enum OnboardingStep: String, Codable, CaseIterable, Sendable {
    /// Liito and one line on what Sisu does.
    case welcome
    /// The three things Sisu helps with.
    case promise
    /// Choosing one of the three demo profiles, with the demo disclosure.
    case profile
    /// "Sisu is reading 12 months of transactions": waits for the overview to load.
    case reading

    /// 1-based position, for "Step 2 of 4" and the progress bar.
    public var number: Int { (Self.allCases.firstIndex(of: self) ?? 0) + 1 }
}

/// What the `-sisu.onboarding` launch argument asks for.
public enum OnboardingLaunch: String, Sendable {
    /// Start at the first screen, as on a clean install.
    case reset
    /// Skip the first run.
    case done

    public init?(argument: String?) {
        guard let argument, let value = OnboardingLaunch(rawValue: argument.lowercased()) else { return nil }
        self = value
    }
}

/// Where the user is in the first run, whether it is finished, and whether Today still owes them the
/// highlighted first insight.
public struct OnboardingFlow: Codable, Equatable, Sendable {
    /// The screen shown while the flow is not complete.
    public private(set) var step: OnboardingStep
    /// True once the user reached Today through the flow (or the flow was skipped by a launch argument).
    public private(set) var isComplete: Bool
    /// True from finishing the flow until the user dismisses the first-insight callout on Today.
    public private(set) var firstInsightPending: Bool

    public init(step: OnboardingStep = .welcome, isComplete: Bool = false, firstInsightPending: Bool = false) {
        self.step = step
        self.isComplete = isComplete
        self.firstInsightPending = firstInsightPending
    }

    /// A clean install: the welcome screen.
    public static let fresh = OnboardingFlow()
    /// Already done, with no callout owed (tests and screenshots that open a screen directly).
    public static let skipped = OnboardingFlow(step: .reading, isComplete: true, firstInsightPending: false)

    public static var stepCount: Int { OnboardingStep.allCases.count }

    /// Whether the flow is on screen instead of the app.
    public var isActive: Bool { !isComplete }

    /// Share of the flow reached, for the progress bar: 0.25 on the welcome screen, 1 while reading.
    public var progress: Double { Double(step.number) / Double(Self.stepCount) }

    /// The intro screens can be skipped straight to the profile choice; the profile and reading cannot.
    public var canSkip: Bool { isActive && (step == .welcome || step == .promise) }

    /// The intro screens and the profile choice can go back one screen.
    public var canGoBack: Bool { isActive && (step == .promise || step == .profile) }

    /// Continue: welcome to promise to profile. The profile screen moves on only by choosing a profile, and
    /// the reading screen only by `finish()`.
    public mutating func advance() {
        guard isActive else { return }
        switch step {
        case .welcome: step = .promise
        case .promise: step = .profile
        case .profile, .reading: break
        }
    }

    /// Back one screen, from the promise or the profile screen.
    public mutating func back() {
        guard canGoBack else { return }
        switch step {
        case .promise: step = .welcome
        case .profile: step = .promise
        case .welcome, .reading: break
        }
    }

    /// Skip the intro: straight to choosing a profile.
    public mutating func skipIntro() {
        guard canSkip else { return }
        step = .profile
    }

    /// A profile was chosen: show the reading moment while its overview loads.
    public mutating func profileChosen() {
        guard isActive, step == .profile else { return }
        step = .reading
    }

    /// The overview could not be loaded: back to the profile choice to try again.
    public mutating func readingFailed() {
        guard isActive, step == .reading else { return }
        step = .profile
    }

    /// The overview is loaded and the user goes on: the flow is complete and Today owes the first insight.
    public mutating func finish() {
        guard isActive, step == .reading else { return }
        isComplete = true
        firstInsightPending = true
    }

    /// The user tapped the first-insight callout away.
    public mutating func dismissFirstInsight() {
        firstInsightPending = false
    }

    /// "Start the demo over": back to the welcome screen.
    public mutating func restart() {
        self = .fresh
    }

    /// The flow to show at launch.
    ///
    /// - `launch == .reset` starts at the welcome screen, as on a clean install.
    /// - `launch == .done` skips the flow (keeping a stored callout if one is still owed).
    /// - Otherwise, when `skipsByDefault` is true (the app was opened straight at a customer or in screenshot
    ///   mode), the flow counts as done.
    /// - Otherwise the stored flow: complete stays complete; an unfinished flow starts again at the welcome
    ///   screen, because the profile it was reading may not be chosen any more. Nothing stored is a clean install.
    public static func atLaunch(stored: OnboardingFlow?, launch: OnboardingLaunch?, skipsByDefault: Bool) -> OnboardingFlow {
        switch launch {
        case .reset:
            return .fresh
        case .done:
            if let stored, stored.isComplete { return stored }
            return .skipped
        case nil:
            if let stored, stored.isComplete { return stored }
            return skipsByDefault ? .skipped : .fresh
        }
    }
}
