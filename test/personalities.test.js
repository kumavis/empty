import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personalities } from '../src/game/personalities.js';
import { createGame, stageTrust, endRound, getView } from '../src/game/game.js';
import { testLevel } from './fixtures.js';

// A crafted view: 4 plots; normalized trust rows; varied balances.
const view = {
  trust: [
    [0, 0.5, 0.5, 0],
    [1, 0, 0, 0],
    [0.2, 0.3, 0, 0.5],
    [0, 0, 1, 0],
  ],
  plots: [
    { id: 'a', balance: 50 },
    { id: 'b', balance: 200 },
    { id: 'c', balance: 200 },
    { id: 'd', balance: 10 },
  ],
};

test('every policy emits a non-negative, zero-diagonal row, deterministically', () => {
  for (const [name, { policy, description }] of Object.entries(personalities)) {
    for (let self = 0; self < 4; self++) {
      const row = policy(view, self);
      assert.equal(row.length, 4, `${name}: row length`);
      assert.ok(row.every((w) => w >= 0), `${name}: non-negative`);
      assert.equal(row[self], 0, `${name}: zero diagonal at ${self}`);
      assert.deepEqual(policy(view, self), row, `${name}: deterministic`);
    }
    assert.ok(description.length > 0, `${name}: has a public description`);
  }
});

test('loyalist re-emits its own normalized row (a copy, not a reference)', () => {
  const row = personalities.loyalist.policy(view, 2);
  assert.deepEqual(row, [0.2, 0.3, 0, 0.5]);
  assert.notEqual(row, view.trust[2]);
});

test('reciprocator mirrors the incoming column; zero incoming emits the zero row', () => {
  // Incoming to plot 0: from b 1.0, from c 0.2.
  assert.deepEqual(personalities.reciprocator.policy(view, 0), [0, 1, 0.2, 0]);
  // Nobody trusts plot 3 except c (0.5).
  assert.deepEqual(personalities.reciprocator.policy(view, 3), [0, 0, 0.5, 0]);
  // A view where nobody trusts plot 1 at all:
  const lonely = {
    ...view,
    trust: [
      [0, 0, 1, 0],
      [1, 0, 0, 0],
      [1, 0, 0, 0],
      [0, 0, 1, 0],
    ],
  };
  assert.deepEqual(personalities.reciprocator.policy(lonely, 1), [0, 0, 0, 0]);
});

test('sycophant courts the richest other; ties break to the lowest index; never self', () => {
  assert.deepEqual(personalities.sycophant.policy(view, 0), [0, 1, 0, 0], 'tie b/c -> b');
  assert.deepEqual(personalities.sycophant.policy(view, 1), [0, 0, 1, 0], 'self excluded');
});

test('gardener waters the poorest other; never self', () => {
  assert.deepEqual(personalities.gardener.policy(view, 0), [0, 0, 0, 1]);
  assert.deepEqual(personalities.gardener.policy(view, 3), [1, 0, 0, 0], 'self excluded');
});

test('merchant backs others proportionally to balances', () => {
  assert.deepEqual(personalities.merchant.policy(view, 0), [0, 200, 200, 10]);
});

test('X5 completed: a reactive AI cannot see raw magnitudes — scaled staging is identical', () => {
  const level = structuredClone(testLevel);
  level.plots[1].personality = 'reciprocator';
  level.goal.amount = 1e9; // keep the game in play for both rounds
  const play = (scale) => {
    let game = createGame(level);
    game = stageTrust(game, 'you', 'brook', 3 * scale);
    game = stageTrust(game, 'you', 'elder', 1 * scale);
    ({ state: game } = endRound(game)); // reciprocator reacts next round
    ({ state: game } = endRound(game));
    // Compare observables: the player's own committed row keeps their raw
    // units by design, but AI rows, the normalized view, and all balances
    // must be bit-identical.
    return {
      aiRows: game.trust.slice(1),
      view: getView(game).trust,
      balances: game.balances,
      totalSupply: game.totalSupply,
    };
  };
  assert.deepEqual(play(1), play(1e6));
});
