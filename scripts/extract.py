#!/usr/bin/env python3
"""Extract readable text from an archived source document.

Usage:  scripts/extract.py <input file> [output file]

Writes a `.txt` sibling next to the input when no output path is given. The
original download is never modified -- the extraction is a convenience copy so
that statutes and IRS publications are greppable from the repo.

Handles PDF (pdfminer.six), HTML/XHTML (html2text) and XML (structural
flattening, used for the e-Gov statute feeds). Run it with the repo venv:

    .venv/bin/python scripts/extract.py sources/us-irs/p514.pdf
"""
import re
import sys
from pathlib import Path


def from_pdf(path: Path) -> str:
    from pdfminer.high_level import extract_text
    return extract_text(str(path))


def decode(path: Path) -> str:
    """Decode a downloaded document, honouring its declared encoding.

    NTA circular pages are served as Shift-JIS (cp932) with a meta charset and
    no BOM. Decoding those as UTF-8 with errors="replace" does not fail -- it
    silently yields mojibake, which then reads as an empty or garbled extraction
    rather than an error. Since the whole archive is Japanese primary sources,
    guessing UTF-8 is not safe; sniff the declared charset first.
    """
    raw = path.read_bytes()

    declared = re.search(
        rb'(?:charset=["\']?|encoding=["\'])([A-Za-z0-9_\-]+)', raw[:4096]
    )
    candidates = []
    if declared:
        candidates.append(declared.group(1).decode("ascii", "ignore"))
    candidates += ["utf-8", "cp932", "euc_jp"]

    for enc in candidates:
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    # Every candidate failed; fall back loudly rather than returning mojibake.
    print(f"warning: no clean decoding for {path.name}; using utf-8 with replacement",
          file=sys.stderr)
    return raw.decode("utf-8", errors="replace")


def from_html(path: Path) -> str:
    import html2text
    h = html2text.HTML2Text()
    h.body_width = 0          # never re-wrap; keeps quoted passages intact
    h.ignore_images = True
    h.ignore_emphasis = False
    h.unicode_snob = True     # keep Japanese text and typographic quotes as-is
    return h.handle(decode(path))


def from_xml(path: Path) -> str:
    """Flatten an XML tree to indented text.

    The e-Gov law API returns deeply nested <Article>/<Paragraph>/<Item>
    elements; indenting by depth preserves the statutory structure that the
    article numbering depends on.
    """
    import xml.etree.ElementTree as ET
    root = ET.parse(str(path)).getroot()
    out = []

    def walk(node, depth):
        text = (node.text or "").strip()
        if text:
            out.append("  " * depth + text)
        for child in node:
            walk(child, depth + 1)
        tail = (node.tail or "").strip()
        if tail:
            out.append("  " * depth + tail)

    walk(root, 0)
    return "\n".join(out)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    src = Path(sys.argv[1])
    if not src.is_file():
        print(f"no such file: {src}", file=sys.stderr)
        return 1

    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(src.suffix + ".txt")

    suffix = src.suffix.lower()
    if suffix == ".pdf":
        text = from_pdf(src)
    elif suffix in (".html", ".htm", ".xhtml"):
        text = from_html(src)
    elif suffix == ".xml":
        text = from_xml(src)
    elif suffix == ".json":
        text = src.read_text(encoding="utf-8", errors="replace")
    else:
        # Unknown extension: sniff the magic bytes rather than give up.
        head = src.open("rb").read(5)
        text = from_pdf(src) if head.startswith(b"%PDF") else from_html(src)

    text = re.sub(r"\n{4,}", "\n\n\n", text)
    dst.write_text(text, encoding="utf-8")
    print(f"OK    {dst}  ({len(text)} chars)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
