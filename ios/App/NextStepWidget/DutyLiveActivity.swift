import ActivityKit
import WidgetKit
import SwiftUI

/// The duty-day Live Activity on the lock screen and in the Dynamic Island: a countdown to the next step
/// (wake-up, leave home, check-in, departure) and the duty's steps with their times.
struct DutyLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DutyActivityAttributes.self) { context in
            LockScreenDutyView(title: context.attributes.title, state: context.state)
                .activityBackgroundTint(CrewColors.background)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.state.headline, systemImage: "airplane").font(.caption.bold()).foregroundStyle(.white)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Countdown(targetMs: context.state.targetMs).font(.title3.monospacedDigit().bold()).foregroundStyle(CrewColors.accent)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    StepsRow(steps: context.state.steps)
                }
            } compactLeading: {
                Image(systemName: "airplane").foregroundStyle(CrewColors.accent)
            } compactTrailing: {
                Countdown(targetMs: context.state.targetMs).font(.caption.monospacedDigit()).frame(maxWidth: 52)
            } minimal: {
                Image(systemName: "airplane").foregroundStyle(CrewColors.accent)
            }
        }
    }
}

/// Counts down to the target; shows "now" once it has passed.
struct Countdown: View {
    let targetMs: Double
    var body: some View {
        let target = Date(timeIntervalSince1970: targetMs / 1000)
        if target > Date() {
            Text(timerInterval: Date()...target, countsDown: true)
        } else {
            Text("now")
        }
    }
}

struct StepsRow: View {
    let steps: [CrewStep]
    var body: some View {
        HStack(spacing: 10) {
            ForEach(steps.prefix(4), id: \.self) { step in
                VStack(spacing: 1) {
                    Text(step.time).font(.caption.monospaced().bold()).foregroundStyle(step.date < Date() ? CrewColors.muted : .white)
                    Text(step.label).font(.caption2).foregroundStyle(CrewColors.muted).lineLimit(1)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}

struct LockScreenDutyView: View {
    let title: String
    let state: DutyActivityAttributes.ContentState
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(title, systemImage: "airplane").font(.caption.bold()).foregroundStyle(CrewColors.muted).lineLimit(1)
                Spacer()
                Text("CrewCircadian").font(.caption2).foregroundStyle(CrewColors.muted)
            }
            HStack(alignment: .firstTextBaseline) {
                Text(state.headline).font(.headline).foregroundStyle(.white)
                Spacer()
                Countdown(targetMs: state.targetMs).font(.title2.monospacedDigit().bold()).foregroundStyle(CrewColors.accent)
            }
            StepsRow(steps: state.steps)
        }
        .padding(14)
    }
}
