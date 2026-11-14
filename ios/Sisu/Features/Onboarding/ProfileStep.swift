// Choosing a demo profile: the third screen of the first run, and the chooser that "Switch customer" opens.
// It carries the demo disclosure for the whole demo. Tapping a card is the action: the card turns S-Pankki green
// with a check, then the profile opens.
import SisuCore
import SwiftUI

struct ProfileStep: View {
    enum Mode { case onboarding, chooser }

    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let mode: Mode
    let choose: (DemoCustomer) -> Void
    @State private var selected: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
                    Text(OnboardingCopy.profileTitle)
                        .font(SisuTheme.Font.h1)
                        .foregroundStyle(SisuTheme.Color.text)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    Text(OnboardingCopy.profileBody)
                        .font(SisuTheme.Font.bodyLarge)
                        .foregroundStyle(SisuTheme.Color.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, mode == .chooser ? SisuTheme.Spacing.section : SisuTheme.Spacing.card)

                DemoDisclosure()

                switch model.customersState {
                case .failed(let message):
                    SisuCard {
                        Text(message).font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
                        SisuButton(label: "Try again", style: .secondary) { Task { await model.retry() } }
                    }
                case .loaded:
                    ForEach(OnboardingProfiles.sorted(model.customers), id: \.customerId) { customer in
                        ProfileCard(customer: customer, selected: selected == customer.customerId,
                                    dimmed: selected != nil && selected != customer.customerId) { pick(customer) }
                    }
                default:
                    ProgressView()
                        .tint(SisuTheme.Color.primary)
                        .frame(maxWidth: .infinity, minHeight: 120)
                        .accessibilityLabel("Loading the profiles")
                }
            }
            .padding(.horizontal, SisuTheme.Spacing.margin)
            .padding(.bottom, SisuTheme.Spacing.section)
        }
        .scrollIndicators(.hidden)
        .sensoryFeedback(.selection, trigger: selected)
    }

    private func pick(_ customer: DemoCustomer) {
        guard selected == nil else { return }
        withAnimation(SisuMotion.state(reduceMotion: reduceMotion)) { selected = customer.customerId }
        // Long enough to see the card turn green; the profile's data starts loading right after.
        let pause = reduceMotion ? 0 : Int(260 * model.launch.motionScale)
        Task {
            try? await Task.sleep(for: .milliseconds(pause))
            choose(customer)
        }
    }
}

/// "This is a demo": the one place the demo is disclosed.
struct DemoDisclosure: View {
    var body: some View {
        HStack(alignment: .top, spacing: SisuTheme.Spacing.grid * 3) {
            Image(systemName: "info.circle.fill")
                .font(SisuTheme.Font.h3)
                .foregroundStyle(SisuTheme.Color.infoText)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
                Text(OnboardingCopy.disclosureTitle)
                    .font(SisuTheme.Font.button)
                Text(OnboardingCopy.disclosureBody)
                    .font(SisuTheme.Font.label)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .foregroundStyle(SisuTheme.Color.infoText)
            Spacer(minLength: 0)
        }
        .padding(SisuTheme.Spacing.card)
        .background(SisuTheme.Color.infoBackground, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

private struct ProfileCard: View {
    let customer: DemoCustomer
    let selected: Bool
    let dimmed: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: SisuTheme.Spacing.card) {
                Text(String(customer.displayName.prefix(1)))
                    .font(SisuTheme.Font.h2)
                    .foregroundStyle(selected ? SisuTheme.Color.onPrimary : SisuTheme.Color.green900)
                    .frame(width: 56, height: 56)
                    .background(selected ? SisuTheme.Color.primary : SisuTheme.Color.green100, in: Circle())
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
                    Text(customer.displayName)
                        .font(SisuTheme.Font.h2)
                        .foregroundStyle(SisuTheme.Color.text)
                    Text(OnboardingProfiles.subtitle(customer))
                        .font(SisuTheme.Font.body)
                        .foregroundStyle(SisuTheme.Color.textMuted)
                    Text(OnboardingProfiles.pitch(for: customer.customerId))
                        .font(SisuTheme.Font.label)
                        .foregroundStyle(SisuTheme.Color.primary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                ZStack {
                    Circle()
                        .strokeBorder(selected ? SisuTheme.Color.primary : SisuTheme.Color.neutral200, lineWidth: 2)
                    if selected {
                        Circle().fill(SisuTheme.Color.primary)
                        Image(systemName: "checkmark")
                            .font(SisuTheme.Font.label)
                            .foregroundStyle(SisuTheme.Color.onPrimary)
                            .transition(.scale.combined(with: .opacity))
                    }
                }
                .frame(width: 28, height: 28)
            }
            .padding(SisuTheme.Spacing.margin)
            .frame(maxWidth: .infinity, minHeight: 112, alignment: .leading)
            .overlay(
                RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous)
                    .strokeBorder(selected ? SisuTheme.Color.primary : .clear, lineWidth: 2)
            )
        }
        .buttonStyle(PressableCardStyle())
        .opacity(dimmed ? 0.5 : 1)
        .accessibilityLabel(OnboardingProfiles.accessibilityLabel(customer))
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityHint("Opens this profile's money")
    }
}
