import { escapeHtml, type BotContext } from "../types.js";
import { mainKeyboard } from "../keyboards/main.js";
import { upsertUser } from "../db/users.js";

export async function startCommand(ctx: BotContext) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  await upsertUser({
    telegramId: tgUser.id,
    username: tgUser.username,
    firstName: tgUser.first_name,
    lastName: tgUser.last_name,
  });

  const name = tgUser.first_name || tgUser.username || "брат по груву";

  await ctx.reply(
    `👋 <b>Привет, ${escapeHtml(name)}!</b>\n\n` +
      `Я <b>BeatLab</b> — твой помощник в работе над треками:\n` +
      `• 🎛 полезные инструменты и калькуляторы\n` +
      `• 🎚 библиотека сэмплов и пресетов\n` +
      `• 🤝 биржа совместной работы\n\n` +
      `Открывай мини-приложение, чтобы погрузиться в работу 👇`,
    {
      parse_mode: "HTML",
      reply_markup: mainKeyboard(),
    },
  );
}
