// Pre-implementation design probes for the Raindrop Game track.
// Runs AGAINST THE ORACLE (the raindrop-viz reference implementation), so all
// numbers here are properties of the normative mechanism, not of our code.
// These results are design input — see the design doc "Probe findings".
//
// Run: node scripts/probes/2026-06-12_design_probes.mjs

import {
  oracleEigentrust,
  oracleSimulate,
  oracleFallbacks,
} from '../../test/oracle/viz-eigentrust.js';

const fmt = (xs) => xs.map((x) => x.toFixed(4)).join(' ');

// ---------------------------------------------------------------------------
console.log('P1 — alpha sensitivity: how much does one player\'s trust shift move g?');
// 5 accounts, equal balances. Everyone trusts everyone else uniformly.
// Player (index 0) moves ALL their trust from account 1 to account 2.
{
  const n = 5;
  const uniformRow = (i) => Array.from({ length: n }, (_, j) => (j === i ? 0 : 1));
  const base = Array.from({ length: n }, (_, i) => uniformRow(i));
  const shifted = base.map((row) => [...row]);
  shifted[0] = [0, 0, 4, 0, 0]; // all of player 0's trust onto account 2
  const balances = [100, 100, 100, 100, 100];
  for (const alpha of [0.05, 0.15, 0.3, 0.5, 0.85]) {
    const g0 = oracleEigentrust({ trustMatrix: base, trustedSetWeights: balances, alpha }).result;
    const g1 = oracleEigentrust({ trustMatrix: shifted, trustedSetWeights: balances, alpha }).result;
    console.log(
      `  alpha=${alpha}: target g ${g0[2].toFixed(4)} -> ${g1[2].toFixed(4)}` +
        ` (x${(g1[2] / g0[2]).toFixed(2)}), victim g ${g0[1].toFixed(4)} -> ${g1[1].toFixed(4)}`,
    );
  }
}

// ---------------------------------------------------------------------------
console.log('\nP2 — Sybil conservation: does splitting a balance raise group allocation?');
{
  // Baseline: 4 accounts; account 3 holds 90 of 300 total. Others trust
  // uniformly; account 3 trusts account 0.
  const balancesBase = [100, 70, 40, 90];
  const Tbase = [
    [0, 1, 1, 1],
    [1, 0, 1, 1],
    [1, 1, 0, 1],
    [1, 0, 0, 0],
  ];
  const gBase = oracleEigentrust({ trustMatrix: Tbase, trustedSetWeights: balancesBase, alpha: 0.15 }).result;
  console.log(`  baseline: account3 g=${gBase[3].toFixed(4)}`);

  // Split: account 3 becomes three sybils (30 each); outsiders' trust toward
  // the original is split evenly across sybils; each sybil keeps the
  // original outgoing trust (to account 0).
  const balancesSplit = [100, 70, 40, 30, 30, 30];
  const Tsplit = [
    [0, 1, 1, 1 / 3, 1 / 3, 1 / 3],
    [1, 0, 1, 1 / 3, 1 / 3, 1 / 3],
    [1, 1, 0, 1 / 3, 1 / 3, 1 / 3],
    [1, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0],
  ];
  const gSplit = oracleEigentrust({ trustMatrix: Tsplit, trustedSetWeights: balancesSplit, alpha: 0.15 }).result;
  const group = gSplit[3] + gSplit[4] + gSplit[5];
  console.log(`  honest split: group g=${group.toFixed(4)} (delta ${(group - gBase[3]).toExponential(2)})`);

  // Adversarial split: sybils form a mutual-trust ring instead.
  const Tring = Tsplit.map((r) => [...r]);
  Tring[3] = [0, 0, 0, 0, 1, 0];
  Tring[4] = [0, 0, 0, 0, 0, 1];
  Tring[5] = [0, 0, 0, 1, 0, 0];
  const gRing = oracleEigentrust({ trustMatrix: Tring, trustedSetWeights: balancesSplit, alpha: 0.15 }).result;
  const groupRing = gRing[3] + gRing[4] + gRing[5];
  console.log(`  sybil ring:   group g=${groupRing.toFixed(4)} (vs baseline ${gBase[3].toFixed(4)})`);
}

// ---------------------------------------------------------------------------
console.log('\nP3 — convergence cost (iterations), alpha=0.15');
{
  for (const n of [6, 12]) {
    const T = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (j === (i + 1) % n || j === (i + 3) % n ? 1 : 0)),
    );
    const b = Array.from({ length: n }, (_, i) => 10 + i * 5);
    for (const errorThreshold of [1e-6, 1e-9]) {
      const r = oracleEigentrust({ trustMatrix: T, trustedSetWeights: b, alpha: 0.15, errorThreshold });
      console.log(`  n=${n} threshold=${errorThreshold}: ${r.iterations} iterations`);
    }
  }
}

// ---------------------------------------------------------------------------
console.log('\nP4 — zero-row fallback: is "delegate nothing" a viable hoard strategy?');
{
  // 4 accounts, equal start. Account 0 delegates NOTHING; others trust
  // uniformly (including account 0). Simulate 10 rounds, fixed issuance 10.
  const T = [
    [0, 0, 0, 0],
    [1, 0, 1, 1],
    [1, 1, 0, 1],
    [1, 1, 1, 0],
  ];
  for (const [name, fb] of Object.entries(oracleFallbacks)) {
    const sim = oracleSimulate({
      trustMatrix: T,
      initialBalances: [100, 100, 100, 100],
      alpha: 0.15,
      issuanceAmount: 10,
      rounds: 10,
      getDefaultsForRow: fb,
    });
    const share = sim.finalBalances[0] / sim.finalTotalSupply;
    console.log(`  fallback=${name}: hoarder share after 10 rounds = ${(share * 100).toFixed(1)}%`);
  }
}

// ---------------------------------------------------------------------------
console.log('\nP5 — issuance feel: rounds for a fully-courted underdog to overtake');
{
  // 3 accounts: leader 150, middle 100, underdog 50. Both others put ALL
  // trust on the underdog; underdog trusts the middle.
  const T = [
    [0, 0, 1],
    [0, 0, 1],
    [0, 1, 0],
  ];
  for (const [mode, amount] of [['fixed', 10], ['fixed', 30], ['percentage', 0.05], ['percentage', 0.15]]) {
    const sim = oracleSimulate({
      trustMatrix: T,
      initialBalances: [150, 100, 50],
      alpha: 0.15,
      issuanceAmount: amount,
      issuanceMode: mode,
      rounds: 40,
    });
    const overtake = sim.balanceHistory.findIndex((bs) => bs[2] > bs[0]);
    console.log(
      `  ${mode} ${amount}: underdog overtakes leader at round ${overtake < 0 ? '>40' : overtake}` +
        ` (final shares ${fmt(sim.finalBalances.map((x) => x / sim.finalTotalSupply))})`,
    );
  }
}

// ---------------------------------------------------------------------------
console.log('\nP6 — is a sybil ring just self-trust by another name? (and alpha as a cap)');
{
  // Same baseline as P2. Compare: (a) single account 3 self-trusting,
  // (b) the 3-sybil ring, at several alphas.
  const balancesBase = [100, 70, 40, 90];
  const Tself = [
    [0, 1, 1, 1],
    [1, 0, 1, 1],
    [1, 1, 0, 1],
    [0, 0, 0, 1], // self-trust
  ];
  const balancesSplit = [100, 70, 40, 30, 30, 30];
  const Tring = [
    [0, 1, 1, 1 / 3, 1 / 3, 1 / 3],
    [1, 0, 1, 1 / 3, 1 / 3, 1 / 3],
    [1, 1, 0, 1 / 3, 1 / 3, 1 / 3],
    [0, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0, 0],
  ];
  for (const alpha of [0.15, 0.3, 0.5]) {
    const gSelf = oracleEigentrust({ trustMatrix: Tself, trustedSetWeights: balancesBase, alpha }).result;
    const gRing = oracleEigentrust({ trustMatrix: Tring, trustedSetWeights: balancesSplit, alpha }).result;
    const ring = gRing[3] + gRing[4] + gRing[5];
    console.log(`  alpha=${alpha}: self-trust g=${gSelf[3].toFixed(4)}, sybil-ring group g=${ring.toFixed(4)}`);
  }
}
