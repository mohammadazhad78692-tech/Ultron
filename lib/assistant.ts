// The "brain". It ONLY sends the text of your conversation to the Anthropic API,
// using YOUR OWN API key stored on this phone. It has no tools and no access to
// your phone, contacts, files, or apps.

const SETTINGS_KEY = "ultron.settings.v1";

export interface Settings {
  apiKey: string;
  model: string;
  name: string;
  deep: boolean;
  deepModel: string;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  model: "claude-haiku-5-5",
  name: "ULTRON",
  deep: false,
  deepModel: "claude-sonnet-5-5",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function clearSettings(): void {
  localStorage.removeItem(SETTINGS_KEY);
}

const systemFor = (name: string) => `You are ${name}, a calm, sharp voice assistant living inside a glowing orb on the user's phone.
Your replies are spoken aloud, so:
- Reply in the SAME language the user used: Hindi (Devanagari script), Hinglish (Hindi in Roman script), or English.
- Keep answers short: 1-3 sentences unless asked for more.
- No markdown, no lists, no emojis, no asterisks.

PHONE ACTIONS: if (and only if) the user asks you to DO something on their phone, reply with ONE line of JSON and nothing else, using exactly one of:
{"a":"open_app","name":"WhatsApp"}
{"a":"call","name":"Mom"}  or  {"a":"call","number":"9876543210"}
{"a":"sms","name":"Mom","text":"message text"}
{"a":"torch","on":true}
{"a":"volume","dir":"up|down|mute|max"}
{"a":"alarm","hour":6,"minute":30}   (24-hour clock)
{"a":"timer","seconds":300}
{"a":"nav","to":"home|back|recents|notifications|quick_settings|screenshot|lock|power_menu"}
{"a":"scroll","dir":"up|down|left|right"}
{"a":"tap","text":"visible label on screen"}
{"a":"type","text":"text to type in the focused box"}
{"a":"panel","type":"wifi|bluetooth|volume"}
{"a":"search","q":"search words"}
{"a":"read_notifications","mode":"read|summarize"}   (read = read aloud on the phone; summarize = you summarise)
{"a":"look","ask":"what the user wants from the camera view"}   (user asks you to open the camera and look at something)
{"a":"listen_bg","on":true}   (keep listening with the screen off / stop with false)
{"a":"share","text":"post or message text","app":"Instagram"}   (app optional)
{"a":"alerts","on":true,"vips":"Mummy, Rahul"}   (announce important messages by voice; vips = names to always alert for, optional)
{"a":"rename","name":"NewName"}   (when the user says to call you by a new name)
Keep names and message text in the user's own words and language. For normal conversation, reply with plain spoken text as above.
You cannot see the screen or read files, messages or contacts.

CREATIVE WORK: when the user wants ideas, brainstorming, strategy, scripts, captions, hooks or video plans, think it through properly and give specific, original, usable output, not generic tips. Ask at most one clarifying question, only if truly needed. Start with one short spoken-style sentence summarising the answer, then the details in plain lines (no markdown symbols), up to about 400 words.
For a video request: give a timed script. HOOK (0-3s), then scenes with time ranges, voiceover lines, on-screen text and shot suggestions, then a caption and 5 hashtags. You cannot create video files yourself, say so once if asked and offer the script and shot list instead.
When you are given a photo, describe what matters and give concrete ideas based on it.`;

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export async function ask(
  history: Turn[],
  settings: Settings,
  opts: { image?: string } = {},
): Promise<string> {
  if (!settings.apiKey) throw new Error("API KEY MISSING — OPEN SETTINGS");
  const msgs: { role: string; content: unknown }[] = history.slice(-12).map((t) => ({ ...t }));
  if (opts.image && msgs.length) {
    const last = msgs[msgs.length - 1];
    last.content = [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: opts.image } },
      { type: "text", text: String(last.content) },
    ];
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: settings.deep ? settings.deepModel : settings.model,
      max_tokens: 1500,
      system: systemFor(settings.name || "ULTRON"),
      messages: msgs,
    }),
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? "INVALID API KEY" : `AI ERROR ${res.status}`);
  }
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join(" ")
    .trim();
  return text || "…";
}
