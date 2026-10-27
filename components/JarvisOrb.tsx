"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createOrbScene, type OrbSceneApi } from "@/lib/orbScene";
import { HandTracker, type TrackerStatus } from "@/lib/handTracker";
import {
  ask, clearSettings, loadSettings, saveSettings, DEFAULT_SETTINGS,
  type Settings, type Turn,
} from "@/lib/assistant";
import { runCommand } from "@/lib/commands";
import { execute, parseAction } from "@/lib/actions";
import { PhoneControl } from "@/lib/phone";
import { snap } from "@/lib/vision";
import {
  listenOnce, recognitionLang, speak, stopListening, stopSpeaking, type LangMode,
} from "@/lib/voice";

const fmtName = (n: string) =>
  n.toUpperCase().split(/\s+/).filter(Boolean).map((w) => [...w].join(".") + ".").join(" ");

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export default function JarvisOrb() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<OrbSceneApi | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);

  const [gestures, setGestures] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<TrackerStatus>({ hands: 0, mode: "idle" });

  const [voice, setVoice] = useState<VoiceState>("idle");
  const [lang, setLang] = useState<LangMode>("auto");
  const [caption, setCaption] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const historyRef = useRef<Turn[]>([]);
  const [preview, setPreview] = useState(false);
  const [longText, setLongText] = useState("");
  const [alerts, setAlerts] = useState({ on: false, vips: "", words: "" });

  useEffect(() => {
    if (showSettings) PhoneControl.getAlerts().then(setAlerts).catch(() => {});
  }, [showSettings]);

  const toggleAlerts = async () => {
    try {
      if (!(await PhoneControl.notifAccessEnabled()).ok) {
        await PhoneControl.openNotifAccessSettings();
        return;
      }
      await PhoneControl.ensure({ alias: "notify" });
      await PhoneControl.setAlerts({ on: !alerts.on });
      setAlerts({ ...alerts, on: !alerts.on });
    } catch {
      setError("ALERTS ONLY WORK IN THE ANDROID APP");
    }
  };

  useEffect(() => {
    setSettings(loadSettings());
    const l = localStorage.getItem("ultron.lang") as LangMode | null;
    if (l) setLang(l);
  }, []);

  useEffect(() => {
    document.title = settings.name || "ULTRON";
  }, [settings.name]);

  const changeLang = (l: LangMode) => {
    setLang(l);
    localStorage.setItem("ultron.lang", l);
  };

  const talk = useCallback(async () => {
    if (voice === "listening") { await stopListening(); return; }
    if (voice !== "idle") { await stopSpeaking(); setVoice("idle"); return; }
    setError(null);
    try {
      setVoice("listening");
      setCaption("LISTENING…");
      const heard = (await listenOnce(recognitionLang(lang))).trim();
      if (!heard) { setCaption(""); setVoice("idle"); return; }
      setCaption(`> ${heard}`);
      setVoice("thinking");
      const local = await runCommand(heard);
      if (local) {
        setCaption(local);
        setVoice("speaking");
        await speak(local);
        return;
      }
      historyRef.current.push({ role: "user", content: heard });
      const reply = await ask(historyRef.current, settings);
      const act = parseAction(reply);

      // Long answers (ideas, scripts) go on screen; only the first sentence is spoken.
      const present = async (text: string) => {
        const long = text.length > 320;
        const first = text.split(/(?<=[.!?।])\s/)[0].slice(0, 220);
        setCaption(long ? first : text);
        setLongText(long ? text : "");
        setVoice("speaking");
        await speak(long ? `${first} Baaki poora screen par hai.` : text);
      };

      if (act?.a === "read_notifications") {
        historyRef.current.pop();
        if (!(await PhoneControl.notifAccessEnabled()).ok) {
          await PhoneControl.openNotifAccessSettings();
          await present("Notification access mein ULTRON ko ON kijiye, phir dobara bolein.");
          return;
        }
        const items = (await PhoneControl.getNotifications()).items;
        if (!items.length) { await present("Koi naya notification nahi hai."); return; }
        if (act.mode === "summarize") {
          // Numbers of 4+ digits (OTPs, amounts, card digits) are hidden before anything leaves the phone.
          const clean = (x: string) => x.replace(/\d{4,}/g, "[number]");
          const lines = items.map((i) => `${i.app}: ${clean(i.title)} - ${clean(i.text)}`).join("\n");
          const sum = await ask(
            [{ role: "user", content: `Mere notifications ka chhota spoken summary do (2-3 vaakya, zaroori cheezein pehle), plain text, JSON nahi:\n${lines}` }],
            settings,
          );
          await present(sum);
        } else {
          await present(items.slice(0, 5).map((i) => `${i.app}: ${i.title}. ${i.text}`).join(" ... "));
        }
        return;
      }

      if (act?.a === "look") {
        historyRef.current.pop();
        if (trackerRef.current) stopGestures();
        setPreview(true);
        await present("Camera khol rahi hoon. Jo dikhana hai uske saamne rakhiye.");
        setCaption("DEKH RAHI HOON…");
        const img = await snap(videoRef.current!, 4);
        setPreview(false);
        setVoice("thinking");
        const q = `${act.ask || heard}\n(Photo ke aadhar par jawab do, plain text mein, JSON nahi.)`;
        await present(await ask([{ role: "user", content: q }], settings, { image: img }));
        return;
      }

      if (act?.a === "rename") {
        historyRef.current.pop();
        const nn = String(act.name ?? "").trim().slice(0, 20);
        if (nn) {
          const next = { ...settings, name: nn };
          setSettings(next);
          saveSettings(next);
          historyRef.current = [];
          setCaption(`Ab mera naam ${nn} hai.`);
          setVoice("speaking");
          await speak(`Ab mera naam ${nn} hai.`);
        }
        return;
      }
      if (act) {
        historyRef.current.pop();
        const confirm = async (q: string) => {
          setCaption(q);
          setVoice("speaking");
          await speak(q);
          setVoice("listening");
          const ans = await listenOnce(recognitionLang(lang));
          return /(haan|han\b|haa|yes|yeah|ok|okay|theek|kar do|bhej do|laga do|हाँ|हां|ठीक|कर दो|भेज दो|लगा दो)/i.test(ans);
        };
        const out = await execute({ ...act, _name: settings.name }, confirm);
        setCaption(out);
        setVoice("speaking");
        await speak(out);
        return;
      }
      historyRef.current.push({ role: "assistant", content: reply });
      await present(reply);
    } catch (e) {
      if (historyRef.current.at(-1)?.role === "user") historyRef.current.pop();
      setError(e instanceof Error ? e.message.toUpperCase() : "VOICE ERROR");
      setCaption("");
    } finally {
      setPreview(false);
      setVoice("idle");
    }
  }, [voice, settings, lang]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scene = createOrbScene(container);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  const stopGestures = useCallback(() => {
    trackerRef.current?.stop();
    trackerRef.current = null;
    setGestures(false);
    setLoading(false);
    setStatus({ hands: 0, mode: "idle" });
  }, []);

  const startGestures = useCallback(async () => {
    if (!videoRef.current || !overlayRef.current) return;
    setError(null);
    setLoading(true);
    setGestures(true);
    const tracker = new HandTracker(videoRef.current, overlayRef.current, {
      onRotate: (dt, dp) => sceneRef.current?.rotateBy(dt, dp),
      onZoom: (f) => sceneRef.current?.zoomBy(f),
      onStatus: setStatus,
    });
    trackerRef.current = tracker;
    try {
      await tracker.start();
      setLoading(false);
    } catch (e) {
      tracker.stop();
      trackerRef.current = null;
      setGestures(false);
      setLoading(false);
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "CAMERA ACCESS DENIED"
          : "GESTURE TRACKING FAILED",
      );
    }
  }, []);

  const toggleGestures = useCallback(() => {
    if (trackerRef.current) stopGestures();
    else void startGestures();
  }, [startGestures, stopGestures]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case "g": toggleGestures(); break;
        case " ": e.preventDefault(); void talk(); break;
        case "r": sceneRef.current?.resetView(); break;
        case "+": case "=": sceneRef.current?.zoomIn(); break;
        case "-": case "_": sceneRef.current?.zoomOut(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleGestures, talk]);

  useEffect(() => () => trackerRef.current?.stop(), []);

  const statusText = loading
    ? "LOADING MODEL…"
    : status.hands === 0
      ? "NO HANDS"
      : `${status.hands} HAND${status.hands > 1 ? "S" : ""} · ${status.mode.toUpperCase()}`;

  return (
    <>
      <div ref={containerRef} className="orb-root" />
      <div className="overlay-vignette" />
      <div className="overlay-grain" />
      <div className="overlay-scanlines" />

      <div className="hud hud-title">{fmtName(settings.name || "ULTRON")}</div>

      <div className="hud hud-hint">
        <div>
          <span className="key">DRAG</span>spin <span className="key">SCROLL</span>zoom
        </div>
        <div>
          <span className="key">G</span>hand gestures <span className="key">R</span>reset{" "}
          <span className="key">+/-</span>zoom
        </div>
      </div>

      {caption && <div className="hud voice-caption">{caption}</div>}

      {longText && (
        <div className="hud result-panel">
          <div className="result-text">{longText}</div>
          <div className="hud-row">
            <button className="hud-btn" onClick={() => navigator.clipboard?.writeText(longText).catch(() => {})}>COPY</button>
            <button className="hud-btn" onClick={() => setLongText("")}>CLOSE</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="hud settings-panel">
          <div className="settings-title">SETTINGS</div>
          <label>ASSISTANT NAME</label>
          <input
            value={settings.name}
            maxLength={20}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
            placeholder="ULTRON"
          />
          <label>ANTHROPIC API KEY</label>
          <input
            type="password"
            autoComplete="off"
            value={settings.apiKey}
            onChange={(e) => setSettings({ ...settings, apiKey: e.target.value.trim() })}
            placeholder="sk-ant-…"
          />
          <label>MODEL</label>
          <input
            value={settings.model}
            onChange={(e) => setSettings({ ...settings, model: e.target.value.trim() })}
          />
          <label>IMPORTANT SENDERS (comma se alag)</label>
          <input
            value={alerts.vips}
            placeholder="Mummy, Rahul"
            onChange={(e) => setAlerts({ ...alerts, vips: e.target.value })}
            onBlur={() => PhoneControl.setAlerts({ vips: alerts.vips }).catch(() => {})}
          />
          <label>IMPORTANT WORDS (comma se alag)</label>
          <input
            value={alerts.words}
            onChange={(e) => setAlerts({ ...alerts, words: e.target.value })}
            onBlur={() => PhoneControl.setAlerts({ words: alerts.words }).catch(() => {})}
          />
          <button className="hud-btn" aria-pressed={alerts.on} onClick={() => void toggleAlerts()}>
            IMPORTANT ALERTS {alerts.on ? "ON" : "OFF"}
          </button>
          <p className="settings-note">
            Key sirf is phone mein save hoti hai. Sirf aapki baatcheet ka text Anthropic ko jaata hai.
            Koi aur server nahi, phone ka koi access nahi.
          </p>
          <div className="hud-row">
            <button className="hud-btn" onClick={() => void PhoneControl.openAccessibilitySettings().catch(() => {})}>PHONE ACCESS</button>
            <button className="hud-btn" onClick={() => void PhoneControl.openNotifAccessSettings().catch(() => {})}>NOTIFS</button>
            <button className="hud-btn" onClick={() => { saveSettings({ ...settings, name: settings.name.trim() || "ULTRON" }); setSettings((x) => ({ ...x, name: x.name.trim() || "ULTRON" })); setShowSettings(false); setError(null); }}>SAVE</button>
            <button className="hud-btn" onClick={() => { clearSettings(); setSettings(DEFAULT_SETTINGS); historyRef.current = []; }}>WIPE</button>
            <button className="hud-btn" onClick={() => setShowSettings(false)}>CLOSE</button>
          </div>
        </div>
      )}

      <div className="hud hud-controls">
        {error && <div className="hud-error">{error}</div>}
        <div className={`camera-panel${gestures || preview ? " visible" : ""}`}>
          <video ref={videoRef} className="camera-video" playsInline muted />
          <canvas ref={overlayRef} className="camera-overlay" width={208} height={156} />
          <div className="camera-status">{statusText}</div>
        </div>
        <button
          className={`hud-btn mic-btn ${voice}`}
          aria-pressed={voice !== "idle"}
          onClick={() => void talk()}
        >
          {voice === "idle" ? "🎙 TALK" : voice.toUpperCase()}
        </button>
        <div className="hud-row">
          {(["auto", "hi", "en"] as LangMode[]).map((l) => (
            <button key={l} className="hud-btn" aria-pressed={lang === l} onClick={() => changeLang(l)}>
              {l === "auto" ? "HINGLISH" : l === "hi" ? "हिंदी" : "ENG"}
            </button>
          ))}
          <button
            className="hud-btn"
            aria-pressed={settings.deep}
            onClick={() => { const n = { ...settings, deep: !settings.deep }; setSettings(n); saveSettings(n); }}
          >
            DEEP
          </button>
          <button className="hud-btn" onClick={() => setShowSettings(true)} aria-label="Settings">⚙</button>
        </div>
        <button className="hud-btn" aria-pressed={gestures} onClick={toggleGestures}>
          GESTURES {gestures ? "ON" : "OFF"}
        </button>
        <div className="hud-row">
          <button className="hud-btn" onClick={() => sceneRef.current?.zoomIn()} aria-label="Zoom in">+</button>
          <button className="hud-btn" onClick={() => sceneRef.current?.zoomOut()} aria-label="Zoom out">−</button>
          <button className="hud-btn" onClick={() => sceneRef.current?.resetView()}>RESET</button>
        </div>
      </div>
    </>
  );
}
