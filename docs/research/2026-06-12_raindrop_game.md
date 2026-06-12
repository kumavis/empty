# Research: Raindrop as the core mechanic of a game

Stage 1 output. Sources, mechanism math, reference-implementation semantics,
and a survey of game-design approaches. This document is the institutional
memory for the Raindrop Game track.

## 1. Sources

| Source | Status | What it provided |
|--------|--------|------------------|
| [Raindrop paper](https://kumavis.github.io/raindrop-paper/paper.md) (Phong Landau) | fetched in full | The mechanism specification (§2 below) |
| [raindrop-viz](https://github.com/kumavis/raindrop-viz) | repo private (404); **live Pages deployment** at kumavis.github.io/raindrop-viz | Reference implementation extracted from the production JS bundle (§3 below) |
| [raindrop-zk](https://github.com/kumavis/raindrop-zk) | repo private (404), no public Pages artifact | Unavailable. Presumed: zero-knowledge proof of the issuance computation (relevant to the paper's note that the *calculator* of a distribution can skew it within the convergence threshold). Not load-bearing for a game. |
| [EigenTrust paper](https://nlp.stanford.edu/pubs/eigentrust.pdf) (Kamvar, Schlosser, Garcia-Molina 2003) | cited by the paper | The trust-propagation algorithm |

## 2. The Raindrop mechanism (from the paper)

Raindrop continuously allocates new token issuance according to a
token-weighted trust network. Per-account state: a **token balance** and a
vector of **outgoing trust weights** over other accounts. Each issuance round:

1. Compute the **balance vector** `b` of relative token balances
   (`b_i = balance_i / Σ balances`).
2. Encode trust delegations as a **row-stochastic trust matrix** `T`
   (row *i* = account *i*'s outgoing trust weights, normalized).
3. Compute the **allocation vector** `g = EigenTrust(T, b, α)` — blends
   balance-proportional influence with transitive endorsement.
4. **Mint** `ΔS` tokens (fixed amount or fraction of supply) and distribute
   to accounts in proportion to `g`. Optionally burn a fraction.

Between rounds, accounts may update trust weights or transfer tokens; changes
take effect next round.

Key properties claimed:

- **Sybil resistance** — influence is anchored to balances; splitting a
  balance across identities does not increase aggregate issuance influence.
- **Real-time adaptability** — no "snapshot problem"; trust updates
  immediately affect subsequent rounds.
- **Endorsement without asset transfer** — trust redirects *future* issuance,
  not existing balances (cites the endowment effect, Kahneman et al. 1991).

Parameters: initial distribution (must be non-zero), issuance rate, issuance
cadence, damping factor `α ∈ (0,1)`, convergence threshold.

## 3. Reference implementation (extracted from the raindrop-viz bundle)

The deployed bundle (`assets/index-BHZePsPU.js`) contains a clean EigenTrust
+ simulation core. Recovered semantics (variable names mine):

```
eigentrust({trustMatrix, trustedSetWeights, alpha = 0.15,
            errorThreshold = 1e-6, maxIterations = 1000, getDefaultsForRow}):
  p  = normalize(trustedSetWeights)            # pre-trusted vector = balances
  T  = rowNormalize(trustMatrix,               # rows summing to 0 fall back
         zeroRow -> getDefaultsForRow(row, p)  #   to p by default
       )
  t  = p
  repeat until ‖t' − t‖₂ ≤ errorThreshold or maxIterations:
    t' = (1−α)·Tᵀ·t + α·p
  return t'
```

```
simulate({trustMatrix, initialBalances, alpha, issuanceAmount = 10,
          issuanceMode = "fixed" | "percentage", rounds, burnRatio = 0}):
  for each round:
    g = eigentrust(T, balances, alpha)
    minted      = (mode == "percentage") ? totalSupply × amount : amount
    distributed = minted × (1 − burnRatio)
    balances_i += g_i × distributed
    totalSupply += distributed
```

Notable choices in the reference implementation:

- **α weights the balance anchor** (`α·p`), `(1−α)` weights propagated trust.
  Default `α = 0.15` → trust propagation dominates; matches EigenTrust's
  `t = (1−a)·Cᵀt + a·p` formulation.
- **Zero-row fallback**: an account delegating no trust implicitly delegates
  per the balance vector (alternatives offered in the UI: uniform/PageRank,
  self-trust).
- Iteration is a plain power method; convergence by L2 distance; warns (does
  not throw) on non-convergence.
- Burn reduces the *distributed* amount, so balances only ever grow.

This is the semantics our engine will mirror — it is the closest thing to a
normative implementation of the paper.

## 4. Survey: making an allocation mechanism the *core* of a game

Five approaches considered (essential mechanic in **bold**):

1. **Negotiation / betrayal strategy** (Diplomacy, Neptune's Pride):
   **directed trust with payoff consequences** is the whole game; alliances
   are profitable until defection. Raindrop fits naturally — trust weights
   are public, persistent, and revocable. Multiplayer-shaped; needs AI or
   humans on the other side.
2. **Economic engine-building / shareholding** (Acquire, Imperial, 18xx):
   **balance-anchored influence** ≈ share ownership; issuance ≈ dividends.
   Validates the "rich anchor, trust redirects" tension as a known-fun loop.
3. **Incremental / flow-optimization** (idle games, factory games):
   **continuous issuance** as a flow to be steered. Low interaction depth;
   risks reducing trust to a static routing puzzle.
4. **Puzzle campaign over network dynamics** (Zachtronics-style level
   design): each level is a small trust network with a goal; **one mechanism
   property per level** (transitivity, balance anchoring, Sybil
   conservation, damping). Strong fit for a single-player, deterministic,
   testable game that *teaches* the mechanism.
5. **God-game / garden sim theming** (Reus, Viva Piñata): rain falls on
   plots; trust = irrigation channels. Pure theming layer — composable with
   any of the above.

**Chosen direction (to be confirmed in Stage 3): 4 + 5 + a dose of 1** — a
deterministic single-player puzzle-strategy campaign against AI characters
with legible trust personalities, themed as gardens competing for rain.
Rationale: single-player is shippable and fully testable without netcode;
deterministic AI personalities make levels into puzzles while still feeling
social (read the table, court the right allies); the campaign structure
doubles as a guided tour of the mechanism's actual properties — the game
*is* the paper's pedagogy.

Essential vs accidental (what the game must keep vs may drop):

- **Essential**: balance-anchored influence; trust redirects *future*
  issuance; transitive propagation (trusting a truster helps you); Sybil
  conservation; row normalization (only *relative* trust matters); damping.
- **Accidental**: blockchain/signatures, wall-clock cadence (game rounds
  replace it), token tradability (no external market in-game), burn
  (optional spice), convergence-threshold manipulation (the zk concern).

## 5. Named theory

- **EigenTrust** (Kamvar et al. 2003) — trust propagation as the stationary
  distribution of a damped Markov chain; the personalization vector here is
  the balance vector.
- **PageRank with personalization** — same fixed-point structure
  (Perron–Frobenius guarantees existence/uniqueness for α > 0).
- **Endowment effect** (Kahneman, Knetsch, Thaler 1991) — why endorsement
  without transfer is behaviorally cheap; in game terms: trust is a free
  action, which is exactly why it's an interesting one.

## 6. Vocabulary (binding for later stages)

| Term | Meaning |
|------|---------|
| round | one issuance cycle (trust updates → allocation → mint → distribute) |
| balance vector `b` | normalized token balances; the pre-trusted vector |
| trust matrix `T` | row-stochastic outgoing trust weights |
| allocation vector `g` | EigenTrust output; sums to 1 |
| damping `α` | weight of the balance anchor vs propagated trust |
| issuance `ΔS` | tokens minted per round (fixed or % of supply) |
| zero-row fallback | trust row for accounts that delegate nothing (default: `b`) |
| burn ratio | fraction of `ΔS` destroyed before distribution |

## 7. Bibliography

1. Landau, P. *Raindrop: Continuous token issuance via delegated trust
   propagation.* https://kumavis.github.io/raindrop-paper/paper.md
2. Kamvar, S. D., Schlosser, M. T., Garcia-Molina, H. (2003). *The EigenTrust
   algorithm for reputation management in P2P networks.* WWW '03.
3. Kahneman, D., Knetsch, J. L., Thaler, R. H. (1991). *Anomalies: The
   endowment effect, loss aversion, and status quo bias.* JEP 5(1).
