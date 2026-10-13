package com.crewcircadian.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The wake-up alarm for the web app: available, permission, schedule (replaces all), cancel. */
@CapacitorPlugin(name = "WakeAlarm")
public class WakeAlarmPlugin extends Plugin {
    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", true);
        r.put("allowed", WakeAlarmStore.canSchedule(getContext()));
        call.resolve(r);
    }

    /** Android 12+: exact alarms need the person's OK in Settings; this opens that page. */
    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (!WakeAlarmStore.canSchedule(getContext()) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        status(call);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        try {
            JSArray alarms = call.getArray("alarms", new JSArray());
            if (!WakeAlarmStore.canSchedule(getContext())) {
                call.reject("Exact alarms are not allowed for this app");
                return;
            }
            WakeAlarmStore.scheduleAll(getContext(), alarms);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not schedule alarms", e);
        }
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        try {
            WakeAlarmStore.cancelAll(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not cancel alarms", e);
        }
    }
}
