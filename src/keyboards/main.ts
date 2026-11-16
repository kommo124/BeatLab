import { Keyboard } from "grammy";
import { config } from "../config.js";
import { BPM_BUTTON } from "../constants.js";

/** Persistent reply keyboard with the Mini App and tool buttons. */
export function mainKeyboard() {
  return new Keyboard()
    .webApp("🎧 Открыть BeatLab", config.WEB_APP_URL)
    .row()
    .text(BPM_BUTTON)
    .resized();
}
