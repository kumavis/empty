// Mechanized level QA (design §3.4, external critique X1/X6/X7):
// every shipped level must be schema-valid, winnable by its checked-in
// solution, and lost by every negative control it declares.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levels, solutions, getLevel, ringDemo } from '../src/game/levels.js';
import { validateLevel } from '../src/game/game.js';
import { bots, runBot, runScript } from '../src/game/bots.js';

test('campaign shape: six levels, unique ids, lookup by id and 1-indexed number', () => {
  assert.equal(levels.length, 6);
  assert.equal(new Set(levels.map((l) => l.id)).size, 6);
  assert.equal(getLevel(1).id, 'first-rain');
  assert.equal(getLevel('drought-court'), levels[5]);
  assert.throws(() => getLevel('lost-level'), /Unknown level/);
  for (const level of levels) {
    assert.ok(level.title && level.story && level.hint && level.teaches, `${level.id}: prose complete`);
    assert.ok(solutions[level.id], `${level.id}: has a checked-in solution`);
    assert.ok(level.negativeControls.length >= 2, `${level.id}: declares controls`);
  }
});

for (const level of levels) {
  test(`level ${level.id}: schema-valid (X7)`, () => {
    assert.equal(validateLevel(level), level);
  });

  test(`level ${level.id}: the checked-in solution wins (X1)`, () => {
    const end = runScript(level, solutions[level.id]);
    assert.equal(end.status, 'won', `solution must win ${level.id}`);
  });

  for (const control of level.negativeControls) {
    const name = control.bot + (control.target ? `(${control.target})` : '');
    test(`level ${level.id}: negative control ${name} loses (X6)`, () => {
      const bot = bots[control.bot](control.target);
      const end = runBot(level, bot);
      assert.equal(end.status, 'lost', `${name} must lose ${level.id}`);
    });
  }
}

test('the greedy-forecast bot is measured, not assumed: beats the tutorial, loses the finale', () => {
  // The tutorial is allowed to be greedy-winnable (design §3.4); the finale
  // is not — that is the measured "not solvable by one-round lookahead".
  assert.equal(runBot(getLevel('first-rain'), bots.greedy()).status, 'won');
  assert.equal(runBot(getLevel('drought-court'), bots.greedy()).status, 'lost');
});

test('ringDemo: the Sybil Garden lesson is numerically true (P2/P6)', () => {
  const { honest, ring } = ringDemo();
  assert.ok(
    Math.abs(honest.groupAllocation - honest.baselineAllocation) < 1e-12,
    'honest split conserves to machine precision',
  );
  assert.ok(
    ring.groupAllocation > honest.groupAllocation * 2,
    'the ring more than doubles the group allocation',
  );
});
