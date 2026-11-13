// The demo flow as a pure state machine: pick a customer, X-ray, research, teach, approve, impact.
import Foundation

/// Where the user is in the demo flow.
public enum FlowStep: String, Codable, CaseIterable, Sendable {
    case pickCustomer, xray, research, teach, approve, impact
}

/// The stages of live research, in order.
public enum ResearchStage: String, Codable, CaseIterable, Sendable {
    case searching, reading, comparing, done
}

public struct FlowState: Equatable, Sendable {
    public var step: FlowStep
    public var customerId: String?
    /// The recurring bill the user is looking at.
    public var billId: String?
    /// The bill name the user confirmed. Bill names are Sisu's guess until this is set.
    public var confirmedBillLabel: String?
    public var researchStage: ResearchStage?
    public var chosenOfferId: String?
    /// The monthly saving of the chosen offer. Not counted anywhere until the action is approved.
    public var pendingSavingPerMonth: Double
    /// The user's prediction in the teaching question.
    public var guess: BranchId?
    public var guessRevealed: Bool
    public var actionStatus: ActionStatus
    /// Above 0 only after the user approved the action. This is what the futures chart uses.
    public var approvedSavingPerMonth: Double

    public init(step: FlowStep = .pickCustomer, customerId: String? = nil, billId: String? = nil, confirmedBillLabel: String? = nil,
                researchStage: ResearchStage? = nil, chosenOfferId: String? = nil, pendingSavingPerMonth: Double = 0, guess: BranchId? = nil,
                guessRevealed: Bool = false, actionStatus: ActionStatus = .none, approvedSavingPerMonth: Double = 0) {
        self.step = step; self.customerId = customerId; self.billId = billId; self.confirmedBillLabel = confirmedBillLabel
        self.researchStage = researchStage; self.chosenOfferId = chosenOfferId; self.pendingSavingPerMonth = pendingSavingPerMonth
        self.guess = guess; self.guessRevealed = guessRevealed; self.actionStatus = actionStatus
        self.approvedSavingPerMonth = approvedSavingPerMonth
    }

    /// Nothing picked yet.
    public static let initial = FlowState()
}

public enum FlowEvent: Equatable, Sendable {
    case customerPicked(String)
    case billChosen(id: String)
    case billNameConfirmed(String)
    case researchStarted
    case researchAdvanced(ResearchStage)
    case offerChosen(id: String, savingPerMonth: Double)
    case guessMade(BranchId)
    case guessRevealed
    case actionDrafted
    case actionApproved
    case actionDeclined
    case reset
}

/// The rules of the flow. An event that does not meet its requirement returns the state unchanged.
///
/// - `customerPicked(id)`: allowed at any step when `id` is not empty. Gives a fresh state with that customer
///   at step `.xray` (bill, research, offer, guess and action are all cleared).
/// - `billChosen(id)`: needs a customer and a non-empty id. Sets `billId`, goes back to step `.xray`, and
///   clears the confirmed label, research stage, chosen offer, pending and approved saving, guess and action.
/// - `billNameConfirmed(label)`: needs a `billId`. The label is trimmed of whitespace and must not be empty.
///   Sets `confirmedBillLabel`.
/// - `researchStarted`: needs a confirmed bill label. Step becomes `.research`, stage `.searching`, and the
///   chosen offer, pending and approved saving, guess and action are cleared.
/// - `researchAdvanced(stage)`: only at step `.research`, and only to the stage right after the current one
///   (`searching` → `reading` → `comparing` → `done`).
/// - `offerChosen(id, savingPerMonth)`: needs step `.research` at stage `.done` and a non-empty id. Sets
///   `chosenOfferId` and `pendingSavingPerMonth` (a negative or non-finite saving counts as 0). Step becomes
///   `.teach`, with no guess yet.
/// - `guessMade(branch)`: only at step `.teach` before the reveal. Sets `guess` (it may be changed).
/// - `guessRevealed`: needs step `.teach` and a guess. Sets `guessRevealed` and step becomes `.approve`.
///   The teaching question cannot be skipped: without a guess nothing happens.
/// - `actionDrafted`: only at step `.approve` with status `.none`. Status becomes `.drafted`.
/// - `actionApproved`: only when the status is `.drafted`. Status becomes `.approved`,
///   `approvedSavingPerMonth` becomes `pendingSavingPerMonth`, step becomes `.impact`.
/// - `actionDeclined`: only when the status is `.drafted`. Status becomes `.declined`,
///   `approvedSavingPerMonth` stays 0, step becomes `.impact`.
/// - `reset`: gives `FlowState.initial`.
public enum Flow {
    public static func reduce(_ state: FlowState, _ event: FlowEvent) -> FlowState {
        state // scaffold stub
    }
}
