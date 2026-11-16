import { config } from "../config.js";

/**
 * Inline keyboard with the Mini App button.
 * Inline buttons can be re-sent with `editMessageReplyMarkup`, so the URL
 * stays fresh after every tunnel restart — unlike reply keyboards.
 */
export function appKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🎧 Открыть BeatLab", web_app: { url: config.WEB_APP_URL } }],
    ],
  };
}
