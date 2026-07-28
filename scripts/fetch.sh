#!/usr/bin/env bash
# fetch.sh -- download a primary source document verbatim into sources/ and
# record its provenance (URL, retrieval timestamp, HTTP status, sha256, bytes).
#
# Usage:  scripts/fetch.sh <area> <basename> <url> ["short description"]
#   area      subdirectory under sources/  (e.g. japan-nta, us-irs, treaty)
#   basename  filename to save as, INCLUDING extension (e.g. pub514-2024.pdf)
#   url       the URL to retrieve
#
# Writes:   sources/<area>/<basename>          the original bytes, unmodified
#           sources/<area>/MANIFEST.tsv        one provenance row per document
#
# Each area gets its own MANIFEST.tsv so parallel agents never write the same
# file. scripts/merge_manifests.sh combines them into sources/MANIFEST.md.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AREA="${1:?usage: fetch.sh <area> <basename> <url> [description]}"
NAME="${2:?missing basename}"
URL="${3:?missing url}"
DESC="${4:-}"

DIR="$REPO/sources/$AREA"
OUT="$DIR/$NAME"
MANIFEST="$DIR/MANIFEST.tsv"
mkdir -p "$DIR"

# Retry with exponential backoff; some government hosts rate-limit aggressively.
STATUS=""
for delay in 0 2 4 8 16; do
  [ "$delay" -gt 0 ] && sleep "$delay"
  STATUS=$(curl -sSL --compressed --max-time 180 \
    -A 'Mozilla/5.0 (compatible; tax-research-archival/1.0)' \
    -o "$OUT" -w '%{http_code}' "$URL" 2>/dev/null)
  [ "$STATUS" = "200" ] && break
done

if [ "$STATUS" != "200" ] || [ ! -s "$OUT" ]; then
  echo "FAIL  $URL  (http=$STATUS)" >&2
  rm -f "$OUT"
  exit 1
fi

SHA=$(sha256sum "$OUT" | cut -d' ' -f1)
SIZE=$(stat -c%s "$OUT")
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

if [ ! -f "$MANIFEST" ]; then
  printf 'file\turl\tretrieved_utc\thttp\tbytes\tsha256\tdescription\n' > "$MANIFEST"
fi
printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
  "$NAME" "$URL" "$TS" "$STATUS" "$SIZE" "$SHA" "$DESC" >> "$MANIFEST"

echo "OK    sources/$AREA/$NAME  ($SIZE bytes, sha256 ${SHA:0:12}...)"
