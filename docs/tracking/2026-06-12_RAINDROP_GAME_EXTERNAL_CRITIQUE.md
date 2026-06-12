# External Critique: Raindrop Game design (D.2 → D.3)

Adversarial review delegated to an independent agent (orientation briefing:
the paradigm, the workflow's test demands, full read of design/research/
self-critique/probes/oracle at commit bb541a5, with license to run its own
oracle probes). Nine findings returned: 1 blocking, 5 significant, 3 minor.
Each finding below carries exactly one response per the grounded-pushback
format. The design doc is revised to D.3 in the same commit.

## X1 — BLOCKING: Levels 1–2 unwinnable; share goals capped by a reachability ceiling

The critic ran an exhaustive 3¹⁰-strategy search of the level-1 sketch
against the oracle: the player's share *decays from round 0 under every
possible play* (max reachable allocation ≈ 0.257 < starting share 0.333,
because the loyalist pins the reciprocator's mirror at 0.5). Decisive
generalization: `share_t` is a convex combination of the initial share and
past allocations, so **share goals are invariant to issuance rate and round
budget** — the self-critique's R1/P3 "Phase 4 will tune parameters" is
provably insufficient for share goals.

**Response: Accept.** This is the most valuable finding of the round — a
wrong *assumption* (tuning fixes goals), not a wrong parameter. Resolution:
(a) tutorial-arc goals become `balanceAtLeast` (absolute harvest targets are
sensitive to allocation quality and round budget, so tuning *does* work);
(b) any remaining share/leader goal must clear a measured **reachability
ceiling** (best-case incoming trust) before a level ships; (c) level
topologies in the campaign table are demoted to provisional sketches —
binding validation is Phase 4's mechanized QA. Design §3.4 rewritten.

## X2 — Levels 1 and 2 are the same puzzle (isomorphic topology, same optimal move)

**Response: Accept.** Level 2 re-sketched around a ≥2-hop chain
(Sage → Elder → Herald) where the winning move is courting the chain's
*terminus* while the natural-but-losing move (courting the richest anchor
directly) is a mandatory failing negative control. Lesson now
distinguishable from level 1's "build your own mutual edge".

## X3 — Balance-vector fallback smuggles diagonal self-trust back in (silence subsidy grows with wealth)

Critic's probe: a silent player holding 50% of supply keeps 42.7% share
after 12 rounds under the D.2 fallback vs 34.2% with a diagonal-zeroed
fallback — and design line "diagonals are zeroed by construction" was
already contradicted by the fallback row.

**Response: Accept.** P4 was measured only at equal balances, where the
diagonal entry is small — a probe-design blind spot worth remembering. Game-
layer fallback is now **the balance vector with diagonal zeroed and
renormalized**; an all-zero staged player row means exactly this
status-quo-endorsement-of-others. The engine keeps the oracle's raw fallback
contract (parity), the game supplies its own `getDefaultsForRow`. New test:
every committed matrix row, including fallback rows, has a zero diagonal.

## X4 — `forecast` contract unspecified (lying instrument vs transparent AIs), untested

**Response: Accept.** Pinned: forecast = the full `endRound` pipeline
(AI policy step included) minus mint/commit — the player sees exactly what
ending the round now would produce. This makes AIs transparent one round
ahead; self-critique P1 is re-argued on those terms: the game's difficulty
lives in multi-round structure (mirror edges persist, sycophants defect as
the lead changes), and X6's greedy-bot negative control now *empirically*
checks that claim per level instead of asserting it. New test:
`forecast(state).allocation` ≡ `endRound(state).report.allocation`.

## X5 — Reciprocator mirror source (raw vs normalized) unspecified; raw reading is a magnitude exploit

Critic showed the two readings even flip level 1 between unwinnable and
winnable-only-via-exploit.

**Response: Accept.** Contract pinned: personalities and `getView` observe
only the **row-normalized committed matrix** — raw staged magnitudes are
player-private and meaningless beyond their ratios (the research doc already
declared "only relative trust matters" essential; the design now enforces
it). New test: scaling any player row by a positive constant leaves all AI
responses and allocations bit-identical.

## X6 — "No-op loses" is the weakest falsifier; property-necessity never tested

**Response: Accept.** Level QA now requires per-level **negative controls**:
a canonical script set (no-op, greedy-forecast bot, all-on-richest,
all-on-designated-ally), where each level declares which controls must lose;
late levels must defeat the greedy bot, making "not greedily solvable" a
measured property rather than a hope. The tutorial is explicitly allowed to
be greedy-winnable.

## X7 — Non-convergence policy and level-schema validation missing

**Response: Accept.** `endRound` **throws** on `converged: false` — with
α ≥ 0.05 the iteration is a (1−α)-contraction, so non-convergence within
1000 iterations is a bug, not a gameplay event; failing loudly beats playing
an unconverged allocation. New `validateLevel()` (trust ≥ 0, zero diagonal,
α ∈ (0,1), burn ∈ [0,1), balances > 0, well-formed goal) runs over every
shipped level in `test/levels.test.js`. The α=1 case stays in the *engine*
suite (it tests the update rule's algebra; the engine deliberately accepts
what the oracle accepts).

## X8 — Goal-predicate edge semantics unpinned

**Response: Accept.** Pinned (and to be encoded as executable assertions in
the acceptance spec): goals evaluate once per round, after distribution;
win is checked before loss, so satisfying the goal on the final round wins;
`byRound: N` means "by the end of round N" (1-indexed); `leaderAtRound`
requires strictly greatest balance — a tie is not leadership.

## X9 — Personalities absent from the `getView` contract

**Response: Accept.** This was a real contract hole: the premise is "read
the table, court the right allies", which requires the table to *show* who
is who. `getView` now exposes each plot's personality id plus a one-line
public description; both views render it. Open information is a design
principle, not an implementation detail.

## Round summary

9/9 findings accepted (several with our own resolution rather than the
critic's suggested one — X1's balance-goal pivot, X4's transparency
re-argument, X7's throw-don't-degrade). No rejections: every finding was
grounded in our actual documents or in fresh oracle measurements. The
process note for the PIR: *both* probe rounds (ours and the critic's)
changed the design materially; the critique round was not overhead.
