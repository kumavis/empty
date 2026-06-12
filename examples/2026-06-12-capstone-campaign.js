// Capstone demo (workflow Stage 5): the whole campaign, played to victory
// through the public API, narrated. Read it to learn the game; run it to
// prove the game:   npm run capstone
//
// This file is ground truth for "what works end to end".

import { levels, solutions, ringDemo } from '../src/game/levels.js';
import { runScript } from '../src/game/bots.js';
import { getView } from '../src/game/game.js';

const line = (s = '') => console.log(s);
const rule = () => line('─'.repeat(72));

line('💧 RAINDROP — a game of trust and rain');
line('   The raindrop mechanism (continuous issuance allocated by EigenTrust');
line('   over a token-weighted trust network) as a six-level campaign.');

let cleared = 0;
for (const level of levels) {
  rule();
  line(`${level.title}`);
  line(`  ${level.story}`);
  line(`  Teaches: ${level.teaches}`);

  const end = runScript(level, solutions[level.id]);
  const view = getView(end);
  const standings = view.plots
    .map((p) => `${p.name} ${p.balance.toFixed(0)} (${(p.share * 100).toFixed(0)}%)`)
    .join(' · ');

  line(`  Winning line: ${solutions[level.id]
    .map((moves) => moves.map(([f, t, w]) => `${f}→${t}:${w}`).join(' '))
    .join(' | ')} …then let the seasons run`);
  line(`  Outcome: ${end.status.toUpperCase()} at round ${end.round}/${end.params.maxRounds}`);
  line(`  Final garden: ${standings}`);

  if (end.status !== 'won') {
    line('  ✗ CAPSTONE FAILURE — a checked-in solution stopped winning.');
    process.exit(1);
  }
  cleared++;
}

rule();
line('The Sybil Garden, as numbers (probe P2/P6, live):');
const { honest, ring } = ringDemo();
line(`  merged plot allocation   ${honest.baselineAllocation.toFixed(6)}`);
line(`  honest 3-way split       ${honest.groupAllocation.toFixed(6)}   (conserved — the paper's claim, exact)`);
line(`  trust-ring split         ${ring.groupAllocation.toFixed(6)}   (self-trust, rebuilt by proxy)`);

rule();
line(`Campaign cleared: ${cleared}/${levels.length} levels won through the public API.`);
line('Play it yourself:  npm run play            (terminal)');
line('                   npm run web             (browser, simulation in a Web Worker)');

// ── Aspirational (not yet built — the specification for what could come) ──
// import { endlessGarden } from '../src/game/endless.js';
//   A seeded "endless mode": procedurally grown courts where each season
//   adds a personality; the goal ladder follows your best share.
// import { duet } from '../src/game/multiplayer.js';
//   Two-player hotseat: GameState is already pure JSON — hand the state
//   across the table (or the wire) and alternate staging windows.
