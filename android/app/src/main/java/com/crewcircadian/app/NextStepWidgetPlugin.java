package com.crewcircadian.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the web app give the home-screen widget its next steps. */
@CapacitorPlugin(name = "NextStepWidget")
public class NextStepWidgetPlugin extends Plugin {
    @PluginMethod
    public void setSteps(PluginCall call) {
        JSArray steps = call.getArray("steps", new JSArray());
        getContext().getSharedPreferences(NextStepWidget.PREFS, android.content.Context.MODE_PRIVATE).edit().putString(NextStepWidget.KEY, steps.toString()).apply();
        NextStepWidget.refresh(getContext());
        call.resolve();
    }
}
