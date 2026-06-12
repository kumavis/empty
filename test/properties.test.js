// Mechanism properties the design leans on (probes P2/P6, design §2),
// proven against OUR engine. Numbers reference the probe script.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eigentrust } from '../src/raindrop.js';

const groupSum = (g, ids) => ids.reduce((s, i) => s + g[i], 0);

const baseline = {
  balances: [100, 70, 40, 90],
  trust: [
    [0, 1, 1, 1],
    [1, 0, 1, 1],
    [1, 1, 0, 1],
    [1, 0, 0, 0],
  ],
};

// Account 3 split into three sybils of 30 each; incoming trust split evenly;
// outgoing trust preserved.
const honestSplit = {
  balances: [100, 70, 40, 30, 30, 30],
  trust: [
    [0, 1, 1, 1 / 3, 1 / 3, 1 / 3],
    [1, 0, 1, 1 / 3, 1 / 3, 1 / 3],
    [1, 1, 0, 1 / 3, 1 / 3, 1 / 3],
    [1, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0],
  ],
};

test('Sybil resistance: an honest split conserves group allocation to machine precision', () => {
  const gBase = eigentrust({
    trustMatrix: baseline.trust,
    trustedSetWeights: baseline.balances,
    alpha: 0.15,
    errorThreshold: 1e-12,
  }).result;
  const gSplit = eigentrust({
    trustMatrix: honestSplit.trust,
    trustedSetWeights: honestSplit.balances,
    alpha: 0.15,
    errorThreshold: 1e-12,
  }).result;
  assert.ok(
    Math.abs(groupSum(gSplit, [3, 4, 5]) - gBase[3]) < 1e-12,
    'splitting a balance does not change aggregate influence (paper §4, probe P2)',
  );
});

test('a sybil trust-ring is exactly single-account self-trust (probe P6)', () => {
  const ringRows = [
    [0, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0, 0],
  ];
  const ringTrust = honestSplit.trust.slice(0, 3).concat(ringRows);
  const selfTrust = baseline.trust.slice(0, 3).concat([[0, 0, 0, 1]]);

  const captures = [];
  for (const alpha of [0.15, 0.3, 0.5]) {
    const gSelf = eigentrust({
      trustMatrix: selfTrust,
      trustedSetWeights: baseline.balances,
      alpha,
      errorThreshold: 1e-12,
    }).result;
    const gRing = eigentrust({
      trustMatrix: ringTrust,
      trustedSetWeights: honestSplit.balances,
      alpha,
      errorThreshold: 1e-12,
    }).result;
    const ringCapture = groupSum(gRing, [3, 4, 5]);
    assert.ok(
      Math.abs(ringCapture - gSelf[3]) < 1e-9,
      `alpha=${alpha}: ring capture ${ringCapture} != self-trust ${gSelf[3]}`,
    );
    captures.push(ringCapture);
  }
  assert.ok(
    captures[0] > captures[1] && captures[1] > captures[2],
    'damping monotonically caps the capture (the balance anchor works)',
  );
});
