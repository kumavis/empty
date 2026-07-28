#!/usr/bin/env python3
"""Validate docs/glossary/*.json against docs/glossary/SCHEMA.md.

The interactive calculator loads these files directly to build its popup term
dictionary, so a malformed entry is a runtime bug in the webapp rather than a
documentation nit. Run before committing:

    .venv/bin/python scripts/check_glossary.py

Exits non-zero and prints every problem found.
"""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
GLOSSARY = REPO / "docs" / "glossary"

REQUIRED = ("id", "en", "jurisdiction", "category", "short", "definition", "citations")
JURISDICTIONS = {"JP", "US", "US-STATE", "TREATY"}
SHORT_MAX = 140


def main() -> int:
    problems: list[str] = []
    entries: dict[str, tuple[str, dict]] = {}   # id -> (source file, entry)

    files = sorted(GLOSSARY.glob("*.json"))
    if not files:
        print(f"no glossary files found in {GLOSSARY}", file=sys.stderr)
        return 1

    for path in files:
        rel = path.relative_to(REPO)
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            problems.append(f"{rel}: invalid JSON -- {exc}")
            continue

        if not isinstance(data, list):
            problems.append(f"{rel}: top level must be an array of entries")
            continue

        for i, entry in enumerate(data):
            where = f"{rel}[{i}]"
            if not isinstance(entry, dict):
                problems.append(f"{where}: entry must be an object")
                continue

            for field in REQUIRED:
                if not entry.get(field):
                    problems.append(f"{where}: missing required field '{field}'")

            eid = entry.get("id")
            if eid:
                where = f"{rel}:{eid}"
                if eid in entries:
                    problems.append(
                        f"{where}: duplicate id, already defined in {entries[eid][0]}"
                    )
                else:
                    entries[eid] = (str(rel), entry)

            jur = entry.get("jurisdiction")
            if jur and jur not in JURISDICTIONS:
                problems.append(
                    f"{where}: jurisdiction '{jur}' not one of {sorted(JURISDICTIONS)}"
                )

            short = entry.get("short", "")
            if len(short) > SHORT_MAX:
                problems.append(
                    f"{where}: 'short' is {len(short)} chars, limit is {SHORT_MAX}"
                )

            # A Japanese term without its romanisation is unusable in the UI,
            # which composes "English (日本語, romaji)" from the separate fields.
            if entry.get("ja") and not entry.get("romaji"):
                problems.append(f"{where}: has 'ja' but no 'romaji'")

            for j, cite in enumerate(entry.get("citations") or []):
                cwhere = f"{where}.citations[{j}]"
                if not isinstance(cite, dict):
                    problems.append(f"{cwhere}: citation must be an object")
                    continue
                for field in ("label", "source", "url"):
                    if not cite.get(field):
                        problems.append(f"{cwhere}: missing '{field}'")
                src = cite.get("source")
                if src and not (REPO / src).exists():
                    problems.append(f"{cwhere}: source path does not exist -- {src}")

    # seeAlso targets can only be checked once every file has been read.
    for eid, (rel, entry) in entries.items():
        for target in entry.get("seeAlso") or []:
            if target not in entries:
                problems.append(f"{rel}:{eid}: seeAlso target '{target}' does not resolve")

    if problems:
        print(f"FAIL  {len(problems)} problem(s) in {len(files)} file(s):\n", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1

    jp = sum(1 for _, e in entries.values() if e.get("ja"))
    print(f"OK    {len(entries)} entries across {len(files)} files ({jp} with Japanese terms)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
