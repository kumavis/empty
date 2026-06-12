# 💧 Raindrop — a game of trust and rain

[Raindrop](https://kumavis.github.io/raindrop-paper/paper.md) is a
cryptoeconomic mechanism: each round, newly minted tokens are distributed by
`g = EigenTrust(T, b, α)` — a blend of token-weighted influence (`b`, the
balance vector) and delegated trust (`T`, the row-stochastic trust matrix).
This repository implements that mechanism **as the core of a puzzle-strategy
game**: every level is a small raindrop network, every victory is a property
of the mechanism, demonstrated.

Remove the issuance round and no level is winnable — that is what "core
mechanic" means here.

## Play

```bash
npm run play               # terminal: node src/cli.js [--level N]
npm run web                # browser at :8137 — or any static server from the repo root
```

The browser version runs **all simulation in a Web Worker**: the worker owns
the game state and is the only code that touches game logic; the page is
render + intent over `postMessage`.

In the CLI: `trust brook 2` stages trust, `forecast` previews the rain,
`end` lets it fall, `help` lists everything. Weights are relative — only
ratios matter (the engine row-normalizes, and tests prove the AIs can't see
your raw numbers).

## The campaign

| # | Level | The mechanism property it teaches |
|---|-------|-----------------------------------|
| 1 | First Rain | Trust redirects *future* issuance — court the one who returns it |
| 2 | The Go-Between | Transitivity: rain pools at the end of trust chains |
| 3 | Make It Rain | Endorsement is not a transfer — growing another plot costs you nothing |
| 4 | The Anchor | Damping (α): the balance anchor makes plutocracy sticky |
| 5 | The Sybil Garden | Splitting a balance conserves influence *exactly* — but a trust ring rebuilds forbidden self-trust |
| 6 | Drought Court | Composition: burn, sycophancy, and mirrors at once |

Every level is mechanically QA'd: a checked-in solution must win, and each
level's declared *negative controls* (no-op, all-on-richest, a greedy
one-round-lookahead bot, designated bad allies) must lose. "The finale is
not greedily solvable" is a measured test result, not a hope.

## Rules of the garden

- Each plot has a token balance; trust is a row of non-negative weights over
  *other* plots (self-trust is forbidden — and level 5 shows you exactly
  what that ban is worth).
- Once per round: `g = EigenTrust(T, b, α)`; ΔS tokens are minted
  (optionally burned by a drought) and distributed in proportion to `g`.
- Delegating nothing endorses the status quo: your empty row falls back to
  the balance vector (diagonal zeroed).
- Delegations persist between rounds; AIs react to the *previous* round's
  public state, so you always move last.

## Architecture

```
src/raindrop.js        the mechanism — bit-exact parity with the reference
                       implementation extracted from the raindrop-viz bundle
                       (test/oracle/, verbatim, with provenance)
src/game/              rules: pure JSON state, staging, AI personalities,
                       levels, goals (all transitions pure functions)
src/cli.js             terminal view (render + intent only)
web/                   browser view; worker.js owns the state, ui.js renders
```

Zero npm dependencies. Node 22+.

## Verify everything

```bash
npm test               # 65 tests: oracle parity, mechanism properties,
                       # game rules, level QA, CLI e2e, worker protocol
npm run acceptance     # the executable acceptance spec, end to end
npm run capstone       # the whole campaign played to victory, narrated
npm run probe          # the design probes against the reference oracle
```

## Process

Built per [GENERIC_CLAUDE_WORKFLOW.md](GENERIC_CLAUDE_WORKFLOW.md):
research → audit → design (+ self- and external critique) → phased
implementation → post-implementation review. The paper trail lives in
[docs/](docs/) — start at
[docs/tracking/ROADMAP.md](docs/tracking/ROADMAP.md).

## References

- Landau, P. — [Raindrop: Continuous token issuance via delegated trust propagation](https://kumavis.github.io/raindrop-paper/paper.md)
- Kamvar, Schlosser, Garcia-Molina (2003) — [The EigenTrust algorithm](https://nlp.stanford.edu/pubs/eigentrust.pdf)
- [kumavis/raindrop-viz](https://github.com/kumavis/raindrop-viz) — the reference visualization whose deployed bundle serves as our test oracle
