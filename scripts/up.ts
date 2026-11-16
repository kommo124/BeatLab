/**
 * One-shot local launcher: mini app + HTTPS tunnel + bot.
 *
 *   bun run up
 *
 * 1. builds the mini app bundle (if missing)
 * 2. starts the static server on :3000 (if not running)
 * 3. opens an SSH tunnel (localhost.run) and rewrites WEB_APP_URL in .env
 * 4. (re)starts the bot with the fresh URL
 *
 * Logs are written to .up-logs/*.log (gitignored).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const LOG_DIR = join(ROOT, ".up-logs");
const WEB_URL_PATTERN = /https:\/\/[a-z0-9.-]+\.lhr\.life/;

mkdirSync(LOG_DIR, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function killByCommandLine(like: string): Promise<void> {
  const command =
    `Get-CimInstance Win32_Process | ` +
    `Where-Object { $_.CommandLine -like '${like}' } | ` +
    `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  await Bun.spawn(["powershell", "-NoProfile", "-Command", command]).exited;
}

function startDetached(name: string, command: string[], cwd = ROOT): void {
  const logPath = join(LOG_DIR, `${name}.log`);
  writeFileSync(logPath, ""); // fresh log per run so we never match stale output
  const fd = openSync(logPath, "a");
  spawn(command[0]!, command.slice(1), {
    cwd,
    detached: true,
    stdio: ["ignore", fd, fd],
    windowsHide: true,
  }).unref();
  writeFileSync(join(LOG_DIR, `${name}.pid`), String(process.pid));
}

async function waitFor(pattern: RegExp, logFile: string, timeoutMs: number): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(logFile)) {
      const match = readFileSync(logFile, "utf8").match(pattern);
      if (match) return match[0];
    }
    await sleep(700);
  }
  return null;
}

async function isWebUp(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:3000/", { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

function setEnvValue(key: string, value: string): void {
  const envPath = join(ROOT, ".env");
  const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const line = `${key}=${value}`;
  const next = env.includes(`${key}=`)
    ? env.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : `${env.trimEnd()}\n${line}\n`;
  writeFileSync(envPath, next);
  process.env[key] = value; // Bun preloads .env at startup — keep memory in sync
}

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
const botUp = await waitFor(/polling for updates/, join(LOG_DIR, "bot.log"), 15_000);
if (!botUp) {
  console.error("❌ Бот не поднялся, смотри .up-logs/bot.log");
  process.exit(1);
}

console.log("\n✅ Всё запущено:");
console.log(`   🌐 Мини-приложение: ${tunnelUrl}`);
console.log("   🤖 Бот: @BeatLab_bot → /start → «🎧 Открыть BeatLab»");

const { notifyUsers } = await import("./notify");
const notified = await notifyUsers();
if (notified > 0) {
  console.log(`   📨 Свежая кнопка отправлена ${notified} пользователю(-ям)`);
}
console.log("\nЛоги: .up-logs/   Остановить: закройте процессы ssh/bun в диспетчере задач");
