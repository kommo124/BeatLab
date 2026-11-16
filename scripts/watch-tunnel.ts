/**
 * Watches the tunnel log for domain rotations.
 *
 * The free localhost.run tunnel issues a NEW domain every time the SSH
 * connection re-establishes (network blip, sleep, …) — even without a
 * process restart. That silently kills the URL baked into the mini-app
 * button ("no tunnel"). This watcher keeps everything in sync:
 *
 *   new domain → .env + restart bot + edit the user's button message
 *
 * Started automatically by `bun run up`.
 */
import { join } from "node:path";
import {
  killByCommandLine,
  latestTunnelUrl,
  LOG_DIR,
  setEnvValue,
  sleep,
  startDetached,
  waitFor,
} from "./procs.js";
import { notifyUsers } from "./notify.js";

let current = process.env.WEB_APP_URL ?? null;

async function onDomainChanged(url: string): Promise<void> {
  current = url;
  setEnvValue("WEB_APP_URL", url);
  console.log(`🔁 Туннель сменил домен → ${url}, перезапускаю бота…`);

  await killByCommandLine("*src/index.ts*");
  startDetached("bot", ["bun", "src/index.ts"]);
  const botUp = await waitFor(/polling for updates/, join(LOG_DIR, "bot.log"), 15_000);
  if (!botUp) {
    console.error("❌ Бот не перезапустился, смотри .up-logs/bot.log");
    return;
  }

  const updated = await notifyUsers();
  console.log(`🔁 Кнопка обновлена у ${updated} пользователей`);
}

console.log(`👁 Наблюдаю за доменом туннеля (сейчас: ${current ?? "?"})`);

for (;;) {
  const latest = latestTunnelUrl();
  if (latest && latest !== current) {
    await onDomainChanged(latest);
  }
  await sleep(3000);
}
