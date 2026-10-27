package app.ultron.orb;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.hardware.camera2.CameraManager;
import android.media.AudioManager;
import android.net.Uri;
import android.provider.AlarmClock;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.telephony.SmsManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import androidx.core.content.ContextCompat;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "PhoneControl",
    permissions = {
        @Permission(strings = {Manifest.permission.READ_CONTACTS}, alias = "contacts"),
        @Permission(strings = {Manifest.permission.CALL_PHONE}, alias = "call"),
        @Permission(strings = {Manifest.permission.SEND_SMS}, alias = "sms"),
        @Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "mic"),
        @Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notify")
    }
)
public class PhoneControlPlugin extends Plugin {

    private void ok(PluginCall c, boolean v) { JSObject r = new JSObject(); r.put("ok", v); c.resolve(r); }
    private void start(Intent i) { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(i); }

    // ---- runtime permission prompts (shown inside the app, on first use) ----
    @PluginMethod public void ensure(PluginCall call) {
        String alias = call.getString("alias", "");
        if (getPermissionState(alias) == PermissionState.GRANTED) { ok(call, true); return; }
        requestPermissionForAlias(alias, call, "ensureCb");
    }
    @PermissionCallback private void ensureCb(PluginCall call) {
        ok(call, getPermissionState(call.getString("alias", "")) == PermissionState.GRANTED);
    }

    // ---- contacts / call / sms ----
    @PluginMethod public void findContact(PluginCall call) {
        String name = call.getString("name", "");
        JSObject r = new JSObject();
        r.put("found", false);
        try (Cursor c = getContext().getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[]{ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                             ContactsContract.CommonDataKinds.Phone.NUMBER},
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " LIKE ?",
                new String[]{"%" + name + "%"}, null)) {
            if (c != null && c.moveToFirst()) {
                r.put("found", true);
                r.put("name", c.getString(0));
                r.put("number", c.getString(1));
            }
        } catch (SecurityException e) { /* permission missing */ }
        call.resolve(r);
    }

    @PluginMethod public void call(PluginCall call) {
        try {
            start(new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + Uri.encode(call.getString("number", "")))));
            ok(call, true);
        } catch (Exception e) { ok(call, false); }
    }

    @PluginMethod public void sendSms(PluginCall call) {
        try {
            SmsManager sm = getContext().getSystemService(SmsManager.class);
            ArrayList<String> parts = sm.divideMessage(call.getString("text", ""));
            sm.sendMultipartTextMessage(call.getString("number", ""), null, parts, null, null);
            ok(call, true);
        } catch (Exception e) { ok(call, false); }
    }

    // ---- device ----
    @PluginMethod public void torch(PluginCall call) {
        try {
            CameraManager cm = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            cm.setTorchMode(cm.getCameraIdList()[0], call.getBoolean("on", true));
            ok(call, true);
        } catch (Exception e) { ok(call, false); }
    }

    @PluginMethod public void volume(PluginCall call) {
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        String d = call.getString("dir", "up");
        int s = AudioManager.STREAM_MUSIC;
        switch (d) {
            case "up": am.adjustStreamVolume(s, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI); break;
            case "down": am.adjustStreamVolume(s, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI); break;
            case "mute": am.setStreamVolume(s, 0, AudioManager.FLAG_SHOW_UI); break;
            case "max": am.setStreamVolume(s, am.getStreamMaxVolume(s), AudioManager.FLAG_SHOW_UI); break;
        }
        ok(call, true);
    }

    @PluginMethod public void alarm(PluginCall call) {
        try {
            Intent i = new Intent(AlarmClock.ACTION_SET_ALARM)
                .putExtra(AlarmClock.EXTRA_HOUR, call.getInt("hour", 7))
                .putExtra(AlarmClock.EXTRA_MINUTES, call.getInt("minute", 0))
                .putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("label", "ULTRON"))
                .putExtra(AlarmClock.EXTRA_SKIP_UI, true);
            start(i); ok(call, true);
        } catch (Exception e) { ok(call, false); }
    }

    @PluginMethod public void timer(PluginCall call) {
        try {
            Intent i = new Intent(AlarmClock.ACTION_SET_TIMER)
                .putExtra(AlarmClock.EXTRA_LENGTH, call.getInt("seconds", 60))
                .putExtra(AlarmClock.EXTRA_SKIP_UI, true);
            start(i); ok(call, true);
        } catch (Exception e) { ok(call, false); }
    }

    @PluginMethod public void openApp(PluginCall call) {
        String q = call.getString("name", "").toLowerCase().trim();
        PackageManager pm = getContext().getPackageManager();
        Intent main = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> list = pm.queryIntentActivities(main, 0);
        ResolveInfo best = null;
        for (ResolveInfo ri : list) {
            String label = ri.loadLabel(pm).toString().toLowerCase();
            if (label.equals(q)) { best = ri; break; }
            if (best == null && label.length() >= 3 && q.length() >= 3 && (label.contains(q) || q.contains(label))) best = ri;
        }
        if (best == null) { ok(call, false); return; }
        Intent li = pm.getLaunchIntentForPackage(best.activityInfo.packageName);
        if (li == null) { ok(call, false); return; }
        start(li); ok(call, true);
    }

    /** Opens a system panel; Android does not let apps flip Wi-Fi/Bluetooth silently. */
    @PluginMethod public void panel(PluginCall call) {
        String t = call.getString("type", "wifi");
        String action = "volume".equals(t) ? Settings.Panel.ACTION_VOLUME
                      : "bluetooth".equals(t) ? Settings.ACTION_BLUETOOTH_SETTINGS
                      : Settings.Panel.ACTION_INTERNET_CONNECTIVITY;
        start(new Intent(action)); ok(call, true);
    }

    // ---- background listening (screen off) ----
    @PluginMethod public void startListening(PluginCall call) {
        try {
            Intent i = new Intent(getContext(), ListenService.class);
            i.putExtra("name", call.getString("name", "ultron"));
            ContextCompat.startForegroundService(getContext(), i);
            ok(call, true);
        } catch (Exception e) { ok(call, false); }
    }
    @PluginMethod public void stopListening(PluginCall call) {
        getContext().stopService(new Intent(getContext(), ListenService.class));
        ok(call, true);
    }
    @PluginMethod public void listening(PluginCall call) { ok(call, ListenService.running); }

    // ---- notifications (read only when you ask) ----
    @PluginMethod public void notifAccessEnabled(PluginCall call) {
        String flat = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        ok(call, flat != null && flat.contains(getContext().getPackageName()));
    }
    @PluginMethod public void openNotifAccessSettings(PluginCall call) {
        start(new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")); ok(call, true);
    }
    @PluginMethod public void getNotifications(PluginCall call) {
        JSArray arr = new JSArray();
        synchronized (UltronNotificationListener.recent) {
            int n = Math.min(10, UltronNotificationListener.recent.size());
            for (int i = 0; i < n; i++) {
                String[] x = UltronNotificationListener.recent.get(i);
                JSObject o = new JSObject();
                o.put("app", x[0]); o.put("title", x[1]); o.put("text", x[2]);
                arr.put(o);
            }
        }
        JSObject r = new JSObject(); r.put("items", arr); call.resolve(r);
    }

    // ---- important-message alerts (rules are stored on the phone only) ----
    @PluginMethod public void setAlerts(PluginCall call) {
        SharedPreferences.Editor e = getContext().getSharedPreferences("ultron_native", Context.MODE_PRIVATE).edit();
        if (call.hasOption("on")) e.putBoolean("alerts_on", call.getBoolean("on", false));
        if (call.hasOption("vips")) e.putString("vips", call.getString("vips", ""));
        if (call.hasOption("words")) e.putString("words", call.getString("words", ""));
        e.apply(); ok(call, true);
    }
    @PluginMethod public void getAlerts(PluginCall call) {
        SharedPreferences p = getContext().getSharedPreferences("ultron_native", Context.MODE_PRIVATE);
        JSObject r = new JSObject();
        r.put("on", p.getBoolean("alerts_on", false));
        r.put("vips", p.getString("vips", ""));
        r.put("words", p.getString("words", UltronNotificationListener.DEFAULT_WORDS));
        call.resolve(r);
    }

    // ---- share text to an app (YOU press the final Post/Send) ----
    @PluginMethod public void share(PluginCall call) {
        String text = call.getString("text", "");
        String app = call.getString("app", "").toLowerCase().trim();
        Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
        String pkg = null;
        if (!app.isEmpty()) {
            PackageManager pm = getContext().getPackageManager();
            for (ResolveInfo ri : pm.queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)) {
                String label = ri.loadLabel(pm).toString().toLowerCase();
                if (label.equals(app) || (label.length() >= 3 && label.contains(app))) { pkg = ri.activityInfo.packageName; break; }
            }
        }
        if (pkg != null) { i.setPackage(pkg); start(i); }
        else start(Intent.createChooser(i, "Share"));
        ok(call, true);
    }

    // ---- accessibility-based control ----
    @PluginMethod public void a11yEnabled(PluginCall call) { ok(call, UltronAccessibilityService.instance != null); }
    @PluginMethod public void openAccessibilitySettings(PluginCall call) {
        start(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)); ok(call, true);
    }
    @PluginMethod public void nav(PluginCall call) {
        UltronAccessibilityService s = UltronAccessibilityService.instance;
        ok(call, s != null && s.global(call.getString("to", "")));
    }
    @PluginMethod public void tap(PluginCall call) {
        UltronAccessibilityService s = UltronAccessibilityService.instance;
        ok(call, s != null && s.clickText(call.getString("text", "")));
    }
    @PluginMethod public void scroll(PluginCall call) {
        UltronAccessibilityService s = UltronAccessibilityService.instance;
        ok(call, s != null && s.scroll(call.getString("dir", "down")));
    }
    @PluginMethod public void type(PluginCall call) {
        UltronAccessibilityService s = UltronAccessibilityService.instance;
        ok(call, s != null && s.typeText(call.getString("text", "")));
    }
}
