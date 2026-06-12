import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  stageTrust,
  endRound,
  getView,
  forecast,
  validateLevel,
  balanceFallbackRow,
} from '../src/game/game.js';
import {
  testLevel,
  goalMetOnFinalRoundWins,
  byRoundMeansEndOfRound,
  tieIsNotLeadership,
  playRounds,
} from './fixtures.js';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('staging rules: self-trust, negatives, non-player plots, ended games', () => {
  const game = createGame(testLevel);
  assert.throws(() => stageTrust(game, 'you', 'you', 1), /self/i);
  assert.throws(() => stageTrust(game, 'you', 'brook', -1), /negative/i);
  assert.throws(() => stageTrust(game, 'you', 'brook', NaN), /negative or non-finite/i);
  assert.throws(() => stageTrust(game, 'brook', 'elder', 1), /not player-controlled/);
  assert.throws(() => stageTrust(game, 'you', 'nobody', 1), /Unknown plot/);

  const staged = stageTrust(game, 'you', 'brook', 5);
  assert.equal(staged.staged[0][1], 5, 'stage lands on the player row');
  assert.equal(game.staged[0][1], 0, 'original state untouched (purity)');

  const done = playRounds(game, testLevel.params.maxRounds);
  assert.notEqual(done.status, 'playing');
  assert.throws(() => stageTrust(done, 'you', 'brook', 1), /not playing/);
  assert.throws(() => endRound(done), /not playing/);
  assert.throws(() => forecast(done), /not playing/);
});

test('every committed row has a zero diagonal, including fallback rows (X3)', () => {
  // Player stages nothing -> their committed row is the zero row -> the
  // engine receives the diagonal-zeroed balance fallback.
  const { state } = endRound(createGame(testLevel));
  state.trust.forEach((row, i) => assert.equal(row[i], 0, `diagonal at ${i}`));

  const pretrusted = [0.5, 0.3, 0.2];
  const fb = balanceFallbackRow(0, pretrusted);
  assert.equal(fb[0], 0);
  assert.ok(close(fb[1], 0.6) && close(fb[2], 0.4), 'renormalized over the others');
  assert.ok(close(fb.reduce((a, b) => a + b, 0), 1));
});

test('forecast equals the realized round exactly (X4 single computation path)', () => {
  let game = createGame(testLevel);
  game = stageTrust(game, 'you', 'brook', 3);
  game = stageTrust(game, 'you', 'elder', 1);
  const fc = forecast(game);
  const { report } = endRound(game);
  assert.deepEqual(fc.allocation, report.allocation);
  assert.deepEqual(fc.balances, report.balances);
  assert.equal(fc.minted, report.minted);
});

test('scale invariance: only trust ratios matter (X5)', () => {
  const play = (scale) => {
    let game = createGame(testLevel);
    game = stageTrust(game, 'you', 'brook', 3 * scale);
    game = stageTrust(game, 'you', 'elder', 1 * scale);
    return endRound(game).report;
  };
  assert.deepEqual(play(1).allocation, play(1000).allocation);
  assert.deepEqual(play(1).balances, play(0.001).balances);
});

test('determinism: identical moves replay to identical states (incl. JSON round-trip)', () => {
  const run = () => {
    let game = createGame(testLevel);
    game = stageTrust(game, 'you', 'brook', 2);
    ({ state: game } = endRound(game));
    game = stageTrust(game, 'you', 'elder', 4);
    ({ state: game } = endRound(game));
    return game;
  };
  const a = run();
  const b = run();
  assert.deepEqual(a, b, 'replay equality');

  const revived = JSON.parse(JSON.stringify(a));
  assert.deepEqual(revived, a, 'state is pure JSON (S3 — the worker boundary depends on this)');
  // A revived state must remain playable through the same API.
  const continued = endRound(stageTrust(revived, 'you', 'brook', 1));
  assert.equal(continued.state.round, 3);
});

test('supply accounting: sum of balances tracks totalSupply every round', () => {
  let game = createGame(testLevel);
  for (let r = 0; r < 4; r++) {
    ({ state: game } = endRound(stageTrust(game, 'you', 'brook', r + 1)));
    const sum = game.balances.reduce((a, b) => a + b, 0);
    assert.ok(close(sum, game.totalSupply, 1e-6), `round ${r + 1}: ${sum} vs ${game.totalSupply}`);
  }
});

test('the view: open information, normalized trust, shares sum to 1 (X5/X9)', () => {
  const { state } = endRound(stageTrust(createGame(testLevel), 'you', 'brook', 7));
  const view = getView(state);
  assert.ok(view.plots.every((p) => typeof p.personality === 'string'));
  assert.ok(view.plots.every((p) => typeof p.description === 'string' && p.description.length > 0));
  assert.ok(close(view.plots.reduce((s, p) => s + p.share, 0), 1));
  view.trust.forEach((row) => {
    assert.ok(close(row.reduce((a, b) => a + b, 0), 1), 'view rows are normalized');
  });
  assert.equal(view.plots[0].lastAllocation, state.history[0].allocation[0]);
});

test('goal edge semantics (X8)', () => {
  assert.equal(goalMetOnFinalRoundWins(), 'won', 'win checked before loss on the final round');
  assert.equal(byRoundMeansEndOfRound(), 'won', 'byRound N = end of round N');
  assert.equal(tieIsNotLeadership(), 'lost', 'a tie is not leadership');
});

test('round budget exhaustion loses when the goal is not met', () => {
  const hopeless = structuredClone(testLevel);
  hopeless.goal = { type: 'balanceAtLeast', plotId: 'you', amount: 1e9, byRound: 5 };
  const done = playRounds(createGame(hopeless), 5);
  assert.equal(done.status, 'lost');
  assert.equal(done.round, 5);
});

test('validateLevel rejects malformed levels (X7)', () => {
  const base = () => structuredClone(testLevel);
  const cases = [
    [(l) => (l.plots = l.plots.slice(0, 1)), /at least 2 plots/],
    [(l) => (l.plots[1].id = 'you'), /unique/],
    [(l) => (l.plots[0].playerControlled = false), /player plot|Unknown personality/],
    [(l) => (l.plots[2].personality = 'trickster'), /Unknown personality/],
    [(l) => (l.initialBalances[1] = 0), /positive/],
    [(l) => (l.initialTrust[1][1] = 0.5), /self-trust/],
    [(l) => (l.initialTrust[2][0] = -1), /negative/],
    [(l) => (l.params.alpha = 1), /alpha/],
    [(l) => (l.params.burnRatio = 1), /burnRatio/],
    [(l) => (l.params.issuanceMode = 'weekly'), /issuanceMode/],
    [(l) => (l.goal.type = 'conquerTheWorld'), /Unknown goal type/],
    [(l) => (l.goal.byRound = 99), /horizon/],
    [(l) => (l.goal.plotId = 'nobody'), /unknown plot/],
  ];
  for (const [mutate, expected] of cases) {
    const level = base();
    mutate(level);
    assert.throws(() => validateLevel(level), expected, expected.toString());
  }
  assert.equal(validateLevel(testLevel), testLevel, 'the fixture itself is valid');
});
