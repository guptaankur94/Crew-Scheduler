import WidgetKit
import SwiftUI

/// Everything the CrewCircadian extension shows outside the app.
@main
struct CrewWidgets: WidgetBundle {
    var body: some Widget {
        NextStepWidget()
        DutyLiveActivity()
    }
}

/// The app's colours (dark, calm).
enum CrewColors {
    static let background = Color(red: 0.008, green: 0.024, blue: 0.09)
    static let accent = Color(red: 0.22, green: 0.62, blue: 0.96)
    static let muted = Color(white: 0.62)
}
