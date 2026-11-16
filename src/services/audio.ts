import decode from "audio-decode";

export interface DecodedAudio {
  /** Mono mix-down */
  samples: Float32Array;
  sampleRate: number;
}

/**
 * Decode any audio file Telegram can send us (mp3, wav, ogg/opus,
 * m4a, flac, aac, webm...) and mix it down to mono.
 */
export async function decodeAudio(bytes: Uint8Array): Promise<DecodedAudio> {
  const copy = bytes.slice();
  const audio = await decode(copy.buffer);

  const channels = audio.channelData;
  const first = channels[0];
  if (!first) throw new Error("Audio file contains no channels");

  if (channels.length === 1) {
    return { samples: first, sampleRate: audio.sampleRate };
  }

  const mono = new Float32Array(first.length);
  for (const channel of channels) {
    for (let i = 0; i < mono.length; i++) {
      mono[i] = mono[i]! + (channel[i] ?? 0);
    }
  }
  const gain = 1 / channels.length;
  for (let i = 0; i < mono.length; i++) {
    mono[i] = mono[i]! * gain;
  }

  return { samples: mono, sampleRate: audio.sampleRate };
}

/** Audio extensions we accept as documents. */
const AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "ogg",
  "oga",
  "opus",
  "m4a",
  "aac",
  "flac",
  "webm",
  "wma",
  "aiff",
  "caf",
];

export function isAudioFile(mimeType: string | null | undefined, fileName?: string): boolean {
  if (mimeType?.startsWith("audio/")) return true;
  if (mimeType === "video/webm" || mimeType === "application/ogg") return true;

  const ext = fileName?.split(".").pop()?.toLowerCase();
  return ext !== undefined && AUDIO_EXTENSIONS.includes(ext);
}
