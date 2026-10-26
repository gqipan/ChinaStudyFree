import type { CapacitorConfig } from "@capacitor/core";

// Family packages obtain the optional AI service address at runtime only.
const familyMode = process.env.FAMILY_ANDROID_MODE;
const isFamily = familyMode === "debug" || familyMode === "release";
const config: CapacitorConfig = {
  appId: isFamily
    ? `com.chinastudyfree.family${familyMode === "debug" ? ".debug" : ""}`
    : "com.chinastudyfree.app",
  appName: familyMode === "debug" ? "聪聪学堂（调试）" : "聪聪学堂",
  webDir: "../web/out",
  server: { androidScheme: "https", iosScheme: "https", cleartext: false },
  plugins: {},
};

export default config;
