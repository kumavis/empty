# US–Japan tax research and calculator

Research toward an interactive tax calculator and strategy explorer for a **US
citizen moving tax domicile from the United States to Japan**.

> **This is research, not tax advice.** It records what the primary sources say,
> with citations you can check. A qualified preparer's position may differ, and
> several points here are explicitly unresolved. Do not act on it without advice.

**New here? Read [`docs/00-overview.md`](docs/00-overview.md).**

## What is in this repository

Two halves, deliberately separated:

```
sources/    Primary documents, archived verbatim. Never edited.
docs/       Analysis. Every claim cites a file in sources/.
scripts/    Tooling to fetch, extract and validate.
```

**36 documents archived** — Japanese statutes from the e-Gov API, NTA guidance,
IRC sections, IRS publications and form instructions, the US–Japan Convention and
its protocols and technical explanations, and US state guidance. Each carries its
URL, retrieval time, size and sha256 in [`sources/MANIFEST.md`](sources/MANIFEST.md),
so you can confirm the bytes have not changed since retrieval.

The rule is in [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md): **nothing is asserted
without a citation to an archived source**, and anything that cannot be tied to one
goes in an *Open questions* section rather than the body. Each document closes by
separating settled law from inference.

## The documents

| Doc | Subject |
|---|---|
| [00](docs/00-overview.md) | **Overview — start here** |
| [01](docs/01-japan-residency-status.md) | Residency classification and the three phases |
| [02](docs/02-japan-remittance-basis.md) | **The remittance basis — the central rule** |
| [03](docs/03-japan-income-categories-and-rates.md) | Japanese income categories and rate tables |
| [04](docs/04-japan-exit-tax-and-leaving.md) | Exit tax, departure timing, moving money out |
| [05](docs/05-us-taxation-and-sourcing.md) | US taxation of citizens abroad, and sourcing |
| [06](docs/06-us-foreign-tax-credit.md) | How the foreign tax credit is calculated |
| [07](docs/07-us-japan-tax-treaty.md) | Treaty, saving clause, and re-sourcing |
| [08](docs/08-severing-us-state-domicile.md) | Leaving US state domicile *(least researched)* |
| [09](docs/09-strategy-levers.md) | **Strategy levers and calculator specification** |

## Terminology

Japanese tax terms are written as the **English translation first, with the
Japanese in parentheses** on first use in a section:

> non-permanent resident (非永住者, *hi-eijūsha*)

Every such term also has a machine-readable entry in
[`docs/glossary/`](docs/glossary/) — currently **51 entries, 32 with Japanese
terms**. The interactive calculator loads these directly to render its popup term
dictionary, so entries are written to stand alone in a tooltip. The schema, and
the `falseFriend` field used to flag genuinely confusable pairs, are documented in
[`docs/glossary/SCHEMA.md`](docs/glossary/SCHEMA.md).

## Working with the sources

Setup, once:

```bash
python3 -m venv .venv
.venv/bin/pip install pdfminer.six html2text
```

Archive a new source — this is the only sanctioned way to add one, because it
records provenance:

```bash
./scripts/fetch.sh <area> <filename.ext> <url> "<description>"
./scripts/merge_manifests.sh          # roll the per-area manifests into MANIFEST.md
```

Make an archived document greppable (writes a `.txt` sibling; the original is
never modified):

```bash
.venv/bin/python scripts/extract.py sources/us-irs/p514.pdf
```

Read specific articles out of a Japanese statute. The Income Tax Act alone is
~18 MB, so whole-file reading is impractical. Article numbers use e-Gov's `Num`
convention, where 「の」 becomes `_` (so 第六十条の二 is `60_2`):

```bash
.venv/bin/python scripts/jp_article.py \
    sources/japan-statutes/income-tax-act.xml 7 95 60_2
```

Validate the glossary before committing:

```bash
.venv/bin/python scripts/check_glossary.py
```

It checks the schema, unique ids across all files, that every `seeAlso` target
resolves, and that **every cited source path actually exists in the repo**.

## The calculator

A TypeScript webapp in [`app/`](app/) — Vite, React, and a tax engine kept in pure
modules under `app/src/domain/` so it is testable independently of the UI.

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm test           # 22 tests anchoring the engine to the worked examples in docs/
npm run typecheck
```

| Module | Implements |
|---|---|
| `domain/phases.ts` | The two clocks — income tax (days, ignores visa) and exit tax (visa, ignores days) |
| `domain/japan.ts` | Remittance ordering rule, specified-securities test, pro-rata allocation |
| `domain/us.ts` | §865(g)(2) interlock, per-basket §904 limitation, uncreditable NIIT |
| `domain/engine.ts` | Multi-year projection; Japan first, since its tax decides US sourcing |
| `domain/rates.ts` | Rate tables, versioned by tax year |

Every Japanese term in the UI goes through the `<T>` component, which renders the
English translation with the Japanese in parentheses and opens a popup carrying
the definition, its citations into `sources/`, and any false-friend warning. It
reads `docs/glossary/*.json` directly, so the research stays the single source of
truth and the two cannot drift.

The tests are the interesting part: they encode the worked example from
[doc 02 §5](docs/02-japan-remittance-basis.md) end to end, the NTA's own rate-table
example, and the finding that a work-visa holder is never exposed to the exit tax
however large the portfolio. **When a test and a document disagree, the document
is the authority.**

### Known approximations, surfaced in the UI rather than hidden

- A **transition year is not apportioned.** Enforcement Order art. 17(4)(vi)
  requires splitting the year at the status change; the model applies the year-end
  phase to the whole year and says so in its notes.
- The **§904(b)(2)(B) factor is estimated**, not transcribed from the Form 1116
  instructions.
- The **§865(g)(2) test is applied in aggregate**, though the statute's "any sale"
  wording suggests it is per-sale (doc 05 open question 4).

## Status

**Done** — primary sources archived; ten cited briefs written; glossary populated
and validating; calculator built, typechecking, and tested.

**Before the calculator's output can be relied on**, close the open questions
flagged in the briefs — principally: Japanese inhabitant tax rules and their
creditability, the §904(b)(2)(B) capital gain adjustment, whether Japan allows any
basis step-up on becoming resident, and reading the 2013 Protocol against the 2003
Convention.
