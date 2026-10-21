import WidgetKit
import SwiftUI

/// Home-screen and lock-screen widget: the next step of the plan (wake-up, leave home, check-in, sleep…).
/// The app gives it the coming steps; the widget moves to the next one by itself when a step's time passes.
struct StepEntry: TimelineEntry {
    let date: Date
    let upcoming: [CrewStep]
}

struct StepProvider: TimelineProvider {
    static let sample = [
        CrewStep(atMs: Date().addingTimeInterval(3600).timeIntervalSince1970 * 1000, time: "04:30", label: "Leave home", detail: "Check-in 05:30"),
        CrewStep(atMs: Date().addingTimeInterval(7200).timeIntervalSince1970 * 1000, time: "05:30", label: "Check-in", detail: "Departs 06:30"),
    ]

    func placeholder(in context: Context) -> StepEntry { StepEntry(date: Date(), upcoming: Self.sample) }

    func getSnapshot(in context: Context, completion: @escaping (StepEntry) -> Void) {
        let steps = CrewStepStore.load()
        completion(entry(at: Date(), steps: context.isPreview && steps.isEmpty ? Self.sample : steps))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StepEntry>) -> Void) {
        let now = Date()
        let steps = CrewStepStore.load()
        // One entry now and one as each coming step passes, so "next" stays right while the app is closed
        let moments = [now] + steps.map(\.date).filter { $0 > now }.prefix(12)
        completion(Timeline(entries: moments.map { entry(at: $0, steps: steps) }, policy: .atEnd))
    }

    private func entry(at date: Date, steps: [CrewStep]) -> StepEntry {
        StepEntry(date: date, upcoming: steps.filter { $0.date > date })
    }
}

struct NextStepWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: StepEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            if let next = entry.upcoming.first { Text("\(next.label) \(next.time)") } else { Text("CrewCircadian") }
        case .accessoryRectangular:
            rectangular
        case .systemMedium:
            medium
        default:
            small
        }
    }

    private var empty: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("CrewCircadian").font(.caption.bold()).foregroundStyle(CrewColors.accent)
            Text("Open the app to see your next step").font(.caption).foregroundStyle(CrewColors.muted)
        }
    }

    private var small: some View {
        Group {
            if let next = entry.upcoming.first {
                VStack(alignment: .leading, spacing: 2) {
                    Text("NEXT").font(.caption2.bold()).foregroundStyle(CrewColors.muted)
                    Text(next.time).font(.system(size: 34, weight: .heavy, design: .monospaced)).foregroundStyle(.white)
                    Text(next.label).font(.headline).foregroundStyle(.white).lineLimit(1)
                    Text(next.detail).font(.caption2).foregroundStyle(CrewColors.muted).lineLimit(2)
                    Spacer(minLength: 0)
                    Text(next.date, style: .relative).font(.caption2).foregroundStyle(CrewColors.accent)
                }
            } else { empty }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var medium: some View {
        HStack(alignment: .top, spacing: 14) {
            small
            if entry.upcoming.count > 1 {
                VStack(alignment: .leading, spacing: 8) {
                    Text("THEN").font(.caption2.bold()).foregroundStyle(CrewColors.muted)
                    ForEach(entry.upcoming.dropFirst().prefix(3), id: \.self) { step in
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text(step.time).font(.caption.monospaced().bold()).foregroundStyle(.white)
                            Text(step.label).font(.caption).foregroundStyle(.white).lineLimit(1)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            if let next = entry.upcoming.first {
                Text("\(next.label) \(next.time)").font(.headline).lineLimit(1)
                Text(next.detail).font(.caption).lineLimit(1)
                Text(next.date, style: .relative).font(.caption2)
            } else {
                Text("CrewCircadian").font(.headline)
                Text("No steps planned").font(.caption)
            }
        }
    }
}

struct NextStepWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NextStepWidget", provider: StepProvider()) { entry in
            NextStepWidgetView(entry: entry)
                .containerBackground(for: .widget) { CrewColors.background }
        }
        .configurationDisplayName("Next step")
        .description("Your next wake-up, leave-home, check-in or sleep, from your roster.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}
