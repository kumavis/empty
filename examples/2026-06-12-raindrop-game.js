// Acceptance spec for the Raindrop Game track (workflow §5: executable
// specification, progress instrument, regression canary, documentation).
//
// Run after EVERY phase:  npm run acceptance
//
// Sections marked [Phase N] are uncommented as their phase lands; the track
// is not DONE until everything below runs clean, uncommented.

import assert from 'node:assert/strict';
import { oracleEigentrust } from '../test/oracle/viz-eigentrust.js';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
let section = '';
const begin = (s) => console.log(`\n== ${(section = s)}`);
const ok = (msg) => console.log(`   ok: ${msg}`);

// ---------------------------------------------------------------------------
begin('[Phase 0] baseline canary — the oracle reproduces the design §4 worked example');
{
  // 3 plots, equal balances; player trusts B, B trusts C, C trusts B.
  const { result: g, iterations } = oracleEigentrust({
    trustMatrix: [[0, 1, 0], [0, 0, 1], [0, 1, 0]],
    trustedSetWeights: [100, 100, 100],
    alpha: 0.15,
    errorThreshold: 1e-12,
  });
  assert.ok(close(g[0], 0.05, 1e-5), 'g[player] = 0.05');
  assert.ok(close(g[1], 0.48649, 1e-5), 'g[B] = 0.48649');
  assert.ok(close(g[2], 0.46351, 1e-5), 'g[C] = 0.46351');
  assert.ok(close(g[0] + g[1] + g[2], 1), 'allocation sums to 1');
  assert.ok(iterations < 1000, 'converged');
  ok(`g = [${g.map((x) => x.toFixed(5)).join(', ')}] in ${iterations} iterations`);
}

// ---------------------------------------------------------------------------
begin('[Phase 1] engine parity & properties');
{
  const { eigentrust, issuanceRound } = await import('../src/raindrop.js');

 // Same inputs, same params -> same allocation as the oracle.
 const params = {
   trustMatrix: [[0, 1, 0], [0, 0, 1], [0, 1, 0]],
   trustedSetWeights: [100, 100, 100],
   alpha: 0.15,
   errorThreshold: 1e-12,
 };
 const ours = eigentrust(params);
 const theirs = oracleEigentrust(params);
 assert.deepEqual(ours.result, theirs.result, 'engine ≡ oracle on the worked example');
 assert.equal(ours.converged, true);

 // One issuance round: 10% of supply minted, distributed by g.
 const round = issuanceRound({
   balances: [100, 100, 100],
   trustMatrix: params.trustMatrix,
   alpha: 0.15,
   issuanceAmount: 0.1,
   issuanceMode: 'percentage',
 });
 assert.ok(close(round.minted, 30), 'mints 10% of 300');
 assert.ok(close(round.balances.reduce((a, b) => a + b, 0), 330), 'supply accounting');
 assert.ok(close(round.balances[0], 101.5, 1e-3), 'player harvests g·ΔS');
 ok(`round: minted ${round.minted}, balances [${round.balances.map((x) => x.toFixed(2)).join(', ')}]`);
}

// ---------------------------------------------------------------------------
begin('[Phase 2] a game exists — staging, forecast, round resolution, goals');
{
  const { createGame, stageTrust, endRound, getView, forecast } =
    await import('../src/game/game.js');
  const { testLevel } = await import('../test/fixtures.js'); // tiny 3-plot level
  let game = createGame(testLevel);

  assert.throws(() => stageTrust(game, 'you', 'you', 1), /self/i, 'self-trust rejected (X3)');
  assert.throws(() => stageTrust(game, 'you', 'brook', -1), /negative/i, 'negative rejected');

  game = stageTrust(game, 'you', 'brook', 5);
  const fc = forecast(game);
  const { state: after, report } = endRound(game);
  assert.deepEqual(fc.allocation, report.allocation, 'forecast ≡ endRound (X4)');
  assert.equal(after.round, 1);

  // Scale invariance (X5): staging 5 or 5000 on the only target is identical.
  let g2 = stageTrust(createGame(testLevel), 'you', 'brook', 5000);
  assert.deepEqual(endRound(g2).report.allocation, report.allocation, 'only ratios matter');

  const view = getView(after);
  assert.ok(view.plots.every((p) => typeof p.personality === 'string'),
    'personalities are public information (X9)');
  assert.ok(close(view.plots.reduce((s, p) => s + p.share, 0), 1), 'shares sum to 1');
}

// ---------------------------------------------------------------------------
begin('[Phase 2] goal edge semantics (X8)');
{
  const { goalMetOnFinalRoundWins, byRoundMeansEndOfRound, tieIsNotLeadership } =
    await import('../test/fixtures.js');
  assert.equal(goalMetOnFinalRoundWins(), 'won', 'win checked before loss');
  assert.equal(byRoundMeansEndOfRound(), 'won', 'byRound N = end of round N');
  assert.equal(tieIsNotLeadership(), 'lost', 'leaderAtRound needs strict lead');
}

// ---------------------------------------------------------------------------
// begin('[Phase 4] campaign: level 1 is winnable through the real API');
// {
//   const { createGame, stageTrust, endRound } = await import('../src/game/game.js');
//   const { levels, solutions } = await import('../src/game/levels.js');
//   let game = createGame(levels[0]);
//   for (const moves of solutions[levels[0].id]) {
//     for (const [target, weight] of moves) game = stageTrust(game, 'you', target, weight);
//     ({ state: game } = endRound(game));
//     if (game.status !== 'playing') break;
//   }
//   assert.equal(game.status, 'won', 'checked-in solution beats First Rain');
// }

// ---------------------------------------------------------------------------
// begin('[Phase 4] the Sybil Garden teaches what the probes proved');
// {
//   // Honest split conserves (P2); the ring reconstructs self-trust (P6).
//   const { ringDemo } = await import('../src/game/levels.js');
//   const { honest, ring } = ringDemo();
//   assert.ok(close(honest.groupAllocation, honest.baselineAllocation, 1e-12),
//     'honest split conserves to machine precision');
//   assert.ok(ring.groupAllocation > honest.groupAllocation * 2,
//     'the ring captures what self-trust would');
// }

// ---------------------------------------------------------------------------
// begin('[Phase 5] the CLI is a real entry point — scripted victory');
// {
//   const { execFileSync } = await import('node:child_process');
//   const out = execFileSync('node', ['src/cli.js', '--level', '1', '--script',
//     'test/solutions/level1.script'], { encoding: 'utf8' });
//   assert.match(out, /you won|victory/i, 'level 1 victory through the CLI');
// }

console.log('\nacceptance spec: all active sections pass.');
