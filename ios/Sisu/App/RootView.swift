// A minimal shell that proves the pieces work together: SisuCore data, the theme and the Rive layer.
// It will be replaced by the real screens.
import SisuCore
import SwiftUI

struct RootView: View {
    /// Taps on Continue needed to fill the demo jar.
    private static let tapsToFill = 5
    /// Shown until SisuCore's presenter is implemented, so the Rive file's sample figure never appears as real.
    private static let pendingHero: [String: RiveValue] = [
        "eyebrow": .string("Safe to spend"), "amount": .string("–"),
        "unit": .string(""), "context": .string("Waiting for SisuCore"),
    ]

    private let api: any SisuAPI = FixtureAPI()

    @State private var customers: [DemoCustomer] = []
    @State private var hero = RootView.pendingHero
    /// The last day the sample data covers.
    @State private var dataDate = ""
    @State private var problem: String?
    @State private var continueTaps = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
                header
                RiveComponentView(.heroNumber, values: hero)
                ForEach(customers, id: \.customerId) { customer in
                    CustomerCard(customer: customer)
                }
                if let problem {
                    Text(problem).font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
                }
                RiveComponentView(.button, values: ["label": .string("Continue")], onTrigger: { _ in
                    continueTaps += 1
                })
                Text("Continue tapped \(continueTaps) times")
                    .font(SisuTheme.Font.label)
                    .foregroundStyle(SisuTheme.Color.textMuted)
                // The 3D file is optional: without it this shows the 2D jar, and without that a placeholder.
                RiveComponentView(.jar3D, values: jar, triggers: ["celebrate#\(continueTaps / Self.tapsToFill)"])
                    .frame(height: 200)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, SisuTheme.Spacing.margin)
            .padding(.vertical, SisuTheme.Spacing.section)
        }
        .background(SisuTheme.Color.background.ignoresSafeArea())
        .task { await load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
            Text("Sisu").font(SisuTheme.Font.h1).foregroundStyle(SisuTheme.Color.text)
            if api.kind != .live {
                Text(dataDate.isEmpty ? "Sample data" : "Sample data, up to \(dataDate)")
                    .font(SisuTheme.Font.caption)
                    .foregroundStyle(SisuTheme.Color.amberText)
                    .padding(.horizontal, SisuTheme.Spacing.grid * 3)
                    .padding(.vertical, SisuTheme.Spacing.grid)
                    .background(SisuTheme.Color.amberBackground, in: Capsule())
            }
        }
    }

    /// Every tap on Continue fills the jar a little. This exercises number, bool and trigger bindings.
    private var jar: [String: RiveValue] {
        let fill = Double(continueTaps % Self.tapsToFill) / Double(Self.tapsToFill)
        let justFilled = continueTaps > 0 && continueTaps % Self.tapsToFill == 0
        return ["fill": .number(justFilled ? 1 : fill), "label": .string("Demo jar"), "full": .bool(justFilled)]
    }

    private func load() async {
        do {
            customers = try await api.demoCustomers()
            guard let first = customers.first else { return }
            let overview = try await api.overview(customerId: first.customerId)
            dataDate = Dates.short(overview.dataTimestamp, language: .en)
            let values = RiveBindings.heroNumber(XrayPresenter.hero(for: overview, language: .en))
            if !values.isEmpty { hero = values }
        } catch {
            problem = "Some sample data could not be loaded."
        }
    }
}

private struct CustomerCard: View {
    let customer: DemoCustomer

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
            Text(customer.displayName).font(SisuTheme.Font.h3).foregroundStyle(SisuTheme.Color.text)
            Text("\(customer.age) · \(customer.area) \(customer.postalCode)")
                .font(SisuTheme.Font.body)
                .foregroundStyle(SisuTheme.Color.textMuted)
        }
        .padding(SisuTheme.Spacing.margin)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SisuTheme.Color.card, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous))
    }
}
