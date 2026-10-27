"""Installs native control code + locks the manifest to exactly the permissions we use."""
import os, re, shutil

ROOT = "android/app/src/main"
PKG_DIR = f"{ROOT}/java/app/ultron/orb"
os.makedirs(PKG_DIR, exist_ok=True)
os.makedirs(f"{ROOT}/res/xml", exist_ok=True)
os.makedirs(f"{ROOT}/res/values", exist_ok=True)
for f in ["MainActivity.java", "PhoneControlPlugin.java", "UltronAccessibilityService.java", "ListenService.java", "UltronNotificationListener.java"]:
    shutil.copy(f"native/android/{f}", f"{PKG_DIR}/{f}")
shutil.copy("native/android/accessibility_service_config.xml", f"{ROOT}/res/xml/accessibility_service_config.xml")
shutil.copy("native/android/ultron_strings.xml", f"{ROOT}/res/values/ultron_strings.xml")

p = f"{ROOT}/AndroidManifest.xml"
s = open(p).read()
s = re.sub(r'\s*<uses-permission[^>]*/>', '', s)
perms = '''
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.READ_CONTACTS" />
    <uses-permission android:name="android.permission.CALL_PHONE" />
    <uses-permission android:name="android.permission.SEND_SMS" />
    <uses-permission android:name="com.android.alarm.permission.SET_ALARM" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.telephony" android:required="false" />
    <queries>
        <intent><action android:name="android.speech.RecognitionService" /></intent>
        <intent><action android:name="android.intent.action.TTS_SERVICE" /></intent>
        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent>
    </queries>
'''
s = s.replace('<application', perms + '\n    <application', 1)
# Capacitor's template already sets allowBackup; remove it first or the manifest has a duplicate attribute
s = re.sub(r'\s*android:allowBackup="[^"]*"', '', s)
s = re.sub(r'\s*android:usesCleartextTraffic="[^"]*"', '', s)
s = s.replace('<application', '<application android:allowBackup="false" android:usesCleartextTraffic="false"', 1)
service = '''
        <service
            android:name=".UltronAccessibilityService"
            android:exported="false"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data android:name="android.accessibilityservice"
                       android:resource="@xml/accessibility_service_config" />
        </service>
        <service android:name=".ListenService" android:exported="false"
                 android:foregroundServiceType="microphone" />
        <service
            android:name=".UltronNotificationListener"
            android:exported="false"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
    '''
s = s.replace('</application>', service + '</application>', 1)
open(p, 'w').write(s)
print("native code installed, manifest patched")
