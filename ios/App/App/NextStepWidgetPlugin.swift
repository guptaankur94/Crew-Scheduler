import Foundation
import Capacitor
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif

/// The home-screen and lock-screen widget (setSteps, same as Android) and the duty-day Live Activity
/// (showDuty / endDuty). The steps are kept in the App Group, where the widget extension reads them.
@objc(NextStepWidgetPlugin)
public class NextStepWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NextStepWidgetPlugin"
    public let jsName = "NextStepWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSteps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showDuty", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endDuty", returnType: CAPPluginReturnPromise),
    ]

    private func steps(_ call: CAPPluginCall) -> [CrewStep] {
        (call.getArray("steps") ?? []).compactMap { item in
            guard let s = item as? [String: Any], let at = (s["atMs"] as? NSNumber)?.doubleValue else { return nil }
            return CrewStep(atMs: at, time: s["time"] as? String ?? "", label: s["label"] as? String ?? "", detail: s["detail"] as? String ?? "")
        }
    }

    @objc func setSteps(_ call: CAPPluginCall) {
        CrewStepStore.save(steps(call))
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    /// Starts the duty's Live Activity, or updates it if it is already showing.
    @objc func showDuty(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { return call.resolve(["shown": false]) }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return call.resolve(["shown": false]) }
        let title = call.getString("title") ?? "Duty"
        let state = DutyActivityAttributes.ContentState(
            steps: steps(call),
            headline: call.getString("headline") ?? "",
            targetMs: call.getDouble("targetMs") ?? 0
        )
        let staleDate = call.getDouble("endMs").map { Date(timeIntervalSince1970: $0 / 1000) }
        Task {
            let content = ActivityContent(state: state, staleDate: staleDate)
            let running = Activity<DutyActivityAttributes>.activities
            if let current = running.first(where: { $0.attributes.title == title }) {
                await current.update(content)
            } else {
                for old in running { await old.end(nil, dismissalPolicy: .immediate) }
                do {
                    _ = try Activity.request(attributes: DutyActivityAttributes(title: title), content: content, pushType: nil)
                } catch {
                    return call.resolve(["shown": false, "error": error.localizedDescription])
                }
            }
            call.resolve(["shown": true])
        }
        #else
        call.resolve(["shown": false])
        #endif
    }

    @objc func endDuty(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { return call.resolve() }
        Task {
            for activity in Activity<DutyActivityAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
            call.resolve()
        }
        #else
        call.resolve()
        #endif
    }
}
