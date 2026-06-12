# PIR: Raindrop Game

**Date** 2026-06-12 · **Duration** one session, ~10:15–11:20 (~65 min) ·
**Commits** 11 (9be3a07 → final) · **Test delta** 0 → 65 (+ acceptance spec
+ capstone) · **Code delta** ~2,660 lines (src+web+test+examples+probes),
~1,300 lines of docs · **Suite health** 65/65 green, 588 ms ·
**Design doc** [DESIGN](2026-06-12_RAINDROP_GAME_DESIGN.md) (D.3) ·
**Critiques** [self](2026-06-12_RAINDROP_GAME_SELF_CRITIQUE.md) /
[external](2026-06-12_RAINDROP_GAME_EXTERNAL_CRITIQUE.md)

## 1. What Was Built

The raindrop mechanism (EigenTrust-allocated continuous issuance) as the
core mechanic of a deterministic single-player puzzle-strategy game:
a paper-faithful engine with **bit-exact parity** to the raindrop-viz
reference implementation (extracted verbatim from its production bundle as
a checked-in oracle); a pure-JSON game layer (staging, five AI trust-row
personalities, goal predicates); six campaign levels each teaching one
mechanism property, with mechanized QA (checked-in solutions must win,
declared negative controls must lose); a tested interactive CLI; and a
static-ESM web view whose simulation runs entirely in a Web Worker
(user requirement, mid-session).

### Objectives vs delivered (Q1, Q2)

Original request: "follow the stated workflow; implement raindrop as the
core mechanic of a game." Delivered scope matches the D.3 design 1:1 —
all 8 phases ✅ in the progress tracker, acceptance spec fully uncommented
and green, capstone 6/6. One mid-session requirement (Web Worker) absorbed
without design rework because serializable-state was already load-bearing.

## 2. Timeline and Phases (Q3)

| Commit | Phase | Note |
|---|---|---|
| 9be3a07 | Stage 1 research | viz repo private → bundle mined for the reference impl |
| 8180a55 | Stage 2 audit | oracle discovery (F3) — the track's luckiest find |
| bb541a5 | Stage 3a design + probes | P2/P6: ring ≡ self-trust; conservation exact |
| 358127c, e2e8897 | Phase 0 | acceptance spec + skipped parity skeleton |
| a07760e | Stage 3b critique | X1: levels provably unwinnable; 9/9 accepted |
| a812c6e | Phase 1 engine | bit-exact parity incl. iteration counts |
| 1f8de1e | Phase 2 game core | critique obligations → tests verbatim |
| a18cbd2 | Phase 3 personalities | X5 completed with reactive AI |
| e1aab91 | Phase 4 campaign | 3 tuning iterations on level 4 |
| b297a5c | Phase 5 CLI | e2e victories at the human entry point |
| ce8c660 | Phase 6 web/worker | protocol core tested headlessly |

## 3. Test Coverage

65 tests: engine unit + property (Σg=1, supply invariant, worked example vs
closed form), oracle parity (seeded random nets × sizes × α × fallbacks,
multi-round sims), mechanism properties (conservation < 1e−12, ring ≡
self-trust < 1e−9, monotone damping cap), game rules (X3/X4/X5/X8/X9,
replay + JSON round-trip), per-personality policies, per-level QA
(schema/solvable/controls-lose), CLI e2e (child processes), worker protocol
(full victory through postMessage messages). Plus the acceptance spec (all
sections active) and the capstone as executable ground truth.

## 4. Bugs Found and Fixed (Q6 — with root cause)

- **D.2 levels 1–2 unwinnable** (external critique X1, exhaustive search):
  root cause — share goals are convex combinations of initial share and
  past allocations, hence invariant to issuance tuning; we designed goals
  before checking reachability ceilings. Fixed by goal-type pivot
  (balance targets for the tutorial arc) + ceiling rule.
- **Level 4 unwinnable at first tuning** (our harness): merchant + α=0.5
  snowballs; two intermediate configurations failed in opposite directions
  (silence-wins / Echo-outgrows-player) before patron-backs-player-only +
  Tycoon 190 landed. Root cause: same class as X1 — vision-estimated
  numbers; the harness exists precisely because of it.
- **Fixture games ended earlier than tests assumed** (twice: playRounds,
  X5 test): root cause — the α-anchor showers even silent plots, so "easy"
  goals are met by no-ops. The same effect that makes X6 negative controls
  necessary.

## 5. Design Decisions and Rationale (Q5 highlights)

- **Oracle extraction over reimplementation-from-prose** — turned "looks
  right" into deepEqual; made parity a regression gate forever.
- **Probes before design freeze** — α default, issuance mode, threshold,
  fallback semantics all chosen from measurements, not taste.
- **No self-trust as a game rule, not an engine rule** — engine stays
  oracle-faithful; the ban lives where the paper implies it; level 5 turns
  the rule's loophole (rings) into the lesson.
- **Forecast = full pipeline minus commit** — one computation path; AI
  transparency accepted and then *measured* (greedy bot results).
- **Worker owns GameState** — the user's requirement became a structural
  enforcement of "views carry zero logic", testable in node.

## 6. Lessons Learned (Q6/Q7/Q8)

- **(Surprise, the richest)** A sybil trust-ring is *numerically identical*
  to single-account self-trust at every α — the paper's Sybil-resistance
  claim is exactly true for what it claims (balance splitting) and the
  ring is not a counterexample but self-trust by proxy, capped by damping.
  This single probe finding generated the game's best level.
- **(Got lucky, Q7)** The viz bundle happened to contain the entire
  EigenTrust core as six dependency-free pure functions. Had it been
  webpack-mangled across module boundaries, the parity story collapses to
  property tests only. Hardening: the oracle is now checked in with
  provenance, so the luck is banked.
- **(Wrong assumption, Q13)** "Level parameters can be tuned later" — false
  for share-type goals (X1's convexity argument). Reachability is a
  *design-time* constraint, not a tuning knob.
- **(Wrong assumption, Q13)** "Greedy must lose all late levels" — at heavy
  damping with a merchant runaway, the myopic and optimal moves *coincide*;
  anti-greedy is a property of specific topologies (split-mirror puzzles),
  not of difficulty. The claim moved to where it is true and measured.
- **(Process)** Our own probes validated the mechanism but never
  adversarially probed a *level*; the external critic's exhaustive search
  did. Probe the *content*, not just the substrate.

## 7. Metrics (Q3)

65 min request→capstone; 11 commits; 65 tests, 588 ms suite; 0 npm
dependencies; engine ≤ 113 iterations/round at n ≤ 12 (threshold 1e−9);
6/6 levels solvable + controls-lose, all enforced in CI-able tests.

## 8. What's Next (Q10, Q11)

Enabled: multiplayer (pure-JSON state), endless mode, transfer mechanics,
Pages deploy — all queued in [DEFERRED.md](DEFERRED.md) (items 1–6) with
unblock conditions. Accepted debt: visual QA of the web view is manual
(deferred #1); goalText is formatted in both CLI and worker (two surfaces,
small, noted in Phase 6 dailies).

## 9. Key Files

`src/raindrop.js` (engine) · `src/game/{game,personalities,levels,bots}.js`
· `src/cli.js` · `web/{worker,ui}.js` + `index.html` ·
`test/oracle/viz-eigentrust.js` (verbatim oracle) ·
`examples/2026-06-12-{raindrop-game,capstone-campaign}.js` ·
`scripts/probes/2026-06-12_{design_probes,level_tuning}.mjs`

## 10. Lessons Distilled (Q15, Q16)

| Lesson | Distilled to | Status |
|---|---|---|
| Reachability ceilings are design-time constraints for ratio-type goals | DESIGN doc §3.4 (goal-reachability rule) + CLAUDE.md (level QA invariant) | ✅ codified |
| Probe the content (levels), not just the substrate (mechanism) | This PIR; candidate for a principles doc when one exists (first data point) | 👁 watching |
| Reference implementations beat prose specs — extract and pin them | CLAUDE.md (oracle invariant) | ✅ codified |
| "X must lose" claims belong only where measured | levels.js declaration comments + CLAUDE.md | ✅ codified |
| Honest-fixture effect: silent players still get rained on; calibrate test goals | test fixtures comments | ✅ in code |

**Q15 (right problem?)** Yes — "make the mechanism the game" survived
contact: every level's winning line is a mechanism property, and the two
places that resisted (X1 goals, L4 greedy) resolved by *listening to the
mechanism* rather than overriding it.

**Q16 (pattern or isolated?)** First PIR in this repo — no longitudinal
table possible. Seeded for next time: watch whether "content-level
adversarial probing" recurs as a gap.

**Q12 (do differently?)** Run the critic's style of exhaustive level search
as part of *our own* Stage 3 probes, before the external round — the
information was one `3^10` loop away the whole time.
