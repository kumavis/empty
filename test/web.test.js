// Web view tests, headless. Two halves:
//  1. The worker protocol core (createSession) is pure and drives a whole
//     game without a browser — the user requirement "all simulation in a
//     Web Worker" is testable because the worker owns the GameState.
//  2. Structural drift guards: ui.js must not import game logic; only the
//     worker may; index.html wires both.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSession } from '../web/worker.js';

test('worker protocol: load, stage, forecast, end round — a full level-1 victory', () => {
  const session = createSession();

  const loaded = session.handle({ type: 'loadLevel', ref: 1 });
  assert.equal(loaded.type, 'state');
  assert.equal(loaded.level.id, 'first-rain');
  assert.equal(loaded.view.status, 'playing');
  assert.ok(loaded.goalText.includes('175'), 'goal text rendered in the worker');
  assert.ok(loaded.levels.length === 6, 'level list for the selector');
  assert.deepEqual(loaded.staged[1], null, 'AI rows are not exposed as staged');

  const staged = session.handle({ type: 'stageTrust', from: 'you', target: 'brook', weight: 5 });
  assert.equal(staged.staged[0][1], 5, 'player staging echoes back');

  const fc = session.handle({ type: 'forecast' });
  assert.equal(fc.type, 'forecast');
  const first = session.handle({ type: 'endRound' });
  assert.deepEqual(fc.allocation, first.report.allocation, 'X4 holds across the worker boundary');

  let last = first;
  while (last.view.status === 'playing') last = session.handle({ type: 'endRound' });
  assert.equal(last.view.status, 'won', 'level 1 is winnable through the worker protocol');

  const after = session.handle({ type: 'endRound' });
  assert.equal(after.type, 'error', 'ended games refuse further rounds');
  assert.match(after.message, /not playing/);
});

test('worker protocol: errors are messages, never throws', () => {
  const session = createSession();
  assert.equal(session.handle({ type: 'forecast' }).type, 'error', 'no level loaded');
  assert.equal(session.handle({ type: 'mystery' }).type, 'error');
  session.handle({ type: 'loadLevel', ref: 1 });
  const bad = session.handle({ type: 'stageTrust', from: 'you', target: 'you', weight: 1 });
  assert.equal(bad.type, 'error');
  assert.match(bad.message, /self/i);
});

test('structural drift guards: logic stays behind the worker boundary', () => {
  const ui = readFileSync(new URL('../web/ui.js', import.meta.url), 'utf8');
  const workerSrc = readFileSync(new URL('../web/worker.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');

  assert.ok(!/from\s+['"]\.\.\/src\//.test(ui), 'ui.js never imports src/');
  assert.ok(/new Worker\(.*type:\s*'module'/s.test(ui), 'ui.js talks to a module worker');
  assert.ok(/from\s+['"]\.\.\/src\/game\/game\.js['"]/.test(workerSrc), 'worker imports the game');
  assert.ok(html.includes('ui.js'), 'page loads the UI module');
  assert.ok(
    !/<script(?![^>]*ui\.js)[^>]*src=/.test(html),
    'no other scripts sneak game logic into the page',
  );
});
