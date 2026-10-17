import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

// True inside the iOS/Android app shell, false in any browser.
export const isNativeApp = Capacitor.isNativePlatform();

// Native builds have no Vercel env vars, so they need the production server baked in.
export const PRODUCTION_GAME_SERVER_URL = "https://checkers-with-a-knight-server.onrender.com";

// Light pages (the board screens) need dark status-bar text; the dark menus need light text.
export function syncStatusBarWithPages(root: HTMLElement) {
  if (!isNativeApp) return;

  let current: Style | null = null;
  const update = () => {
    const page = root.querySelector(":scope > main");
    const style = page?.classList.contains("game-page") ? Style.Light : Style.Dark;
    if (style !== current) {
      current = style;
      void StatusBar.setStyle({ style }).catch(() => undefined);
    }
  };

  update();
  new MutationObserver(update).observe(root, { childList: true });
}
