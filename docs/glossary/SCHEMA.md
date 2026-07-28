# Glossary entry schema

Every research document contributes machine-readable term definitions to this
directory. The interactive calculator loads all `*.json` files here and uses
them to render the popup term dictionary, so entries must be complete enough to
stand alone in a tooltip.

One file per research area, named after the area slug (e.g.
`japan-residency.json`). Each file is a JSON array of entries.

## Presentation rule

Throughout the docs and the webapp, a Japanese tax term is written as the
**English translation first, with the Japanese in parentheses** on first use in
a section:

> non-permanent resident (非永住者, *hi-eijūsha*)

The glossary carries the pieces separately so the UI can compose that form
itself.

## Entry fields

| field | required | notes |
|---|---|---|
| `id` | yes | kebab-case, unique across all files. Stable — the webapp links to it. |
| `en` | yes | English term, sentence case. This is the display headword. |
| `ja` | no | Japanese term in kanji/kana. Omit for US-only terms. |
| `romaji` | no | Hepburn romanisation with macrons (`hi-eijūsha`). Include whenever `ja` is present. |
| `jurisdiction` | yes | `JP`, `US`, `US-STATE`, or `TREATY`. |
| `category` | yes | Area slug, e.g. `japan-residency`, `us-ftc`. |
| `short` | yes | One sentence, ≤ 140 chars. This is the tooltip's first line. |
| `definition` | yes | 2–5 sentences. Explain the operative legal effect, not just the words. |
| `citations` | yes | Array; at least one. See below. |
| `seeAlso` | no | Array of other entry `id`s. |
| `falseFriend` | no | Set when the term is easily confused with a similar one — say what it is NOT. |

### Citation object

```json
{
  "label": "Income Tax Act art. 7(1)(ii)",
  "source": "sources/japan-statutes/income-tax-act.xml",
  "url": "https://laws.e-gov.go.jp/law/340AC0000000033"
}
```

`source` is a repo-relative path to an **archived** document under `sources/`.
Every citation must point at a file that actually exists in this repo — that is
what makes the claim checkable offline.

## Example

```json
[
  {
    "id": "non-permanent-resident",
    "en": "Non-permanent resident",
    "ja": "非永住者",
    "romaji": "hi-eijūsha",
    "jurisdiction": "JP",
    "category": "japan-residency",
    "short": "A resident without Japanese nationality who has had a domicile or residence in Japan for 5 years or less within the preceding 10 years.",
    "definition": "A non-permanent resident is a subclass of Japanese tax resident, so Japan-source income is fully taxable. The status matters because foreign-source income is taxed only to the extent it is paid within Japan or remitted to Japan. The 5-year count is cumulative across the preceding 10 years, not consecutive, and a US citizen always satisfies the 'without Japanese nationality' element.",
    "citations": [
      {
        "label": "Income Tax Act art. 2(1)(iv)",
        "source": "sources/japan-statutes/income-tax-act.xml",
        "url": "https://laws.e-gov.go.jp/law/340AC0000000033"
      }
    ],
    "seeAlso": ["resident", "non-resident", "remittance-basis"],
    "falseFriend": "Not the same as Japan's immigration status 'Permanent Resident' (永住者) — the tax test counts days of residence and ignores visa category."
  }
]
```

## Validation

`scripts/check_glossary.py` enforces the schema, unique ids, resolvable
`seeAlso` targets, and that every `citations[].source` path exists.
