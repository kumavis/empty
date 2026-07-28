# How the US foreign tax credit is calculated

```
As of:        2026-07-28
Applies to:   US tax years 2025-2026
Verified by:  IRC sections 901-905 read verbatim from sources/us-code/, and the
              Form 1116 instructions archived in sources/us-irs/i1116.pdf
```

This document is written to be **implementable**. Section 4 is the algorithm.

## 1. What is creditable

§901 allows a credit for **income, war profits and excess profits taxes** paid or
accrued to a foreign country. §903 extends it to taxes paid **"in lieu of"** an
income tax.

Japanese taxes and their treatment:

| Japanese tax | Creditable? | Note |
|---|---|---|
| National income tax (所得税) | Yes | Plainly an income tax |
| Special reconstruction income tax (復興特別所得税) | Yes | A surtax *on* the income tax |
| Local inhabitant tax (住民税) | **Yes** — see caveat | ~10% of income; a levy on income, not a fee |
| Consumption tax (消費税) | No | Not an income tax |
| Social insurance premiums | No | Not a tax; see doc 07 §5 |

Inhabitant tax creditability is **material** — it is roughly 10% of income and
getting it wrong swings the whole model. It is universally claimed in practice and
is structurally an income tax. **But no archived source in this repository states
it**, so it is marked *likely but unverified* below. Resolve before relying on it.

## 2. The limitation — §904(a)

The credit cannot exceed:

```
limitation = US tax before credit × ( foreign-source taxable income in the basket )
                                     ( ─────────────────────────────────────────── )
                                     (        total taxable income                 )
```

The numerator is **foreign-source taxable income** — gross foreign income **less
deductions allocated and apportioned to it** under §§861-865 and Treas. Reg.
§1.861-8. Those allocations *shrink* the numerator and so shrink the credit; a
model that uses gross foreign income overstates the credit.

## 3. The baskets — §904(d)

The limitation is computed **separately per basket**, and **credits cannot cross
baskets**. This is why a taxpayer can hold large unused Japanese credits and still
owe US tax.

| Basket | Contents here |
|---|---|
| **General** | Salary for services performed in Japan |
| **Passive** | Dividends, interest, and **capital gains** |
| Foreign branch | Not usually relevant |
| §951A (GILTI) | Not usually relevant |
| **Treaty-resourced** | Items re-sourced under a treaty — §904(d)(6) |

**The structural problem this creates:** foreign salary sits in the general basket
and is normally over-taxed by Japan, generating excess credits there. Capital gains
sit in the passive basket. The excess general-basket credits **cannot** relieve US
tax on the gains. Salary credits and gain credits live in separate universes.

### The treaty basket — §904(d)(6)

> If (i) without regard to any treaty obligation, any item of income would be
> treated as derived from sources **within** the United States, (ii) under a treaty
> obligation such item would be treated as arising from sources **outside** the
> United States, and (iii) the taxpayer **chooses the benefits** of such treaty
> obligation, subsections (a), (b) and (c) ... shall be applied **separately with
> respect to each such item**.

[IRC §904(d)(6)(A)] — `sources/us-code/irc-904.html`

Note "**separately with respect to each such item**" — this is not one extra
basket but a **per-item** limitation. Each re-sourced item gets its own fraction,
so credits cannot be pooled even among re-sourced items. Doc 07 explains when
re-sourcing is needed; the practical point here is that it is **item-by-item**, and
a calculator must model it that way.

§904(d)(6)(B) disapplies this where §865(h) or §904(h)(10) applies.

## 4. The algorithm

For each tax year:

1. **Compute US taxable income** on worldwide income, applying §911 first if elected.
2. **Characterise each income item** by source (doc 05 §1) and by basket (§3 above).
3. **Allocate and apportion deductions** to each basket's foreign-source income.
4. **Compute US tax before credit** on total taxable income, applying the §911(f)
   stacking rule so excluded income still sets the marginal rate.
5. **For each basket separately:**
   a. numerator = foreign-source taxable income in that basket, after step 3;
   b. apply the **capital gain rate differential adjustment** (§5 below);
   c. `limitation = US_tax_before_credit × numerator / adjusted_total_taxable_income`,
      where the denominator takes the SAME rate differential reduction as the
      numerator (§904(b)(2)(B)(ii)), and the numerator is capped at the
      denominator — §904(a) says "but not in excess of the taxpayer's entire
      taxable income", so the ratio can never exceed 1;
   d. `credit = min(creditable foreign taxes in basket, limitation)`;
   e. `excess = creditable foreign taxes − limitation` → carry under §904(c).
6. **Repeat step 5 per re-sourced item** under §904(d)(6).
7. **Sum the credits**; apply against chapter 1 tax **only** — **not** against NIIT
   (doc 05 §3).
8. **Carry excess** back 1 year and forward 10 [§904(c)], per basket.

### §904(c), verbatim

Excess taxes are "deemed taxes paid or accrued ... **in the first preceding taxable
year and in any of the first 10 succeeding taxable years**, in that order"
[`sources/us-code/irc-904.html`]. Carryback is **1 year**, carryforward is
**10 years**, FIFO, and per basket.

## 5. The capital gain rate differential adjustment — §904(b)(2)(B)

The provision has **two clauses, and both bite.** Quoting the archived statute:

> **(i)** … the taxable income from sources outside the United States shall
> include gain … only in an amount equal to foreign source capital gain net
> income **reduced by the rate differential portion of foreign source net
> capital gain**,
> **(ii)** **the entire taxable income shall include gain from the sale or
> exchange of capital assets only in an amount equal to capital gain net income
> reduced by the rate differential portion of net capital gain** …

[IRC §904(b)(2)(B)] — `sources/us-code/irc-904.html.txt`

Clause (i) scales the **numerator**. Clause (ii) scales the **denominator** the
same way. The logic: if the US taxes a gain at 15% rather than 37%, it should
neither surrender credit as though it had taxed it at 37%, nor count the full
gain as taxable income when sizing the fraction.

The factor is not an estimate. The Form 1116 instructions direct multiplying
foreign-source capital gain by **0.4054** where it is taxed at 15% and
**0.5405** where taxed at 20% — that is `rate / 37` — and excluding 0%-rate gain
entirely. The Line 18 worksheet makes the denominator adjustment **mandatory**
unless foreign net capital gain is under $20,000.

**Correction, 2026-07-28.** § 4 step 5c of this document previously stated the
limitation as `numerator / total_taxable_income` with **no denominator
adjustment**, and this section described only the numerator scaling. Clause (ii)
was omitted. The calculator faithfully implemented the incomplete rule and
returned $11,950 of US tax on this document's own worked example (§ 9), against
the ~$3,800 the example itself predicts — a 3.1× overstatement. Both the
document and the engine now apply both clauses.

> This is the provision that turns the passive-basket problem from awkward into
> painful, and it is the one most often omitted from simplified models. The
> line-by-line computation is in the Form 1116 instructions
> [`sources/us-irs/i1116.pdf`] and **must be transcribed** before the calculator is
> considered correct — see Open questions.

## 6. Paid versus accrued — §905(a), and the inhabitant tax lag

A taxpayer may elect to claim the credit on a **paid** or **accrued** basis. The
election, once made, binds future years.

This matters more in Japan than almost anywhere, because of the **inhabitant tax
lag** (doc 03 §3): inhabitant tax on year N's income is billed and paid in year
N+1.

- On a **paid** basis, year N's US return credits inhabitant tax *paid* in year N —
  which relates to year N−1's income. Income and tax are permanently mismatched by
  a year, and in the **first** year in Japan there is **no** inhabitant tax paid at
  all, so the credit is at its smallest exactly when Japanese income first appears.
- On an **accrued** basis, year N's return credits inhabitant tax *accrued* on year
  N's income, matching the two. This is generally the better election for someone
  moving to Japan, and the choice should be made **in the first year**.

Foreign taxes are translated at the **average exchange rate** for the year under
§986(a), with an exception for taxes actually paid in the year they accrue.

**§905(c)** requires notice of a foreign tax **redetermination** — if the Japanese
liability later changes, the US return must be amended. Given that Japanese
assessments settle after the US return is filed, this is a live obligation, not a
formality.

## 7. Interaction with §911

Foreign taxes **allocable to excluded income are not creditable** [§911(d)(6)]. The
Form 1116 instructions give the apportionment: creditable tax is reduced in the
ratio of excluded income to total foreign earned income.

For a high earner in Japan this usually means **§911 should not be elected**:

- Japanese combined rates on salary reach ~55%, well above US rates.
- Taking the credit alone typically eliminates US tax on the salary *and* generates
  excess general-basket credits.
- Electing §911 excludes ~$130,000 but **burns the Japanese tax on that slice**,
  reducing credits without reducing the US liability much — because the credit
  would have covered it anyway.
- §911(f) stacking means the excluded income still drives the marginal rate.

Model both and compare. Note also that a §911 election, once revoked, **cannot be
re-made for five years** without IRS consent — so this is a sticky choice.

## 8. The de minimis election

A taxpayer with **$300 or less** of creditable foreign taxes (**$600** if married
filing jointly), all from passive income reported on a payee statement, may claim
the credit **without filing Form 1116**. Irrelevant at the amounts in this project,
but it means no carryover is generated.

## 9. Worked example

US citizen, non-permanent resident in Japan, single, 2027. Assume the treaty
re-sourcing in doc 07 applies and inhabitant tax is creditable.

| Item | Amount | Source | Basket |
|---|---|---|---|
| Salary, services performed in Japan | $200,000 | Foreign (§861(a)(3)) | General |
| Long-term gain, pre-arrival shares, **remitted** so Japan taxes it | $100,000 | Foreign (§865(g)(2) satisfied) | Passive |
| Japanese tax on salary (~50% combined) | $100,000 | — | General |
| Japanese tax on the gain (20.315%) | $20,315 | — | Passive |

Sketch:

- **General basket.** US tax on $200,000 salary ≈ $45,000. Limitation ≈ that
  amount. Japanese tax $100,000 → credit capped at ~$45,000, **excess ~$55,000**
  carried forward 10 years. US tax on salary → nil.
- **Passive basket.** US tax on a $100,000 long-term gain at 20% = $20,000, **plus
  $3,800 NIIT which no credit can touch**. The §904(b)(2)(B) adjustment scales the
  numerator down by roughly `20/37`, cutting the limitation to well under $20,000 —
  so **part of the $20,315 Japanese tax is not creditable this year** despite the
  US and Japanese rates being nearly identical.
- The $55,000 of excess **general** credits **cannot** be used against the passive
  shortfall.
- **Net:** roughly $3,800 of NIIT plus a passive-basket residual, and $55,000 of
  credits that will likely expire unused.

> The lesson: **excess credits on salary are worthless for sheltering gains.** This
> is why remittance discipline in Japan (doc 02) matters even though the US taxes
> the gain regardless — the Japanese tax it avoids is not fully recoverable through
> the credit.

*The figures above are illustrative and rounded; they demonstrate the mechanism,
not a computed result. The §904(b)(2)(B) factor in particular is approximated.*

## 10. Confidence

**Settled** — from the US Code text archived here:

- §901/§903 creditability of income taxes and in-lieu-of taxes.
- The §904(a) limitation formula and its per-basket application.
- **§904(c): 1-year carryback, 10-year carryforward, in that order.** Quoted verbatim.
- **§904(d)(6): treaty-resourced items get a limitation computed *separately with
  respect to each item*** — per-item, not a single pooled basket.
- §911(d)(6)'s denial of credit for taxes on excluded income.

**Likely but unverified:**

- **Japanese inhabitant tax creditability.** Structurally sound and universally
  claimed, but no archived authority. **Highest-value open item in this document.**
- The §904(b)(2)(B) adjustment mechanics and its exact factor — the *existence* and
  *direction* of the adjustment are certain; the arithmetic is not transcribed.
- The $300/$600 de minimis thresholds and the 5-year §911 revocation lock.
- The basket assignment of capital gains to passive — standard, but not verified
  against §904(d)(2)'s definitions here.
- The high-tax kickout, §904(d)(2)(F), which can reclassify high-taxed passive
  income into the general basket. **Potentially significant**: Japanese tax at
  20.315% on gains may or may not trip it, and if it does the basket analysis in
  §3 changes materially. Not analysed.

**Open questions:**

1. **Transcribe the §904(b)(2)(B) computation** from the archived Form 1116
   instructions, line by line. The calculator cannot be correct without it.
2. **Verify inhabitant tax creditability** against a primary source.
3. **Analyse the high-tax kickout** for Japanese-taxed capital gains.
4. **Whether NIIT can be credited under the treaty** (doc 05 Open questions).
5. **Confirm the accrued-basis election is available and advantageous** in year one,
   and what the election mechanics are.

## Sources

| Label | Archived file | Original URL |
|---|---|---|
| IRC §901, §903, §904, §905, §986 | `sources/us-code/irc-901.html` etc. | https://www.law.cornell.edu/uscode/text/26/904 |
| IRC §911 | `sources/us-code/irc-911.html` | https://www.law.cornell.edu/uscode/text/26/911 |
| IRS Pub 514 | `sources/us-irs/p514.pdf` | https://www.irs.gov/pub/irs-pdf/p514.pdf |
| Form 1116 and instructions | `sources/us-irs/f1116.pdf`, `i1116.pdf` | https://www.irs.gov/pub/irs-pdf/i1116.pdf |

Retrieved 2026-07-28; see `sources/*/MANIFEST.tsv` for hashes.
