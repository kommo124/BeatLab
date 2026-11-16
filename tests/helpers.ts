import { Mp3Encoder } from "@breezystack/lamejs";

export interface SignalOptions {
  bpm: number;
  /** Frequencies of the sustained chord (defaults to A minor) */
  chord?: number[];
  durationSec?: number;
  sampleRate?: number;
}

/**
 * Synthesise a kick-per-beat + sustained chord signal with a known
 * tempo and key, so the analyser can be checked against ground truth.
 */
export function makeSignal(opts: SignalOptions): Float32Array {
  const {
    bpm,
    chord = [110, 130.81, 164.81, 220], // A minor
    durationSec = 8,
    sampleRate = 44100,
  } = opts;

  const total = Math.round(durationSec * sampleRate);
  const out = new Float32Array(total);
  const beatLen = (60 / bpm) * sampleRate;

  // Sustained chord
  const phases = chord.map(() => 0);
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    let s = 0;
    for (let c = 0; c < chord.length; c++) {
      const vibrato = 1 + 0.002 * Math.sin(2 * Math.PI * 5 * t);
      phases[c]! += (2 * Math.PI * chord[c]! * vibrato) / sampleRate;
      s += 0.09 * Math.sin(phases[c]!);
    }
    out[i] = s;
  }

  // Kicks on every beat
  const burstLen = Math.round(0.2 * sampleRate);
  for (let beat = 0; beat * beatLen + burstLen < total; beat++) {
    const start = Math.round(beat * beatLen);
    let phase = 0;
    for (let j = 0; j < burstLen; j++) {
      const x = j / sampleRate;
      const freq = 55 + 115 * Math.exp(-x / 0.04);
      phase += (2 * Math.PI * freq) / sampleRate;
      const env = Math.exp(-x / 0.07);
      out[start + j]! += 0.85 * env * Math.sin(phase);
    }
  }

  // Soft-clip
  for (let i = 0; i < total; i++) {
    out[i] = Math.tanh(out[i]!);
  }
  return out;
}

/** Encode mono Float32 samples as a 16-bit PCM WAV. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataLen = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buf);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataLen, true);

  let offset = 44;
  for (const s of samples) {
    view.setInt16(offset, Math.max(-1, Math.min(1, s)) * 0x7fff, true);
    offset += 2;
  }
  return new Uint8Array(buf);
}

/** Encode mono Float32 samples as a 128 kbps MP3. */
export function encodeMp3(samples: Float32Array, sampleRate: number): Uint8Array {
  const encoder = new Mp3Encoder(1, sampleRate, 128);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    pcm[i] = Math.max(-1, Math.min(1, samples[i]!)) * 0x7fff;
  }

  const chunks: Uint8Array[] = [];
  const blockSize = 1152;
  for (let i = 0; i < pcm.length; i += blockSize) {
    const chunk = encoder.encodeBuffer(pcm.subarray(i, i + blockSize));
    if (chunk.length > 0) chunks.push(new Uint8Array(chunk));
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(new Uint8Array(tail));

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
