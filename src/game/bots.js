// Canonical naive strategies (external critique X6). Levels declare which
// of these MUST lose; the suite enforces it. The greedy bot doubles as the
// measured check on "this level is not solvable by one-round lookahead".
//
// A bot is a function (gameState) -> moves, where moves is a list of
// [fromPlotId, targetPlotId, weight] staging triples for this round.

import { getView, forecast, stageTrust, createGame, endRound } from './game.js';

const controlledIndices = (state) =>
  state.plots.map((p, i) => (p.playerControlled ? i : -1)).filter((i) => i >= 0);

const otherIds = (state, self) =>
  state.plots.filter((_, j) => j !== self).map((p) => p.id);

// Stage a full one-hot row: all weight on `target`, everything else cleared.
// (Player rows persist between rounds, so clearing matters.)
const oneHotMoves = (state, self, target) =>
  otherIds(state, self).map((id) => [state.plots[self].id, id, id === target ? 1 : 0]);

export function noopBot() {
  return [];
}

export function allOnRichestBot(state) {
  const view = getView(state);
  return controlledIndices(state).flatMap((self) => {
    let best = -1;
    view.plots.forEach((p, j) => {
      if (j === self) return;
      if (best < 0 || p.balance > view.plots[best].balance) best = j;
    });
    return oneHotMoves(state, self, view.plots[best].id);
  });
}

export const allOnAllyBot = (targetId) => (state) =>
  controlledIndices(state).flatMap((self) =>
    state.plots[self].id === targetId ? [] : oneHotMoves(state, self, targetId),
  );

// Goal progress after one round, per goal type — what a myopic player
// would maximize.
function goalMetric(state, predicted) {
  const { goal } = state;
  const index = (id) => state.plots.findIndex((p) => p.id === id);
  switch (goal.type) {
    case 'balanceAtLeast':
      return predicted.balances[index(goal.plotId)];
    case 'shareAtLeast': {
      const supply = predicted.balances.reduce((a, b) => a + b, 0);
      const ids = goal.plotIds ?? [goal.plotId];
      return ids.reduce((s, id) => s + predicted.balances[index(id)], 0) / supply;
    }
    case 'leaderAtRound': {
      const i = index(goal.plotId);
      const maxOther = Math.max(...predicted.balances.filter((_, j) => j !== i));
      return predicted.balances[i] - maxOther;
    }
    default:
      throw new Error(`Unknown goal type: ${goal.type}`);
  }
}

// One-round-lookahead optimizer: per controlled plot (in order), try keeping
// the current row or going one-hot on each other plot; keep whatever
// maximizes the goal metric under forecast(). Deterministic.
export function greedyBot(state) {
  let working = state;
  const chosen = [];
  for (const self of controlledIndices(state)) {
    let bestMoves = []; // keep current row
    let bestScore = goalMetric(working, forecast(working));
    for (const target of otherIds(working, self)) {
      const moves = oneHotMoves(working, self, target);
      let trial = working;
      for (const [from, to, w] of moves) trial = stageTrust(trial, from, to, w);
      const score = goalMetric(trial, forecast(trial));
      if (score > bestScore) {
        bestScore = score;
        bestMoves = moves;
      }
    }
    for (const [from, to, w] of bestMoves) working = stageTrust(working, from, to, w);
    chosen.push(...bestMoves);
  }
  return chosen;
}

export const bots = {
  noop: () => noopBot,
  allOnRichest: () => allOnRichestBot,
  allOnAlly: (target) => allOnAllyBot(target),
  greedy: () => greedyBot,
};

// Drive a level with a bot until the game ends; returns the final state.
export function runBot(level, bot) {
  let game = createGame(level);
  while (game.status === 'playing') {
    for (const [from, to, w] of bot(game)) game = stageTrust(game, from, to, w);
    ({ state: game } = endRound(game));
  }
  return game;
}

// Drive a level with a per-round move script (rounds beyond the script's
// length stage nothing — delegations persist). Returns the final state.
export function runScript(level, moveRounds) {
  let game = createGame(level);
  for (let r = 0; game.status === 'playing'; r++) {
    for (const [from, to, w] of moveRounds[r] ?? []) game = stageTrust(game, from, to, w);
    ({ state: game } = endRound(game));
  }
  return game;
}
