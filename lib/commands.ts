// Local voice commands. They run ON the phone, only when you ask, and only
// do what is listed here. Anything else goes to the AI as normal conversation.
import { Capacitor } from "@capacitor/core";
import { AppLauncher } from "@capacitor/app-launcher";
import { PhoneControl } from "./phone";

const APPS: Record<string, { pkg: string; name: string }> = {
  youtube: { pkg: "com.google.android.youtube", name: "YouTube" },
  whatsapp: { pkg: "com.whatsapp", name: "WhatsApp" },
  "वॉट्सऐप": { pkg: "com.whatsapp", name: "WhatsApp" },
  instagram: { pkg: "com.instagram.android", name: "Instagram" },
  chrome: { pkg: "com.android.chrome", name: "Chrome" },
  gmail: { pkg: "com.google.android.gm", name: "Gmail" },
  maps: { pkg: "com.google.android.apps.maps", name: "Maps" },
  spotify: { pkg: "com.spotify.music", name: "Spotify" },
  telegram: { pkg: "org.telegram.messenger", name: "Telegram" },
  settings: { pkg: "com.android.settings", name: "Settings" },
  "सेटिंग": { pkg: "com.android.settings", name: "Settings" },
  phonepe: { pkg: "com.phonepe.app", name: "PhonePe" },
  gpay: { pkg: "com.google.android.apps.nbu.paisa.user", name: "Google Pay" },
  "यूट्यूब": { pkg: "com.google.android.youtube", name: "YouTube" },
};

const OPEN_WORDS = /(kholo|khol do|khol|open|start|chalu|chalao|launch|खोलो|खोल|चालू|चलाओ)/i;

async function openUrl(url: string) {
  if (Capacitor.isNativePlatform()) await AppLauncher.openUrl({ url });
  else window.open(url, "_blank");
}

/** Returns the sentence to speak if a command was handled, otherwise null. */
export async function runCommand(raw: string): Promise<string | null> {
  const t = raw.toLowerCase().trim();

  // "WhatsApp kholo", "open YouTube"
  if (OPEN_WORDS.test(t)) {
    for (const key of Object.keys(APPS)) {
      if (t.includes(key)) {
        const app = APPS[key];
        try {
          if (!Capacitor.isNativePlatform()) return `${app.name} sirf Android app mein khulta hai.`;
          const r = await PhoneControl.openApp({ name: app.name });
          return r.ok ? `${app.name} khol raha hoon.` : `${app.name} is phone mein nahi mila.`;
        } catch {
          return `${app.name} is phone mein nahi mila.`;
        }
      }
    }
  }

  // "google par X search karo", "search cricket score", "X dhundo"
  const s = t.match(/(?:search|सर्च|dhundo|dhoondo|khojo|खोजो|ढूंढो)\s*(?:karo|करो)?\s*(.+)/i) ||
            t.match(/(.+?)\s+(?:search karo|search kar|सर्च करो|dhundo|ढूंढो)/i);
  if (s && s[1].trim().length > 1) {
    const q = s[1].replace(/^(google|गूगल)\s*(par|पर)?\s*/i, "").trim();
    await openUrl(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
    return `${q} search kar raha hoon.`;
  }

  // "98765 43210 dial karo" -> opens the dialer only. YOU press the call button.
  const digits = t.replace(/[\s-]/g, "").match(/\+?\d{6,13}/);
  if (digits && /(dial|call|कॉल|डायल|phone lagao)/i.test(t)) {
    await openUrl(`tel:${digits[0]}`);
    return `Dialer khol diya hai, call button aap dabaiye.`;
  }

  return null;
}
