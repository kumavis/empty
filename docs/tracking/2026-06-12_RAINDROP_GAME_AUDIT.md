# Audit: Raindrop Game — infrastructure and gap analysis

Stage 2 output. **Scope**: the entire repository plus the build/runtime
environment, evaluated for "what must exist for raindrop to become the core
mechanic of a shippable, testable game." **Lens**: the workflow's testing
and entry-point requirements (GENERIC_CLAUDE_WORKFLOW.md §4, §5, §10) and
the mechanism requirements from the research doc.

## Findings (measured, not estimated)

- **F1 — The repo is empty of code.** Before this track: 1 tracked file
  (`GENERIC_CLAUDE_WORKFLOW.md`, 792 lines); after Stage 1: 6 tracked files,
  all documentation. No `package.json`, no `.gitignore`, no CI config, no
  source, zero tests. Everything is greenfield; there are no call sites to
  migrate and no existing conventions beyond the workflow document.
- **F2 — Runtime supports a zero-dependency stack.** `node v22.22.2`,
  `npm 10.9.7` measured in-container. Node 22 natively provides ES modules
  and `node:test` — engine, game logic, and tests need **zero npm
  dependencies**, which also removes network-policy risk during builds.
- **F3 — The reference implementation is recoverable as a test oracle.**
  `kumavis/raindrop-viz` is private, but its deployed bundle
  (424,704 bytes) contains the EigenTrust core as six self-contained pure
  functions (minified names `Qg, E3, b3, M3, A3, P3`, ~1 KB total, no DOM or
  React dependencies). These can be extracted verbatim into a parity-test
  oracle, giving us numerical ground truth against the *actual* normative
  implementation rather than only against self-derived properties.
- **F4 — No deployment target exists yet, but one is implied.** The sibling
  project ships as a static SPA on GitHub Pages. A no-build static ESM page
  in this repo can deploy the same way; nothing currently configures Pages.
- **F5 — The user-facing entry point is undefined.** The workflow demands
  validation "at the real user-facing entry point" (§4). For a game this
  means *a human can play it*. The audit finds two viable entry points in
  this environment: a browser page (deployable, but not directly
  playtestable from this container) and a terminal CLI (fully playtestable
  here). The design must pick the validation story deliberately.

## Recommendations

- **R1** (from F1): a single **Track** — "Raindrop Game" — no Series, no
  Parts. Greenfield scope with ~7 phases fits the workflow's "single
  feature → Track only" rule.
- **R2** (from F2): zero-dependency Node 22 ESM + `node:test`. Same modules
  run in the browser unbundled.
- **R3** (from F3): extract the viz EigenTrust core as a checked-in oracle
  (`test/oracle/`) with provenance comments, and write the engine⇄oracle
  parity test skeleton during Stage 3 as the workflow prescribes for
  multi-path designs.
- **R4** (from F3): run pre-implementation **probes against the oracle**
  (α sensitivity, Sybil-split conservation, convergence cost) so the design
  is tuned with data from the normative implementation before any engine
  code exists.
- **R5** (from F5): headless `Game` API is the tested entry point driven by
  the acceptance spec; a CLI provides in-container human playtesting; the
  browser page is the shipped artifact reusing the identical modules.

## What this audit does not cover

Solution design (level design, AI personalities, UI) — that is Stage 3.
