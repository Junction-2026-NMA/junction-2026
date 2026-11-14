// Launch arguments of the coach screen, for the screenshot harness (LaunchOptions.swift is frozen, so they are
// read here). Each one drives the Ask screen once its session is ready.
//
//   -sisu.coachAsk "<question>"        ask this question
//   -sisu.coachInvestigate 1           start "Look into my finances"
//   -sisu.coachQuiz <index>            when the answer is done, pick this option of its quiz
//   -sisu.coachDecide approve|decline  when the answer is done, decide on its action
//   -sisu.coachScroll offers|quiz|action|impact|research|evidence|end   scroll the newest answer to that card
import Foundation

struct CoachLaunch {
    var ask: String?
    var investigate = false
    var quiz: Int?
    var decide: String?
    var scroll: String?

    var isEmpty: Bool { ask == nil && !investigate && quiz == nil && decide == nil && scroll == nil }

    static let current: CoachLaunch = {
        let arguments = ProcessInfo.processInfo.arguments
        func value(_ name: String) -> String? {
            guard let index = arguments.firstIndex(of: "-\(name)"), index + 1 < arguments.count else { return nil }
            return arguments[index + 1]
        }
        var launch = CoachLaunch()
        launch.ask = value("sisu.coachAsk")
        launch.investigate = value("sisu.coachInvestigate") == "1"
        launch.quiz = value("sisu.coachQuiz").flatMap(Int.init)
        launch.decide = value("sisu.coachDecide")
        launch.scroll = value("sisu.coachScroll")
        return launch
    }()
}
