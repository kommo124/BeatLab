import { escapeHtml, type BotContext } from "../types.js";
import { mainKeyboard } from "../keyboards/main.js";
import { decodeAudio, isAudioFile } from "../services/audio.js";
import { analyze, type AnalysisResult } from "../services/analyze.js";
import { downloadTelegramFile } from "../services/telegramFiles.js";
import { BPM_BUTTON } from "../constants.js";

export async function bpmCommand(ctx: BotContext) {
  await ctx.reply(
    `🎵 <b>BPM & Key</b>\n\n` +
      `Пришли аудио — голосовое, трек или файл документом — и я определю:\n` +
      `• ⏱ темп (BPM)\n` +
      `• 🎹 тональность и номер в Camelot-колесе\n\n` +
      `Поддерживаемые форматы: mp3, wav, ogg, m4a, aac, flac, webm.`,
    { parse_mode: "HTML", reply_markup: mainKeyboard() },
  );
}

function getAudioFile(ctx: BotContext): { fileId: string } | undefined {
  const msg = ctx.message;
  if (!msg) return undefined;

  if (msg.voice) return { fileId: msg.voice.file_id };
  if (msg.audio) return { fileId: msg.audio.file_id };
  if (
    msg.document &&
    isAudioFile(msg.document.mime_type, msg.document.file_name ?? undefined)
  ) {
    return { fileId: msg.document.file_id };
  }
  return undefined;
}

export async function analyzeAudioMessage(ctx: BotContext) {
  const file = getAudioFile(ctx);
  if (!file || !ctx.chatId) return;

  const status = await ctx.reply("⏳ Скачиваю и анализирую трек…");

  try {
    const bytes = await downloadTelegramFile(ctx.api, file.fileId);
    const { samples, sampleRate } = await decodeAudio(bytes);

    if (samples.length < sampleRate * 2) {
      await ctx.api.editMessageText(
        ctx.chatId,
        status.message_id,
        "⚠️ Трек слишком короткий — нужно минимум 2 секунды.",
      );
      return;
    }

    const result = analyze(samples, sampleRate);
    await ctx.api.editMessageText(ctx.chatId, status.message_id, formatResult(result), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    console.error("Audio analysis failed:", err);
    await ctx.api.editMessageText(
      ctx.chatId,
      status.message_id,
      "❌ Не получилось проанализировать файл. Попробуй отправить его документом в mp3 или wav.",
    );
  }
}

function formatResult(result: AnalysisResult): string {
  const { bpm, key } = result;
  const tempo = bpm > 0 ? `<b>${bpm.toFixed(1)}</b> BPM` : "не определён";

  return (
    `🎯 <b>Анализ готов</b>\n\n` +
    `⏱ Темп: ${tempo}\n` +
    `🎹 Ключ: <b>${escapeHtml(key.name)}</b> <code>${key.camelot}</code>\n` +
    `📊 Уверенность в ключе: ${key.confidence}%\n\n` +
    `_Точность темпа ±2 BPM — учитывай это при сведении._`
  );
}
