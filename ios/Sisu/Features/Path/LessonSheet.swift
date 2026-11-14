// One lesson: the idea in plain words, then predict (three Rive choice cards) and reveal (the customer's own
// figures). Berries are awarded once, when the lesson is answered the first time. Any answer is fine.
import SisuCore
import SwiftUI

struct LessonSheet: View {
    let card: TeachingCard
    let path: PathModel
    /// Screenshots: answer with option n (1 based) once the sheet is up.
    var autoAnswer: Int?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var quiz: TeachingQuiz
    @State private var earned = 0
    @State private var finishedPath = false

    init(card: TeachingCard, path: PathModel, autoAnswer: Int? = nil) {
        self.card = card
        self.path = path
        self.autoAnswer = autoAnswer
        _quiz = State(initialValue: TeachingQuiz(card: card))
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: SisuTheme.Spacing.card) {
                    Text(card.title)
                        .font(SisuTheme.Font.h1)
                        .foregroundStyle(SisuTheme.Color.text)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    Text(card.explanation)
                        .font(SisuTheme.Font.bodyLarge)
                        .foregroundStyle(SisuTheme.Color.text)
                        .fixedSize(horizontal: false, vertical: true)

                    VStack(alignment: .leading, spacing: SisuTheme.Spacing.grid * 3) {
                        Eyebrow(text: quiz.isRevealed ? "Your guess" : "Make a guess")
                        Text(card.question)
                            .font(SisuTheme.Font.h3)
                            .foregroundStyle(SisuTheme.Color.text)
                            .fixedSize(horizontal: false, vertical: true)
                        ForEach(Array(quiz.choices.enumerated()), id: \.offset) { index, values in
                            RiveComponentView(.choiceCard, values: values) { trigger in
                                if trigger == "pressed" { choose(index) }
                            }
                            .riveAccessible(card.options[index], isButton: !quiz.isRevealed, value: choiceValue(index)) { choose(index) }
                            .accessibilityIdentifier("choice.\(index + 1)")
                        }
                    }
                    .padding(.top, SisuTheme.Spacing.grid * 2)

                    if let reveal = quiz.reveal {
                        SisuCard {
                            if let feedback = LessonPathPresenter.feedback(quiz) {
                                Text(feedback).font(SisuTheme.Font.h3).foregroundStyle(SisuTheme.Color.text)
                            }
                            Text(reveal)
                                .font(SisuTheme.Font.body)
                                .foregroundStyle(SisuTheme.Color.text)
                                .fixedSize(horizontal: false, vertical: true)
                            if let reward = LessonPathPresenter.rewardText(earned: earned) {
                                RiveComponentView(.statPill, values: RiveBindings.statPill(kind: .berries, value: reward))
                                    .sizing(.contain).frame(width: 120, height: 45)
                                    .riveAccessible("You earned \(reward)")
                            }
                        }
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                        .id("reveal")

                        SisuButton(label: "Done") { path.finished(card, justCompletedPath: finishedPath) }
                            .padding(.top, SisuTheme.Spacing.grid * 2)
                            .id("done")
                    }
                }
                .padding(.horizontal, SisuTheme.Spacing.margin)
                .padding(.top, SisuTheme.Spacing.section)
                .padding(.bottom, SisuTheme.Spacing.section)
            }
            .scrollIndicators(.hidden)
            .background(SisuTheme.Color.green25)
            .onChange(of: quiz.isRevealed) { _, revealed in
                guard revealed else { return }
                Task {
                    try? await Task.sleep(for: .milliseconds(250))
                    withAnimation(SisuMotion.state(reduceMotion: reduceMotion)) { proxy.scrollTo("done", anchor: .bottom) }
                }
            }
            .task {
                guard let autoAnswer else { return }
                try? await Task.sleep(for: .milliseconds(700))
                choose(autoAnswer - 1)
            }
        }
    }

    private func choose(_ index: Int) {
        guard !quiz.isRevealed, card.options.indices.contains(index) else { return }
        let wasAllDone = path.allDone
        withAnimation(SisuMotion.state(reduceMotion: reduceMotion)) {
            quiz.choose(index)
            earned = path.complete(card)
        }
        finishedPath = !wasAllDone && path.allDone
    }

    private func choiceValue(_ index: Int) -> String {
        switch quiz.state(of: index) {
        case .correct: return "Right answer"
        case .wrong: return "Your guess"
        default: return ""
        }
    }
}
