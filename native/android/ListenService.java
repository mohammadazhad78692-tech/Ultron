package app.ultron.orb;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.hardware.camera2.CameraManager;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;

import androidx.core.app.NotificationCompat;

import java.util.ArrayList;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Screen-off listening. Reacts ONLY to sentences containing the assistant's name,
 * and (while the phone is locked) only runs harmless commands: torch, volume, timer.
 * Nothing is stored or sent anywhere by this service.
 */
public class ListenService extends Service implements RecognitionListener, TextToSpeech.OnInitListener {
    static volatile boolean running = false;
    private static final String CHANNEL = "ultron_listen";

    private SpeechRecognizer rec;
    private Intent recIntent;
    private final Handler h = new Handler(Looper.getMainLooper());
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean stopped = false;
    private String wake = "ultron";
    private PowerManager.WakeLock wl;

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences prefs = getSharedPreferences("ultron_native", MODE_PRIVATE);
        if (intent != null && intent.getStringExtra("name") != null) {
            prefs.edit().putString("wake", intent.getStringExtra("name")).apply();
        }
        wake = norm(prefs.getString("wake", "ultron"));

        startForeground(1, buildNotification(),
            Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE : 0);
        if (running) return START_STICKY;
        running = true;
        stopped = false;

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ultron:listen");
        wl.acquire(8 * 60 * 60 * 1000L);

        tts = new TextToSpeech(this, this);
        if (SpeechRecognizer.isRecognitionAvailable(this)) {
            rec = SpeechRecognizer.createSpeechRecognizer(this);
            rec.setRecognitionListener(this);
            recIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "hi-IN")
                .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
            listen();
        } else {
            stopSelf();
        }
        return START_STICKY;
    }

    private Notification buildNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Background listening",
                NotificationManager.IMPORTANCE_LOW));
        }
        PendingIntent pi = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL)
            .setContentTitle("Naam bolkar command do")
            .setContentText("Mic chalu hai. Band karne ke liye app kholo.")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(pi)
            .setOngoing(true)
            .build();
    }

    private void listen() {
        if (stopped || rec == null) return;
        try { rec.startListening(recIntent); } catch (Exception e) { h.postDelayed(this::listen, 1500); }
    }

    // ---------- commands ----------
    private static String norm(String s) { return s.toLowerCase(Locale.ROOT).replaceAll("[\\s.\\-]", ""); }

    private void handle(String text) {
        String t = text.toLowerCase(Locale.ROOT);
        if (!norm(t).contains(wake)) return;

        if (has(t, "sunna band", "listening band", "stop listening", "सुनना बंद", "सुनना बन्द")) {
            say("Theek hai, sunna band kar rahi hoon.");
            stopSelf();
            return;
        }
        if (has(t, "torch", "flash", "टॉर्च", "टोर्च")) {
            boolean off = has(t, "band", "off", "बंद", "बन्द", "bujha", "बुझा");
            try {
                CameraManager cm = (CameraManager) getSystemService(Context.CAMERA_SERVICE);
                cm.setTorchMode(cm.getCameraIdList()[0], !off);
                say(off ? "Torch band." : "Torch chalu.");
            } catch (Exception e) { say("Torch nahi chal paayi."); }
            return;
        }
        if (has(t, "awaaz", "awaz", "volume", "आवाज", "वॉल्यूम", "वॉल्युम")) {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            int s = AudioManager.STREAM_MUSIC;
            if (has(t, "mute", "chup", "म्यूट")) am.setStreamVolume(s, 0, AudioManager.FLAG_SHOW_UI);
            else if (has(t, "full", "max", "फुल")) am.setStreamVolume(s, am.getStreamMaxVolume(s), AudioManager.FLAG_SHOW_UI);
            else if (has(t, "kam", "ghata", "down", "कम", "घटा")) am.adjustStreamVolume(s, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI);
            else am.adjustStreamVolume(s, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI);
            say("Ho gaya.");
            return;
        }
        if (has(t, "timer", "टाइमर")) {
            Matcher m = Pattern.compile("(\\d+)").matcher(t);
            if (m.find()) {
                long n = Long.parseLong(m.group(1));
                boolean sec = has(t, "second", "sec", "सेकंड", "सेकण्ड");
                long ms = n * (sec ? 1000L : 60000L);
                h.postDelayed(() -> say("Aapka timer khatam ho gaya."), ms);
                say("Timer " + n + (sec ? " second" : " minute") + " ka laga diya.");
            } else say("Kitne minute ka timer?");
            return;
        }
        say("Phone lock hone par main sirf torch, awaaz aur timer kar sakti hoon.");
    }

    private static boolean has(String t, String... keys) {
        for (String k : keys) if (t.contains(k)) return true;
        return false;
    }

    private void say(String msg) {
        if (ttsReady) tts.speak(msg, TextToSpeech.QUEUE_FLUSH, null, "u");
    }

    @Override public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) { tts.setLanguage(new Locale("en", "IN")); ttsReady = true; }
    }

    // ---------- RecognitionListener ----------
    @Override public void onResults(Bundle b) {
        ArrayList<String> m = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (m != null) for (String c : m) { if (norm(c).contains(wake)) { handle(c); break; } }
        h.postDelayed(this::listen, 300);
    }
    @Override public void onError(int error) {
        if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) { stopSelf(); return; }
        if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY && rec != null) rec.cancel();
        h.postDelayed(this::listen, error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY ? 1500 : 500);
    }
    @Override public void onReadyForSpeech(Bundle p) { }
    @Override public void onBeginningOfSpeech() { }
    @Override public void onRmsChanged(float v) { }
    @Override public void onBufferReceived(byte[] b) { }
    @Override public void onEndOfSpeech() { }
    @Override public void onPartialResults(Bundle b) { }
    @Override public void onEvent(int t, Bundle b) { }

    @Override public void onDestroy() {
        stopped = true;
        running = false;
        h.removeCallbacksAndMessages(null);
        if (rec != null) { rec.destroy(); rec = null; }
        if (tts != null) { tts.shutdown(); tts = null; }
        if (wl != null && wl.isHeld()) wl.release();
        super.onDestroy();
    }
}
