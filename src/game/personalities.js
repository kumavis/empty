// AI personalities: pure trust-row policies over the public view (X5: they
// observe only the row-normalized committed matrix — never raw magnitudes).
// A policy returns the plot's new outgoing trust row: non-negative weights,
// zero diagonal. All deterministic. Descriptions are public information
// rendered by every view (X9).
//
// Phase 2 ships `loyalist` (the minimum for round resolution);
// Phase 3 adds the rest of the court.

// Picks the index of the best OTHER plot by `score`; ties go to the lowest
// index. Never self.
const bestOther = (view, selfIndex, score) => {
  let best = -1;
  view.plots.forEach((plot, j) => {
    if (j === selfIndex) return;
    if (best < 0 || score(plot) > score(view.plots[best])) best = j;
  });
  return best;
};

const oneHot = (n, target) => Array.from({ length: n }, (_, j) => (j === target ? 1 : 0));

export const personalities = {
  loyalist: {
    description: 'Keeps their trust exactly where it started, forever.',
    // Re-emitting the own normalized row preserves the initial ratios for
    // the whole game.
    policy: (view, selfIndex) => [...view.trust[selfIndex]],
  },
  reciprocator: {
    description: 'Returns trust in the proportions it received last round.',
    // Mirrors the normalized incoming column; with no incoming trust it
    // emits the zero row and the balance fallback applies (design §3.3).
    policy: (view, selfIndex) =>
      view.trust.map((row, j) => (j === selfIndex ? 0 : row[selfIndex])),
  },
  sycophant: {
    description: 'Flatters whoever holds the most tokens.',
    policy: (view, selfIndex) =>
      oneHot(view.plots.length, bestOther(view, selfIndex, (p) => p.balance)),
  },
  gardener: {
    description: 'Waters whichever plot is smallest.',
    policy: (view, selfIndex) =>
      oneHot(view.plots.length, bestOther(view, selfIndex, (p) => -p.balance)),
  },
  merchant: {
    description: 'Backs every plot in proportion to its holdings.',
    policy: (view, selfIndex) =>
      view.plots.map((plot, j) => (j === selfIndex ? 0 : plot.balance)),
  },
};

export function getPersonality(id) {
  const personality = personalities[id];
  if (!personality) throw new Error(`Unknown personality: ${id}`);
  return personality;
}
