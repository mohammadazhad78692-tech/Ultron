import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.ultron.orb",
  appName: "ULTRON",
  webDir: "out",
  backgroundColor: "#000000",
  android: { allowMixedContent: false },
  plugins: {
    // Routes fetch() through native HTTP (no CORS problems when calling the AI API)
    CapacitorHttp: { enabled: true },
  },
};

export default config;
