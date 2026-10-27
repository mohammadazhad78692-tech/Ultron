import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { TextToSpeech } from "@capacitor-community/text-to-speech";

export type LangMode = "auto" | "hi" | "en";

const native = () => Capacitor.isNativePlatform();

/** Speech-recognition locale. "auto" uses hi-IN, which copes well with Hinglish. */
export function recognitionLang(mode: LangMode): string {
  return mode === "en" ? "en-IN" : "hi-IN";
}

/** Pick a TTS voice: Devanagari text -> Hindi voice, Roman text -> Indian English. */
export function speechLang(text: string): string {
  return /[\u0900-\u097F]/.test(text) ? "hi-IN" : "en-IN";
}

export async function micAvailable(): Promise<boolean> {
  if (native()) return (await SpeechRecognition.available()).available;
  return typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

/** Listen once and resolve with the recognised sentence ("" if nothing heard). */
export async function listenOnce(lang: string): Promise<string> {
  if (native()) {
    const perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== "granted") throw new Error("MIC PERMISSION DENIED");
    const res = await SpeechRecognition.start({
      language: lang,
      maxResults: 1,
      partialResults: false,
      popup: false,
    });
    return res.matches?.[0] ?? "";
  }
  // Browser fallback (desktop dev)
  const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Rec) throw new Error("SPEECH RECOGNITION NOT SUPPORTED");
  return new Promise((resolve, reject) => {
    const r = new Rec();
    r.lang = lang;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e: any) => resolve(e.results[0][0].transcript as string);
    r.onerror = (e: any) => (e.error === "no-speech" ? resolve("") : reject(new Error(String(e.error).toUpperCase())));
    r.onend = () => resolve("");
    r.start();
  });
}

export async function stopListening(): Promise<void> {
  if (native()) await SpeechRecognition.stop().catch(() => {});
}

export async function speak(text: string): Promise<void> {
  const lang = speechLang(text);
  if (native()) {
    await TextToSpeech.speak({ text, lang, rate: 1.0, pitch: 0.9, volume: 1.0 });
    return;
  }
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.pitch = 0.9;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export async function stopSpeaking(): Promise<void> {
  if (native()) await TextToSpeech.stop().catch(() => {});
  else window.speechSynthesis?.cancel();
}
