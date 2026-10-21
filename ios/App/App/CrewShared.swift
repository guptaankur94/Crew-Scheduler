import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

/// Shared by the app and its widget extension (both targets compile this file).
enum CrewShared {
    /// The App Group both the app and the widget can read and write.
    static let appGroup = "group.com.crewcircadian.app"
    static let stepsKey = "nextSteps"
}

/// One step of the plan for the widget and Live Activity: wake-up, leave home, check-in, sleep… (home time).
struct CrewStep: Codable, Hashable {
    let atMs: Double
    let time: String
    let label: String
    let detail: String
    var date: Date { Date(timeIntervalSince1970: atMs / 1000) }
}

enum CrewStepStore {
    static func save(_ steps: [CrewStep]) {
        guard let defaults = UserDefaults(suiteName: CrewShared.appGroup), let data = try? JSONEncoder().encode(steps) else { return }
        defaults.set(data, forKey: CrewShared.stepsKey)
    }

    static func load() -> [CrewStep] {
        guard let data = UserDefaults(suiteName: CrewShared.appGroup)?.data(forKey: CrewShared.stepsKey) else { return [] }
        return (try? JSONDecoder().decode([CrewStep].self, from: data)) ?? []
    }
}

#if canImport(ActivityKit)
/// The duty-day Live Activity: the duty's steps and a countdown to the next one.
@available(iOS 16.1, *)
struct DutyActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var steps: [CrewStep]
        /// The step the countdown points at (e.g. "Check-in").
        var headline: String
        var targetMs: Double
    }

    /// The duty, e.g. "6E 810 DEL → BLR + 2".
    var title: String
}
#endif
