# Self-Critique: Raindrop Game design

Lenses applied to the D.1 design (see design doc §8 for the Stage 0 gate).
Each finding: challenge → resolution. Findings that changed the design are
marked **[adopted]**.

## Lens P — Principles challenged

- **P1 — Does `forecast` trivialize the game?** Showing the exact next-round
  allocation could reduce play to greedy hill-climbing. *Challenge held
  against "the game teaches the mechanism":* hiding the computation would be
  difficulty-by-obscurity; multi-round politics (reciprocator courtship, AI
  reactions) is not greedily solvable from a one-round forecast. **Keep
  forecast, always on.** Explicitly rejected the "disable forecast on hard
  levels" knob as obscurity.
- **P2 — Web UI risks "DONE (unit only)".** This container cannot click a
  browser. Resolution: the CLI is the fully-validated user-facing entry
  point (scripted e2e to victory); the web page is a logic-free second view
  with a node smoke test (HTML parses, module graph resolves) and will be
  marked honestly in the tracker as "logic-free shell; visual QA = manual".
- **P3 — Round counts and share targets in the level table are estimates from
  vision**, exactly what Stage 2 warns about. Resolution **[adopted]**: design
  doc treats them as provisional; Phase 4's solvable+losable tests are the
  measurement; tuning deltas recorded in the dailies.

## Lens R — Reality-check

- **R1 — Levels 4 and 5 may be unwinnable as parameterized.** P1 showed high
  α damps the trust lever (level 4 is α=0.5 *and* the merchant amplifies the
  leader); P6's ring number (0.758) was measured with the group holding 30%
  of supply — level 5's player plots may start smaller. **[adopted]** Phase 4
  explicitly budgets for parameter tuning; solvability scripts are the gate,
  not the table in §3.4.
- **R2 — Parity-test validity.** Engine defaults deviate from the oracle
  (threshold 1e−9 vs 1e−6), so parity tests MUST pass identical explicit
  parameters to both sides; comparing under defaults would test nothing.
  **[adopted]** into the test strategy.
- **R3 — Oracle `steps` includes the initial state** (length = iterations+1).
  Our engine must match this shape or the parity suite must compare `result`
  only. Decision: compare `result` and `iterations` under identical params.

## Lens M — Paradigm-mindspace ("the mechanism IS the game")

- **M1 — `leaderAtRound` goal**: predicate over the balance trajectory —
  in paradigm. ✓
- **M2 — Argmax personalities (sycophant/gardener) can oscillate** between
  two near-equal targets. Oscillation is emergent politics, not a bug — but
  level QA must prove no level *requires* exploiting an oscillation artifact
  to win. Covered by "solution script must exploit the named property".
- **M3 — Information timing**: AIs respond to the pre-round state, so the
  player effectively moves last each round. This is a deliberate single-
  player legibility choice, consistent with the paper's "updates take effect
  next round". Documented in design §3.2 — not hidden.

## Lens S — Structural

- **S1 — Seeded PRNG**: hand-rolled mulberry32 for parity tests only;
  greenfield repo has no existing machinery to consume. Acceptable.
- **S2 — Missing declared property** **[adopted]**: supply accounting
  invariant (`supply' = supply + minted·(1−burn)`, and Σbalances == supply
  throughout a game) added to the engine/game test lists.
- **S3 — Serializability is claimed, never proven** **[adopted]**: add a
  JSON round-trip + replay-equality test to `test/game.test.js`; this is the
  structural hook for future save/load and multiplayer.
