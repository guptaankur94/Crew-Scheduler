package com.crewcircadian.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own native plugin: the wake-up alarm
        registerPlugin(WakeAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
