# Documentation conventions

These rules apply to every file in `docs/`. They exist so that a reader can
verify any statement against primary law without leaving the repository.

## 1. Nothing is asserted without a citation

Every substantive statement carries a citation to an **archived** source under
`sources/`. Inline form:

> A non-permanent resident is taxed on foreign-source income only to the extent
> it is paid in Japan or remitted to Japan. [ITA art. 7(1)(ii)]

with a `## Sources` table at the foot of the document mapping each short label
to the archived file, the original URL, and the retrieval date.

If a statement cannot be tied to a primary source, it belongs in the
**Open questions** section, not in the body.

## 2. Primary sources beat secondary sources

Preference order:

1. Statute / treaty text (e-Gov, US Code, Treasury treaty PDFs)
2. Cabinet Orders and Regulations (施行令, 施行規則, Treas. Reg.)
3. Tax authority guidance (NTA *tax answer* pages, IRS publications, form instructions)
4. Accounting-firm commentary — **only** to locate a primary source, never as the citation itself

Big-4 and law-firm summaries are useful navigation aids and are frequently
wrong on detail. If a document relies on one, say so explicitly and mark the
point as unverified.

## 3. Terminology

Use the correct legal term, with the Japanese in parentheses on first use in
each section:

> non-permanent resident (非永住者, *hi-eijūsha*)

Avoid loose paraphrases ("temporary resident", "the 5-year rule") except when
explicitly noting them as informal usage that maps onto a legal term. Every
term used this way must also have an entry in `docs/glossary/` — see
`docs/glossary/SCHEMA.md`.

## 4. Say when the law is as of

Each document opens with a front-matter block:

```
As of:        2026-07-28
Applies to:   Japanese tax years 2025 onward; US tax years 2025 onward
Verified by:  <what was checked, and against what>
```

Tax rates, thresholds and bracket tables change annually. A figure without a
year attached is a defect.

## 5. Confidence is stated, not implied

Close each document with:

- **Settled** — points resting directly on statute or treaty text.
- **Likely but unverified** — points resting on guidance or inference; say what
  would settle them.
- **Open questions** — points where the archived sources genuinely do not
  answer the question.

Never resolve an open question by picking the plausible answer. The
calculator's output is only as trustworthy as the honesty of this section.

## 6. This is research, not advice

These documents record what the sources say. They are not tax advice, and the
positions taken by a return preparer may differ. Where a question is
genuinely contestable — the treatment of a particular remittance, say — the
document should present the competing readings rather than assert one.
