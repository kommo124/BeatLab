import { Bot } from "grammy";
import { config } from "./config.js";
import type { BotContext } from "./types.js";
import { startCommand } from "./handlers/start.js";
import { analyzeAudioMessage, bpmCommand } from "./handlers/bpmKey.js";
import { BPM_BUTTON } from "./constants.js";

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.BOT_TOKEN);

  bot.command("start", startCommand);
  bot.command("bpm", bpmCommand);
  bot.command("help", (ctx) =>
    ctx.reply(
      "🤖 Я бот BeatLab.\n\n" +
        "Команды:\n" +
        "/start — приветствие и вход в мини-приложение\n" +
        "/bpm — определить BPM и тональность трека",
    ),
  );

  // BPM & Key tool: any audio the user sends us
  bot.on(["message:voice", "message:audio", "message:document"], analyzeAudioMessage);

  bot.on("message:text", (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    if (ctx.message.text === BPM_BUTTON) {
      void bpmCommand(ctx);
      return;
    }
    ctx.reply("Пока я понимаю только команды. Нажми /start, чтобы начать.");
  });

  bot.catch((err) => {
    console.error("⚠️ Bot error:", err.error);
  });

  return bot;
}
