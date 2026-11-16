import { Keyboard } from "grammy";
import { config } from "../config.js";

/** Persistent reply keyboard with the Mini App button. */
export function mainKeyboard() {
  return new Keyboard()
    .webApp("🎧 Открыть BeatLab", config.WEB_APP_URL)
    .resized();
}
