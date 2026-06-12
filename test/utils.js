// Shared test utilities. Seeded PRNG so randomized parity tests are
// reproducible — a failure always reproduces with the same seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random n×n non-negative trust matrix; ~`zeroRowEvery`-th row left all-zero
// to exercise the fallback path.
export function randomTrustMatrix(n, rand, zeroRowEvery = 4) {
  return Array.from({ length: n }, (_, i) => {
    if (zeroRowEvery > 0 && i % zeroRowEvery === zeroRowEvery - 1) {
      return Array(n).fill(0);
    }
    return Array.from({ length: n }, () => (rand() < 0.4 ? 0 : rand() * 10));
  });
}

export function randomBalances(n, rand) {
  return Array.from({ length: n }, () => 1 + rand() * 100);
}

export function maxAbsDiff(a, b) {
  return a.reduce((m, x, i) => Math.max(m, Math.abs(x - b[i])), 0);
}
