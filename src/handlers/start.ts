import { escapeHtml, type BotContext } from "../types.js";
import { appKeyboard } from "../keyboards/main.js";
import { setLinkMessageId, upsertUser } from "../db/users.js";

const GREETING = (name: string) =>
  `👋 <b>Привет, ${escapeHtml(name)}!</b>\n\n` +
  `Я <b>BeatLab</b> — твой помощник в работе над треками:\n` +
  `• 🎛 полезные инструменты и калькуляторы\n` +
  `• 🎚 библиотека сэмплов и пресетов\n` +
  `• 🤝 биржа совместной работы\n\n` +
  `Открывай мини-приложение по кнопке ниже 👇`;

export async function startCommand(ctx: BotContext) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const user = await upsertUser({
    telegramId: tgUser.id,
    username: tgUser.username,
    firstName: tgUser.first_name,
    lastName: tgUser.last_name,
  });

  const name = tgUser.first_name || tgUser.username || "брат по груву";
  const text = GREETING(name);
  const replyMarkup = appKeyboard();

  // Keep ONE button message per user: edit it in place when it exists.
  if (user.linkMessageId != null) {
    try {
      const chatId = ctx.chat?.id ?? tgUser.id; // private chat: ids are equal
      await ctx.api.editMessageText(chatId, user.linkMessageId, text, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
      return;
    } catch {
      // message deleted or too old — fall through and send a fresh one
    }
  }

  const sent = await ctx.reply(text, { parse_mode: "HTML", reply_markup: replyMarkup });
  await setLinkMessageId(tgUser.id, sent.message_id);
}
