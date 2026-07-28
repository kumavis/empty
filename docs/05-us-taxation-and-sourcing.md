# US taxation of a citizen abroad, and income sourcing

```
As of:        2026-07-28
Applies to:   US tax years 2025-2026 where figures are given
Verified by:  IRC sections 861-865 and 911 read verbatim from sources/us-code/,
              and IRS publications archived in sources/us-irs/
```

The US taxes citizens on **worldwide income regardless of where they live**. The
move to Japan does not end US filing; it creates a second filing. Everything in
this document is about limiting the overlap, not escaping it.

## 1. Sourcing is the whole game

Sourcing determines whether the foreign tax credit has room to operate (doc 06).
An item taxed by Japan but **sourced to the US** produces no credit capacity — the
taxpayer pays both. So sourcing, not rates, is where the double-tax risk lives.

### Compensation for personal services

Sourced **where the services are performed** [IRC §861(a)(3), §862(a)(3)]. Salary
for work performed in Japan is **foreign-source** to the US — irrespective of who
pays it or into which account. A year straddling the move is apportioned on a time
basis under Treas. Reg. §1.861-4.

Note this is the **mirror image** of the Japanese rule (doc 03 §6): the same salary
is Japan-source for Japan and foreign-source for the US. The two systems agree,
which is why salary is the *easy* case — Japan taxes first as source country, and
the US credit relieves it.

### Gains on personal property — the §865 machinery

This is the hard case, and it is more favourable than commentary usually suggests.

**§865(a):** income from the sale of personal property —
> (1) by a **United States resident** shall be sourced in the United States, or
> (2) by a **nonresident** shall be sourced outside the United States.

**§865(g)(1)(A)(i)(I)** then defines the term counter-intuitively:
> The term "United States resident" means any individual who **is a United States
> citizen or a resident alien and does not have a tax home (as defined in section
> 911(d)(3)) in a foreign country**.

So a US citizen **with a tax home in Japan is *not* a "United States resident"**
for §865. Under §865(g)(1)(B) they are a "nonresident", and §865(a)(2) sources
their securities gains **outside the United States** — foreign-source, which is
exactly what the credit needs.

**But §865(g)(2) gates it:**
> a United States citizen or resident alien **shall not be treated as a nonresident**
> with respect to any sale of personal property **unless an income tax equal to at
> least 10 percent of the gain** derived from such sale **is actually paid to a
> foreign country** with respect to that gain.

[IRC §865(a), (g)] — `sources/us-code/irc-865.html`

### The interlock with the Japanese remittance basis

Read §865(g)(2) alongside doc 02 and a rigid either/or appears:

| Japanese treatment of the gain | Japanese tax paid | §865(g)(2) satisfied? | US source | Result |
|---|---|---|---|---|
| Sheltered (not remitted) | **0%** | **No** | **US-source** | US taxes in full; nothing to credit, nothing double-taxed |
| Taxed (remitted, or phase 3) | 20.315% | **Yes** (≥10%) | **Foreign** | Japan taxes; US credit has room |

> **The single most important consequence for this project: the Japanese
> remittance shelter does not save US tax.** It saves the *Japanese* tax. The US
> tax on the gain is owed either way. Someone modelling this as "no tax while
> unremitted" is wrong by the entire US liability.

The corollary is that the shelter's value equals the Japanese tax avoided **minus
the US tax that would have been credited away anyway**. Where the US and Japanese
rates are close, that difference is small; where the US rate is low (0%/15%
brackets) it is real. Doc 09 quantifies this.

### Other sourcing rules

| Income | Source | Authority |
|---|---|---|
| Real property gains | Where the property is | §861(a)(5), §862(a)(5) |
| Dividends | Payer's residence | §861(a)(1)-(2), §862(a)(1)-(2) |
| Interest | Payer's residence | §861(a)(1), §862(a)(1) |
| Inventory sales | Special rules; §865 disapplied | §865(b) |

§865(e)(2) additionally sources sales attributable to a foreign fixed place of
business outside the US, again subject to a **10% actual foreign tax** condition
[§865(e)(1)(B)].

## 2. The foreign earned income exclusion — §911

**Earned income only.** §911 excludes *foreign earned income* — compensation for
services. It has **no application whatever to capital gains, dividends or
interest**. This is the sharpest answer to the user's earned-vs-capital question on
the US side.

| Year | Maximum exclusion |
|---|---|
| 2025 | **$130,000** |
| 2026 | **$132,900** |

Adjusted annually; 2026 figures per the IRS inflation-adjustment release.

Qualification requires a **tax home** in a foreign country plus **either**:

- the **bona fide residence test** — an uninterrupted period including a full tax
  year, a facts-and-circumstances test; or
- the **physical presence test** — 330 full days in any 12 consecutive months.

In a mid-year move only the physical presence test is usually available in year
one, and the exclusion is **pro-rated** by qualifying days.

A **housing exclusion** sits on top, over a base amount and under a cap; the cap is
raised for high-cost locations, and **Tokyo carries a location-specific limit** in
the annual IRS notice. Exact figures are in the Form 2555 instructions
[`sources/us-irs/i2555.pdf`] and are **not transcribed here** — see Open questions.

Two traps:

- **Stacking, §911(f).** Excluded income still pushes remaining income into higher
  brackets. The exclusion removes income from tax, not from the rate calculation.
- **No double benefit, §911(d)(6).** Foreign taxes allocable to excluded income are
  **not creditable**. Claiming §911 destroys the credit on the excluded slice — see
  doc 06 §7. For a high earner facing ~55% Japanese rates, §911 is frequently
  **worse** than taking a full credit, because it burns creditable Japanese tax to
  shelter income the credit would have covered anyway.

## 3. US rates on the two income types

**Capital gains.** Long-term (held over one year) at 0/15/20% by bracket;
short-term at ordinary rates to 37%. Note the **holding period mismatch**: the US
uses a one-year test from the acquisition date, Japan uses no holding-period test
at all for securities and a five-year test measured to 1 January for real property
(doc 03 §4). The same asset can be long-term in one country and not the other.

**Net investment income tax, §1411.** An additional **3.8%** on net investment
income above threshold. Critically, **no foreign tax credit is allowed against
NIIT** under the general rules — §901 credits run against chapter 1 tax, and NIIT
sits in chapter 2A. So 3.8% on investment income is **structurally
uncreditable** and is paid on top of any Japanese tax.

There has been litigation on whether treaty relief articles override this. Recent
decisions have gone in favour of taxpayers in some instances. **This is contested,
not settled** — the calculator should default to NIIT being uncreditable and flag
the treaty position as an upside case. See Open questions.

## 4. Compliance obligations triggered by the move

- **FBAR (FinCEN 114)** — aggregate foreign accounts over **$10,000** at any point
  in the year. Low threshold, severe penalties, filed separately from the return.
- **FATCA Form 8938** — higher thresholds for taxpayers living abroad than for
  domestic filers. Exact thresholds in Pub 519 — not transcribed here.
- **Form 8621 / PFICs** — **Japanese mutual funds and investment trusts are almost
  always PFICs.** The punitive PFIC regime can exceed 50% effective rates and
  imposes heavy reporting. A US citizen in Japan should generally hold securities
  through **non-Japanese** funds. This is one of the most commonly and expensively
  missed points for Americans in Japan.
- **Automatic extension** to 15 June for taxpayers abroad, further extendable —
  but **interest still runs from April**. Japan's return deadline is 15 March, so
  the Japanese liability is normally known before the US return is due. That
  ordering is convenient and matters for the paid/accrued election in doc 06 §6.

## 5. Confidence

**Settled** — read from the US Code text archived here:

- §865(a)'s residence-of-seller rule and §865(g)'s inverted definition, under which
  a US citizen with a foreign tax home is a "nonresident".
- **§865(g)(2)'s 10%-actual-foreign-tax condition** — the interlock with the
  Japanese remittance basis. This is the key US-side finding.
- §861(a)(3)/§862(a)(3) sourcing compensation where services are performed.
- §911's restriction to *earned* income, the two qualification tests, the §911(f)
  stacking rule and the §911(d)(6) denial of credit on excluded income.

**Likely but unverified:**

- FEIE amounts of $130,000 (2025) and $132,900 (2026) — from IRS web material, not
  transcribed from an archived Revenue Procedure.
- That NIIT is uncreditable. This follows from the chapter placement of §1411 and
  is the mainstream position, but no archived source is quoted for it here.
- Capital gains bracket thresholds and the FBAR/8938 thresholds — asserted from
  general knowledge, not transcribed from the archived publications.
- That Japanese investment trusts are PFICs — near-universally reported, and
  structurally very likely, but not verified against §1297 analysis here.

**Open questions:**

1. **Transcribe the §911 housing figures** for Japan/Tokyo from the archived Form
   2555 instructions, including the base and the location-specific cap.
2. **NIIT and the treaty** — establish the current state of the litigation and
   whether a treaty-based position on Form 8833 is sustainable. Worth 3.8% of all
   investment income, so worth resolving properly.
3. **Whether Japanese tax "actually paid" for §865(g)(2)** includes inhabitant tax
   paid in a *later* year, given the one-year lag (doc 03 §3). If only the national
   15.315% counts in-year it still clears 10%, so the conclusion holds either way —
   but the mechanics affect the credit computation.
4. **Whether the §865(g)(2) test is applied sale-by-sale.** The text says "with
   respect to any sale", implying per-sale. Under the Japanese ordering rule
   (doc 02 §4) a *partial* deemed remittance may mean Japanese tax is paid on only
   part of a year's gains — so some sales clear 10% and others do not, splitting
   the sourcing within a single year. **This is a genuinely unresolved interaction
   between the two regimes and it directly affects the calculator's arithmetic.**

## Sources

| Label | Archived file | Original URL |
|---|---|---|
| IRC §865 | `sources/us-code/irc-865.html` | https://www.law.cornell.edu/uscode/text/26/865 |
| IRC §861, §862 | `sources/us-code/irc-861.html`, `irc-862.html` | https://www.law.cornell.edu/uscode/text/26/861 |
| IRC §911 | `sources/us-code/irc-911.html` | https://www.law.cornell.edu/uscode/text/26/911 |
| IRC §1411 | `sources/us-code/irc-1411.html` | https://www.law.cornell.edu/uscode/text/26/1411 |
| IRS Pub 54 | `sources/us-irs/p54.pdf` | https://www.irs.gov/pub/irs-pdf/p54.pdf |
| IRS Pub 519 | `sources/us-irs/p519.pdf` | https://www.irs.gov/pub/irs-pdf/p519.pdf |
| Form 2555 instructions | `sources/us-irs/i2555.pdf` | https://www.irs.gov/pub/irs-pdf/i2555.pdf |
| FEIE amounts | — (web) | https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill |

Retrieved 2026-07-28; see `sources/*/MANIFEST.tsv` for hashes.
