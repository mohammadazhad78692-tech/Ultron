package app.ultron.orb;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.speech.tts.TextToSpeech;

import androidx.core.app.NotificationCompat;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * - Keeps the latest notifications in RAM only (never on disk).
 * - If "important alerts" are ON: when a message app gets a message from one of YOUR chosen
 *   senders, or containing one of YOUR chosen words, it announces the sender (not the message)
 *   by voice and with a heads-up notification. All matching is done on the phone, nothing is sent out.
 */
public class UltronNotificationListener extends NotificationListenerService implements TextToSpeech.OnInitListener {
    static final String DEFAULT_WORDS =
        "urgent,jaldi,zaroori,zaruri,emergency,asap,important,turant,call me,call kar,जरूरी,ज़रूरी,जल्दी,तुरंत,इमरजेंसी";
    static final List<String[]> recent = Collections.synchronizedList(new ArrayList<>());
    private static final Set<String> MESSAGING = new HashSet<>(Arrays.asList(
        "com.whatsapp", "com.whatsapp.w4b", "org.telegram.messenger", "com.google.android.apps.messaging",
        "com.android.mms", "com.instagram.android", "com.facebook.orca", "com.snapchat.android"));
    private static final String CHANNEL = "ultron_important";

    private TextToSpeech tts;
    private boolean ttsReady = false;
    private String lastKey = "";
    private long lastTime = 0;
    private int nid = 100;

    @Override public void onCreate() { super.onCreate(); tts = new TextToSpeech(this, this); }
    @Override public void onDestroy() { if (tts != null) tts.shutdown(); super.onDestroy(); }
    @Override public void onInit(int status) {
        if (status != TextToSpeech.SUCCESS) return;
        tts.setLanguage(new Locale("en", "IN"));
        tts.setAudioAttributes(new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
        ttsReady = true;
    }

    @Override public void onListenerConnected() {
        try { for (StatusBarNotification s : getActiveNotifications()) add(s); } catch (Exception ignored) { }
    }
    @Override public void onListenerDisconnected() { recent.clear(); }

    @Override public void onNotificationPosted(StatusBarNotification sbn) {
        String[] item = add(sbn);
        if (item != null) maybeAlert(item[0], sbn.getPackageName(), item[1], item[2]);
    }

    private String[] add(StatusBarNotification sbn) {
        if (sbn.getPackageName().equals(getPackageName())) return null;
        Notification n = sbn.getNotification();
        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return null;
        Bundle e = n.extras;
        CharSequence title = e.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence text = e.getCharSequence(Notification.EXTRA_TEXT);
        if (title == null && text == null) return null;
        String app = sbn.getPackageName();
        try {
            PackageManager pm = getPackageManager();
            app = pm.getApplicationLabel(pm.getApplicationInfo(app, 0)).toString();
        } catch (Exception ignored) { }
        String[] item = new String[]{app, String.valueOf(title == null ? "" : title),
                                     String.valueOf(text == null ? "" : text)};
        synchronized (recent) {
            recent.add(0, item);
            while (recent.size() > 30) recent.remove(recent.size() - 1);
        }
        return item;
    }

    private void maybeAlert(String app, String pkg, String title, String text) {
        SharedPreferences p = getSharedPreferences("ultron_native", MODE_PRIVATE);
        if (!p.getBoolean("alerts_on", false) || !MESSAGING.contains(pkg)) return;

        String t = title.toLowerCase(Locale.ROOT), x = text.toLowerCase(Locale.ROOT);
        boolean hit = false;
        for (String v : p.getString("vips", "").split(",")) {
            v = v.trim().toLowerCase(Locale.ROOT);
            if (!v.isEmpty() && t.contains(v)) { hit = true; break; }
        }
        if (!hit) {
            for (String k : p.getString("words", DEFAULT_WORDS).split(",")) {
                k = k.trim().toLowerCase(Locale.ROOT);
                if (!k.isEmpty() && x.contains(k)) { hit = true; break; }
            }
        }
        if (!hit) return;

        long now = System.currentTimeMillis();
        String key = title + "|" + text;
        if (key.equals(lastKey) && now - lastTime < 60000) return; // apps often re-post the same message
        lastKey = key; lastTime = now;

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Important messages",
                NotificationManager.IMPORTANCE_HIGH));
        }
        PendingIntent pi = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        try {
            nm.notify(nid++, new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("Important message: " + title)
                .setContentText(app)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build());
        } catch (SecurityException ignored) { }

        if (ttsReady) {
            tts.speak(title + " ka important message aaya hai, " + app + " par.",
                      TextToSpeech.QUEUE_ADD, null, "alert");
        }
    }
}
