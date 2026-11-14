// The sheets: the safe-to-spend maths, the transactions behind a figure, and settings.
import SisuCore
import SwiftUI

/// A sheet's frame: near-white green, a title and a close button.
private struct SheetFrame<Content: View>: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                Text(title)
                    .font(SisuTheme.Font.h2)
                    .foregroundStyle(SisuTheme.Color.text)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: SisuTheme.Spacing.card)
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(SisuTheme.Font.button)
                        .foregroundStyle(SisuTheme.Color.green700)
                        .frame(width: 40, height: 40)
                        .background(SisuTheme.Color.green100, in: Circle())
                }
                .accessibilityLabel("Close")
            }
            .padding(.horizontal, SisuTheme.Spacing.margin)
            .padding(.top, SisuTheme.Spacing.margin + SisuTheme.Spacing.grid)
            .padding(.bottom, SisuTheme.Spacing.card)
            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(SisuTheme.Color.green25.ignoresSafeArea())
        .presentationCornerRadius(SisuTheme.Radius.sheet)
        .presentationDragIndicator(.visible)
    }
}

// MARK: - Maths

struct MathsSheet: View {
    @Environment(AppModel.self) private var model
    let overview: Overview

    var body: some View {
        SheetFrame(title: "How safe to spend is worked out") {
            ScrollView {
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
                    if !model.isLive { SampleDataTag() }
                    SisuCard {
                        ForEach(Array(TodayPresenter.mathsLines(overview).enumerated()), id: \.offset) { index, line in
                            if index > 0 { Divider().overlay(line.isResult ? SisuTheme.Color.green900 : SisuTheme.Color.neutral200) }
                            HStack(alignment: .firstTextBaseline) {
                                VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
                                    Text(line.label)
                                        .font(line.isResult ? SisuTheme.Font.button : SisuTheme.Font.body)
                                        .foregroundStyle(SisuTheme.Color.text)
                                    Text(line.basis)
                                        .font(SisuTheme.Font.caption)
                                        .foregroundStyle(SisuTheme.Color.textMuted)
                                }
                                .fixedSize(horizontal: false, vertical: true)
                                Spacer(minLength: SisuTheme.Spacing.card)
                                Text(line.amount)
                                    .font(line.isResult ? SisuTheme.Font.h2 : SisuTheme.Font.button)
                                    .foregroundStyle(SisuTheme.Color.text)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                    Text(TodayPresenter.dataDate(overview))
                        .font(SisuTheme.Font.caption)
                        .foregroundStyle(SisuTheme.Color.textMuted)
                }
                .padding(.horizontal, SisuTheme.Spacing.margin)
                .padding(.bottom, SisuTheme.Spacing.section)
            }
        }
        .presentationDetents([.large])
    }
}

// MARK: - Transactions

struct TransactionsSheet: View {
    @Environment(AppModel.self) private var model
    let request: EvidenceRequest
    @State private var list: TransactionList?
    @State private var failed = false

    var body: some View {
        SheetFrame(title: request.title) {
            Group {
                if let list {
                    if list.transactions.isEmpty {
                        message("No payments in this period.")
                    } else {
                        rows(list)
                    }
                } else if failed {
                    VStack(spacing: SisuTheme.Spacing.card) {
                        message("The payments could not be loaded.")
                        SisuButton(label: "Try again", style: .secondary) { Task { await load() } }
                            .padding(.horizontal, SisuTheme.Spacing.margin)
                    }
                } else {
                    VStack(spacing: SisuTheme.Spacing.card) {
                        ProgressView().tint(SisuTheme.Color.green700)
                        message("Finding the payments")
                    }
                    .padding(.top, SisuTheme.Spacing.section)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .task { await load() }
    }

    private func rows(_ list: TransactionList) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
                if !model.isLive { SampleDataTag() }
                Text(TodayPresenter.transactionsTotal(list))
                    .font(SisuTheme.Font.h3)
                    .foregroundStyle(SisuTheme.Color.text)
                if let note = TodayPresenter.truncatedNote(list) {
                    Text(note).font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.textMuted)
                }
            }
            .padding(.horizontal, SisuTheme.Spacing.margin)
            .padding(.bottom, SisuTheme.Spacing.grid * 3)

            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(Array(list.transactions.enumerated()), id: \.offset) { index, transaction in
                        let row = TodayPresenter.transactionRow(transaction)
                        if index > 0 { Divider().overlay(SisuTheme.Color.neutral200) }
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(row.category).font(SisuTheme.Font.body).foregroundStyle(SisuTheme.Color.text)
                                Text(row.date).font(SisuTheme.Font.caption).foregroundStyle(SisuTheme.Color.textMuted)
                            }
                            Spacer()
                            Text(row.amount).font(SisuTheme.Font.button).foregroundStyle(SisuTheme.Color.text)
                        }
                        .padding(.vertical, SisuTheme.Spacing.grid * 3)
                        .accessibilityElement(children: .combine)
                    }
                }
                .padding(.horizontal, SisuTheme.Spacing.margin)
                .background(SisuTheme.Color.card, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous))
                .padding(.horizontal, SisuTheme.Spacing.margin)
                .padding(.bottom, SisuTheme.Spacing.section)
            }
            .scrollIndicators(.hidden)
        }
    }

    private func message(_ text: String) -> some View {
        Text(text)
            .font(SisuTheme.Font.body)
            .foregroundStyle(SisuTheme.Color.textMuted)
            .frame(maxWidth: .infinity)
            .padding(.top, SisuTheme.Spacing.card)
    }

    private func load() async {
        failed = false
        do {
            list = try await model.transactions(request.filter)
        } catch {
            failed = true
        }
    }
}

// MARK: - Settings

struct SettingsSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var address = ""

    var body: some View {
        SheetFrame(title: "Settings") {
            ScrollView {
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
                    SisuCard {
                        Text("Backend address").font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.textMuted)
                        TextField("http://localhost:3000", text: $address)
                            .font(SisuTheme.Font.body)
                            .foregroundStyle(SisuTheme.Color.text)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .submitLabel(.done)
                            .onSubmit(applyAddress)
                            .padding(.horizontal, SisuTheme.Spacing.grid * 4)
                            .frame(height: SisuTheme.Spacing.touchTarget)
                            .background(SisuTheme.Color.green25, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.button, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: SisuTheme.Radius.button, style: .continuous).stroke(SisuTheme.Color.neutral400))
                            .accessibilityLabel("Backend address")
                        Text(statusLine)
                            .font(SisuTheme.Font.label)
                            .foregroundStyle(SisuTheme.Color.text)
                        Divider().overlay(SisuTheme.Color.neutral200)
                        HStack {
                            Text("Use sample data only")
                                .font(SisuTheme.Font.body)
                                .foregroundStyle(SisuTheme.Color.text)
                            Spacer()
                            RiveComponentView(.toggle, values: RiveValues.toggle(on: model.sampleOnly)) { trigger in
                                if trigger == "toggled" { toggleSample() }
                            }
                            .riveAccessible("Use sample data only", isButton: true, value: model.sampleOnly ? "On" : "Off", action: toggleSample)
                        }
                    }
                    SisuButton(label: "Start the demo over", style: .secondary) {
                        model.resetDemo()
                        dismiss()
                    }
                    SisuButton(label: "Switch customer", style: .quiet) {
                        dismiss()
                        model.switchCustomer()
                    }
                }
                .padding(.horizontal, SisuTheme.Spacing.margin)
                .padding(.bottom, SisuTheme.Spacing.section)
            }
        }
        .presentationDetents([.height(480), .large])
        .onAppear { address = model.baseURLString }
    }

    private var statusLine: String {
        switch model.backendAnswered {
        case .some(true): return "The backend answered. Figures are live."
        case .some(false): return "The backend did not answer, so Sisu shows sample data."
        case .none: return "Sample data only. Sisu is not asking the backend."
        }
    }

    private func applyAddress() {
        model.baseURLString = address
        Task { await model.applySettings() }
    }

    private func toggleSample() {
        model.sampleOnly.toggle()
        Task { await model.applySettings() }
    }
}
