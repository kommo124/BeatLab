import type { Api } from "grammy";
import { config } from "../config.js";

/**
 * Download a Telegram file by its file_id (Bot API limit: 20 MB).
 */
export async function downloadTelegramFile(
  api: Api,
  fileId: string,
): Promise<Uint8Array> {
  const file = await api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file: HTTP ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
