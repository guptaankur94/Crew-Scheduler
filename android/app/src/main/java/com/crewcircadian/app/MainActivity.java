package com.crewcircadian.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own native plugins: the wake-up alarm, and rosters shared from other apps
        registerPlugin(WakeAlarmPlugin.class);
        registerPlugin(SharedRosterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
