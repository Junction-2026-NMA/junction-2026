// The voice lab: push to talk on a session of its own, without the Ask screen. Shown on the Path tab when the
// app is launched with `-sisu.voicelab 1`. Plain text for what was heard and the answer, the button's state,
// a mute toggle and the notice. With `-sisu.voicefixture 1` the button sends a bundled clip.
import SisuCore
import SwiftUI

struct VoiceLabScreen: View {
    @Environment(AppModel.self) private var model
    @State private var voice: VoiceController?

    var body: some View {
        Group {
            if let voice {
                VoiceLabContent(voice: voice, session: voice.session)
            } else {
                LoadingState()
            }
        }
        .background(SisuTheme.Color.background)
        .task(id: model.customersState == .loaded) {
            guard voice == nil, model.customersState == .loaded else { return }
            let customerId = model.customer?.customerId ?? FixtureAPI.customerIds.first ?? "CUST04974"
            let session: CoachSession
            if model.isLive, let url = URL(string: model.baseURLString) {
                session = CoachSession.live(customerId: customerId, baseURL: url)
            } else {
                session = CoachSession.sample(customerId: customerId)
            }
            let launch = VoiceLaunch.current
            voice = VoiceController(session: session, fixture: launch.voiceFixture ? .fixture : nil)
        }
    }
}

private struct VoiceLabContent: View {
    let voice: VoiceController
    @ObservedObject var session: CoachSession
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var didAutoRun = false

    private var heard: CoachMessage? { session.messages.last { $0.role == .user } }
    private var answer: CoachMessage? { session.messages.last { $0.role == .assistant } }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
                    SisuCard {
                        Eyebrow(text: "You said")
                        Text(heardText)
                            .font(SisuTheme.Font.bodyLarge)
                            .foregroundStyle(SisuTheme.Color.text)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("voicelab.transcript")
                    }
                    SisuCard {
                        Eyebrow(text: "Sisu")
                        Text(answerText)
                            .font(SisuTheme.Font.body)
                            .foregroundStyle(SisuTheme.Color.text)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("voicelab.answer")
                        if let error = answer?.error {
                            Text(error).font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.textMuted)
                        }
                        Text(clipsText)
                            .font(SisuTheme.Font.caption)
                            .foregroundStyle(SisuTheme.Color.textMuted)
                            .accessibilityIdentifier("voicelab.clips")
                    }
                    SisuCard {
                        HStack(spacing: SisuTheme.Spacing.grid * 3) {
                            VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid) {
                                Text("Speak replies").font(SisuTheme.Font.h3).foregroundStyle(SisuTheme.Color.text)
                                Text(VoiceText.speakRepliesDetail(muted: voice.isMuted))
                                    .font(SisuTheme.Font.label).foregroundStyle(SisuTheme.Color.textMuted)
                            }
                            Spacer(minLength: 0)
                            RiveComponentView(.toggle, values: RiveBindings.toggle(on: !voice.isMuted)) { trigger in
                                if trigger == "toggled" { voice.isMuted.toggle() }
                            }
                            .riveAccessible("Speak replies", isButton: true, value: voice.isMuted ? "Off" : "On") { voice.isMuted.toggle() }
                        }
                    }
                }
                .padding(.horizontal, SisuTheme.Spacing.margin)
                .padding(.vertical, SisuTheme.Spacing.grid * 2)
            }
            .scrollIndicators(.hidden)
            talkArea
        }
        .background(SisuTheme.Color.background)
        .animation(SisuMotion.state(reduceMotion: reduceMotion), value: voice.notice)
        .task {
            guard VoiceLaunch.current.voiceAuto, voice.fixture != nil, !didAutoRun else { return }
            didAutoRun = true
            try? await Task.sleep(for: .milliseconds(800))
            voice.pressDown()
            try? await Task.sleep(for: .milliseconds(700))
            voice.pressUp()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 2) {
            Text("Voice lab")
                .font(SisuTheme.Font.h1)
                .foregroundStyle(SisuTheme.Color.text)
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: SisuTheme.Spacing.grid * 2) {
                if let tag = CoachText.dataTag(for: session.dataLabel) {
                    RiveComponentView(.tag, values: RiveBindings.tag(text: tag, tone: .amber))
                        .riveAccessible(tag)
                }
                if voice.fixture != nil {
                    Text("Test clip, no microphone")
                        .font(SisuTheme.Font.caption)
                        .foregroundStyle(SisuTheme.Color.textMuted)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, SisuTheme.Spacing.margin)
        .padding(.vertical, SisuTheme.Spacing.grid * 2)
    }

    private var talkArea: some View {
        VStack(spacing: SisuTheme.Spacing.grid * 2) {
            if let notice = voice.notice {
                Text(notice)
                    .font(SisuTheme.Font.label)
                    .foregroundStyle(SisuTheme.Color.text)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, SisuTheme.Spacing.grid * 4)
                    .padding(.vertical, SisuTheme.Spacing.grid * 2)
                    .background(SisuTheme.Color.green100, in: Capsule())
                    .accessibilityIdentifier("voicelab.notice")
            }
            RiveComponentView(.voiceButton, values: RiveBindings.voiceButton(voice.state)) { voice.handle($0) }
                .riveAccessible(voice.accessibilityLabel, isButton: true) { voice.toggleFromAccessibility() }
                .accessibilityIdentifier("voicelab.button")
            Text(VoiceButtonPresenter.label(voice.state))
                .font(SisuTheme.Font.label)
                .foregroundStyle(SisuTheme.Color.textMuted)
                .accessibilityIdentifier("voicelab.state")
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, SisuTheme.Spacing.grid * 3)
    }

    private var heardText: String {
        guard let heard else { return "Hold the button and ask Sisu something." }
        return heard.pending && heard.text.isEmpty ? "Listening…" : heard.text
    }

    private var answerText: String {
        guard let answer else { return "The answer appears here as it streams." }
        if answer.text.isEmpty { return answer.filler ?? (answer.pending ? "Thinking…" : "No answer.") }
        return answer.text
    }

    private var clipsText: String {
        VoiceText.clipsPlayed(voice.clipsPlayed)
    }
}
