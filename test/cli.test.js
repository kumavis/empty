// End-to-end validation at the human entry point (workflow §4: "validate at
// the real user-facing entry point"): the CLI, driven by script files.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const cli = (args, input) =>
  execFileSync('node', ['src/cli.js', ...args], { encoding: 'utf8', input });

test('scripted victory: level 1 through the CLI', () => {
  const out = cli(['--level', '1', '--script', 'test/solutions/level1.script']);
  assert.match(out, /First Rain/);
  assert.match(out, /YOU WON/);
  assert.match(out, /Lesson:/);
});

test('scripted victory: the Sybil Garden with plot:target syntax', () => {
  const out = cli(['--level', '5', '--script', 'test/solutions/level5.script']);
  assert.match(out, /YOU WON/);
  assert.match(out, /Sybil Garden/);
});

test('losing is reported honestly (silence loses level 1)', () => {
  const out = cli(['--level', '1'], 'run\nquit\n');
  assert.match(out, /season ended — level lost/);
  assert.match(out, /Hint:/);
});

test('bad input is survivable: errors print, the session continues', () => {
  const out = cli(['--level', '1'], 'trust nobody 1\ntrust brook -1\nhint\nquit\n');
  assert.match(out, /✗ Unknown plot: nobody/);
  assert.match(out, /✗ Trust weight/);
  assert.match(out, /Hint:/, 'session continued after errors');
});

test('the board renders the open-information contract (X9)', () => {
  const out = cli(['--level', '6'], 'quit\n');
  assert.match(out, /sycophant/, 'personality ids are visible');
  assert.match(out, /Flatters whoever holds the most tokens/, 'descriptions are visible');
  assert.match(out, /Trust flows/, 'normalized trust matrix is visible');
});
