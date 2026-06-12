// Game core: rules around the raindrop mechanism, nothing more.
// State is plain JSON-serializable data; every transition is a pure
// function returning new state (the Web Worker boundary and replay
// determinism both depend on this).
//
// The round pipeline reads as the paper does: commit trust rows →
// row-normalize → eigentrust → mint → distribute → evaluate goal.

import { issuanceRound, rowNormalize, normalize } from '../raindrop.js';
import { getPersonality } from './personalities.js';

// Game rule (external critique X3): an account that delegates nothing
// endorses the status quo — the balance vector — but never itself: the
// diagonal entry is zeroed and the row renormalized.
export function balanceFallbackRow(selfIndex, pretrusted) {
  const row = pretrusted.map((p, j) => (j === selfIndex ? 0 : p));
  const total = row.reduce((sum, p) => sum + p, 0);
  if (total <= 0) {
    throw new Error('Balance fallback undefined: no other plot holds tokens.');
  }
  return row.map((p) => p / total);
}

const GOAL_TYPES = new Set(['balanceAtLeast', 'shareAtLeast', 'leaderAtRound']);

export function validateLevel(level) {
  const { plots, initialBalances, initialTrust, params, goal } = level;
  const n = plots?.length ?? 0;
  if (n < 2) throw new Error('Level needs at least 2 plots.');
  if (new Set(plots.map((p) => p.id)).size !== n) throw new Error('Plot ids must be unique.');
  if (!plots.some((p) => p.playerControlled)) throw new Error('Level needs a player plot.');
  for (const plot of plots) {
    if (!plot.playerControlled) getPersonality(plot.personality);
  }
  if (initialBalances.length !== n || initialBalances.some((b) => !(b > 0))) {
    throw new Error('Initial balances must be positive for every plot (paper §6).');
  }
  if (initialTrust.length !== n || initialTrust.some((row) => row.length !== n)) {
    throw new Error('Initial trust must be an n×n matrix.');
  }
  initialTrust.forEach((row, i) => {
    if (row.some((w) => !(w >= 0))) throw new Error(`Trust row ${i} has a negative weight.`);
    if (row[i] !== 0) throw new Error(`Trust row ${i} has self-trust (game rule: diagonal is zero).`);
  });
  if (!(params.alpha > 0 && params.alpha < 1)) throw new Error('alpha must be in (0,1).');
  if (!(params.burnRatio >= 0 && params.burnRatio < 1)) throw new Error('burnRatio must be in [0,1).');
  if (!(params.issuanceAmount > 0)) throw new Error('issuanceAmount must be positive.');
  if (!Number.isInteger(params.maxRounds) || params.maxRounds < 1) {
    throw new Error('maxRounds must be a positive integer.');
  }
  if (params.issuanceMode !== 'fixed' && params.issuanceMode !== 'percentage') {
    throw new Error('issuanceMode must be "fixed" or "percentage".');
  }
  if (!GOAL_TYPES.has(goal.type)) throw new Error(`Unknown goal type: ${goal.type}`);
  const horizon = goal.type === 'leaderAtRound' ? goal.round : goal.byRound;
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > params.maxRounds) {
    throw new Error('Goal horizon must be a round within the level round budget.');
  }
  const goalPlots = goal.plotIds ?? [goal.plotId];
  for (const id of goalPlots) {
    if (!plots.some((p) => p.id === id)) throw new Error(`Goal references unknown plot: ${id}`);
  }
  return level;
}

export function createGame(level) {
  validateLevel(level);
  return {
    levelId: level.id,
    round: 0,
    status: 'playing',
    plots: level.plots.map((plot) => ({
      id: plot.id,
      name: plot.name ?? plot.id,
      personality: plot.playerControlled ? 'player' : plot.personality,
      playerControlled: Boolean(plot.playerControlled),
    })),
    balances: [...level.initialBalances],
    totalSupply: level.initialBalances.reduce((sum, b) => sum + b, 0),
    trust: level.initialTrust.map((row) => [...row]),
    staged: level.initialTrust.map((row) => [...row]),
    params: { ...level.params },
    goal: structuredClone(level.goal),
    history: [],
  };
}

const plotIndex = (state, plotId) => {
  const index = state.plots.findIndex((p) => p.id === plotId);
  if (index < 0) throw new Error(`Unknown plot: ${plotId}`);
  return index;
};

const assertPlaying = (state) => {
  if (state.status !== 'playing') throw new Error(`Game is not playing (status: ${state.status}).`);
};

// Player intent: edit one weight of an owned plot's persistent trust row.
export function stageTrust(state, plotId, targetId, weight) {
  assertPlaying(state);
  const from = plotIndex(state, plotId);
  if (!state.plots[from].playerControlled) {
    throw new Error(`Plot ${plotId} is not player-controlled.`);
  }
  const to = plotIndex(state, targetId);
  if (from === to) throw new Error('Self-trust is not allowed (game rule).');
  if (!Number.isFinite(weight) || weight < 0) {
    throw new Error(`Trust weight must be a non-negative number, got a negative or non-finite value.`);
  }
  const next = structuredClone(state);
  next.staged[from][to] = weight;
  return next;
}

// The public view: everything any participant (player, AI policy, UI) may
// observe. Only normalized trust appears (X5); personalities are open
// information (X9).
export function getView(state) {
  const pretrusted = normalize(state.balances);
  const fallback = (i) => balanceFallbackRow(i, pretrusted);
  const last = state.history[state.history.length - 1] ?? null;
  return {
    levelId: state.levelId,
    round: state.round,
    status: state.status,
    maxRounds: state.params.maxRounds,
    totalSupply: state.totalSupply,
    goal: structuredClone(state.goal),
    trust: rowNormalize(state.trust, fallback),
    plots: state.plots.map((plot, i) => ({
      id: plot.id,
      name: plot.name,
      personality: plot.personality,
      description: plot.playerControlled
        ? 'You. Every raindrop counts.'
        : getPersonality(plot.personality).description,
      playerControlled: plot.playerControlled,
      balance: state.balances[i],
      share: pretrusted[i],
      lastAllocation: last ? last.allocation[i] : null,
    })),
    lastReport: last,
  };
}

// Single computation path for "what does ending the round produce" (X4):
// forecast() and endRound() both call this.
function resolveRound(state) {
  const view = getView(state);
  const committed = state.plots.map((plot, i) => {
    if (plot.playerControlled) return [...state.staged[i]];
    return getPersonality(plot.personality).policy(view, i);
  });
  const pretrusted = normalize(state.balances);
  const result = issuanceRound({
    balances: state.balances,
    totalSupply: state.totalSupply,
    trustMatrix: committed,
    alpha: state.params.alpha,
    issuanceAmount: state.params.issuanceAmount,
    issuanceMode: state.params.issuanceMode,
    burnRatio: state.params.burnRatio,
    getDefaultsForRow: (i) => balanceFallbackRow(i, pretrusted),
  });
  if (!result.converged) {
    // With alpha >= 0.05 the update is a (1-alpha)-contraction; reaching
    // this is a bug in level data or engine, never a gameplay event (X7).
    throw new Error('EigenTrust did not converge — invalid level or engine bug.');
  }
  return { committed, result };
}

// Goal edge semantics (X8): evaluated once per round after distribution;
// win checked before loss; byRound N = "by the end of round N" (1-indexed);
// leadership must be strict — a tie is not leadership.
function evaluateGoal(goal, state) {
  const share = (i) => state.balances[i] / state.totalSupply;
  switch (goal.type) {
    case 'balanceAtLeast': {
      const i = plotIndex(state, goal.plotId);
      if (state.balances[i] >= goal.amount) return 'won';
      return state.round >= goal.byRound ? 'lost' : 'playing';
    }
    case 'shareAtLeast': {
      const ids = goal.plotIds ?? [goal.plotId];
      const total = ids.reduce((sum, id) => sum + share(plotIndex(state, id)), 0);
      if (total >= goal.share) return 'won';
      return state.round >= goal.byRound ? 'lost' : 'playing';
    }
    case 'leaderAtRound': {
      if (state.round < goal.round) return 'playing';
      const i = plotIndex(state, goal.plotId);
      const lead = state.balances.every((b, j) => j === i || state.balances[i] > b);
      return lead ? 'won' : 'lost';
    }
    default:
      throw new Error(`Unknown goal type: ${goal.type}`);
  }
}

// Preview of the full round pipeline — AI policies included — without
// committing anything (X4).
export function forecast(state) {
  assertPlaying(state);
  const { result } = resolveRound(state);
  return {
    allocation: result.allocation,
    balances: result.balances,
    minted: result.minted,
    distributed: result.distributed,
    burned: result.burned,
  };
}

export function endRound(state) {
  assertPlaying(state);
  const { committed, result } = resolveRound(state);
  const next = structuredClone(state);
  next.round = state.round + 1;
  next.trust = committed.map((row) => [...row]);
  next.staged = committed.map((row) => [...row]);
  next.balances = result.balances;
  next.totalSupply = result.totalSupply;
  const report = {
    round: next.round,
    allocation: result.allocation,
    minted: result.minted,
    distributed: result.distributed,
    burned: result.burned,
    balances: result.balances,
  };
  next.history = [...state.history, report];
  next.status = evaluateGoal(next.goal, next);
  if (next.status === 'playing' && next.round >= next.params.maxRounds) {
    next.status = 'lost'; // round budget exhausted (design §3.2 step 4)
  }
  return { state: next, report };
}
