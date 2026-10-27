package app.ultron.orb;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.graphics.Path;
import android.os.Build;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.List;

/**
 * Does NOTHING on its own. It never reads or stores screen content from events
 * (onAccessibilityEvent is empty). It only acts when the app calls the methods
 * below in response to YOUR voice command.
 */
public class UltronAccessibilityService extends AccessibilityService {
    public static volatile UltronAccessibilityService instance;

    @Override protected void onServiceConnected() { instance = this; }
    @Override public boolean onUnbind(Intent intent) { instance = null; return super.onUnbind(intent); }
    @Override public void onDestroy() { instance = null; super.onDestroy(); }
    @Override public void onAccessibilityEvent(AccessibilityEvent event) { /* intentionally empty */ }
    @Override public void onInterrupt() { }

    public boolean global(String a) {
        switch (a) {
            case "home": return performGlobalAction(GLOBAL_ACTION_HOME);
            case "back": return performGlobalAction(GLOBAL_ACTION_BACK);
            case "recents": return performGlobalAction(GLOBAL_ACTION_RECENTS);
            case "notifications": return performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS);
            case "quick_settings": return performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS);
            case "power_menu": return performGlobalAction(GLOBAL_ACTION_POWER_DIALOG);
            case "lock":
                return Build.VERSION.SDK_INT >= 28 && performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN);
            case "screenshot":
                return Build.VERSION.SDK_INT >= 28 && performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT);
            default: return false;
        }
    }

    public boolean clickText(String text) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;
        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(text);
        for (AccessibilityNodeInfo n : nodes) {
            AccessibilityNodeInfo x = n;
            while (x != null && !x.isClickable()) x = x.getParent();
            if (x != null && x.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true;
        }
        return false;
    }

    /** dir = direction the CONTENT should move, as a person would say it ("down" = see lower content). */
    public boolean scroll(String dir) {
        DisplayMetrics dm = getResources().getDisplayMetrics();
        float w = dm.widthPixels, h = dm.heightPixels;
        Path p = new Path();
        switch (dir) {
            case "down": p.moveTo(w / 2, h * 0.7f); p.lineTo(w / 2, h * 0.3f); break;
            case "up": p.moveTo(w / 2, h * 0.3f); p.lineTo(w / 2, h * 0.7f); break;
            case "left": p.moveTo(w * 0.3f, h / 2); p.lineTo(w * 0.7f, h / 2); break;
            case "right": p.moveTo(w * 0.7f, h / 2); p.lineTo(w * 0.3f, h / 2); break;
            default: return false;
        }
        GestureDescription g = new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(p, 0, 300)).build();
        return dispatchGesture(g, null, null);
    }

    public boolean typeText(String text) {
        AccessibilityNodeInfo f = findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
        if (f == null) return false;
        Bundle b = new Bundle();
        b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
        return f.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, b);
    }
}
