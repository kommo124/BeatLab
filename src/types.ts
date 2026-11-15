import { Context } from "grammy";

/** Shared context for all handlers. */
export type BotContext = Context;

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
