// What Sisu is doing right now, as one value, for the mascot and a status line. A port of
// lib/agent/activity.ts: every state is driven by a real event from the agent, never by a timer.
import Foundation

/// `idle`, `listening`, `thinking`, `reading_account`, `searching_web`, `reading_pages`, `calculating`,
/// `found_something`, `setting_up`, `waiting_for_approval`, `speaking`, `approved`, `declined` or `error`.
public enum SisuActivityState: String, Codable, CaseIterable, Sendable {
    case idle, listening, thinking
    case readingAccount = "reading_account"
    case searchingWeb = "searching_web"
    case readingPages = "reading_pages"
    case calculating
    case foundSomething = "found_something"
    case settingUp = "setting_up"
    case waitingForApproval = "waiting_for_approval"
    case speaking, approved, declined, error

    /// The mascot's pose for the state (the table in the backend's frontend handoff).
    public var pose: LiitoPose {
        switch self {
        case .idle: return .sleepy
        case .listening, .thinking, .speaking: return .curious
        case .readingAccount, .readingPages, .calculating, .settingUp: return .focused
        case .searchingWeb: return .gliding
        case .foundSomething, .waitingForApproval: return .foundSomething
        case .approved: return .cheering
        case .declined, .error: return .cosy
        }
    }

    /// The caption used when the event gives none.
    public var defaultLabel: String {
        switch self {
        case .idle: return "Ready when you are"
        case .listening: return "Listening"
        case .thinking: return "Thinking"
        case .readingAccount: return "Reading your account"
        case .searchingWeb: return "Searching the web"
        case .readingPages: return "Reading the pages"
        case .calculating: return "Doing the sums"
        case .foundSomething: return "Found something"
        case .settingUp: return "Setting it up for you"
        case .waitingForApproval: return "Waiting for your approval"
        case .speaking: return "Telling you what I found"
        case .approved: return "Done"
        case .declined: return "Left as it was"
        case .error: return "Something went wrong"
        }
    }
}

/// The eight poses of the brand kit, as the backend names them.
public enum LiitoPose: String, Codable, CaseIterable, Sendable {
    case sleepy, curious, focused, gliding
    case foundSomething = "found-something"
    case cheering, proud, cosy

    /// The Rive mood for the pose (`found-something` is `found`).
    public var mood: RiveBindings.LiitoMood {
        switch self {
        case .sleepy: return .sleepy
        case .curious: return .curious
        case .focused: return .focused
        case .gliding: return .gliding
        case .foundSomething: return .found
        case .cheering: return .cheering
        case .proud: return .proud
        case .cosy: return .cosy
        }
    }
}

/// What Sisu is doing right now. Change the mascot only when `state` changes, and show `label` beside it.
public struct SisuActivity: Codable, Equatable, Sendable {
    public var state: SisuActivityState
    /// The pose the mascot should be in.
    public var liito: LiitoPose
    /// Plain words for a caption: `Searching the web with Exa`.
    public var label: String
    /// For example the search query, the page being read, or an action's warning.
    public var detail: String?

    /// An activity with the state's own pose. A nil or empty label gives the state's default caption.
    public init(_ state: SisuActivityState, label: String? = nil, detail: String? = nil) {
        self.state = state
        self.liito = state.pose
        self.label = label?.isEmpty == false ? label ?? state.defaultLabel : state.defaultLabel
        self.detail = detail
    }

    public static let idle = SisuActivity(.idle)

    /// The Rive mood to show: the pose's mood, except that `thinking` shows the mood `thinking` (the three
    /// bouncing dots).
    public var mood: RiveBindings.LiitoMood {
        state == .thinking ? .thinking : liito.mood
    }

    /// The same activity in another pose (a whole plan approved is `proud` instead of `cheering`).
    public func posed(_ pose: LiitoPose) -> SisuActivity {
        var copy = self
        copy.liito = pose
        return copy
    }
}

public enum Activity {
    /// The state a running tool puts Sisu in. An unknown tool is `thinking`.
    public static func state(forTool name: String) -> SisuActivityState {
        switch name {
        case "get_spending", "list_bills", "get_cash_flow", "find_patterns", "get_mortgage", "show_chart": return .readingAccount
        case "check_affordability", "run_scenario", "calculate": return .calculating
        case "search_offers", "web_search": return .searchingWeb
        case "prepare_action": return .settingUp
        default: return .thinking
        }
    }

    /// One turn of conversation: feed every event of the agent's stream through this.
    public static func nextActivity(_ current: SisuActivity, _ event: SisuEvent) -> SisuActivity {
        switch event {
        case .start, .transcript:
            return SisuActivity(.thinking)
        case .toolStart(_, let name, _, let label):
            return SisuActivity(state(forTool: name), label: label)
        case .stage(let stage):
            if stage.kind == .extraction { return SisuActivity(.readingPages, label: stage.summary) }
            if stage.kind == .lead { return SisuActivity(.foundSomething, label: stage.summary) }
            if stage.kind == .calculation { return SisuActivity(.calculating, label: stage.title, detail: stage.summary) }
            return current
        case .research(let result):
            guard let best = result.best else { return current }
            return SisuActivity(.foundSomething, label: "Best offer: \(best.provider)")
        case .action(let action):
            return SisuActivity(.waitingForApproval, label: action.title, detail: action.warning)
        case .sentence:
            return current.state == .waitingForApproval ? current : SisuActivity(.speaking)
        case .error(let message):
            return SisuActivity(.error, label: message)
        default:
            return current
        }
    }

    /// The money plan: feed every `PlanEvent` through this.
    public static func nextPlanActivity(_ current: SisuActivity, _ event: PlanEvent) -> SisuActivity {
        switch event {
        case .planStart:
            return SisuActivity(.thinking, label: "Opening your account")
        case .scan(let scan):
            return SisuActivity(.readingAccount, label: "Reading \(scan.transactions) transactions", detail: "\(scan.months) months")
        case .finding(let finding):
            return finding.role == "bill" ? current : SisuActivity(.foundSomething, label: finding.title)
        case .searchStart(_, let query, _):
            return SisuActivity(.searchingWeb, label: "Searching the web with Exa", detail: query)
        case .checkStart(_, let title, _):
            return SisuActivity(.searchingWeb, label: "Researching what is worth checking", detail: title)
        case .checkDone(let check):
            return check.finding?.isEmpty == false ? SisuActivity(.foundSomething, label: check.title) : current
        case .searchPages:
            return SisuActivity(.readingPages, label: "Reading the pages with Context.dev")
        case .pageRead(let page):
            return SisuActivity(.readingPages, label: page.reader == "exa" ? "Reading the pages with Exa" : "Reading the pages with Context.dev", detail: page.host)
        case .offers(let offers):
            guard let best = offers.best, offers.note?.isEmpty != false else { return current }
            return SisuActivity(.foundSomething, label: "Best \(offers.billType.rawValue) offer: \(best.provider)")
        case .calc:
            return SisuActivity(.calculating, label: "Adding it up")
        case .action(let action):
            return SisuActivity(.settingUp, label: action.title)
        case .planDone(let plan):
            let count = plan.actions.count
            return count > 0 ? SisuActivity(.waitingForApproval, label: "\(count) \(count == 1 ? "thing" : "things") set up") : SisuActivity(.speaking)
        case .error(let message):
            return SisuActivity(.error, label: message)
        case .projection, .summary, .unknown:
            return current
        }
    }
}
