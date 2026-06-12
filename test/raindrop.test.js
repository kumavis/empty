import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize,
  rowNormalize,
  transpose,
  matVec,
  l2Distance,
  eigentrust,
  issuanceRound,
} from '../src/raindrop.js';
import { mulberry32, randomTrustMatrix, randomBalances } from './utils.js';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('helpers: normalize, rowNormalize fallback, transpose, matVec, l2Distance', () => {
  assert.deepEqual(normalize([1, 3]), [0.25, 0.75]);
  assert.throws(() => normalize([0, 0]), /greater than 0/);

  const fallbackCalls = [];
  const normalized = rowNormalize([[2, 2], [0, 0]], (i) => {
    fallbackCalls.push(i);
    return [0.9, 0.1];
  });
  assert.deepEqual(normalized, [[0.5, 0.5], [0.9, 0.1]]);
  assert.deepEqual(fallbackCalls, [1], 'fallback called only for the zero row');

  assert.deepEqual(transpose([[1, 2], [3, 4]]), [[1, 3], [2, 4]]);
  assert.deepEqual(matVec([[1, 2], [3, 4]], [1, 1]), [3, 7]);
  assert.equal(l2Distance([0, 0], [3, 4]), 5);
});

test('alpha=1 collapses to the balance vector in one iteration', () => {
  const r = eigentrust({
    trustMatrix: [[0, 1, 0], [1, 0, 1], [1, 1, 0]],
    trustedSetWeights: [10, 30, 60],
    alpha: 1,
  });
  assert.deepEqual(r.result, [0.1, 0.3, 0.6]);
  assert.equal(r.iterations, 1);
  assert.equal(r.converged, true);
});

test('design §4 worked example matches the closed-form fixed point', () => {
  // Linear solve of t = 0.85·Tᵀt + 0.15·b for the 3-plot example:
  // t = [1/20, 18/37, 0.85·18/37 + 1/20]
  const r = eigentrust({
    trustMatrix: [[0, 1, 0], [0, 0, 1], [0, 1, 0]],
    trustedSetWeights: [100, 100, 100],
    alpha: 0.15,
    errorThreshold: 1e-12,
  });
  assert.ok(close(r.result[0], 1 / 20));
  assert.ok(close(r.result[1], 18 / 37));
  assert.ok(close(r.result[2], (0.85 * 18) / 37 + 1 / 20));
  assert.equal(r.converged, true);
});

test('allocation is a distribution: non-negative, sums to 1 (seeded random nets)', () => {
  const rand = mulberry32(7);
  for (let trial = 0; trial < 20; trial++) {
    const n = 2 + Math.floor(rand() * 10);
    const r = eigentrust({
      trustMatrix: randomTrustMatrix(n, rand),
      trustedSetWeights: randomBalances(n, rand),
      alpha: 0.05 + rand() * 0.9,
    });
    assert.ok(r.result.every((x) => x >= 0), 'non-negative');
    assert.ok(close(r.result.reduce((a, b) => a + b, 0), 1, 1e-9), 'sums to 1');
  }
});

test('converged flag is false when the iteration budget is exhausted', () => {
  const r = eigentrust({
    trustMatrix: [[0, 1, 0], [0, 0, 1], [0, 1, 0]],
    trustedSetWeights: [100, 100, 100],
    alpha: 0.15,
    errorThreshold: 1e-12,
    maxIterations: 2,
  });
  assert.equal(r.converged, false);
  assert.equal(r.iterations, 2);
});

test('issuanceRound: fixed mint, supply accounting, distribution by g, purity', () => {
  const balances = [100, 100, 100];
  const r = issuanceRound({
    balances,
    trustMatrix: [[0, 1, 0], [0, 0, 1], [0, 1, 0]],
    alpha: 0.15,
    issuanceAmount: 30,
    errorThreshold: 1e-12,
  });
  assert.equal(r.minted, 30);
  assert.equal(r.distributed, 30);
  assert.equal(r.burned, 0);
  assert.equal(r.totalSupply, 330, 'supply invariant: in + distributed (S2)');
  assert.ok(close(r.balances[0], 100 + (1 / 20) * 30));
  assert.ok(close(r.balances[1], 100 + (18 / 37) * 30));
  assert.deepEqual(balances, [100, 100, 100], 'inputs not mutated');
});

test('issuanceRound: percentage mode and burn arithmetic', () => {
  const r = issuanceRound({
    balances: [100, 100, 100],
    trustMatrix: [[0, 1, 0], [0, 0, 1], [0, 1, 0]],
    alpha: 0.15,
    issuanceAmount: 0.1,
    issuanceMode: 'percentage',
    burnRatio: 0.25,
  });
  assert.ok(close(r.minted, 30), 'mints 10% of supply 300');
  assert.ok(close(r.distributed, 22.5), 'burns a quarter before distribution');
  assert.ok(close(r.burned, 7.5));
  assert.ok(close(r.burned + r.distributed, r.minted));
  assert.ok(close(r.totalSupply, 322.5));
  assert.throws(() => issuanceRound({
    balances: [1],
    trustMatrix: [[0]],
    issuanceAmount: 1,
    burnRatio: 1.5,
  }), /Burn ratio/);
});
