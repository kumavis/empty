// The raindrop mechanism: continuous token issuance allocated by EigenTrust
// over a token-weighted trust network.
//
//   g = EigenTrust(T, b, α)   with update   t ← (1−α)·Tᵀ·t + α·b
//
// Semantics mirror the reference implementation (test/oracle/) exactly —
// operation order included, so parity tests can assert bit-equality.
// Documented deviations from the oracle's defaults (design §3.1):
//   - errorThreshold defaults to 1e-9 (oracle: 1e-6) — probe P3 showed the
//     tighter threshold costs ~40 extra iterations at game sizes.
//   - non-convergence sets `converged: false` instead of console.warn.
// This module is pure mechanism: no game concepts, no game imports.

export function normalize(weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    throw new Error('Total weight of trusted set must be greater than 0.');
  }
  return weights.map((w) => w / total);
}

// Row-normalize a non-negative matrix; rows summing to zero are replaced by
// getDefaultRow(rowIndex).
export function rowNormalize(matrix, getDefaultRow) {
  return matrix.map((row, i) => {
    const total = row.reduce((sum, w) => sum + w, 0);
    return total > 0 ? row.map((w) => w / total) : getDefaultRow(i);
  });
}

export function transpose(matrix) {
  return matrix[0].map((_, col) => matrix.map((row) => row[col]));
}

export function matVec(matrix, vector) {
  return matrix.map((row) => row.reduce((acc, w, j) => acc + w * vector[j], 0));
}

export function l2Distance(a, b) {
  return Math.sqrt(a.reduce((acc, x, i) => acc + Math.pow(x - b[i], 2), 0));
}

export function eigentrust({
  trustMatrix,
  trustedSetWeights,
  alpha = 0.15,
  initialState,
  errorThreshold = 1e-9,
  maxIterations = 1000,
  getDefaultsForRow,
}) {
  const size = trustMatrix.length;
  if (trustedSetWeights.length !== size) {
    throw new Error('Length of trustedSetWeights must match the number of peers in the network.');
  }
  const pretrusted = normalize(trustedSetWeights);
  const defaults = getDefaultsForRow || (() => pretrusted);
  const stochastic = rowNormalize(trustMatrix, (i) => defaults(i, pretrusted));

  let current = initialState ? [...initialState] : [...pretrusted];
  let previous = [...current];
  const steps = [current];
  const transposed = transpose(stochastic);

  let delta = Infinity;
  let iterations = 0;
  while (delta > errorThreshold && iterations < maxIterations) {
    current = matVec(transposed, previous).map(
      (propagated, i) => (1 - alpha) * propagated + alpha * pretrusted[i],
    );
    delta = l2Distance(current, previous);
    previous = [...current];
    steps.push(current);
    iterations++;
  }

  return { result: current, steps, iterations, converged: delta <= errorThreshold };
}

// One raindrop issuance round: compute the allocation vector, mint, burn,
// distribute. Pure — returns new arrays, never mutates inputs.
// `totalSupply` is threaded as state (matching the reference simulation's
// accumulator) rather than recomputed from balances, so long simulations
// stay float-faithful to the oracle.
export function issuanceRound({
  balances,
  totalSupply = balances.reduce((sum, b) => sum + b, 0),
  trustMatrix,
  alpha = 0.15,
  issuanceAmount,
  issuanceMode = 'fixed',
  burnRatio = 0,
  errorThreshold,
  maxIterations,
  getDefaultsForRow,
}) {
  if (burnRatio < 0 || burnRatio > 1) {
    throw new Error('Burn ratio must be between 0 and 1');
  }
  const { result: allocation, iterations, converged } = eigentrust({
    trustMatrix,
    trustedSetWeights: balances,
    alpha,
    ...(errorThreshold !== undefined && { errorThreshold }),
    ...(maxIterations !== undefined && { maxIterations }),
    getDefaultsForRow,
  });

  const minted = issuanceMode === 'percentage' ? totalSupply * issuanceAmount : issuanceAmount;
  const distributed = minted * (1 - burnRatio);
  const burned = minted - distributed;

  return {
    allocation,
    minted,
    distributed,
    burned,
    balances: balances.map((b, i) => b + allocation[i] * distributed),
    totalSupply: totalSupply + distributed,
    iterations,
    converged,
  };
}
