/** Shared helpers for the local launcher scripts (up / watch-tunnel). */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dir, "..");
export const LOG_DIR = join(ROOT, ".up-logs");
export const WEB_URL_PATTERN = /https:\/\/[a-z0-9.-]+\.lhr\.life/;

mkdirSync(LOG_DIR, { recursive: true });

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function killByCommandLine(like: string): Promise<void> {
  const command =
    `Get-CimInstance Win32_Process | ` +
    `Where-Object { $_.CommandLine -like '${like}' } | ` +
    `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  await Bun.spawn(["powershell", "-NoProfile", "-Command", command]).exited;
}

export function startDetached(name: string, command: string[], cwd = ROOT): void {
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

export async function waitFor(
  pattern: RegExp,
  logFile: string,
  timeoutMs: number,
): Promise<string | null> {
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

export async function isWebUp(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:3000/", { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export function setEnvValue(key: string, value: string): void {
  const envPath = join(ROOT, ".env");
  const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const line = `${key}=${value}`;
  const next = env.includes(`${key}=`)
    ? env.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : `${env.trimEnd()}\n${line}\n`;
  writeFileSync(envPath, next);
  process.env[key] = value; // Bun preloads .env at startup — keep memory in sync
}

/** The newest tunnel domain printed in the tunnel log (last match wins). */
export function latestTunnelUrl(): string | null {
  const logPath = join(LOG_DIR, "tunnel.log");
  if (!existsSync(logPath)) return null;
  const text = readFileSync(logPath, "utf8");
  const all = [...text.matchAll(new RegExp(WEB_URL_PATTERN.source, "g"))];
  return all.at(-1)?.[0] ?? null;
}
