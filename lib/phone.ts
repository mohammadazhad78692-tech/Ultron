import { registerPlugin } from "@capacitor/core";

interface Ok { ok: boolean }
export interface PhoneControlPlugin {
  ensure(o: { alias: "contacts" | "call" | "sms" | "mic" | "notify" }): Promise<Ok>;
  findContact(o: { name: string }): Promise<{ found: boolean; name?: string; number?: string }>;
  call(o: { number: string }): Promise<Ok>;
  sendSms(o: { number: string; text: string }): Promise<Ok>;
  torch(o: { on: boolean }): Promise<Ok>;
  volume(o: { dir: "up" | "down" | "mute" | "max" }): Promise<Ok>;
  alarm(o: { hour: number; minute: number; label?: string }): Promise<Ok>;
  timer(o: { seconds: number }): Promise<Ok>;
  openApp(o: { name: string }): Promise<Ok>;
  panel(o: { type: string }): Promise<Ok>;
  a11yEnabled(): Promise<Ok>;
  openAccessibilitySettings(): Promise<Ok>;
  nav(o: { to: string }): Promise<Ok>;
  tap(o: { text: string }): Promise<Ok>;
  scroll(o: { dir: string }): Promise<Ok>;
  type(o: { text: string }): Promise<Ok>;
  startListening(o: { name: string }): Promise<Ok>;
  stopListening(): Promise<Ok>;
  listening(): Promise<Ok>;
  notifAccessEnabled(): Promise<Ok>;
  openNotifAccessSettings(): Promise<Ok>;
  getNotifications(): Promise<{ items: { app: string; title: string; text: string }[] }>;
  share(o: { text: string; app?: string }): Promise<Ok>;
  setAlerts(o: { on?: boolean; vips?: string; words?: string }): Promise<Ok>;
  getAlerts(): Promise<{ on: boolean; vips: string; words: string }>;
}

export const PhoneControl = registerPlugin<PhoneControlPlugin>("PhoneControl");
