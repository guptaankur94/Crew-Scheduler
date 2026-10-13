import Foundation
import Capacitor
import SwiftUI
#if canImport(AlarmKit)
import AlarmKit
#endif

/// The wake-up alarm for the web app. On iOS 26 and later it uses AlarmKit, so the alarm rings like the Clock app
/// (even in Silent mode and with a Focus on) and shows on the lock screen. Older iPhones report "not available"
/// and the app keeps using an ordinary notification.
@objc(WakeAlarmPlugin)
public class WakeAlarmPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WakeAlarmPlugin"
    public let jsName = "WakeAlarm"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "schedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelAll", returnType: CAPPluginReturnPromise),
    ]

    @objc func status(_ call: CAPPluginCall) {
        if #available(iOS 26.0, *) {
            call.resolve(["available": true, "allowed": CrewAlarms.isAuthorized])
        } else {
            call.resolve(["available": false, "allowed": false])
        }
    }

    @objc func requestPermission(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else { return call.resolve(["available": false, "allowed": false]) }
        Task {
            let allowed = await CrewAlarms.requestAuthorization()
            call.resolve(["available": true, "allowed": allowed])
        }
    }

    @objc func schedule(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else { return call.reject("Alarms need iOS 26 or later") }
        let alarms: [(id: Int, at: Date, title: String)] = (call.getArray("alarms") ?? []).compactMap { item in
            guard let a = item as? [String: Any], let id = a["id"] as? Int, let ms = a["atMs"] as? Double else { return nil }
            return (id, Date(timeIntervalSince1970: ms / 1000), (a["title"] as? String) ?? "Wake up")
        }
        Task {
            do {
                try await CrewAlarms.replaceAll(with: alarms)
                call.resolve()
            } catch {
                call.reject("Could not schedule alarms: \(error.localizedDescription)")
            }
        }
    }

    @objc func cancelAll(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else { return call.resolve() }
        CrewAlarms.cancelAll()
        call.resolve()
    }
}

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct CrewAlarmMetadata: AlarmMetadata {}

@available(iOS 26.0, *)
enum CrewAlarms {
    private static let savedKey = "crew_wake_alarm_ids"

    static var isAuthorized: Bool { AlarmManager.shared.authorizationState == .authorized }

    static func requestAuthorization() async -> Bool {
        if isAuthorized { return true }
        return (try? await AlarmManager.shared.requestAuthorization()) == .authorized
    }

    /// A stable alarm ID from the app's numeric reminder ID.
    static func uuid(_ id: Int) -> UUID {
        UUID(uuidString: String(format: "C0E0A1A2-0000-4000-8000-%012llx", UInt64(truncatingIfNeeded: id))) ?? UUID()
    }

    static func replaceAll(with alarms: [(id: Int, at: Date, title: String)]) async throws {
        cancelAll()
        var saved: [String] = []
        for a in alarms where a.at > Date() {
            let stop = AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.circle")
            let alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: a.title), stopButton: stop)
            let attributes = AlarmAttributes<CrewAlarmMetadata>(presentation: AlarmPresentation(alert: alert), tintColor: .blue)
            let id = uuid(a.id)
            let config = AlarmManager.AlarmConfiguration<CrewAlarmMetadata>(schedule: .fixed(a.at), attributes: attributes)
            _ = try await AlarmManager.shared.schedule(id: id, configuration: config)
            saved.append(id.uuidString)
        }
        UserDefaults.standard.set(saved, forKey: savedKey)
    }

    static func cancelAll() {
        for s in UserDefaults.standard.stringArray(forKey: savedKey) ?? [] {
            if let id = UUID(uuidString: s) { try? AlarmManager.shared.cancel(id: id) }
        }
        UserDefaults.standard.removeObject(forKey: savedKey)
    }
}
#endif
