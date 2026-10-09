package com.crewcircadian.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Home-screen widget: the next step from the plan ("Wake up 04:15", "Leave home 05:15", "Sleep 21:45"). The app
 * stores its next steps with their times; the widget shows the first that has not passed, so it stays right
 * while the app is closed (Android refreshes it about every 30 minutes, and the app refreshes it on every change).
 */
public class NextStepWidget extends AppWidgetProvider {
    static final String PREFS = "crew_widget";
    static final String KEY = "steps";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
    }

    static void refresh(Context context) {
        AppWidgetManager m = AppWidgetManager.getInstance(context);
        int[] ids = m.getAppWidgetIds(new ComponentName(context, NextStepWidget.class));
        for (int id : ids) m.updateAppWidget(id, views(context));
    }

    private static RemoteViews views(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_next_step);
        String label = "Open CrewCircadian";
        String time = "";
        String detail = "No upcoming steps";
        try {
            JSONArray steps = new JSONArray(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]"));
            long now = System.currentTimeMillis();
            for (int i = 0; i < steps.length(); i++) {
                JSONObject s = steps.getJSONObject(i);
                if (s.getLong("atMs") > now) {
                    label = s.optString("label", label);
                    time = s.optString("time", "");
                    detail = s.optString("detail", "");
                    break;
                }
            }
        } catch (Exception ignored) {
        }
        v.setTextViewText(R.id.widget_label, label);
        v.setTextViewText(R.id.widget_time, time);
        v.setTextViewText(R.id.widget_detail, detail);
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }
}
