# Deferred Work Queue

Single source-of-truth queue for deferred work. Items are added in the same
commit that defers them; triaged at the start of each new work track.

| # | Item | Deferred from | Why deferred | Unblocked by |
|---|------|---------------|--------------|--------------|
| 1 | Visual QA / polish of the web view (layout, animation timing, mobile) | Raindrop Game Phase 6 | Container has no browser; logic is fully tested headlessly, rendering is not | A human opening `web/index.html` (any static server from repo root) |
| 2 | ~~GitHub Pages deployment automation~~ | Raindrop Game design §9 | DONE — `.github/workflows/pages.yml` tests then publishes `web/` (+`src/`) to Pages on every push to `main` | n/a (resolved) |
| 3 | Multiplayer ("duet" hotseat or networked) | Raindrop Game design §9 | Single-player ships and tests without netcode; GameState is already pure JSON | Demand; see capstone aspirational section |
| 4 | raindrop-zk-style verifiable issuance computation | Raindrop Game Stage 1 | kumavis/raindrop-zk is private with no public artifact to build against | Access to the repo or a published spec |
| 5 | Token *transfers* as a player action (paper allows them between rounds) | Raindrop Game design §9 / external critique E2 | Campaign teaches issuance, not trading; transfers would also need new goal-reachability analysis per level | A track that designs trading levels with ceiling validation |
| 6 | Endless/procedural mode with a goal ladder | Raindrop Game Phase 7 capstone | Aspirational; campaign is the deliverable | See capstone aspirational section |
