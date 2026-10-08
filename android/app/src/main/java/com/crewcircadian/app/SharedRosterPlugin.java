package com.crewcircadian.app;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;

/**
 * "Share → CrewCircadian": roster screenshots or PDFs shared from another app arrive here. The web app asks for
 * them (getPending) when it starts or resumes, and is also told straight away while it is open ("shared").
 */
@CapacitorPlugin(name = "SharedRoster")
public class SharedRosterPlugin extends Plugin {
    private static final int MAX_BYTES = 20 * 1024 * 1024;
    private JSArray pending = new JSArray();

    @Override
    public void load() {
        take(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        take(intent);
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSObject r = new JSObject();
        r.put("files", pending);
        pending = new JSArray();
        call.resolve(r);
    }

    private void take(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        ArrayList<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) uris.add(u);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) uris.addAll(list);
        } else {
            return;
        }
        JSArray files = new JSArray();
        for (Uri u : uris) {
            JSObject f = read(u);
            if (f != null) files.put(f);
        }
        // Handled once: a later resume must not bring the same files back
        intent.setAction(Intent.ACTION_MAIN);
        if (files.length() == 0) return;
        for (int i = 0; i < files.length(); i++) pending.put(files.opt(i));
        JSObject event = new JSObject();
        event.put("files", files);
        notifyListeners("shared", event, true);
    }

    private JSObject read(Uri uri) {
        try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                if (out.size() > MAX_BYTES) return null;
            }
            JSObject f = new JSObject();
            f.put("name", nameOf(uri));
            f.put("type", getContext().getContentResolver().getType(uri));
            f.put("data", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
            return f;
        } catch (Exception e) {
            return null;
        }
    }

    private String nameOf(Uri uri) {
        try (Cursor c = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {
        }
        return "Shared roster";
    }
}
