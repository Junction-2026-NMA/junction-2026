// Launch arguments of the voice lab and the teaching path (read here, not in the frozen LaunchOptions.swift).
//
//   -sisu.voicelab 1        the Path tab shows the voice lab instead of the path
//   -sisu.voicefixture 1    the talk button sends a bundled one-second clip instead of the microphone
//   -sisu.voiceauto 1       with the fixture: run one push-to-talk turn by itself once the lab is on screen
//   -sisu.lesson <n>        open lesson n (1 to 7) when the path has loaded
//   -sisu.lessonAnswer <n>  and answer it with option n (1 to 3)
//   -sisu.lessonsDone <n>   start with the first n lessons done (screenshots only)
import Foundation

struct VoiceLaunch {
    var voiceLab = false
    var voiceFixture = false
    var voiceAuto = false
    var lesson: Int?
    var lessonAnswer: Int?
    var lessonsDone: Int?

    static let current: VoiceLaunch = {
        let arguments = ProcessInfo.processInfo.arguments
        func value(_ name: String) -> String? {
            guard let index = arguments.firstIndex(of: "-\(name)"), index + 1 < arguments.count else { return nil }
            return arguments[index + 1]
        }
        var options = VoiceLaunch()
        options.voiceLab = value("sisu.voicelab") == "1"
        options.voiceFixture = value("sisu.voicefixture") == "1"
        options.voiceAuto = value("sisu.voiceauto") == "1"
        options.lesson = value("sisu.lesson").flatMap(Int.init)
        options.lessonAnswer = value("sisu.lessonAnswer").flatMap(Int.init)
        options.lessonsDone = value("sisu.lessonsDone").flatMap(Int.init)
        return options
    }()
}
