// The customer picker: three synthetic S-Pankki customers as large pressable cards, with Liito saying hello.
import SisuCore
import SwiftUI

struct PickerScreen: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
                        Text("sisu")
                            .font(SisuTheme.Font.display)
                            .foregroundStyle(SisuTheme.Color.green700)
                        Text("Small wins, every day.")
                            .font(SisuTheme.Font.h2)
                            .foregroundStyle(SisuTheme.Color.text)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                    LiitoView(mood: "cheering", label: "Liito the flying squirrel waves hello")
                        .frame(width: 150, height: 150)
                }
                .padding(.top, SisuTheme.Spacing.card)

                Text("Pick someone to be today. These are synthetic S-Pankki customers with invented names.")
                    .font(SisuTheme.Font.bodyLarge)
                    .foregroundStyle(SisuTheme.Color.text)
                    .fixedSize(horizontal: false, vertical: true)

                if !model.isLive {
                    SampleDataTag()
                }

                switch model.customersState {
                case .failed(let message):
                    SisuCard {
                        Text(message).font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
                        SisuButton(label: "Try again", style: .secondary) { Task { await model.retry() } }
                    }
                default:
                    ForEach(model.customers, id: \.customerId) { customer in
                        CustomerCard(customer: customer) { Task { await model.choose(customer) } }
                    }
                }
            }
            .padding(.horizontal, SisuTheme.Spacing.margin)
            .padding(.bottom, SisuTheme.Spacing.section)
        }
        .scrollIndicators(.hidden)
    }
}

private struct CustomerCard: View {
    let customer: DemoCustomer
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: SisuTheme.Spacing.card) {
                Text(String(customer.displayName.prefix(1)))
                    .font(SisuTheme.Font.h2)
                    .foregroundStyle(SisuTheme.Color.green900)
                    .frame(width: 56, height: 56)
                    .background(SisuTheme.Color.green100, in: Circle())
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
                    Text(customer.displayName)
                        .font(SisuTheme.Font.h2)
                        .foregroundStyle(SisuTheme.Color.text)
                    Text("\(customer.age) · \(customer.area)")
                        .font(SisuTheme.Font.body)
                        .foregroundStyle(SisuTheme.Color.textMuted)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(SisuTheme.Font.button)
                    .foregroundStyle(SisuTheme.Color.green700)
            }
            .padding(SisuTheme.Spacing.margin)
            .frame(maxWidth: .infinity, minHeight: 96, alignment: .leading)
        }
        .buttonStyle(PressableCardStyle())
        .accessibilityLabel("\(customer.displayName), \(customer.age), \(customer.area)")
        .accessibilityHint("Opens this customer's money")
    }
}

/// A white card with a 4 pt darker bottom edge that moves down when pressed.
struct PressableCardStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        configuration.label
            .background(SisuTheme.Color.card, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous))
            .offset(y: pressed ? SisuTheme.Spacing.pressEdge : 0)
            .background(
                RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous)
                    .fill(SisuTheme.Color.green300)
                    .offset(y: SisuTheme.Spacing.pressEdge)
            )
            .padding(.bottom, SisuTheme.Spacing.pressEdge)
            .animation(SisuMotion.state(reduceMotion: reduceMotion), value: pressed)
    }
}
