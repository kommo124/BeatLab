import { describe, expect, test } from "bun:test";
import { decodeAudio } from "../src/services/audio.js";
import { analyze, detectBpm, detectKey } from "../src/services/analyze.js";
import { encodeMp3, encodeWav, makeSignal } from "./helpers.js";

describe("BPM detection", () => {
  test("finds 128 BPM", async () => {
    const signal = makeSignal({ bpm: 128 });
    const { samples, sampleRate } = await decodeAudio(encodeWav(signal, 44100));
    expect(detectBpm(samples, sampleRate)).toBeCloseTo(128, 0);
  });

  test("finds 90 BPM", async () => {
    const signal = makeSignal({ bpm: 90 });
    const { samples, sampleRate } = await decodeAudio(encodeWav(signal, 44100));
    expect(detectBpm(samples, sampleRate)).toBeCloseTo(90, 0);
  });

  test("finds 140 BPM", async () => {
    const signal = makeSignal({ bpm: 140 });
    const { samples, sampleRate } = await decodeAudio(encodeWav(signal, 44100));
    expect(detectBpm(samples, sampleRate)).toBeCloseTo(140, 0);
  });
});

describe("key detection", () => {
  test("A minor chord → A minor", async () => {
    const signal = makeSignal({ bpm: 128 }); // default A minor chord
    const { samples, sampleRate } = await decodeAudio(encodeWav(signal, 44100));
    const key = detectKey(samples, sampleRate);
    expect(key.root).toBe("A");
    expect(key.mode).toBe("minor");
    expect(key.name).toBe("A minor");
    expect(key.camelot).toBe("8A");
    expect(key.confidence).toBeGreaterThan(30);
  });

  test("C major chord → C major", async () => {
    const signal = makeSignal({
      bpm: 100,
      chord: [130.81, 164.81, 196, 261.63], // C E G C
    });
    const { samples, sampleRate } = await decodeAudio(encodeWav(signal, 44100));
    const key = detectKey(samples, sampleRate);
    expect(key.root).toBe("C");
    expect(key.mode).toBe("major");
    expect(key.camelot).toBe("8B");
  });
});

describe("MP3 pipeline", () => {
  test("decodes mp3 and keeps tempo + key", async () => {
    const signal = makeSignal({ bpm: 128 });
    const mp3 = encodeMp3(signal, 44100);
    const { samples, sampleRate } = await decodeAudio(mp3);

    const result = analyze(samples, sampleRate);
    expect(result.bpm).toBeCloseTo(128, 0);
    expect(result.key.root).toBe("A");
    expect(result.key.mode).toBe("minor");
  });
});
