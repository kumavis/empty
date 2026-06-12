#!/usr/bin/env python3
"""Generates narration audio for each scene and writes src/timing.json
so the Remotion composition can size scenes to the audio.

Usage: build-narration.py [sceneId ...]
With scene ids, only those clips are regenerated; other scenes keep their
existing timing.json entries (so their hardcoded beat constants stay valid).

Uses Piper TTS (https://github.com/OHF-Voice/piper1-gpl) with the
`en_GB-cori-high` voice. Each sentence is synthesized separately and
joined with explicit silence, which both gives us per-sentence start
times (the `marks` array, used to sync animations to the narration) and
avoids piper's --sentence-silence flag — some builds fill that inserted
"silence" with uninitialized memory, producing loud static bursts.
"""
import json
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf

ROOT = os.path.join(os.path.dirname(__file__), "..")
AUDIO_DIR = os.path.join(ROOT, "public", "audio")
MODEL = os.path.join(ROOT, "voices", "en_GB-cori-high.onnx")
SENTENCE_GAP = 0.3  # seconds of silence inserted between sentences

SCENES = [
    {
        "id": "title",
        "lead": 0.4,
        "tail": 0.8,
        "text": "This is LavaMoat: security tools that protect JavaScript apps from supply chain attacks. Here's why you need it.",
    },
    {
        "id": "deps",
        "lead": 0.5,
        "tail": 0.9,
        "text": "A modern JavaScript app is mostly code you didn't write. You add six dependencies; they bring along twelve hundred more. That's code from hundreds of strangers, all running with full access to your application. Any one of these modules could harm your computer, or your users' computers.",
    },
    {
        "id": "incident",
        "lead": 0.5,
        "tail": 0.9,
        "text": "And this is not hypothetical. Twenty eighteen: the event-stream package, with millions of downloads a week, gets handed to a new maintainer. Malicious code ships inside the Copay Bitcoin wallet, and steals users' private keys.",
    },
    {
        "id": "timeline",
        "lead": 0.5,
        "tail": 0.9,
        "text": "And it never stopped. Year after year, popular packages kept getting hijacked. Then twenty twenty-five broke every record. Chalk and debug: hijacked, two billion weekly downloads. And Shai-Hulud: the first self-replicating n p m worm, backdooring nearly eight hundred packages across two waves. Twenty twenty-six? Still accelerating. It's no longer a question of if. Only when.",
    },
    {
        "id": "stages",
        "lead": 0.5,
        "tail": 0.9,
        "text": "A malicious package can strike anywhere in your pipeline. At install: lifecycle scripts run arbitrary code on your machine. At build: it rides inside your tooling. And at runtime: it ships in the app your users trust.",
    },
    {
        "id": "mutable",
        "lead": 0.5,
        "tail": 0.9,
        "text": "So why is JavaScript such an easy target? In a word: flexibility. Remember that word, because the same flexibility that makes JavaScript vulnerable is exactly what will let us make it safe. First, the danger. Reason one: everything is mutable. Any package can overwrite Array prototype map, and instantly, the entire app is compromised.",
    },
    {
        "id": "ambient",
        "lead": 0.5,
        "tail": 0.9,
        "text": "Reason two: ambient authority. That innocent little string library has every power your own code has. One malicious update, and it's shipping your secrets to an evil lair, while working perfectly, so nobody notices.",
    },
    {
        "id": "hardened",
        "lead": 0.5,
        "tail": 0.9,
        "text": "Enter LavaMoat. It's built on Hardened JavaScript: that same flexibility, turned into defense. Lockdown freezes the primordials: nobody tampers with shared built-ins, ever. And Compartments give each package its own isolated globals. It touches only what you explicitly hand it.",
    },
    {
        "id": "policy",
        "lead": 0.5,
        "tail": 0.9,
        "text": "Here's the magic. LavaMoat wraps every dependency in its own compartment, enforced by a policy: exactly which globals, which built-ins, which packages each one may access. And LavaMoat writes that policy for you. Automatically. One command.",
    },
    {
        "id": "toolkit",
        "lead": 0.5,
        "tail": 0.9,
        "text": "Adopt it one step at a time. Allow-scripts blocks surprise install scripts. LavaMoat Node shields your build. And bundler plugins for webpack and browserify lock down your runtime.",
    },
    {
        "id": "outro",
        "lead": 0.5,
        "tail": 2.0,
        "text": "Today, LavaMoat guards MetaMask in production: tens of millions of users, every single day. So what's the answer? Never use dependencies? Unrealistic. Audit all of node_modules? Impossible. Contain every package, with LavaMoat? Solved. The next supply chain attack is coming. Make sure it can't do any damage. github dot com, slash LavaMoat.",
    },
]


def probe_seconds(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, check=True)
    return float(out.stdout)


def main():
    from piper import PiperVoice

    only = set(sys.argv[1:])
    unknown = only - {s["id"] for s in SCENES}
    if unknown:
        sys.exit(f"unknown scene ids: {', '.join(sorted(unknown))}")
    timing_path = os.path.join(ROOT, "src", "timing.json")
    existing = {}
    if only and os.path.exists(timing_path):
        with open(timing_path) as f:
            existing = json.load(f)

    os.makedirs(AUDIO_DIR, exist_ok=True)
    voice = PiperVoice.load(MODEL)
    sr = voice.config.sample_rate
    gap = np.zeros(int(SENTENCE_GAP * sr), dtype=np.float32)

    timing = {}
    for scene in SCENES:
        if only and scene["id"] not in only and scene["id"] in existing:
            timing[scene["id"]] = existing[scene["id"]]
            continue
        sentences = re.split(r"(?<=[.!?;]) +", scene["text"])
        chunks = []
        marks = []  # start time (s) of each sentence within the clip
        offset = 0
        for sentence in sentences:
            if chunks:
                chunks.append(gap)
                offset += gap.size
            marks.append(round(offset / sr, 3))
            audio = np.concatenate(
                [c.audio_float_array for c in voice.synthesize(sentence)])
            chunks.append(audio)
            offset += audio.size
        wav = os.path.join(AUDIO_DIR, f"{scene['id']}.wav")
        mp3 = os.path.join(AUDIO_DIR, f"{scene['id']}.mp3")
        sf.write(wav, np.concatenate(chunks), sr)
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-i", wav,
             "-codec:a", "libmp3lame", "-q:a", "4", mp3],
            check=True)
        os.remove(wav)
        audio_sec = probe_seconds(mp3)
        timing[scene["id"]] = {
            "audio": f"audio/{scene['id']}.mp3",
            "lead": scene["lead"],
            "audioSec": round(audio_sec, 3),
            "durationSec": round(max(scene["lead"] + audio_sec + scene["tail"], 4), 3),
            "marks": marks,
        }
        print(f"{scene['id']:<10} {audio_sec:.2f}s  marks={marks}")

    with open(timing_path, "w") as f:
        json.dump(timing, f, indent=2)
    total = sum(t["durationSec"] for t in timing.values())
    print(f"total ≈ {total:.1f}s")


if __name__ == "__main__":
    main()
