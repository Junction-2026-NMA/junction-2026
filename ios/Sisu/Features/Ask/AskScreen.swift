// The coach screen: ask Sisu by text (or voice, through the store's seam), watch the answer and its stage
// cards arrive, answer the teaching question, approve or decline the simulated switch.
// All logic is in SisuCore (CoachSession and the presenters) and in CoachStore; this file lays it out.
import SisuCore
import SwiftUI

struct AskScreen: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if let session = model.coach.session {
            CoachConversation(session: session, store: model.coach)
                .id(ObjectIdentifier(session))
        } else {
            PlaceholderScreen(title: "Ask Sisu", mood: "idle", line: "Pick a profile and Sisu is ready for your questions.")
        }
    }
}

/// The conversation with one session.
private struct CoachConversation: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ObservedObject var session: CoachSession
    let store: CoachStore

    @State private var draft = ""
    @State private var stageJustLanded = false
    @State private var followBottom = true
    @State private var launchDone = false
    @FocusState private var typing: Bool

    private static let suggestions = [
        "How much do I spend on everyday things?",
        "Can you find me a cheaper electricity deal?",
        "Can I afford a €200 trip?",
    ]

    private var newest: CoachMessage? { session.messages.last { $0.role == .assistant } }
    private var stageCount: Int { newest?.stages.count ?? 0 }
    /// Some answer on screen is waiting for Approve or Decline: that card holds the one primary button.
    private var decisionWaiting: Bool {
        session.messages.contains { message in
            guard let action = message.action ?? message.stages.lazy.compactMap(\.actionValue).first else { return false }
            return action.status == .awaitingApproval
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            fallbackNotice
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
                        if session.messages.isEmpty {
                            emptyState
                        } else {
                            ForEach(session.messages) { message in
                                if message.role == .user {
                                    UserBubble(text: message.text, pending: message.pending)
                                        .id(message.id)
                                        .transition(cardTransition)
                                } else {
                                    AssistantAnswer(message: message, session: session, store: store, retry: { retry(message) })
                                        .id(message.id)
                                        .transition(cardTransition)
                                }
                            }
                        }
                        // Where the bottom of the content is, relative to the visible area: follow only while the
                        // user is at (or near) the bottom, so their own scrolling is never fought.
                        GeometryReader { geometry in
                            Color.clear.preference(key: BottomEdgeKey.self, value: geometry.frame(in: .named(Self.space)).minY)
                        }
                        .frame(height: 1)
                        .id(Self.bottom)
                    }
                    .padding(.horizontal, SisuTheme.Spacing.margin)
                    .padding(.vertical, SisuTheme.Spacing.card)
                    .animation(SisuMotion.state(reduceMotion: reduceMotion), value: session.messages.count)
                    .animation(SisuMotion.state(reduceMotion: reduceMotion), value: stageCount)
                }
                .coordinateSpace(name: Self.space)
                .background(GeometryReader { geometry in
                    Color.clear.preference(key: ViewportHeightKey.self, value: geometry.size.height)
                })
                .onPreferenceChange(ViewportHeightKey.self) { viewportHeight = $0 }
                .onPreferenceChange(BottomEdgeKey.self) { bottomEdge in
                    // Back at the bottom: follow again. Away from it only counts when the user moved it.
                    let near = bottomEdge <= viewportHeight + 120
                    if near, !followBottom { followBottom = true }
                    if !near, dragging, followBottom { followBottom = false }
                }
                .simultaneousGesture(DragGesture(minimumDistance: 8)
                    .onChanged { _ in dragging = true }
                    .onEnded { _ in dragging = false })
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: newest?.text.count ?? 0) { _, _ in follow(proxy) }
                .onChange(of: stageCount) { _, _ in follow(proxy) }
                .onChange(of: session.messages.count) { _, _ in
                    // A new question: always show it.
                    followBottom = true
                    follow(proxy)
                }
                .task(id: ObjectIdentifier(session)) { await runLaunch(proxy) }
            }
            if let notice = store.voice?.notice {
                Text(notice)
                    .font(SisuTheme.Font.label)
                    .foregroundStyle(SisuTheme.Color.textMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, SisuTheme.Spacing.margin)
            }
            composer
        }
        .background(SisuTheme.Color.background)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .onChange(of: stageCount) { old, new in
            guard new > old else { return }
            stageJustLanded = true
            Task {
                try? await Task.sleep(for: .seconds(1.2))
                stageJustLanded = false
            }
        }
        .onChange(of: session.isThinking) { _, thinking in
            if thinking { store.cheering = false }
        }
    }

    private static let bottom = "coach-bottom"
    private static let space = "coach-scroll"
    @State private var viewportHeight: CGFloat = 0
    @State private var dragging = false

    private var cardTransition: AnyTransition {
        reduceMotion ? .opacity : .opacity.combined(with: .move(edge: .bottom))
    }

    private func follow(_ proxy: ScrollViewProxy) {
        guard followBottom else { return }
        if reduceMotion {
            proxy.scrollTo(Self.bottom, anchor: .bottom)
        } else {
            withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo(Self.bottom, anchor: .bottom) }
        }
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .center, spacing: SisuTheme.Spacing.grid * 3) {
            VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
                Text("Ask Sisu")
                    .font(SisuTheme.Font.h1)
                    .foregroundStyle(SisuTheme.Color.text)
                    .accessibilityAddTraits(.isHeader)
            }
            Spacer(minLength: 0)
            RiveComponentView(.liito, values: RiveBindings.liito(mood: mood))
                .sizing(.contain)
                .frame(width: 72, height: 72)
                .riveAccessible("Liito the flying squirrel", value: mood.rawValue)
        }
        .padding(.horizontal, SisuTheme.Spacing.margin)
        .padding(.top, SisuTheme.Spacing.grid * 2)
        .padding(.bottom, SisuTheme.Spacing.grid * 2)
        .background(SisuTheme.Color.background)
    }

    /// Said once, in place, when Sisu switches from the live server to the recorded answers (or starts on them
    /// because the app already found the server unreachable). Not a permanent badge: Settings has the details.
    @ViewBuilder private var fallbackNotice: some View {
        if let notice = session.fallbackNotice {
            TransientNotice(id: "coach-fallback-\(session.customerId)", text: notice)
                .padding(.horizontal, SisuTheme.Spacing.margin)
                .padding(.bottom, SisuTheme.Spacing.grid * 2)
                .onDisappear { session.dismissFallbackNotice() }
        } else if store.fellBackToSample {
            TransientNotice(id: "coach-unreachable-\(session.customerId)",
                            text: "Sisu's server could not be reached, so you see recorded sample answers.")
                .padding(.horizontal, SisuTheme.Spacing.margin)
                .padding(.bottom, SisuTheme.Spacing.grid * 2)
        }
    }

    private var mood: RiveBindings.LiitoMood {
        CoachMood.liito(isThinking: session.isThinking, stageJustLanded: stageJustLanded, celebrating: store.cheering)
    }

    // MARK: Empty state

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
            Text("Ask about your money. Sisu checks your own numbers first.")
                .font(SisuTheme.Font.h2)
                .foregroundStyle(SisuTheme.Color.text)
                .fixedSize(horizontal: false, vertical: true)
            Eyebrow(text: "Try one of these")
                .padding(.top, SisuTheme.Spacing.grid * 2)
            ForEach(Self.suggestions, id: \.self) { question in
                SisuButton(label: question, style: .secondary) { send(question) }
            }
            Eyebrow(text: "Or let Sisu work through a whole case")
                .padding(.top, SisuTheme.Spacing.grid * 2)
            SisuButton(label: "Look into my finances", style: draft.isEmpty ? .primary : .secondary) { investigate() }
        }
    }

    // MARK: Composer

    private var composer: some View {
        HStack(spacing: SisuTheme.Spacing.grid * 2) {
            TextField("Ask Sisu anything", text: $draft, axis: .vertical)
                .lineLimit(1...4)
                .font(SisuTheme.Font.body)
                .foregroundStyle(SisuTheme.Color.text)
                .focused($typing)
                .submitLabel(.send)
                .onSubmit { send(draft) }
                .padding(.horizontal, SisuTheme.Spacing.card)
                .padding(.vertical, SisuTheme.Spacing.grid * 3)
                .frame(minHeight: SisuTheme.Spacing.touchTarget)
                .background(SisuTheme.Color.card, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.button, style: .continuous))
                .accessibilityLabel("Your question")
            if session.isThinking {
                SisuButton(label: "Stop", style: .secondary) { session.cancel() }
                    .frame(width: 88)
            } else {
                SisuButton(label: "Send", style: sendIsPrimary ? .primary : .secondary, enabled: !draft.trimmingCharacters(in: .whitespaces).isEmpty) {
                    send(draft)
                }
                .frame(width: 88)
            }
            RiveComponentView(.voiceButton, values: RiveBindings.voiceButton(state: store.voiceState)) { trigger in
                if trigger == "pressDown" { store.voiceDown() }
                if trigger == "pressUp" { store.voiceUp() }
            }
            .sizing(.contain)
            .frame(width: 56, height: 56)
            .riveAccessible(store.voice?.accessibilityLabel ?? "Talk to Sisu", isButton: true, value: store.voiceState.rawValue) {
                store.voice?.toggleFromAccessibility()
            }
            // For the UI tests: the spoken clips so far (identifiers are never read out).
            .accessibilityIdentifier("ask.voice.clips.\(store.voice?.clipsPlayed ?? 0)")
        }
        .padding(.horizontal, SisuTheme.Spacing.margin)
        .padding(.vertical, SisuTheme.Spacing.grid * 2)
        .background(SisuTheme.Color.background)
    }

    /// One primary button on screen: Send is primary only when there is text and nothing else holds the primary.
    private var sendIsPrimary: Bool {
        !draft.trimmingCharacters(in: .whitespaces).isEmpty && !decisionWaiting
    }

    // MARK: Turns

    private func send(_ text: String) {
        let question = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty else { return }
        draft = ""
        store.ask(question)
    }

    private func investigate() {
        draft = ""
        if !model.isDone(.investigate) { model.complete(.investigate) }
        store.investigate()
    }

    /// Asks the question of a failed answer again.
    private func retry(_ reply: CoachMessage) {
        guard let index = session.messages.firstIndex(where: { $0.id == reply.id }), index > 0 else { return }
        let question = session.messages[index - 1].text
        if question == CoachSession.investigateText {
            store.investigate()
        } else {
            store.ask(question)
        }
    }

    // MARK: Launch arguments (screenshots)

    private func runLaunch(_ proxy: ScrollViewProxy) async {
        let launch = CoachLaunch.current
        guard !launch.isEmpty, !launchDone else { return }
        launchDone = true
        try? await Task.sleep(for: .milliseconds(600))
        if launch.investigate {
            if session.messages.isEmpty { store.investigate() }
        } else if let ask = launch.ask, session.messages.isEmpty {
            store.ask(ask)
        }
        // Wait for the answer to finish.
        try? await Task.sleep(for: .milliseconds(300))
        for _ in 0..<200 where session.isThinking { try? await Task.sleep(for: .milliseconds(100)) }
        guard let reply = newest else { return }
        if let index = launch.quiz, let card = reply.teaching ?? reply.stages.lazy.compactMap(\.teachingValue).first {
            if store.choose(index, on: card) { model.coachMoment(.quizAnswered, id: card.id) }
        }
        if let decision = launch.decide, let action = reply.action ?? reply.stages.lazy.compactMap(\.actionValue).first {
            await AnswerActions.decide(action, approve: decision == "approve", store: store, model: model)
        }
        try? await Task.sleep(for: .milliseconds(400))
        if var target = launch.scroll {
            followBottom = target == "end"
            let kinds = Set(reply.stages.map(\.kind.rawValue))
            if target == "offers", kinds.contains("extraction") { target = "extraction" }
            if target == "quiz", kinds.contains("teaching") { target = "teaching" }
            var anchor = UnitPoint.top
            if target.hasSuffix("-bottom") {
                target = String(target.dropLast("-bottom".count))
                anchor = .bottom
            }
            let id = target == "end" ? Self.bottom : target == "top" ? reply.id : reply.id + "-" + target
            proxy.scrollTo(id, anchor: target == "end" ? .bottom : anchor)
        }
    }
}

private struct BottomEdgeKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

private struct ViewportHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

/// The user's message: right-aligned, deep green.
private struct UserBubble: View {
    let text: String
    let pending: Bool

    var body: some View {
        HStack {
            Spacer(minLength: SisuTheme.Spacing.section * 2)
            Text(text.isEmpty && pending ? "Listening…" : text)
                .font(SisuTheme.Font.body)
                .foregroundStyle(SisuTheme.Color.onPrimary)
                .padding(.horizontal, SisuTheme.Spacing.card)
                .padding(.vertical, SisuTheme.Spacing.grid * 3)
                .background(SisuTheme.Color.primary, in: RoundedRectangle(cornerRadius: SisuTheme.Radius.card, style: .continuous))
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("You asked: \(text)")
    }
}

extension Stage {
    var actionValue: AgentAction? { if case .action(let action) = data { return action } else { return nil } }
    var teachingValue: TeachingCard? { if case .teaching(let card) = data { return card } else { return nil } }
}

/// Placeholder: Liito and one friendly sentence, for tabs still being built (Path uses it too).
struct PlaceholderScreen: View {
    @Environment(AppModel.self) private var model
    let title: String
    let mood: String
    let line: String

    var body: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
            HStack {
                Text(title).font(SisuTheme.Font.h1).foregroundStyle(SisuTheme.Color.text)
                Spacer()
            }
            Spacer()
            RiveComponentView(.liito, values: RiveValues.liito(mood))
                .sizing(.contain)
                .frame(width: 240, height: 240)
                .frame(maxWidth: .infinity)
                .riveAccessible("Liito the flying squirrel")
            Text(line)
                .font(SisuTheme.Font.bodyLarge)
                .foregroundStyle(SisuTheme.Color.text)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
        }
        .padding(.horizontal, SisuTheme.Spacing.margin)
        .padding(.top, SisuTheme.Spacing.card)
    }
}
