# LavaMoat explainer video

A ~2.5 minute animated explainer for [LavaMoat](https://github.com/LavaMoat/LavaMoat),
built with [Remotion](https://remotion.dev). The narrative and visual style follow the
[Devcon 6 talk](https://github.com/kumavis/talk-lavamoat-devcon6-2022)
("The Attacker is Inside") — same palette, lava-wave title, icons, and
event-stream headline screenshots.

## Story beats

1. **Title** — LavaMoat: javascript supplychain security
2. **Your app, on npm** — a few deps explode into 1,000+ transitive packages
3. **2018 event-stream incident** — malicious code shipped inside the Copay wallet
4. **Attack timeline, 2018 → 2026** — the attacks accelerated: ua-parser-js (2021),
   node-ipc & colors sabotage (2022), Ledger connect-kit drainer (2023),
   web3.js & lottie-player (2024), the chalk & debug takeover (2B weekly
   downloads) and the self-replicating Shai-Hulud worm (~800 packages,
   25k+ repos across two waves, 2025), axios / node-ipc / Red Hat (2026)
5. **Attack surface** — install (lifecycle scripts) → build (tooling) → runtime
6. **Why is JS such an easy target?** — flexibility: it makes JavaScript vulnerable
   *and* is what lets us make it safe (the thesis, stated up front); then
   #1 — everything is mutable (`Array.prototype.map = ...`)
7. **#2 — ambient authority** — any package can `fetch(process.env)` unnoticed
8. **The foundation** — Hardened JavaScript (SES): that same flexibility turned
   into defense — `lockdown()` + `Compartment`
9. **How LavaMoat works** — every package in its own compartment, enforced by an
   auto-generated `policy.json`
10. **Adopt incrementally** — `@lavamoat/allow-scripts`, `lavamoat-node`, bundler plugins
11. **Outro** — battle-tested at MetaMask; "Never use dependencies? Unrealistic.
    Audit all of node_modules? Impossible. Contain every package with LavaMoat?
    Solved." (adapted from the MetaMask LavaMoat blog post);
    github.com/LavaMoat/LavaMoat

## Rendering

```sh
git clone -b claude/compassionate-knuth-icaby0 git@github.com:kumavis/empty.git
cd empty/video
npm install
npm run render          # writes out/lavamoat-explainer.mp4 (1080p30, CRF 18)
npm run studio          # live-preview / edit the composition
```

Narration audio and `src/timing.json` are checked in, so rendering needs only
Node — no TTS setup. Remotion downloads its own headless Chromium on first run.

### Higher-quality renders

The committed `lavamoat-explainer.mp4` at the repo root is a CRF 22 re-encode
to keep the repo small. The scenes are all vector/DOM, so they upscale
losslessly:

```sh
# near-lossless 1080p
npx remotion render src/index.ts LavaMoatExplainer out/hq.mp4 --crf 10

# 4K (3840x2160)
npx remotion render src/index.ts LavaMoatExplainer out/4k.mp4 --scale 2 --crf 14

# ProRes 4444 editing master
npx remotion render src/index.ts LavaMoatExplainer out/master.mov \
  --codec prores --prores-profile 4444
```

Scene durations are driven by the narration audio: `src/timing.json` maps each
scene to its clip length plus per-sentence start times (`marks`), and is
checked in along with the generated audio, so rendering works out of the box.
Scenes use the marks (or constants derived from them) to sync animation beats
to the narration.

## Regenerating narration

Narration is synthesized locally with [Piper TTS](https://github.com/OHF-Voice/piper1-gpl)
(voice: `en_GB-cori-high`). Each sentence is synthesized separately and joined
with explicit silence — this yields the per-sentence `marks` and sidesteps
piper's `--sentence-silence` flag, which in some builds fills the inserted
silence with uninitialized memory (loud static bursts). To tweak the script,
edit the texts in `scripts/build-narration.py`, then:

```sh
pip install piper-tts numpy soundfile
mkdir -p voices && cd voices && python3 -m piper.download_voices en_GB-cori-high && cd ..
npm run narration       # rebuilds public/audio/*.mp3 + src/timing.json
```

`ffmpeg` is required (audio encoding + duration probing). If you change the
text, re-check the hardcoded beat constants in `src/scenes/*` against the
printed marks (the Outro reads its marks from timing.json directly).

## Credits

- Logo, icons, and headline screenshots from the
  [talk-lavamoat-devcon6-2022](https://github.com/kumavis/talk-lavamoat-devcon6-2022) deck
- Example code and policy snippets from the talk and the
  [LavaMoat README](https://github.com/LavaMoat/LavaMoat)
