// Shared game fixtures, including the executable X8 goal edge-semantics
// checks consumed by both the test suite and the acceptance spec.

import { createGame, stageTrust, endRound } from '../src/game/game.js';

// Minimal 3-plot level: you, and two loyalists who admire each other.
export const testLevel = {
  id: 'fixture-3plot',
  title: 'Fixture',
  story: 'A tiny garden for tests.',
  plots: [
    { id: 'you', name: 'You', playerControlled: true },
    { id: 'brook', name: 'Brook', personality: 'loyalist' },
    { id: 'elder', name: 'Elder', personality: 'loyalist' },
  ],
  initialBalances: [100, 100, 100],
  initialTrust: [
    [0, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ],
  params: {
    alpha: 0.15,
    issuanceAmount: 0.1,
    issuanceMode: 'percentage',
    burnRatio: 0,
    maxRounds: 5,
  },
  goal: { type: 'balanceAtLeast', plotId: 'you', amount: 105, byRound: 5 },
};

const playRounds = (game, rounds) => {
  for (let i = 0; i < rounds && game.status === 'playing'; i++) {
    ({ state: game } = endRound(game));
  }
  return game;
};

// X8: win is checked before loss — a goal met exactly on the final round is
// a win. The threshold is derived from a dry run so the check is robust.
export function goalMetOnFinalRoundWins() {
  const dry = playRounds(createGame(testLevel), 2);
  const reachableByRound2 = dry.balances[0];
  const level = structuredClone(testLevel);
  level.goal = {
    type: 'balanceAtLeast',
    plotId: 'you',
    amount: reachableByRound2, // >= holds exactly at the end of round 2
    byRound: 2,
  };
  level.params.maxRounds = 2;
  const afterRound1 = endRound(createGame(level)).state;
  if (afterRound1.status !== 'playing') return `unexpected: ${afterRound1.status} at round 1`;
  return endRound(afterRound1).state.status;
}

// X8: byRound N means "by the END of round N" — a goal reachable during
// round 1 is won when round 1 resolves, not rejected at its start.
export function byRoundMeansEndOfRound() {
  const dry = endRound(createGame(testLevel)).state;
  const level = structuredClone(testLevel);
  level.goal = {
    type: 'balanceAtLeast',
    plotId: 'you',
    amount: dry.balances[0],
    byRound: 1,
  };
  level.params.maxRounds = 1;
  return endRound(createGame(level)).state.status;
}

// X8: leadership must be strict. Ash and Birch are exactly symmetric, so
// their balances tie forever and `leaderAtRound` for Ash must report lost.
export function tieIsNotLeadership() {
  const level = {
    id: 'fixture-tie',
    title: 'Tie',
    story: '',
    plots: [
      { id: 'you', name: 'You', playerControlled: true },
      { id: 'ash', name: 'Ash', personality: 'loyalist' },
      { id: 'birch', name: 'Birch', personality: 'loyalist' },
    ],
    initialBalances: [100, 100, 100],
    initialTrust: [
      [0, 1, 1], // you feed the symmetry
      [0, 0, 1],
      [0, 1, 0],
    ],
    params: { alpha: 0.15, issuanceAmount: 10, issuanceMode: 'fixed', burnRatio: 0, maxRounds: 1 },
    goal: { type: 'leaderAtRound', plotId: 'ash', round: 1 },
  };
  return endRound(createGame(level)).state.status;
}

export { playRounds };
