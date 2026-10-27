// Turns the AI's one-line JSON (derived ONLY from what you said) into real phone actions.
// Screen content, contacts and messages are never sent to the AI.
import { Capacitor } from "@capacitor/core";
import { PhoneControl } from "./phone";

export type Action = { a: string; [k: string]: any };

export function parseAction(reply: string): Action | null {
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    return o && typeof o.a === "string" ? (o as Action) : null;
  } catch {
    return null;
  }
}

type Confirm = (question: string) => Promise<boolean>;
const NEEDS_A11Y = new Set(["nav", "scroll", "tap", "type"]);

async function resolveNumber(act: Action): Promise<{ name: string; number: string } | string> {
  if (act.number) return { name: String(act.number), number: String(act.number) };
  const perm = await PhoneControl.ensure({ alias: "contacts" });
  if (!perm.ok) return "Contacts ki permission nahi mili.";
  const c = await PhoneControl.findContact({ name: String(act.name ?? "") });
  if (!c.found || !c.number) return `${act.name} naam ka contact nahi mila.`;
  return { name: c.name ?? String(act.name), number: c.number };
}

export async function execute(act: Action, confirm: Confirm): Promise<string> {
  if (!Capacitor.isNativePlatform()) return "Ye kaam sirf Android app mein hota hai.";

  if (NEEDS_A11Y.has(act.a) && !(await PhoneControl.a11yEnabled()).ok) {
    await PhoneControl.openAccessibilitySettings();
    return "Pehle Accessibility mein ULTRON ko ON kijiye, phir dobara bolein.";
  }

  switch (act.a) {
    case "open_app": {
      const r = await PhoneControl.openApp({ name: String(act.name ?? "") });
      return r.ok ? `${act.name} khol raha hoon.` : `${act.name} phone mein nahi mila.`;
    }
    case "call": {
      const t = await resolveNumber(act);
      if (typeof t === "string") return t;
      if (!(await confirm(`${t.name} ko call karun?`))) return "Theek hai, call nahi kiya.";
      if (!(await PhoneControl.ensure({ alias: "call" })).ok) return "Call ki permission nahi mili.";
      return (await PhoneControl.call({ number: t.number })).ok ? `${t.name} ko call laga raha hoon.` : "Call nahi lag paaya.";
    }
    case "sms": {
      const t = await resolveNumber(act);
      if (typeof t === "string") return t;
      const text = String(act.text ?? "");
      if (!(await confirm(`${t.name} ko message bhejun: ${text}?`))) return "Theek hai, message nahi bheja.";
      if (!(await PhoneControl.ensure({ alias: "sms" })).ok) return "SMS ki permission nahi mili.";
      return (await PhoneControl.sendSms({ number: t.number, text })).ok ? "Message bhej diya." : "Message nahi ja paaya.";
    }
    case "torch":
      await PhoneControl.torch({ on: act.on !== false });
      return act.on === false ? "Torch band." : "Torch chalu.";
    case "volume":
      await PhoneControl.volume({ dir: act.dir });
      return "Ho gaya.";
    case "alarm":
      await PhoneControl.alarm({ hour: Number(act.hour), minute: Number(act.minute ?? 0) });
      return `Alarm ${act.hour}:${String(act.minute ?? 0).padStart(2, "0")} par set kar diya.`;
    case "timer":
      await PhoneControl.timer({ seconds: Number(act.seconds) });
      return "Timer chalu kar diya.";
    case "panel":
      await PhoneControl.panel({ type: String(act.type ?? "wifi") });
      return "Panel khol diya, wahan se toggle kar lijiye ya bolo 'tap karo'.";
    case "search":
      await PhoneControl.openApp({ name: "Chrome" });
      return `Chrome khol diya, ${act.q} search ke liye.`;
    case "listen_bg": {
      if (act.on === false) { await PhoneControl.stopListening(); return "Background sunna band kar diya."; }
      if (!(await PhoneControl.ensure({ alias: "mic" })).ok) return "Mic ki permission nahi mili.";
      await PhoneControl.ensure({ alias: "notify" }); // only affects whether the status notification is visible
      const r = await PhoneControl.startListening({ name: String(act._name ?? "ultron") });
      return r.ok
        ? "Ab screen band hone par bhi sunungi. Naam bolkar bolna. Lock mein sirf torch, awaaz aur timer chalenge."
        : "Background sunna chalu nahi ho paaya.";
    }
    case "alerts": {
      if (!(await PhoneControl.notifAccessEnabled()).ok) {
        await PhoneControl.openNotifAccessSettings();
        return "Pehle Notification access mein ULTRON ko ON kijiye, phir dobara bolein.";
      }
      await PhoneControl.ensure({ alias: "notify" });
      await PhoneControl.setAlerts({
        on: act.on !== false,
        ...(act.vips !== undefined ? { vips: String(act.vips) } : {}),
      });
      return act.on === false ? "Important message alert band kar diya." : "Important message alert chalu. Aise message aane par main bol kar bataungi.";
    }
    case "share": {
      await PhoneControl.share({ text: String(act.text ?? ""), app: act.app ? String(act.app) : undefined });
      return "Share screen khol di, bas Post ya Send aap dabaiye.";
    }
    case "nav":
      return (await PhoneControl.nav({ to: String(act.to) })).ok ? "Ho gaya." : "Ye nahi ho paaya.";
    case "scroll":
      return (await PhoneControl.scroll({ dir: String(act.dir) })).ok ? "Ho gaya." : "Scroll nahi hua.";
    case "tap":
      return (await PhoneControl.tap({ text: String(act.text) })).ok ? "Dabaa diya." : `Screen par "${act.text}" nahi mila.`;
    case "type":
      return (await PhoneControl.type({ text: String(act.text) })).ok ? "Likh diya." : "Koi text box select nahi hai.";
    default:
      return "Ye command mujhe samajh nahi aaya.";
  }
}
