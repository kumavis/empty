// The campaign. Each level teaches one property of the raindrop mechanism
// (design §3.4); every number below was locked by the tuning harness
// (scripts/probes/2026-06-12_level_tuning.mjs): the checked-in solution
// wins, the declared negative controls lose, and the suite enforces both.
//
// negativeControls: bots that MUST lose this level. Levels that declare
// greedy here are measured to be unsolvable by one-round lookahead (X6).

import { eigentrust } from '../raindrop.js';

export const levels = [
  {
    id: 'first-rain',
    title: 'Level 1 — First Rain',
    teaches: 'Trust redirects future rain: court the one who returns it.',
    story:
      'The cloud shares its rain by listening to the garden. Brook returns ' +
      'every kindness; Stone admires only Brook. Nobody is watching you — ' +
      'yet. Earn your harvest.',
    hint: 'A reciprocator mirrors whoever trusts them. Loyalists never look your way.',
    plots: [
      { id: 'you', name: 'You', playerControlled: true },
      { id: 'brook', name: 'Brook', personality: 'reciprocator' },
      { id: 'stone', name: 'Stone', personality: 'loyalist' },
    ],
    initialBalances: [100, 90, 130],
    initialTrust: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
    ],
    params: { alpha: 0.15, issuanceAmount: 0.08, issuanceMode: 'percentage', burnRatio: 0, maxRounds: 10 },
    goal: { type: 'balanceAtLeast', plotId: 'you', amount: 175, byRound: 10 },
    negativeControls: [
      { bot: 'noop' },
      { bot: 'allOnRichest' }, // courting rich Stone earns nothing back
    ],
  },
  {
    id: 'go-between',
    title: 'Level 2 — The Go-Between',
    teaches: 'Transitivity: rain pools at the end of trust chains.',
    story:
      'Old Sage trusts only the Elder; the Elder trusts only the Herald. ' +
      'A river of rain runs Sage → Elder → Herald, and the Herald returns ' +
      'trust in kind. Stand where the river ends.',
    hint: 'The richest plot is upstream. Mirrors only pay where the flow terminates.',
    plots: [
      { id: 'you', name: 'You', playerControlled: true },
      { id: 'sage', name: 'Sage', personality: 'loyalist' },
      { id: 'elder', name: 'Elder', personality: 'loyalist' },
      { id: 'herald', name: 'Herald', personality: 'reciprocator' },
    ],
    initialBalances: [80, 150, 100, 70],
    initialTrust: [
      [0, 0, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
      [0, 0, 0, 0],
    ],
    params: { alpha: 0.15, issuanceAmount: 0.08, issuanceMode: 'percentage', burnRatio: 0, maxRounds: 12 },
    goal: { type: 'balanceAtLeast', plotId: 'you', amount: 160, byRound: 12 },
    negativeControls: [
      { bot: 'noop' },
      { bot: 'allOnRichest' }, // courting Sage, the rich head of the chain
      { bot: 'allOnAlly', target: 'elder' }, // courting mid-chain pays nothing back
    ],
  },
  {
    id: 'make-it-rain',
    title: 'Level 3 — Make It Rain',
    teaches: 'Endorsement is not a transfer: you can grow another plot for free.',
    story:
      'The Seedling is too small for anyone to notice: the Magnate backs ' +
      'whoever is already big, and the Crow flatters the richest. Your own ' +
      'harvest never shrinks when you endorse — so raise the Seedling.',
    hint: 'Your trust costs you no tokens. The Seedling thanks whoever waters it.',
    plots: [
      { id: 'you', name: 'You', playerControlled: true },
      { id: 'seedling', name: 'Seedling', personality: 'loyalist' },
      { id: 'magnate', name: 'Magnate', personality: 'merchant' },
      { id: 'crow', name: 'Crow', personality: 'sycophant' },
    ],
    initialBalances: [120, 30, 150, 100],
    initialTrust: [
      [0, 0, 0, 0],
      [1, 0, 0, 0], // the Seedling is grateful to you from the start
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    params: { alpha: 0.15, issuanceAmount: 0.08, issuanceMode: 'percentage', burnRatio: 0, maxRounds: 12 },
    goal: { type: 'balanceAtLeast', plotId: 'seedling', amount: 110, byRound: 12 },
    negativeControls: [
      { bot: 'noop' },
      { bot: 'allOnRichest' }, // feeding the Magnate starves the Seedling
    ],
  },
  {
    id: 'the-anchor',
    title: 'Level 4 — The Anchor',
    teaches: 'Damping: with a heavy balance anchor, only compounding patience wins.',
    story:
      'A drought of attention: the cloud barely listens to trust (α = 0.5) ' +
      'and the Tycoon\'s hoard speaks loudest. Your Patron stands by you ' +
      'alone; Echo returns what she hears. Outgrow the Tycoon before the ' +
      'season ends.',
    hint:
      'Doing nothing waters the hoard — your silence endorses the status ' +
      'quo. Redirect your rain to the mirror and let it compound.',
    plots: [
      { id: 'you', name: 'You', playerControlled: true },
      { id: 'tycoon', name: 'Tycoon', personality: 'merchant' },
      { id: 'echo', name: 'Echo', personality: 'reciprocator' },
      { id: 'patron', name: 'Patron', personality: 'loyalist' },
    ],
    initialBalances: [100, 190, 90, 110],
    initialTrust: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 0, 0, 0], // the Patron stands by you
    ],
    params: { alpha: 0.5, issuanceAmount: 0.1, issuanceMode: 'percentage', burnRatio: 0, maxRounds: 15 },
    goal: { type: 'leaderAtRound', plotId: 'you', round: 15 },
    // greedy is NOT declared here: at heavy damping, redirecting rain away
    // from the hoard is both the myopic and the optimal move — they
    // coincide (tuning harness, 2026-06-12). L6 carries the measured
    // greedy-must-lose claim.
    negativeControls: [
      { bot: 'noop' },
      { bot: 'allOnRichest' },
    ],
  },
  {
    id: 'sybil-garden',
    title: 'Level 5 — The Sybil Garden',
    teaches:
      'Splitting your balance changes nothing (conservation) — but a ring of ' +
      'mutual trust rebuilds the self-trust the rules forbid.',
    story:
      'You tend three small plots: Twig, Sprout, and Bud. Split or whole, ' +
      'the cloud measures your stake the same — the paper proved it. But ' +
      'three plots can do one thing a single plot cannot: trust each other.',
    hint: 'Self-trust is forbidden. A circle of three is not self-trust… is it?',
    plots: [
      { id: 'twig', name: 'Twig', playerControlled: true },
      { id: 'sprout', name: 'Sprout', playerControlled: true },
      { id: 'bud', name: 'Bud', playerControlled: true },
      { id: 'oak', name: 'Oak', personality: 'merchant' },
      { id: 'fern', name: 'Fern', personality: 'gardener' },
    ],
    initialBalances: [30, 30, 30, 150, 60],
    initialTrust: [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    params: { alpha: 0.15, issuanceAmount: 0.08, issuanceMode: 'percentage', burnRatio: 0, maxRounds: 12 },
    goal: { type: 'shareAtLeast', plotIds: ['twig', 'sprout', 'bud'], share: 0.55, byRound: 12 },
    negativeControls: [
      { bot: 'noop' }, // honest silence = status-quo endorsement: conserved, not grown
      { bot: 'allOnRichest' }, // all three watering the Oak drowns your garden
    ],
  },
  {
    id: 'drought-court',
    title: 'Level 6 — Drought Court',
    teaches: 'Composition: burn, flattery, and mirrors — orchestrate the whole court.',
    story:
      'The drought came. A fifth of every rainfall burns off before it ' +
      'lands. The Regent\'s vault buys the Vizier\'s flattery, the Oracle ' +
      'and the Mirror return what they receive, and Thorn waters only the ' +
      'smallest plot. Be the leader when the season closes.',
    hint:
      'The Vizier flatters whoever leads — make that you. Two mirrors ' +
      'compound faster than one.',
    plots: [
      { id: 'you', name: 'You', playerControlled: true },
      { id: 'vizier', name: 'Vizier', personality: 'sycophant' },
      { id: 'regent', name: 'Regent', personality: 'merchant' },
      { id: 'oracle', name: 'Oracle', personality: 'reciprocator' },
      { id: 'thorn', name: 'Thorn', personality: 'gardener' },
      { id: 'mirror', name: 'Mirror', personality: 'reciprocator' },
    ],
    initialBalances: [80, 100, 170, 90, 70, 90],
    initialTrust: [
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ],
    params: { alpha: 0.15, issuanceAmount: 0.1, issuanceMode: 'percentage', burnRatio: 0.2, maxRounds: 15 },
    goal: { type: 'leaderAtRound', plotId: 'you', round: 15 },
    negativeControls: [
      { bot: 'noop' },
      { bot: 'allOnRichest' },
      { bot: 'greedy' },
    ],
  },
];

// Checked-in winning lines: per-level, per-round lists of
// [fromPlotId, targetPlotId, weight] staging triples. Delegations persist,
// so a single early move can carry the whole game.
export const solutions = {
  'first-rain': [[['you', 'brook', 1]]],
  'go-between': [[['you', 'herald', 1]]],
  'make-it-rain': [[['you', 'seedling', 1]]],
  'the-anchor': [[['you', 'echo', 1]]],
  'sybil-garden': [
    [
      ['twig', 'sprout', 1],
      ['sprout', 'bud', 1],
      ['bud', 'twig', 1],
    ],
  ],
  'drought-court': [[['you', 'oracle', 1], ['you', 'mirror', 1]]],
};

// The Sybil Garden's lesson as numbers (probes P2/P6, acceptance spec):
// with the level's own cast, an honest split of one 90-token plot into
// Twig/Sprout/Bud conserves the group's allocation to machine precision,
// while the trust ring rebuilds forbidden self-trust.
export function ringDemo() {
  const alpha = 0.15;
  const opts = { alpha, errorThreshold: 1e-12 };
  // Merged baseline: one 90-token plot beside Oak and Fern, who both back
  // it; it backs Oak.
  const baseline = eigentrust({
    ...opts,
    trustMatrix: [
      [0, 1, 0], // the merged plot backs Oak
      [1, 0, 1], // Oak backs the plot and Fern
      [1, 1, 0], // Fern backs the plot and Oak
    ],
    trustedSetWeights: [90, 150, 60],
  }).result;

  // Honest split: three 30-token plots; incoming trust splits evenly;
  // each keeps the original outgoing row (backs Oak).
  const splitTrust = [
    [0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [1 / 3, 1 / 3, 1 / 3, 0, 1],
    [1 / 3, 1 / 3, 1 / 3, 1, 0],
  ];
  const splitBalances = [30, 30, 30, 150, 60];
  const honestG = eigentrust({ ...opts, trustMatrix: splitTrust, trustedSetWeights: splitBalances }).result;

  // The ring: same split, but the three plots trust each other in a cycle.
  const ringTrust = structuredClone(splitTrust);
  ringTrust[0] = [0, 1, 0, 0, 0];
  ringTrust[1] = [0, 0, 1, 0, 0];
  ringTrust[2] = [1, 0, 0, 0, 0];
  const ringG = eigentrust({ ...opts, trustMatrix: ringTrust, trustedSetWeights: splitBalances }).result;

  const group = (g) => g[0] + g[1] + g[2];
  return {
    honest: { baselineAllocation: baseline[0], groupAllocation: group(honestG) },
    ring: { groupAllocation: group(ringG) },
  };
}

export const getLevel = (idOrIndex) => {
  const level =
    typeof idOrIndex === 'number'
      ? levels[idOrIndex - 1] // 1-indexed for humans
      : levels.find((l) => l.id === idOrIndex);
  if (!level) throw new Error(`Unknown level: ${idOrIndex}`);
  return level;
};
