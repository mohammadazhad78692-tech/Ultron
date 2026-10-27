# ULTRON — Android (vivo T4x)

Glowing orb + voice assistant (Hindi / Hinglish / English) + hand gestures.

## Phone control (all local, by voice)
Call/SMS by contact name (asks "haan?" first), torch, volume, alarm/timer, open any installed app,
Home/Back/Recents/notifications/screenshot/lock, scroll, tap a label on screen, type text.
Enable once: Settings (gear) -> PHONE ACCESS -> ULTRON -> ON.
Android 13+ sideloaded apps: if the switch is greyed, go to Settings -> Apps -> ULTRON -> ⋮ -> "Allow restricted settings", then retry.

## Privacy
- Added permissions for control: contacts (read), call, SMS, alarm, plus the Accessibility service.
- The AI only receives the TEXT of what you say. It never receives screen content, contacts, SMS or files.

- Permissions: INTERNET, MICROPHONE, CAMERA. Nothing else (no contacts, SMS, files,
  location, accessibility, overlay, device-admin).
- No analytics, no creator server. The only network call is your text to
  api.anthropic.com with YOUR key.
- Hand tracking runs fully on-device; the camera feed never leaves the phone.
- Voice recognition/TTS use Android's own Google engines.
- `android:allowBackup=false` so the key isn't copied into cloud backups.

## Build without a laptop (GitHub Actions)
Push this folder to a GitHub repo -> Actions tab -> "Build APK" -> Run workflow -> download `ultron-apk` -> install the APK on the phone.

## Voice commands (local, no AI needed)
"WhatsApp kholo", "YouTube open karo", "google par cricket score search karo", "9876543210 dial karo" (opens dialer; you press call).

## Build
Needs Node 20+, Android Studio, USB debugging on the phone.

    bash scripts/setup-android.sh
    npm run android:open      # then press Run ▶ with phone connected

After changing code: `npm run android:sync`.

## Desktop test
    npm install && npm run dev      # http://localhost:3000 (Chrome: Space = talk)

## Rename the assistant
Settings (⚙) -> ASSISTANT NAME -> SAVE, or just say "ab se tumhara naam Jarvis hai".
This changes the on-screen title, the window title and how the AI introduces itself.
The home-screen icon label is set by Android at install time: rename it via your launcher
(long-press icon) or change `appName` in capacitor.config.ts and rebuild.

## Advanced features
- **Screen-off listening:** say "background mein suno" (or action listen_bg). Needs mic + notification permission. While locked it reacts only to sentences containing the assistant's name and runs torch / volume / timer only. Stop: "<naam> sunna band karo".
- **Notifications:** Settings -> NOTIFS -> allow ULTRON. "Notifications padho" reads aloud on-device; "notifications ka summary do" sends them to the AI with 4+ digit numbers hidden.
- **Camera look:** "camera kholke dekho, ye dikhao aur idea do" -> back camera for 4s, one photo goes to the AI.
- **DEEP button:** uses the stronger model (`deepModel` in settings) for brainstorming/scripts.
- **Scripts & video plans:** timed script, shot list, caption, hashtags. It cannot render a video file.
- **Social apps:** no logins/API. It shares text to the app (Instagram, WhatsApp...) and you press Post/Send; it can also tap/scroll inside apps via Accessibility.

## Important-message alerts
Settings -> set IMPORTANT SENDERS / WORDS -> IMPORTANT ALERTS ON (needs notification access).
For WhatsApp/Telegram/SMS/Instagram/Messenger/Snapchat messages from those senders (or containing those words)
the phone announces "<sender> ka important message aaya hai" by voice + a heads-up notification.
The message text is NOT spoken or sent anywhere. Matching is local. It follows your silent/DND settings.
On vivo: Settings -> Battery -> background power consumption / Autostart -> allow ULTRON, otherwise Android may stop the listener.
Group chats show the group name as sender, so add the group name to senders if you want those.
