import { Bot } from "grammy";
import { config } from "./config.js";
import type { BotContext } from "./types.js";
import { appKeyboard } from "./keyboards/main.js";
import { findUser, setLinkMessageId } from "./db/users.js";
import { startCommand } from "./handlers/start.js";

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.BOT_TOKEN);

  bot.command("start", startCommand);
  bot.command("help", (ctx) =>
    ctx.reply(
      "🤖 Я бот BeatLab.\n\n" +
        "Все инструменты — внутри мини-приложения.\n" +
        "Жми кнопку ниже или команду /start.",
    ),
  );

  // Only /start (and the notify script) create button messages — text replies
  // just point at the existing one, so stale copies with dead URLs never pile up.
  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    const user = await findUser(ctx.from.id);
    if (user?.linkMessageId != null) {
      await ctx.reply("Все инструменты — внутри мини-приложения 👇\nЖми кнопку в закреплённом сообщении выше.");
      return;
    }
    const sent = await ctx.reply("Все инструменты — внутри мини-приложения 👇", {
      reply_markup: appKeyboard(),
    });
    await setLinkMessageId(ctx.from.id, sent.message_id);
  });

  bot.catch((err) => {
    console.error("⚠️ Bot error:", err.error);
  });

  return bot;
}
