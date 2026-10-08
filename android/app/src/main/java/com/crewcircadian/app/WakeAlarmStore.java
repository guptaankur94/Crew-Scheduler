package com.crewcircadian.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Wake-up alarms: scheduled with AlarmManager.setAlarmClock (exact, allowed in Doze, shown as the next alarm)
 * and remembered so they can be put back after the phone restarts.
 */
final class WakeAlarmStore {
    private static final String PREFS = "crew_wake_alarms";
    private static final String KEY = "alarms";

    static void scheduleAll(Context context, JSONArray alarms) throws Exception {
        cancelAll(context);
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        long now = System.currentTimeMillis();
        JSONArray kept = new JSONArray();
        for (int i = 0; i < alarms.length(); i++) {
            JSONObject a = alarms.getJSONObject(i);
            long at = a.getLong("atMs");
            if (at <= now) continue;
            PendingIntent fire = fireIntent(context, a);
            Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            PendingIntent show = PendingIntent.getActivity(context, a.getInt("id"), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), fire);
            kept.put(a);
        }
        prefs(context).edit().putString(KEY, kept.toString()).apply();
    }

    static void cancelAll(Context context) throws Exception {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        JSONArray old = saved(context);
        for (int i = 0; i < old.length(); i++) am.cancel(fireIntent(context, old.getJSONObject(i)));
        prefs(context).edit().remove(KEY).apply();
    }

    static JSONArray saved(Context context) {
        try {
            return new JSONArray(prefs(context).getString(KEY, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    static boolean canSchedule(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).canScheduleExactAlarms();
    }

    private static PendingIntent fireIntent(Context context, JSONObject a) throws Exception {
        Intent intent = new Intent(context, WakeAlarmReceiver.class);
        intent.putExtra("id", a.getInt("id"));
        intent.putExtra("title", a.optString("title", "Wake up"));
        intent.putExtra("body", a.optString("body", ""));
        return PendingIntent.getBroadcast(context, a.getInt("id"), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
