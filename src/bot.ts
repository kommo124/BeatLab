import { Bot } from "grammy";
import { config } from "./config.js";
import type { BotContext } from "./types.js";
import { startCommand } from "./handlers/start.js";

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.BOT_TOKEN);

  bot.command("start", startCommand);
  bot.command("help", (ctx) =>
    ctx.reply(
      "🤖 Я бот BeatLab.\n\nКоманды:\n/start — приветствие и вход в мини-приложение",
    ),
  );

  bot.on("message:text", (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    ctx.reply("Пока я понимаю только команды. Нажми /start, чтобы начать.");
  });

  bot.catch((err) => {
    console.error("⚠️ Bot error:", err.error);
  });

  return bot;
}
