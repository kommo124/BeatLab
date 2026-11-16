/**
 * One-shot local launcher: mini app + HTTPS tunnel + bot + domain watcher.
 *
 *   bun run up
 *
 * 1. builds the mini app bundle (if missing)
 * 2. starts the static server on :3000 (if not running)
 * 3. opens an SSH tunnel (localhost.run) and rewrites WEB_APP_URL in .env
 * 4. (re)starts the bot with the fresh URL
 * 5. starts the tunnel watcher (keeps the button fresh on domain rotation)
 *
 * Logs are written to .up-logs/*.log (gitignored).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  isWebUp,
  killByCommandLine,
  latestTunnelUrl,
  LOG_DIR,
  ROOT,
  setEnvValue,
  sleep,
  startDetached,
  waitFor,
  WEB_URL_PATTERN,
} from "./procs.js";

// --- 1. mini app bundle ---------------------------------------------------

if (!existsSync(join(ROOT, "web", "public", "main.js"))) {
  console.log("📦 Собираю мини-приложение…");
  await Bun.spawn(["bun", "run", "web:build"], {
    cwd: ROOT,
    stdio: ["inherit", "inherit", "inherit"],
  }).exited;
}

// --- 2. static server -----------------------------------------------------

if (await isWebUp()) {
  console.log("🌐 Мини-приложение уже запущено на :3000");
} else {
  console.log("🌐 Запускаю мини-приложение на :3000…");
  await killByCommandLine("*src/web/server.ts*");
  startDetached("web", ["bun", "src/web/server.ts"]);
  const up = await waitFor(/Mini app running/, join(LOG_DIR, "web.log"), 10_000);
  if (!up) {
    console.error("❌ Веб-сервер не поднялся, смотри .up-logs/web.log");
    process.exit(1);
  }
}

// --- 3. HTTPS tunnel ------------------------------------------------------

console.log("🔒 Открываю HTTPS-туннель (localhost.run)…");
await killByCommandLine("*nokey@localhost.run*");
const tunnelLog = join(LOG_DIR, "tunnel.log");
startDetached("tunnel", [
  "ssh",
  "-o", "StrictHostKeyChecking=no",
  "-o", "UserKnownHostsFile=NUL",
  "-o", "ServerAliveInterval=30",
  "-o", "ExitOnForwardFailure=yes",
  "-R", "80:localhost:3000",
  "nokey@localhost.run",
]);

const tunnelUrl = await waitFor(WEB_URL_PATTERN, tunnelLog, 45_000);
if (!tunnelUrl) {
  console.error("❌ Туннель не поднялся, смотри .up-logs/tunnel.log");
  process.exit(1);
}
setEnvValue("WEB_APP_URL", tunnelUrl);
console.log(`🔒 HTTPS: ${tunnelUrl}`);

// --- 4. bot ----------------------------------------------------------------

console.log("🤖 Запускаю бота…");
await killByCommandLine("*src/index.ts*");
startDetached("bot", ["bun", "src/index.ts"]);
const botUp = await waitFor(/polling for updates/, join(LOG_DIR, "bot.log"), 30_000);
if (!botUp) {
  console.error("❌ Бот не поднялся, смотри .up-logs/bot.log");
  process.exit(1);
}

// --- 5. tunnel watcher ----------------------------------------------------

await killByCommandLine("*watch-tunnel*");
startDetached("watch", ["bun", "scripts/watch-tunnel.ts"]);
const watchUp = await waitFor(/Наблюдаю за доменом/, join(LOG_DIR, "watch.log"), 10_000);
if (!watchUp) {
  console.error("❌ Наблюдатель не поднялся, смотри .up-logs/watch.log");
  process.exit(1);
}
console.log("👁 Наблюдатель туннеля запущен (авто-обновление кнопки при смене домена)");

// --- notify ---------------------------------------------------------------

console.log("\n✅ Всё запущено:");
console.log(`   🌐 Мини-приложение: ${latestTunnelUrl() ?? tunnelUrl}`);
console.log("   🤖 Бот: @BeatLab_bot → /start → «🎧 Открыть BeatLab»");

const { notifyUsers } = await import("./notify");
const notified = await notifyUsers();
if (notified > 0) {
  console.log(`   📨 Кнопка обновлена у ${notified} пользователей`);
}
console.log("\nЛоги: .up-logs/   Остановить: закройте процессы ssh/bun в диспетчере задач");
