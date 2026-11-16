/**
 * Keeps the mini-app button fresh for every user.
 *
 * The button lives in ONE persistent message per user; when the tunnel
 * domain changes (`bun run up`), that message's inline keyboard is edited
 * in place — so users never accumulate stale "no tunnel" buttons.
 *
 *   bun scripts/notify.ts
 */
import { appKeyboard } from "../src/keyboards/main.js";
import { listUsersWithLink, setLinkMessageId } from "../src/db/users.js";

const TOKEN = process.env.BOT_TOKEN;
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;

const TEXT = "🔗 Мини-приложение BeatLab — открывай по кнопке:";

async function api<T>(method: string, payload: Record<string, unknown>): Promise<T | null> {
  if (!API) return null;
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.warn(`⚠️ ${method} failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  const body = (await res.json()) as { result: T };
  return body.result;
}

export async function notifyUsers(): Promise<number> {
  if (!API) {
    console.warn("⚠️ BOT_TOKEN is not set, skipping notify");
    return 0;
  }

  let updated = 0;
  for (const { telegramId, linkMessageId } of listUsersWithLink()) {
    const markup = { reply_markup: appKeyboard() };

    // Try to refresh the existing message first (Telegram limits edits to 48h)
    if (linkMessageId != null) {
      const edited = await api<boolean>("editMessageReplyMarkup", {
        chat_id: telegramId,
        message_id: linkMessageId,
        ...markup,
      });
      if (edited) {
        updated++;
        continue;
      }
    }

    const sent = await api<{ message_id: number }>("sendMessage", {
      chat_id: telegramId,
      text: TEXT,
      ...markup,
    });
    if (sent) {
      await setLinkMessageId(telegramId, sent.message_id);
      updated++;
    }
  }
  return updated;
}

if (import.meta.main) {
  const count = await notifyUsers();
  console.log(`✅ Mini-app button refreshed for ${count} user(s)`);
}
