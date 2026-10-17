import type { CapacitorConfig } from "@capacitor/cli";

// appId is permanent once an app is uploaded to App Store Connect or Google Play.
// Replace the placeholder with a reverse-domain ID under the LLC's domain before the first upload.
const config: CapacitorConfig = {
  appId: "com.example.knightcheckers",
  appName: "Knight Checkers",
  webDir: "dist",
  backgroundColor: "#111613",
  ios: {
    contentInset: "never"
  }
};

export default config;
