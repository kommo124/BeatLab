/**
 * Sends every known user a fresh mini-app button.
 * Called by `bun run up` after the tunnel (and therefore WEB_APP_URL) changes,
 * because web_app buttons bake the URL into the message they were sent with.
 *
 *   bun scripts/notify.ts
 */
import { join } from "node:path";
import { Database } from "bun:sqlite";

const TOKEN = process.env.BOT_TOKEN;
const WEB_URL = process.env.WEB_APP_URL;
const DB_PATH = join(import.meta.dir, "..", "beatlab.db");

export async function notifyUsers(): Promise<number> {
  if (!TOKEN || !WEB_URL) {
    console.warn("⚠️ BOT_TOKEN or WEB_APP_URL is not set, skipping notify");
    return 0;
  }

  const db = new Database(DB_PATH, { readonly: true });
  const rows = db
    .query("SELECT telegram_id FROM users")
    .all() as { telegram_id: number }[];
  db.close();

  let sent = 0;
  for (const { telegram_id } of rows) {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: telegram_id,
        text: "🔗 Ссылка на мини-приложение обновилась — открывай:",
        reply_markup: {
          keyboard: [[{ text: "🎧 Открыть BeatLab", web_app: { url: WEB_URL } }]],
          resize_keyboard: true,
          is_persistent: true,
        },
      }),
    });
    if (res.ok) sent++;
    else console.warn(`⚠️ failed to notify ${telegram_id}: ${res.status}`);
  }
  return sent;
}

if (import.meta.main) {
  const count = await notifyUsers();
  console.log(`✅ Fresh mini-app link sent to ${count} user(s)`);
}
