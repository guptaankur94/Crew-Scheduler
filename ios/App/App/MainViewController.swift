import UIKit
import Capacitor

/// The app's web view, with the app's own native plugins registered.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WakeAlarmPlugin())
        bridge?.registerPluginInstance(NextStepWidgetPlugin())
    }

    #if DEBUG
    /// Development builds only: launched with -wakeAlarmSelfTest, set a test alarm 45 seconds ahead through the
    /// same JavaScript path the app uses, to check the alarm end to end in the simulator.
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if ProcessInfo.processInfo.arguments.contains("-liveActivitySelfTest") { return runLiveActivitySelfTest() }
        guard ProcessInfo.processInfo.arguments.contains("-wakeAlarmSelfTest") else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            let js = """
            (async () => {
              const W = Capacitor.Plugins.WakeAlarm;
              console.log('WAKEALARM status ' + JSON.stringify(await W.status()));
              console.log('WAKEALARM permission ' + JSON.stringify(await W.requestPermission()));
              try { await W.schedule({ alarms: [{ id: 4242, atMs: Date.now() + 45000, title: 'Wake up: check-in 06:15', body: '' }] }); console.log('WAKEALARM scheduled'); }
              catch (e) { console.log('WAKEALARM failed ' + e.message); }
            })()
            """
            self?.bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    /// Development builds only: launched with -liveActivitySelfTest, give the widget a few steps and start a duty
    /// Live Activity through the same JavaScript path the app uses.
    private func runLiveActivitySelfTest() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            let js = """
            (async () => {
              const W = Capacitor.Plugins.NextStepWidget, now = Date.now(), m = 60000;
              const t = (ms) => new Date(ms + 5.5 * 3600000).toISOString().slice(11, 16);
              const steps = [[20, 'Leave home'], [65, 'Check-in'], [125, 'Departs'], [420, 'Sign-off']].map(([o, l]) => ({ atMs: now + o * m, time: t(now + o * m), label: l, detail: 'Test' }));
              await W.setSteps({ steps });
              console.log('LIVEACTIVITY steps set');
              const r = await W.showDuty({ title: '6E 810 DEL → BLR + 2', steps, headline: 'Leave home', targetMs: steps[0].atMs, endMs: now + 420 * m });
              console.log('LIVEACTIVITY ' + JSON.stringify(r));
            })()
            """
            self?.bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }
    #endif
}
