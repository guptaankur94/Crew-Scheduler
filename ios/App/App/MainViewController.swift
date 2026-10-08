import UIKit
import Capacitor

/// The app's web view, with the app's own native plugins registered.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WakeAlarmPlugin())
    }

    #if DEBUG
    /// Development builds only: launched with -wakeAlarmSelfTest, set a test alarm 45 seconds ahead through the
    /// same JavaScript path the app uses, to check the alarm end to end in the simulator.
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
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
    #endif
}
