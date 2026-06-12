// AI personalities: pure trust-row policies over the public view (X5: they
// observe only the row-normalized committed matrix — never raw magnitudes).
// A policy returns the plot's new outgoing trust row: non-negative weights,
// zero diagonal. All deterministic. Descriptions are public information
// rendered by every view (X9).
//
// Phase 2 ships `loyalist` (the minimum for round resolution);
// Phase 3 adds the rest of the court.

export const personalities = {
  loyalist: {
    description: 'Keeps their trust exactly where it started, forever.',
    // Re-emitting the own normalized row preserves the initial ratios for
    // the whole game.
    policy: (view, selfIndex) => [...view.trust[selfIndex]],
  },
};

export function getPersonality(id) {
  const personality = personalities[id];
  if (!personality) throw new Error(`Unknown personality: ${id}`);
  return personality;
}
