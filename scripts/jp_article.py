#!/usr/bin/env python3
"""Pull specific articles out of an e-Gov statute XML file.

The e-Gov law API returns whole acts -- the Income Tax Act (所得税法) alone is
~18 MB -- which is impractical to read or grep directly. This extracts just the
articles you name, preserving paragraph and item structure.

Usage:
    scripts/jp_article.py <law.xml> <article> [<article> ...]

Article numbers use e-Gov's `Num` convention, where "の" becomes an underscore:
    7       -> 第七条            (scope of taxable income)
    60_2    -> 第六十条の二      (exit tax / 国外転出時課税)
    95      -> 第九十五条        (foreign tax credit)

Example:
    .venv/bin/python scripts/jp_article.py \\
        sources/japan-statutes/income-tax-act.xml 7 95 161 > /tmp/arts.txt
"""
import sys
import xml.etree.ElementTree as ET


def text_of(node) -> str:
    """Concatenate all descendant text, dropping structural whitespace.

    Ruby annotations (<Ruby>) carry furigana in <Rt> children; those are reading
    aids rather than statutory text, so they are skipped to keep quotes clean.
    """
    parts = []
    if node.tag == "Rt":
        return ""
    if node.text:
        parts.append(node.text.strip())
    for child in node:
        parts.append(text_of(child))
        if child.tail:
            parts.append(child.tail.strip())
    return "".join(p for p in parts if p)


def render(article, indent: str = "") -> str:
    lines = []
    title = article.find("ArticleTitle")
    caption = article.find("ArticleCaption")
    header = (text_of(title) if title is not None else f"Article {article.get('Num')}")
    if caption is not None:
        header += " " + text_of(caption)
    lines.append(indent + header)

    for para in article.findall("Paragraph"):
        num = para.get("Num", "")
        sentence = para.find("ParagraphSentence")
        body = text_of(sentence) if sentence is not None else ""
        lines.append(f"{indent}  ({num}) {body}")
        for item in para.findall("Item"):
            it = item.find("ItemTitle")
            isent = item.find("ItemSentence")
            lines.append(
                f"{indent}    {text_of(it) if it is not None else ''} "
                f"{text_of(isent) if isent is not None else ''}".rstrip()
            )
            for sub in item.findall("Subitem1"):
                st = sub.find("Subitem1Title")
                ss = sub.find("Subitem1Sentence")
                lines.append(
                    f"{indent}      {text_of(st) if st is not None else ''} "
                    f"{text_of(ss) if ss is not None else ''}".rstrip()
                )
    return "\n".join(lines)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    root = ET.parse(sys.argv[1]).getroot()
    wanted = sys.argv[2:]

    # Index every Article in the document by its Num attribute. Articles appear
    # at varying depths (Part > Chapter > Section > Subsection), and supplementary
    # provisions (附則) reuse numbers, so the first match in document order wins.
    index = {}
    for article in root.iter("Article"):
        num = article.get("Num")
        if num is not None and num not in index:
            index[num] = article

    missing = [n for n in wanted if n not in index]
    for num in wanted:
        if num in index:
            print(render(index[num]))
            print()

    if missing:
        print(f"NOT FOUND: {', '.join(missing)}", file=sys.stderr)
        print(f"(document contains {len(index)} articles)", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
