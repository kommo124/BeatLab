import { hannWindow, magnitudes } from "../utils/fft.js";

export type MusicMode = "major" | "minor";

export interface KeyResult {
  /** Root note, e.g. "A", "C#" */
  root: string;
  mode: MusicMode;
  /** Display name, e.g. "A minor" */
  name: string;
  /** Camelot notation, e.g. "8A" */
  camelot: string;
  /** Confidence 0–100 */
  confidence: number;
}

export interface AnalysisResult {
  bpm: number;
  key: KeyResult;
}

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

/** Camelot wheel: index by root note (C = 0). */
const CAMELOT_MAJOR = [
  "8B",
  "3B",
  "10B",
  "5B",
  "12B",
  "7B",
  "2B",
  "9B",
  "4B",
  "11B",
  "6B",
  "1B",
] as const;
const CAMELOT_MINOR = [
  "5A",
  "12A",
  "7A",
  "2A",
  "9A",
  "4A",
  "11A",
  "6A",
  "1A",
  "8A",
  "3A",
  "10A",
] as const;

/** Krumhansl–Schmuckler key profiles. */
const MAJOR_PROFILE = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];
const MINOR_PROFILE = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

const MIN_BPM = 60;
const MAX_BPM = 180;
/** Octave folding target: beats faster than this get doubled, slower halved. */
const FOLD_MIN = 70;
const FOLD_MAX = 180;

/**
 * Detect tempo from an onset envelope built out of short-time energy flux.
 */
export function detectBpm(samples: Float32Array, sampleRate: number): number {
  const frame = 1024;
  const hop = 512;
  const frameCount = Math.max(0, Math.floor((samples.length - frame) / hop));
  if (frameCount < 8) return 0;

  const fps = sampleRate / hop; // envelope frames per second
  const envelope = new Float32Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    const start = i * hop;
    let sum = 0;
    for (let j = 0; j < frame; j++) {
      const s = samples[start + j] ?? 0;
      sum += s * s;
    }
    envelope[i] = Math.sqrt(sum / frame);
  }

  // Positive energy flux (onset strength)
  const onset = new Float32Array(frameCount);
  let mean = 0;
  for (let i = 1; i < frameCount; i++) {
    const v = Math.max(0, envelope[i]! - envelope[i - 1]!);
    onset[i] = v;
    mean += v;
  }
  mean /= frameCount;
  for (let i = 0; i < frameCount; i++) {
    onset[i] = Math.max(0, onset[i]! - mean);
  }

  const minLag = Math.max(2, Math.floor((fps * 60) / MAX_BPM));
  const maxLag = Math.min(frameCount - 2, Math.ceil((fps * 60) / MIN_BPM));
  if (maxLag <= minLag) return 0;

  // Normalised autocorrelation over the plausible tempo range
  const ac = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let norm = 0;
    for (let i = 0; i + lag < frameCount; i++) {
      sum += onset[i]! * onset[i + lag]!;
      norm += onset[i]! * onset[i]!;
    }
    ac[lag] = norm > 0 ? sum / norm : 0;
  }

  // Prefer peaks that also score at half/double period
  const score = (lag: number): number => {
    let s = ac[lag] ?? 0;
    if (lag * 2 <= maxLag) s += 0.5 * (ac[lag * 2] ?? 0);
    const half = Math.round(lag / 2);
    if (half >= minLag) s += 0.5 * (ac[half] ?? 0);
    return s;
  };

  let bestLag = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const s = score(lag);
    if (s > bestScore) {
      bestScore = s;
      bestLag = lag;
    }
  }

  // Parabolic interpolation around the peak for sub-frame precision
  let lag = bestLag;
  const y0 = score(bestLag - 1);
  const y1 = score(bestLag);
  const y2 = score(bestLag + 1);
  const denom = y0 - 2 * y1 + y2;
  if (denom !== 0) {
    const delta = (0.5 * (y0 - y2)) / denom;
    if (Number.isFinite(delta) && Math.abs(delta) < 1) lag += delta;
  }

  let bpm = (60 * fps) / lag;
  while (bpm < FOLD_MIN) bpm *= 2;
  while (bpm > FOLD_MAX) bpm /= 2;
  if (bpm < MIN_BPM || bpm > MAX_BPM) return 0;

  return Math.round(bpm * 10) / 10;
}

/**
 * Detect musical key with a chroma histogram correlated
 * against Krumhansl–Schmuckler profiles.
 */
export function detectKey(
  samples: Float32Array,
  sampleRate: number,
): KeyResult {
  const fftSize = 8192;
  const hop = Math.max(1, Math.round(sampleRate * 0.1));
  const window = hannWindow(fftSize);
  const chroma = new Float64Array(12);

  const maxFrames = 600; // ~60 s of audio is plenty
  const lastStart = Math.min(samples.length - fftSize, hop * maxFrames);

  for (let start = 0; start <= lastStart; start += hop) {
    let energy = 0;
    const frame = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      const s = samples[start + i] ?? 0;
      energy += s * s;
      frame[i] = s * window[i]!;
    }
    if (energy < 1e-6) continue;

    const mags = magnitudes(frame);

    for (let bin = 1; bin < mags.length; bin++) {
      const freq = (bin * sampleRate) / fftSize;
      if (freq < 55 || freq > 2000) continue;

      const midi = 69 + 12 * Math.log2(freq / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      chroma[pc] = chroma[pc]! + mags[bin]!;
    }
  }

  const chromaArr = Array.from(chroma);
  const total = chromaArr.reduce((a, b) => a + b, 0);
  if (total === 0) {
    return {
      root: "C",
      mode: "major",
      name: "C major",
      camelot: "8B",
      confidence: 0,
    };
  }

  let best = { root: 0, mode: "major" as MusicMode, corr: -Infinity };
  for (const mode of ["major", "minor"] as const) {
    const profile = mode === "major" ? MAJOR_PROFILE : MINOR_PROFILE;
    for (let root = 0; root < 12; root++) {
      // Scale degree d of the profile sits at pitch class (root + d) % 12
      const rotated = profile.map((_, i) => profile[(i - root + 12) % 12]!);
      const corr = pearson(chromaArr, rotated);
      if (corr > best.corr) best = { root, mode, corr };
    }
  }

  const root = NOTE_NAMES[best.root]!;
  const camelot =
    best.mode === "major"
      ? CAMELOT_MAJOR[best.root]!
      : CAMELOT_MINOR[best.root]!;

  return {
    root,
    mode: best.mode,
    name: `${root} ${best.mode}`,
    camelot,
    confidence: Math.round(Math.min(1, Math.max(0, best.corr)) * 100),
  };
}

/** Full analysis of a mono signal. */
export function analyze(
  samples: Float32Array,
  sampleRate: number,
): AnalysisResult {
  return {
    bpm: detectBpm(samples, sampleRate),
    key: detectKey(samples, sampleRate),
  };
}

function pearson(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i]!;
    sumB += b[i]!;
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i]! - meanA;
    const db = b[i]! - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}
