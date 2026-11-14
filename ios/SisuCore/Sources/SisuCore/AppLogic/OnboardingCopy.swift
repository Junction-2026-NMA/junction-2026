// The words and figures of the first run: each screen's copy, what makes each demo profile interesting, the
// reading moment, and the first insight Today highlights. Every figure comes from the overview payload.
import Foundation

/// One row of the "what Sisu does" screen: a basket and everyday examples of what lands in it. No amounts:
/// no profile is chosen yet, and every figure on screen must come from a profile's data.
public struct OnboardingBasketRow: Equatable, Sendable, Identifiable {
    public let kind: BasketKind
    /// "Rent, phone, electricity"
    public let examples: String
    /// "Must pay, every month"
    public let meaning: String
    public var id: String { kind.rawValue }
}

/// The copy of the intro screens and the profile screen (shaped by .handoff/onboarding-research.md).
public enum OnboardingCopy {
    public static let welcomeTitle = "See where your money goes, and keep a little more of it."
    public static let welcomeBody = "Sisu is a money coach inside S-Pankki. Small wins with your money, every day."
    public static let welcomeButton = "Show me how"

    public static let promiseTitle = "Every euro lands in one of three baskets"
    public static let promiseBaskets: [OnboardingBasketRow] = [
        OnboardingBasketRow(kind: .fixed, examples: "Rent, phone, electricity", meaning: "Must pay, every month"),
        OnboardingBasketRow(kind: .curveballs, examples: "Dentist, repairs, gifts", meaning: "Must pay, now and then"),
        OnboardingBasketRow(kind: .leaks, examples: "Food, coffee, rides", meaning: "Everyday choices"),
    ]
    /// What Sisu does with the baskets: the three promises, one line each.
    public static let promiseThenTitle = "Then Sisu"
    public static let promiseThen = [
        "Finds the money that slips away",
        "Checks live offers for your bills",
        "Gives you one small step a day",
    ]
    public static let promiseButton = "Got it"

    public static let profileTitle = "Pick someone to be today"
    public static let profileBody = "Sisu reads their last 12 months and shows you what it finds."
    /// The demo disclosure. The profile screen carries it for the whole demo.
    public static let disclosureTitle = "This is a demo"
    public static let disclosureBody = "These are fictional people with synthetic S-\u{2060}Pankki data and invented names. Nothing here is anyone's real money."

    public static let skip = "Skip"
    public static let back = "Back"
}

/// What makes each demo profile worth picking. No figures: the profile's overview is not loaded yet.
public enum OnboardingProfiles {
    /// The order the profiles are offered in: the strongest story first.
    public static let order = ["CUST04414", "CUST04974", "CUST02003"]

    /// One line on what is interesting about this profile; a neutral line for a customer Sisu does not know.
    public static func pitch(for customerId: String) -> String {
        switch customerId {
        case "CUST04414": return "The biggest bill-switching win"
        case "CUST04974": return "Some months run out before payday"
        case "CUST02003": return "A big buffer, and what to do next"
        default: return "A year of everyday banking"
        }
    }

    /// The customers in `order`, then any others in the order given.
    public static func sorted(_ customers: [DemoCustomer]) -> [DemoCustomer] {
        customers.enumerated().sorted { a, b in
            let ia = order.firstIndex(of: a.element.customerId) ?? order.count + a.offset
            let ib = order.firstIndex(of: b.element.customerId) ?? order.count + b.offset
            return ia < ib
        }.map(\.element)
    }

    /// "25 · Espoo".
    public static func subtitle(_ customer: DemoCustomer) -> String { "\(customer.age) · \(customer.area)" }

    /// The card's accessibility label: "Eetu, 25, Espoo. The biggest bill-switching win".
    public static func accessibilityLabel(_ customer: DemoCustomer) -> String {
        "\(customer.displayName), \(customer.age), \(customer.area). \(pitch(for: customer.customerId))"
    }
}

/// The "Sisu is reading" moment between the profile choice and Today.
public enum OnboardingReading {
    /// While the overview loads: "Liito is sorting 12 months of Eetu's payments".
    public static func loadingTitle(name: String, months: Int = 12) -> String {
        "Liito is sorting \(months) months of \(name)'s payments"
    }

    public static let loadingDetail = "Sorting them into three baskets: must pay every month, now and then, and everyday choices."

    /// Every categorised payment in the overview's window (the sum of the categories' counts).
    public static func paymentCount(_ overview: Overview) -> Int {
        overview.baskets.reduce(0) { sum, basket in sum + basket.categories.reduce(0) { $0 + $1.count } }
    }

    public static let failedButton = "Pick a profile again"
}

/// The callout Today shows above the flagged bill on the first visit.
public struct FirstInsightState: Equatable, Sendable {
    public let eyebrow: String
    /// "Looks like Electricity is your biggest bill after rent: about €79 a month."
    public let headline: String
    /// Where the figure comes from, and why it matters.
    public let detail: String
    /// Where the figure comes from: "From 36 of Eetu's transactions".
    public let source: String
    /// The link's visible words: "See them".
    public let seeLabel: String
    /// Source and link as one sentence, the link's accessibility label: "From 36 of Eetu's transactions · See them".
    public var linkLabel: String { "\(source) · \(seeLabel)" }
    /// The transactions sheet's title and filter: the same rows the bill card opens.
    public let evidenceTitle: String
    public let evidence: EvidenceFilter
    public let dismissLabel: String
}

public enum FirstInsightPresenter {
    /// The first insight for this overview: the flagged bill, with the bills category it sits in. Nil when
    /// there is no bill to flag.
    public static func state(for overview: Overview, confirmedName: String? = nil) -> FirstInsightState? {
        let owner = overview.displayName.isEmpty ? "these" : "\(overview.displayName)'s"
        guard let bill = TodayPresenter.flaggedBill(in: overview) else { return nil }
        let money = { (amount: Double) in Money.format(amount, language: .en) }
        let name = confirmedName.map { "\($0) is" } ?? "Looks like \(bill.guessLabel) is"
        let headline = "\(name) your biggest bill after rent: about \(money(bill.monthlyAvg)) a month."
        let category = overview.baskets.lazy.flatMap(\.categories).first { $0.category == bill.category }
        let detail: String
        let source: String
        if let category, category.count > 0 {
            detail = "All your \(bill.category.lowercased()) bills come to about \(money(category.monthlyAvg)) a month. "
                + "Bills like these are often cheaper for new customers."
            source = "From \(category.count) of \(owner) transactions"
        } else {
            detail = bill.basis
            source = "From \(owner) transactions"
        }
        return FirstInsightState(
            eyebrow: "Liito found something",
            headline: headline,
            detail: detail,
            source: source,
            seeLabel: "See them",
            evidenceTitle: "\(bill.category) payments",
            evidence: EvidenceFilter(from: overview.windowFrom, to: overview.windowTo, category: bill.category),
            dismissLabel: "Got it"
        )
    }
}
