import { analyze, type AnalysisResult } from "../shared/analyze.js";

interface TelegramWebApp {
  ready(): void;
  expand(): void;
  HapticFeedback?: {
    notificationOccurred(type: "success" | "error" | "warning"): void;
  };
}

const tg: TelegramWebApp | undefined = (
  window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }
).Telegram?.WebApp;

tg?.ready();
tg?.expand();

const dropEl = mustGet<HTMLElement>("drop");
const fileInput = mustGet<HTMLInputElement>("file");
const progressEl = mustGet<HTMLElement>("progress");
const resultEl = mustGet<HTMLElement>("result");
const errorEl = mustGet<HTMLElement>("error");
const bpmEl = mustGet<HTMLElement>("bpm");
const keyEl = mustGet<HTMLElement>("key");
const camelotEl = mustGet<HTMLElement>("camelot");
const confFill = mustGet<HTMLElement>("confFill");
const confText = mustGet<HTMLElement>("confText");

function mustGet<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

function setState(state: "drop" | "progress" | "result" | "error") {
  dropEl.classList.toggle("hidden", state !== "drop");
  progressEl.classList.toggle("hidden", state !== "progress");
  resultEl.classList.toggle("hidden", state !== "result");
  errorEl.classList.toggle("hidden", state !== "error");
}

function showError(message: string) {
  errorEl.textContent = message;
  setState("error");
  tg?.HapticFeedback?.notificationOccurred("error");
}

// --- File selection -------------------------------------------------------

mustGet<HTMLButtonElement>("pick").addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropEl.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void handleFile(file);
  fileInput.value = "";
});

for (const eventName of ["dragenter", "dragover"] as const) {
  dropEl.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropEl.classList.add("is-over");
  });
}

for (const eventName of ["dragleave", "dragend", "drop"] as const) {
  dropEl.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropEl.classList.remove("is-over");
  });
}

dropEl.addEventListener("drop", (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) void handleFile(file);
});

mustGet<HTMLButtonElement>("again").addEventListener("click", () =>
  setState("drop"),
);

// --- Analysis -------------------------------------------------------------

const MAX_ANALYSIS_SEC = 120;

async function handleFile(file: File): Promise<void> {
  setState("progress");

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    let buffer: AudioBuffer;
    try {
      buffer = await audioContext.decodeAudioData(arrayBuffer);
    } finally {
      await audioContext.close();
    }

    if (buffer.duration < 2) {
      showError("Трек слишком короткий — нужно минимум 2 секунды.");
      return;
    }

    const result = analyze(toMono(buffer), buffer.sampleRate);
    render(result);
    setState("result");
    tg?.HapticFeedback?.notificationOccurred("success");
  } catch (err) {
    console.error(err);
    showError(
      "Не удалось прочитать аудио. Попробуй другой файл — лучше всего подходят mp3 и wav.",
    );
  }
}

function toMono(buffer: AudioBuffer): Float32Array {
  const length = Math.min(buffer.length, buffer.sampleRate * MAX_ANALYSIS_SEC);
  const channels = buffer.numberOfChannels;

  if (channels === 1) {
    return buffer.getChannelData(0).slice(0, length);
  }

  const out = new Float32Array(length);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      out[i] = out[i]! + data[i]!;
    }
  }
  const gain = 1 / channels;
  for (let i = 0; i < length; i++) {
    out[i] = out[i]! * gain;
  }
  return out;
}

function render(result: AnalysisResult): void {
  bpmEl.textContent = result.bpm > 0 ? result.bpm.toFixed(1) : "н/д";
  keyEl.textContent = result.key.name;
  camelotEl.textContent = result.key.camelot;

  const confidence = result.key.confidence;
  confFill.style.width = `${confidence}%`;
  confText.textContent = `уверенность ${confidence}%`;
}

setState("drop");
