// Parity suite: our engine must be numerically indistinguishable from the
// reference implementation (the verbatim raindrop-viz oracle).
//
// Workflow rule (design §5 / self-critique R2): identical EXPLICIT params go
// to both sides — comparing under each side's defaults would test nothing,
// since our engine deliberately defaults to a tighter threshold.
//
// Skeleton lands in Phase 0 (skipped); Phase 1 makes it run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  oracleEigentrust,
  oracleSimulate,
  oracleFallbacks,
} from './oracle/viz-eigentrust.js';
import { mulberry32, randomTrustMatrix, randomBalances } from './utils.js';

const ENGINE = new URL('../src/raindrop.js', import.meta.url);
const enginePresent = existsSync(ENGINE);
const skip = enginePresent ? false : 'Phase 1 not landed: src/raindrop.js absent';

test('eigentrust parity across sizes, alphas, fallbacks (seeded)', { skip }, async () => {
  const { eigentrust } = await import(ENGINE);
  for (const n of [2, 3, 5, 8, 12]) {
    for (const alpha of [0.05, 0.15, 0.5, 0.85]) {
      for (const [name, fb] of Object.entries(oracleFallbacks)) {
        const rand = mulberry32(n * 1000 + alpha * 100);
        const params = {
          trustMatrix: randomTrustMatrix(n, rand),
          trustedSetWeights: randomBalances(n, rand),
          alpha,
          errorThreshold: 1e-9,
          maxIterations: 1000,
          getDefaultsForRow: fb,
        };
        const ours = eigentrust(params);
        const theirs = oracleEigentrust(params);
        assert.deepEqual(
          ours.result,
          theirs.result,
          `g mismatch: n=${n} alpha=${alpha} fallback=${name}`,
        );
        assert.equal(ours.iterations, theirs.iterations, `iteration count: n=${n} alpha=${alpha}`);
      }
    }
  }
});

test('multi-round simulation parity (fixed + percentage + burn)', { skip }, async () => {
  const { issuanceRound } = await import(ENGINE);
  for (const [mode, amount, burnRatio] of [
    ['fixed', 10, 0],
    ['fixed', 25, 0.3],
    ['percentage', 0.08, 0],
    ['percentage', 0.05, 0.2],
  ]) {
    const rand = mulberry32(42);
    const n = 6;
    const trustMatrix = randomTrustMatrix(n, rand);
    const initialBalances = randomBalances(n, rand);
    const rounds = 12;

    const theirs = oracleSimulate({
      trustMatrix,
      initialBalances,
      alpha: 0.15,
      issuanceAmount: amount,
      issuanceMode: mode,
      rounds,
      burnRatio,
      getDefaultsForRow: oracleFallbacks.trustSet,
    });

    // The oracle's simulate() invokes eigentrust at ITS defaults (1e-6) and
    // tracks supply incrementally — mirror both explicitly for bit-equality.
    let balances = [...initialBalances];
    let totalSupply = balances.reduce((a, b) => a + b, 0);
    for (let r = 0; r < rounds; r++) {
      const res = issuanceRound({
        balances,
        totalSupply,
        trustMatrix,
        alpha: 0.15,
        issuanceAmount: amount,
        issuanceMode: mode,
        burnRatio,
        errorThreshold: 1e-6,
        maxIterations: 1000,
        getDefaultsForRow: oracleFallbacks.trustSet,
      });
      balances = res.balances;
      totalSupply = res.totalSupply;
      assert.deepEqual(
        balances,
        theirs.balanceHistory[r + 1],
        `round ${r} balances mismatch (${mode} ${amount} burn ${burnRatio})`,
      );
    }
    assert.deepEqual(balances, theirs.finalBalances);
  }
});
