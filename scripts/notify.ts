/**
 * Keeps the mini-app button fresh for every user.
 *
 * The button lives in ONE persistent message per user; when the tunnel
 * domain changes, that message is edited in place — so users never
 * accumulate stale "no tunnel" buttons.
 *
 *   bun scripts/notify.ts
 */
import { appKeyboard } from "../src/keyboards/main.js";
import { listUsersWithLink, setLinkMessageId } from "../src/db/users.js";

const TOKEN = process.env.BOT_TOKEN;
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;

const TEXT = "🔗 Мини-приложение BeatLab — открывай по кнопке:";

type ApiResult<T> = { ok: true; result: T } | { ok: false; description: string };

async function api<T>(
  method: string,
  payload: Record<string, unknown>,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as {
      ok: boolean;
      result?: T;
      description?: string;
    };
    if (body.ok) return { ok: true, result: body.result as T };
    return { ok: false, description: body.description ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, description: String(err) };
  }
}

export async function notifyUsers(): Promise<number> {
  if (!API) {
    console.warn("⚠️ BOT_TOKEN is not set, skipping notify");
    return 0;
  }

  let updated = 0;
  for (const { telegramId, linkMessageId } of listUsersWithLink()) {
    const markup = { reply_markup: appKeyboard() };

    // Refresh the existing message first (Telegram limits edits to 48h)
    if (linkMessageId != null) {
      const edited = await api<boolean>("editMessageText", {
        chat_id: telegramId,
        message_id: linkMessageId,
        text: TEXT,
        ...markup,
      });
      if (edited.ok || edited.description.includes("not modified")) {
        updated++;
        continue;
      }
      console.warn(`⚠️ edit ${linkMessageId} failed for ${telegramId}: ${edited.description}`);
    }

    const sent = await api<{ message_id: number }>("sendMessage", {
      chat_id: telegramId,
      text: TEXT,
      ...markup,
    });
    if (sent.ok) {
      await setLinkMessageId(telegramId, sent.result.message_id);
      updated++;
    } else {
      console.warn(`⚠️ send failed for ${telegramId}: ${sent.description}`);
    }
  }
  return updated;
}

if (import.meta.main) {
  const count = await notifyUsers();
  console.log(`✅ Mini-app button refreshed for ${count} user(s)`);
}
