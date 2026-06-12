// Level tuning harness (Phase 4). For every campaign level, runs the
// checked-in solution plus every canonical bot through the REAL game API
// and prints outcomes with final goal metrics. Numbers in levels.js are
// locked only when: solution wins AND every declared negative control loses.
//
// Run: node scripts/probes/2026-06-12_level_tuning.mjs

import { levels, solutions } from '../../src/game/levels.js';
import { bots, runBot, runScript } from '../../src/game/bots.js';

const goalProgress = (level, state) => {
  const { goal } = level;
  const index = (id) => state.plots.findIndex((p) => p.id === id);
  switch (goal.type) {
    case 'balanceAtLeast':
      return `${goal.plotId}=${state.balances[index(goal.plotId)].toFixed(1)} (need ${goal.amount})`;
    case 'shareAtLeast': {
      const ids = goal.plotIds ?? [goal.plotId];
      const share = ids.reduce((s, id) => s + state.balances[index(id)], 0) / state.totalSupply;
      return `share=${(share * 100).toFixed(1)}% (need ${(goal.share * 100).toFixed(0)}%)`;
    }
    case 'leaderAtRound': {
      const i = index(goal.plotId);
      const sorted = state.balances.map((b, j) => [b, j]).sort((a, b) => b[0] - a[0]);
      const rank = sorted.findIndex(([, j]) => j === i) + 1;
      return `rank ${rank}, ${state.balances[i].toFixed(1)} vs best other ${sorted[rank === 1 ? 1 : 0][0].toFixed(1)}`;
    }
    default:
      return '?';
  }
};

for (const level of levels) {
  console.log(`\n### ${level.title} [${level.id}]`);
  const sol = runScript(level, solutions[level.id]);
  console.log(`  solution      -> ${sol.status.toUpperCase().padEnd(7)} round ${sol.round}  ${goalProgress(level, sol)}`);

  const declared = new Set(level.negativeControls.map((c) => c.bot + (c.target ?? '')));
  const controls = [
    ['noop', bots.noop()],
    ['allOnRichest', bots.allOnRichest()],
    ['greedy', bots.greedy()],
    ...level.negativeControls
      .filter((c) => c.bot === 'allOnAlly')
      .map((c) => [`allOnAlly(${c.target})`, bots.allOnAlly(c.target)]),
  ];
  for (const [name, bot] of controls) {
    const end = runBot(level, bot);
    const mustLose =
      declared.has(name) ||
      declared.has(name.replace(/^allOnAlly\((.*)\)$/, 'allOnAlly$1'));
    const verdict =
      mustLose && end.status === 'won' ? '  *** QA VIOLATION: must lose ***' : '';
    console.log(
      `  ${name.padEnd(13)} -> ${end.status.toUpperCase().padEnd(7)} round ${end.round}  ${goalProgress(level, end)}${verdict}`,
    );
  }
}
