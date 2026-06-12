// The simulation worker (user requirement, 2026-06-12): owns the live
// GameState and runs ALL simulation off the main thread. The page talks to
// it exclusively via postMessage; the protocol core is a pure function so
// node can test it without a browser.
//
// Protocol (request -> response):
//   { type: 'loadLevel', ref }                   -> state snapshot
//   { type: 'stageTrust', from, target, weight } -> state snapshot
//   { type: 'forecast' }                         -> { type: 'forecast', ... }
//   { type: 'endRound' }                         -> state snapshot (+ report)
// Any failure -> { type: 'error', message }

import { createGame, stageTrust, endRound, getView, forecast } from '../src/game/game.js';
import { levels, getLevel } from '../src/game/levels.js';

function goalText(goal, plots) {
  const name = (id) => plots.find((p) => p.id === id)?.name ?? id;
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  switch (goal.type) {
    case 'balanceAtLeast':
      return `Grow ${name(goal.plotId)} to ${goal.amount} tokens by the end of round ${goal.byRound}.`;
    case 'shareAtLeast': {
      const ids = goal.plotIds ?? [goal.plotId];
      return `Hold ${pct(goal.share)} of all tokens across ${ids.map(name).join(', ')} by the end of round ${goal.byRound}.`;
    }
    case 'leaderAtRound':
      return `Be the strict leader in tokens at the end of round ${goal.round}.`;
    default:
      return '';
  }
}

export function createSession() {
  let level = null;
  let state = null;

  const snapshot = (extra = {}) => {
    const view = getView(state);
    return {
      type: 'state',
      view,
      goalText: goalText(view.goal, view.plots),
      // The player's own raw staged rows (their private units) for controls.
      staged: state.plots.map((p, i) => (p.playerControlled ? [...state.staged[i]] : null)),
      level: {
        id: level.id,
        title: level.title,
        story: level.story,
        hint: level.hint,
        teaches: level.teaches,
        index: levels.indexOf(level) + 1,
        count: levels.length,
      },
      levels: levels.map((l, i) => ({ id: l.id, title: l.title, index: i + 1 })),
      ...extra,
    };
  };

  return {
    handle(message) {
      try {
        switch (message.type) {
          case 'loadLevel':
            level = getLevel(message.ref);
            state = createGame(level);
            return snapshot();
          case 'stageTrust':
            state = stageTrust(state, message.from, message.target, message.weight);
            return snapshot();
          case 'forecast':
            return { type: 'forecast', ...forecast(state) };
          case 'endRound': {
            const { state: next, report } = endRound(state);
            state = next;
            return snapshot({ report });
          }
          default:
            return { type: 'error', message: `Unknown message type: ${message.type}` };
        }
      } catch (err) {
        return { type: 'error', message: err.message };
      }
    },
  };
}

// Bind to the worker scope only when actually running inside a Web Worker;
// importing this module in node (tests) stays side-effect free.
if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof window === 'undefined') {
  const session = createSession();
  self.onmessage = (event) => self.postMessage(session.handle(event.data));
}
