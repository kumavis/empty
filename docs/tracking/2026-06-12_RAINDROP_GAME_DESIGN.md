# Track Design: Raindrop Game — "a game of trust and rain"

Stage 3 design document (D.3 — probe findings folded in at D.2; external
critique round X1–X9 folded in at D.3; see the linked critique docs for the
full findings and responses).

**Thesis**: the raindrop mechanism is already a game — balances anchor
influence, trust redirects future rain, propagation rewards courting the
right allies. This track ships a deterministic single-player puzzle-strategy
campaign in which every level is a small raindrop network and every victory
is a demonstrated property of the mechanism.

Linked documents: [research](../research/2026-06-12_raindrop_game.md) ·
[audit](2026-06-12_RAINDROP_GAME_AUDIT.md) ·
[self-critique](2026-06-12_RAINDROP_GAME_SELF_CRITIQUE.md) ·
[external critique](2026-06-12_RAINDROP_GAME_EXTERNAL_CRITIQUE.md)

## Progress Tracker

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 0 | Scaffolding + acceptance spec + parity skeleton | ✅ done | 358127c (scaffolding), Phase 0 commit; spec baseline green, parity suite skipped pending Phase 1 |
| 1 | Engine: `eigentrust` + `issuanceRound` (+ parity, property tests) | ✅ done | bit-exact parity with oracle (results AND iteration counts); 11 tests green; acceptance Phase 1 section active |
| 2 | Game core: state, staging, round resolution, goals | ✅ done | X3/X4/X5/X8/X9 + S2/S3 tested; 21 tests green; X5's "AI responses scale-invariant" half completes in Phase 3 (only loyalist exists yet) |
| 3 | AI personalities | ✅ done | 5 policies, all view-pure; X5 completed with a reactive-AI scale test; 28 tests green |
| 4 | Campaign levels + solvability tests | ✅ done | 6 levels tuned via harness; all solutions win, all declared controls lose; greedy measured (wins tutorial, loses finale); L4 finding: at α=0.5 the myopic and optimal moves coincide — greedy claim moved to L6 |
| 5 | CLI (interactive + scripted) | ✅ done | scripted victories L1 + L5 (plot:target syntax), honest losses, error recovery, X9 rendering; 62 tests green |
| 6 | Web UI (static ESM page) | ⬜ not started | |
| 7 | Capstone demo, README/CLAUDE.md, cleanup, PIR | ⬜ not started | |

## 1. Problem statement

Implement raindrop (continuous token issuance via delegated trust, aggregated
by EigenTrust) as the **core mechanic** of a game — not as a backdrop or
flavor. "Core mechanic" is testable: remove the issuance round and no level
is winnable; every level goal is a predicate over the balance trajectory the
mechanism produces.

## 2. Probe findings (design input — run against the oracle, see `scripts/probes/`)

All numbers from `scripts/probes/2026-06-12_design_probes.mjs` executed
against the verbatim raindrop-viz implementation (`test/oracle/`):

- **P1 (α sensitivity)**: with 5 equal accounts, one account shifting all its
  trust multiplies the target's allocation ×1.53 at α=0.15, ×1.11 at α=0.85.
  → α is the *difficulty knob*: low α = responsive trust politics, high α =
  sticky plutocracy. Default **α = 0.15** (paper/viz default, good lever
  feel); one level deliberately raises it.
- **P2 (Sybil conservation)**: honest balance splitting conserves group
  allocation to machine precision (Δ = −1.67e−16). The paper's claim holds
  exactly. But a sybil **ring** (split + mutual trust loop) lifted group
  allocation 0.256 → 0.758.
- **P6 (ring = self-trust)**: the ring's group allocation **equals** a single
  self-trusting account's allocation at every α tested (0.7577 @ 0.15,
  0.6062 @ 0.3, 0.4750 @ 0.5). The "attack" is not a sybil advantage — it is
  self-trust reconstructed by proxy, and damping caps it. → Game rule: **no
  self-trust** (classic EigenTrust `c_ii = 0`); the late-game Sybil Garden
  level teaches both the conservation result and the ring caveat honestly.
- **P3 (convergence cost)**: ≤ 113 iterations at threshold 1e−9 for n ≤ 12.
  Cost trivial → engine default **errorThreshold = 1e-9**, maxIterations
  1000 (tighter than viz's 1e−6; reduces the "calculator can skew within the
  threshold" concern the paper notes, and makes test assertions sharper).
- **P4 (zero-row fallback)**: a "delegate nothing" account reaches 35.1%
  share under self-trust fallback vs 26.0% under balance-vector fallback.
  Self-trust fallback would make silence a dominant strategy and contradict
  the no-self-trust rule. → fallback based on the balance vector. *Revised
  by external critique X3*: the raw balance vector's diagonal entry is
  itself self-trust (a silence subsidy growing with wealth — 42.7% vs 34.2%
  retained share for a 50%-holder, critic's probe). **Game fallback = balance
  vector with diagonal zeroed and renormalized**; the engine keeps the
  oracle's raw contract for parity and the game supplies its own
  `getDefaultsForRow`.
- **P5 (issuance feel)**: a fully-courted underdog overtakes the leader at
  round 24 with fixed-10 issuance, round 12 at 5%/round, round 5 at 15%.
  → levels run 10–15 rounds with **percentage issuance ≈ 5–10%** so comeback
  arcs fit inside a level; per-level override allowed.

## 3. Architecture

Three layers; each lower layer never imports an upper one:

```
src/raindrop.js          the mechanism (paper-faithful; mirrors the oracle)
src/game/                rules: state, staging, AI policies, levels, goals
src/cli.js + web/        views: render state, collect player intent
```

### 3.1 Engine — `src/raindrop.js` (pure, no game concepts)

```js
eigentrust({ trustMatrix, trustedSetWeights, alpha = 0.15,
             errorThreshold = 1e-9, maxIterations = 1000,
             getDefaultsForRow })            // -> { result, iterations, converged, steps }
issuanceRound({ balances, trustMatrix, alpha, issuanceAmount,
                issuanceMode = 'fixed'|'percentage', burnRatio = 0,
                getDefaultsForRow })         // -> { allocation, minted, distributed,
                                             //      burned, balances }   (new array)
// exported helpers: normalize, rowNormalize, transpose, matVec, l2Distance
```

Semantics mirror the oracle exactly (same update rule `t ← (1−α)·Tᵀ·t + α·p`,
same zero-row fallback contract, same burn-before-distribute). Deviations
from oracle defaults: threshold 1e−9 (P3) and a `converged` flag instead of a
`console.warn`. **The engine permits diagonal trust** — the no-self-trust
rule is a *game* rule, enforced in the game layer; the engine stays
mechanism-faithful so parity tests with the oracle are exact.

### 3.2 Game core — `src/game/game.js`

State is plain JSON-serializable data; all transitions are pure functions
returning new state. No randomness anywhere → identical inputs replay
identically (puzzle fairness + trivial test determinism).

```js
createGame(levelDef)                  // -> GameState (validates the level)
stageTrust(state, plotId, targetId, weight)  // player intent; throws on
                                             // self-trust or negative weight
endRound(state)                       // -> { state, report }; throws if
                                      //    eigentrust reports !converged
getView(state)                        // balances, shares, ROW-NORMALIZED
                                      // incoming/outgoing trust, last
                                      // allocation, goal status, and each
                                      // plot's personality id + public
                                      // description (open information — X9)
forecast(state)                       // the FULL endRound pipeline (AI
                                      // policy step included) minus
                                      // mint/commit (X4): exactly what
                                      // ending the round now would produce
```

**Observation contract (X5)**: personalities and `getView` observe only the
row-normalized committed matrix. Raw staged magnitudes are meaningless
beyond their ratios — scaling any player row by a positive constant must
leave every AI response and allocation identical (tested).

`GameState` (shape): `{ levelId, round, status: 'playing'|'won'|'lost',
plots: [{ id, name, personality, balance, playerControlled }],
trust: number[][], staged: number[][], params: { alpha, issuanceAmount,
issuanceMode, burnRatio, maxRounds }, history: [{ round, allocation,
minted, balances }] }`.

**Round resolution (`endRound`) — simultaneous and ordered:**
1. AI rows are computed from the *pre-round* view (player's staged rows are
   not visible to AIs this round — no information asymmetry against the
   player).
2. All rows (staged player rows + AI rows) commit; diagonals are zero by
   construction everywhere: staging rejects them, policies never emit them,
   and the zero-row fallback is diagonal-zeroed (X3).
3. `issuanceRound` runs; balances update; history appends. Non-convergence
   throws (X7): with α ≥ 0.05 the update is a (1−α)-contraction, so failing
   to converge in 1000 iterations is a bug, never a gameplay event.
4. Goal predicate evaluates → `won` / `lost` (round budget exhausted) /
   `playing`. **Edge semantics (X8)**: goals evaluate once per round, after
   distribution; win is checked before loss (goal met on the final round =
   win); `byRound: N` means "by the end of round N", rounds 1-indexed;
   `leaderAtRound` requires strictly greatest balance — ties are not
   leadership.

### 3.3 AI personalities — `src/game/personalities.js`

A personality is a pure policy `(view, selfIndex) -> trustRow` (diagonal 0,
non-negative; all deterministic):

| Personality | Policy (over the row-normalized view — X5) |
|---|---|
| `loyalist` | fixed row from the level definition, forever |
| `reciprocator` | mirrors the normalized incoming-trust column from the previous round; zero incoming → emits all-zero row (engine fallback applies) |
| `sycophant` | all trust on the richest other plot (ties → lowest index) |
| `gardener` | all trust on the poorest other plot (ties → lowest index) |
| `merchant` | trust proportional to others' balances |

Personalities are the *politics* layer: each is a legible, exploitable
strategy in mechanism terms (e.g., courting the reciprocator builds a mutual
edge; the sycophant amplifies whoever leads — including you).

### 3.4 Levels — `src/game/levels.js`

A level is data, fully in mechanism formalism plus a goal predicate:
`{ id, title, story, plots, initialBalances, initialTrust, params, goal,
hint }`. Goal types: `shareAtLeast { plotId|'player', share, byRound }`,
`balanceAtLeast { plotId, amount, byRound }`, `leaderAtRound { round }`.
Multi-plot player control (`playerControlled: true` on several plots) powers
the Sybil level.

**Campaign** (each level = one mechanism property, difficulty rising).
Topology sketches and targets below are **provisional by design** (external
critique X1 proved the D.2 sketches unwinnable): binding numbers are set in
Phase 4 against measured ceilings, and a level ships only when its
mechanized QA passes.

| # | Title | Teaches | Setup sketch (provisional) | Goal type |
|---|-------|---------|----------------------------|-----------|
| 1 | First Rain | trust redirects future rain — build a mutual edge | 3 plots: you, loyalist, reciprocator | `balanceAtLeast(you)` — harvest target by round ~10 |
| 2 | The Go-Between | transitivity — rain pools at the end of trust chains | 4 plots: Sage → Elder → Herald chain (loyalists + reciprocator terminus); courting the rich anchor directly must lose | `balanceAtLeast(you)` |
| 3 | Make It Rain | endorsement ≠ transfer | grow the poorest plot ("the Seedling") without sending it anything | `balanceAtLeast(seedling)` |
| 4 | The Anchor | damping / balance anchor | α = 0.5, rich merchant leads | `leaderAtRound` (ceiling-validated) |
| 5 | The Sybil Garden | split conservation + the ring caveat | you control 3 small plots | combined `shareAtLeast` (ceiling-validated) |
| 6 | Drought Court | composition + burn/percentage issuance | 6 plots, sycophant + merchant + gardener, burn 0.2 | `leaderAtRound` (ceiling-validated) |

**Goal-reachability rule (X1)**: `shareAtLeast`/`leaderAtRound` goals are
invariant to issuance rate and round budget (share is a convex combination
of the initial share and past allocations), so every such goal must clear a
measured reachability ceiling (best-case incoming trust) before the level
ships. Tutorial-arc goals use absolute balance targets, which round budgets
and issuance *can* tune.

**Level QA is mechanized (Phase 4 tests)** — every shipped level must pass:
(a) **solvable** — a checked-in scripted solution wins; (b) **negative
controls (X6)** — against the canonical naive scripts (no-op,
greedy-forecast bot, all-on-richest, all-on-designated-ally), each level
declares which must lose, and late levels must defeat the greedy bot —
making "not greedily solvable" a measured property; (c) **schema-valid
(X7)** — `validateLevel()` enforces trust ≥ 0, zero diagonals, α ∈ (0,1),
burn ∈ [0,1), positive balances, well-formed goal.

### 3.5 Views

- **CLI (`src/cli.js`)** — interactive readline loop and `--script` mode
  (newline/`;`-separated commands) for end-to-end tests and replays.
  Commands: `trust <target> <weight>`, `trust <plot>:<target> <weight>`
  (multi-plot levels), `forecast`, `status`, `end`, `help`, `quit`.
  Renders balances as unicode bars, trust table, allocation forecast, story
  and goal text.
- **Web (`web/index.html` + `web/ui.js` + `web/worker.js`)** — static page,
  no build step, GitHub Pages-ready. **All simulation runs in a Web Worker**
  (user requirement, 2026-06-12): `web/worker.js` is a module worker that
  imports the SAME `src/` ESM modules and owns the live `GameState`; the
  main thread holds no game logic at all — it sends intents
  (`{ type: 'stageTrust' | 'endRound' | 'forecast' | 'loadLevel' }`) via
  `postMessage` and renders the JSON view/forecast snapshots the worker
  returns. This is possible precisely because `GameState` is
  JSON-serializable (self-critique S3) and the engine is pure — the worker
  boundary doubles as a structural enforcement of the "views carry zero
  logic" rule, and keeps the UI responsive however heavy a level's
  computation gets. SVG board: plots on a circle, edge widths = trust,
  per-round rain animation sized by `g`; sliders for the player's outgoing
  weights; forecast preview; level select; story/goal panel.

## 4. Worked example (traceable by hand)

3 plots, balances `[100,100,100]` → `b = [⅓,⅓,⅓]`; rows: player `[0,1,0]`,
B `[0,0,1]`, C `[0,1,0]`; α = 0.15. Iteration from `t₀ = b`:
`t₁ = 0.85·Tᵀt₀ + 0.15·b = [0.05, 0.6167, 0.3333]`. Fixed point (solve the
linear system): `g = [0.05, 0.48649, 0.46351]` (sums to 1). One round of
percentage issuance at 10% mints 30, so balances become
`[101.5, 114.59, 113.91]`. This example is enshrined as an engine unit test.

## 5. Test strategy

| Suite | Proves |
|---|---|
| `test/raindrop.test.js` | helpers; α=1 ⇒ g=b in one step (engine algebra; the game validator restricts α to (0,1)); §4 worked example vs closed form; Σg=1; supply-accounting invariant (self-critique S2); burn arithmetic |
| `test/parity.test.js` | engine ≡ oracle on seeded-random matrices (sizes 2–12, several α, all three fallbacks) and multi-round simulations — identical explicit params passed to both sides (self-critique R2) — **skeleton lands in Phase 0, enabled in Phase 1** |
| `test/properties.test.js` | honest-split conservation (|Δ| < 1e−12); ring ≡ self-trust; damping caps ring capture monotonically |
| `test/game.test.js` | staging rules (self-trust rejected); zero diagonal on every committed row incl. fallback (X3); simultaneity; determinism (replay equality); JSON round-trip (self-critique S3); `forecast` ≡ `endRound` allocation (X4); row scale-invariance (X5); goal edge semantics (X8); Σbalances == supply each round |
| `test/personalities.test.js` | each policy's emitted rows on crafted views; policies read only the normalized matrix |
| `test/levels.test.js` | per-level: schema-valid (X7), solvable, declared negative controls lose (X6) |
| `test/cli.test.js` | scripted CLI playthrough of level 1 to victory (child process) |
| `examples/2026-06-12-raindrop-game.js` | acceptance spec through the public API (§6), incl. one executable assertion per goal edge case (X8) |

Runner: `node --test test/` (zero dependencies). Seeded PRNG (mulberry32)
checked into test utils for the parity suite.

## 6. Acceptance spec (Phase 0)

`examples/2026-06-12-raindrop-game.js` — executable, run after every phase:
baseline canary (oracle round computation) active from Phase 0; aspirational
sections (engine parity, a full level-1 victory via `createGame` →
`stageTrust` → `endRound`, a Sybil Garden ring demonstration, CLI scripted
victory) commented out and uncommented as their phases land. Phase N is not
done until its sections run clean.

## 7. Phase plan and dependencies

Phases match the Progress Tracker. Dependencies are architectural:
engine (1) ← game core (2) ← personalities (3) ← levels (4) ← CLI (5) and
web (6) in either order ← capstone (7). Each phase ends with the workflow's
5-step completion checklist (tests, commit, tracker, dailies, proceed).

**Named drift risks** (checked at each phase's Vision Alignment Gate):

- *Phase 1*: "improving" oracle semantics (different norm, different
  iteration order) and silently breaking parity. Parity suite is the guard.
- *Phase 2*: burying the mechanism under game abstractions. Guard: `endRound`
  must read as "normalize → eigentrust → mint → distribute" with rule checks
  around it, nothing more.
- *Phase 3*: personalities that need randomness or hidden state to be
  interesting. Guard: policies are pure functions of the public view.
- *Phase 4*: levels that are puzzles about AI quirks instead of mechanism
  properties. Guard: each level names the property it teaches; the solution
  script must exploit *that* property.
- *Phase 5/6*: logic leaking into views. Guard: views import game functions;
  grep for arithmetic on balances/trust in view files should find none. For
  the web view specifically: only `web/worker.js` may import from `src/`;
  the main-thread script communicates exclusively via `postMessage`.

## 8. Stage 0 design gate (mantra: "the mechanism IS the game")

| Component | In paradigm? | Could it be MORE aligned? |
|---|---|---|
| Engine | yes — paper-faithful, oracle-parity | threshold/flag deviations are explicit and probe-justified, not drift |
| Game rules | yes — rules are mechanism-legal restrictions (no self-trust) + a goal predicate | goals are predicates over balance trajectories only; no off-mechanism resources (e.g., no "action points") were added — challenged and kept out |
| Personalities | yes — pure trust-row policies | reciprocator initially wanted memory of two rounds; cut to one (view-pure) |
| Levels | yes — data in mechanism formalism | story text is presentation-only; goals never reference story |
| Views | presentation only | forecast uses the real engine, not a heuristic copy — single computation path |

**Observations (outside the paradigm, and why):** story/theming text and the
CLI/web rendering are necessarily outside the mechanism formalism; they carry
no rules. The diagonal ban is a deliberate game-layer restriction of the
mechanism (the paper implies it; the oracle doesn't enforce it) — labeled a
*rule*, not scaffolding, and the Sybil Garden level exists precisely to show
what its absence would mean.

## 9. Deferred (tracked in DEFERRED.md when/if deferred)

Candidates surfaced during design, deliberately out of scope: multiplayer
(netcode; nothing in the architecture precludes it — `GameState` is
serializable), raindrop-zk-style verifiable computation (no public artifact
to build against), token *transfers* as a player action (the paper allows
them; the campaign teaches issuance, not trading — see external critique
response E2), GitHub Pages deployment automation.
