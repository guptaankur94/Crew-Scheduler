package com.crewcircadian.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** The phone forgets alarms when it restarts; this puts the saved wake-up alarms back. */
public class WakeAlarmBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !"android.intent.action.MY_PACKAGE_REPLACED".equals(action)) return;
        try {
            WakeAlarmStore.scheduleAll(context, WakeAlarmStore.saved(context));
        } catch (Exception ignored) {
            // The app re-plans alarms the next time it opens
        }
    }
}
