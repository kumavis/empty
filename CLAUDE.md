# CLAUDE.md

Raindrop Game — the raindrop issuance mechanism (EigenTrust over a
token-weighted trust network) as a puzzle-strategy game. Zero-dependency
Node 22 ESM; same modules run in node and the browser.

## Binding process

ALL work follows [GENERIC_CLAUDE_WORKFLOW.md](GENERIC_CLAUDE_WORKFLOW.md)
(five stages, commit discipline, tracking docs, dailies, PIRs). Master
index: [docs/tracking/ROADMAP.md](docs/tracking/ROADMAP.md).

## Commands

- `npm test` — full suite (`node --test "test/*.test.js"`)
- `npm run acceptance` — executable acceptance spec (run after every phase)
- `npm run capstone` — full-campaign ground truth
- `npm run play` / `npm run web` — CLI / browser game

## Load-bearing invariants (tests enforce all of these)

- **Engine parity**: `src/raindrop.js` is bit-exact (results AND iteration
  counts) with `test/oracle/viz-eigentrust.js` — the verbatim production
  bundle of kumavis/raindrop-viz. Never "clean up" the oracle; never change
  engine numerics without the parity suite.
- **The mechanism is the game**: game rules are restrictions expressible in
  mechanism formalism (no self-trust, diagonal-zeroed balance fallback);
  goals are predicates over balance trajectories.
- **Views carry zero logic**: `src/cli.js` and `web/ui.js` only render and
  forward intents. In the browser, ALL simulation runs in the Web Worker
  (`web/worker.js`), the only web file allowed to import `src/`.
- **State is pure JSON**, transitions are pure functions — replay equality
  and the worker boundary both depend on it.
- **Level QA is mechanized**: checked-in solutions must win; declared
  negative controls (incl. the greedy bot) must lose. Tune levels with
  `scripts/probes/2026-06-12_level_tuning.mjs`, then lock numbers in tests.
- **Personalities/views observe only the row-normalized trust matrix** —
  raw staged magnitudes are player-private.
