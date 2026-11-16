/**
 * In-place iterative radix-2 Cooley–Tukey FFT.
 * Returns magnitudes of the first N/2 bins.
 */
export function magnitudes(input: Float32Array): Float32Array {
  const n = input.length;
  if ((n & (n - 1)) !== 0) {
    throw new Error(`FFT size must be a power of two, got ${n}`);
  }

  const re = new Float32Array(n);
  const im = new Float32Array(n);
  re.set(input);

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    const half = len >> 1;

    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;

      for (let j = 0; j < half; j++) {
        const a = i + j;
        const b = a + half;

        const vRe = re[b]! * curRe - im[b]! * curIm;
        const vIm = re[b]! * curIm + im[b]! * curRe;

        re[b] = re[a]! - vRe;
        im[b] = im[a]! - vIm;
        re[a] = re[a]! + vRe;
        im[a] = im[a]! + vIm;

        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }

  const out = new Float32Array(n >> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.hypot(re[i]!, im[i]!);
  }
  return out;
}

/** Hann window of the given size. */
export function hannWindow(size: number): Float32Array {
  const win = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return win;
}
