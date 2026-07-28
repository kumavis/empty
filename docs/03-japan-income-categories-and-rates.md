# Japanese income categories, rates, and the earned/capital distinction

```
As of:        2026-07-28
Applies to:   Japanese tax year 2025 (令和7年) onward, where marked. Rate tables
              change annually — every figure below carries its year.
Verified by:  NTA tax answer pages archived in sources/japan-nta/, cross-checked
              against the NTA's own worked examples.
```

Japan taxes different kinds of income under **structurally different regimes**,
not merely at different rates. Which regime applies is the largest single driver
of the outcome, and it is the reason the user's earned-income/capital-gain split
is the right way to model this.

## 1. The three taxation modes

| Mode | Japanese | Effect |
|---|---|---|
| Aggregate taxation | 総合課税 (*sōgō kazei*) | Pooled with other aggregate income, taxed at progressive rates up to 45% + 10% local |
| Separate self-assessment | 申告分離課税 (*shinkoku bunri kazei*) | Taxed on its own at a flat rate, declared on the return |
| Separate withholding at source | 源泉分離課税 (*gensen bunri kazei*) | Flat rate withheld, no return needed, no further tax |

Employment income sits in aggregate taxation. Listed securities gains sit in
separate self-assessment. That single distinction is worth more than any deduction
in this document.

## 2. Employment income (給与所得, *kyūyo shotoku*)

Aggregate taxation. Taxable employment income is gross salary less the
**employment income deduction** (給与所得控除, *kyūyo shotoku kōjo*), a statutory
schedule standing in for expenses. The deduction is **capped at ¥1,950,000**
above ¥8,500,000 of gross salary, so a high earner is effectively taxed on close
to gross. The 令和7年分以降 schedule is:

| Gross salary | Deduction |
|---|---|
| up to ¥1,900,000 | ¥650,000 |
| ¥1,900,001–¥3,600,000 | ×30% + ¥80,000 |
| ¥3,600,001–¥6,600,000 | ×20% + ¥440,000 |
| ¥6,600,001–¥8,500,000 | ×10% + ¥1,100,000 |
| ¥8,500,001 and above | ¥1,950,000 (cap) |

[NTA No.1410] — `sources/japan-nta/taxanswer-shotoku-1410-v2.htm`

**Correction, 2026-07-28.** This section previously said the schedule flattens
above **¥6,600,000**. It flattens above **¥8,500,000**; ¥6,600,000 is where the
20% band ends. The engine also implemented the superseded 令和2年–令和6年
schedule, which had a ¥1,625,000 breakpoint and a ×40%−¥100,000 band that no
longer exist. Below ¥6,600,000 the NTA directs use of 別表第五 rather than this
table; that table is not archived here, so figures at those incomes are
approximate.

The **basic deduction** (基礎控除, *kiso kōjo*) was restructured by the 2025 reform
(令和7年度税制改正). It is **not a flat amount** — it tapers by the taxpayer's
合計所得金額, reaching **zero above ¥25,000,000**:

| 合計所得金額 | 令和7年分 | 令和8年分以降 |
|---|---|---|
| up to ¥1,320,000 | ¥950,000 | ¥950,000 |
| ¥1,320,001–¥3,360,000 | ¥880,000 | ¥580,000 |
| ¥3,360,001–¥4,890,000 | ¥680,000 | ¥580,000 |
| ¥4,890,001–¥6,550,000 | ¥630,000 | ¥580,000 |
| ¥6,550,001–¥23,500,000 | ¥580,000 | ¥580,000 |
| ¥23,500,001–¥24,000,000 | ¥480,000 | ¥480,000 |
| ¥24,000,001–¥24,500,000 | ¥320,000 | ¥320,000 |
| ¥24,500,001–¥25,000,000 | ¥160,000 | ¥160,000 |
| above ¥25,000,000 | ¥0 | ¥0 |

[NTA No.1199, 根拠法令 所法86・措法41の16の2] —
`sources/japan-nta/taxanswer-shotoku-1199.htm`

**Correction, 2026-07-28.** This section previously cited
`taxanswer-shotoku-1195` for the basic deduction and listed the figure as
settled. **That page is No.1195 配偶者特別控除 — the spouse special deduction.**
It states no basic deduction rule, and the ¥580,000 appearing on it is the
*spouse's* income threshold, not a deduction amount. The substance above was
broadly right — ¥580,000 is correct for the ¥6.55m–¥23.5m band and the
¥25,000,000 taper is real — but it rested on a page that does not support it,
which is exactly what CONVENTIONS rule 1 exists to prevent. The correct source
is now archived and cited. `MANIFEST.tsv` also mis-described page 1195 and has
been corrected.

> For a high-earning relocating professional these deductions are close to
> irrelevant — they are rounding error against a seven-figure yen salary. Model
> them, but do not plan around them.

## 3. National income tax rates — 令和7年 (2025)

Applied to aggregate taxable income (課税総所得金額), rounded down to the nearest
¥1,000. The "quick deduction" (控除額) makes this a flat-plus-offset computation
rather than a true bracket walk.

| Taxable income (¥) | Rate | Quick deduction (¥) |
|---|---|---|
| 1,000 – 1,949,000 | 5% | 0 |
| 1,950,000 – 3,299,000 | 10% | 97,500 |
| 3,300,000 – 6,949,000 | 20% | 427,500 |
| 6,950,000 – 8,999,000 | 23% | 636,000 |
| 9,000,000 – 17,999,000 | 33% | 1,536,000 |
| 18,000,000 – 39,999,000 | 40% | 2,796,000 |
| 40,000,000 and above | 45% | 4,796,000 |

`tax = taxable_income × rate − quick_deduction`

Verified against the NTA's own example: ¥7,000,000 × 0.23 − 636,000 = **¥974,000**
[`taxanswer-shotoku-2260`].

### Special reconstruction income tax (復興特別所得税)

**2.1% of the base national income tax amount** (基準所得税額), levied for tax years
through **令和19年 (2037)** [`taxanswer-shotoku-2260`]. It is a surtax *on the tax*,
not on income, so it multiplies whatever the national tax is — including the flat
15% on securities gains.

### Local inhabitant tax (住民税, *jūminzei*)

A flat **10%** (4% prefectural + 6% municipal) on the prior year's income, plus a
small per-capita levy (均等割). Two features matter far more than the rate:

- **It runs a year behind.** Liability for a year's income is assessed and billed
  in the *following* fiscal year.
- **It is keyed to residence on 1 January.** A person who is a resident of a
  Japanese municipality on 1 January is liable for inhabitant tax on the *previous*
  calendar year's income — even if they leave in February.

The combination is a genuine planning lever on both arrival and departure; see
doc 04 §2 and doc 09.

> Inhabitant tax figures here are **not** verified from a primary source in this
> repository. The 10% split and the 1 January rule are long-standing and
> universally reported, but the Local Tax Act (地方税法) has not been archived.
> Treat as *likely but unverified* and see Open questions.

## 4. Capital gains (譲渡所得, *jōto shotoku*)

### Listed securities (上場株式等, *jōjō kabushiki-tō*)

Separate self-assessment taxation at a combined **20.315%**:

| Component | Rate |
|---|---|
| National income tax | 15% |
| Special reconstruction income tax (2.1% of the 15%) | 0.315% |
| Local inhabitant tax | 5% |
| **Total** | **20.315%** |

The NTA states the headline as "20% (income tax 15%, inhabitant tax 5%)"
[`taxanswer-shotoku-1463`]; the 0.315% is the reconstruction surtax applied to the
national component.

**This flat rate is the single most important number in the whole project.** A
high earner faces ~55% marginal on salary and 20.315% on listed securities gains.

Unlisted shares (一般株式等) are taxed at the same 20.315% but in a **separate
basket**: losses on unlisted shares cannot be offset against listed-share gains.
Losses on listed securities may be carried forward **three years** against
listed-securities gains, conditional on filing a return for every intervening year.

### Real property (土地建物等)

Separate self-assessment, with the long/short split turning on an **unusual
measurement date**: the holding period is measured to **1 January of the year of
sale**, not the sale date [`taxanswer-joto-3202`]. A property sold in December of
its fifth year is still short-term.

| Holding period (to 1 Jan of sale year) | Japanese | Combined rate |
|---|---|---|
| Over 5 years | 長期譲渡所得 | 20.315% (15% + 0.315% + 5%) |
| 5 years or less | 短期譲渡所得 | 39.63% (30% + 0.63% + 9%) |

### Other property

General movable-property gains fall under **aggregate** taxation, with a
**¥500,000 special deduction**, and only **half** the gain included where the asset
was held over five years.

### Crypto-assets

Miscellaneous income (雑所得, *zatsu shotoku*) under **aggregate** taxation — up to
~55% combined. Reform proposals to move crypto to 20.315% separate taxation have
circulated for several years. **Not verified as enacted** as of 2026-07-28; treat
crypto as aggregate-taxed and see Open questions.

## 5. Foreign currency gains

For a yen-functional taxpayer, converting foreign currency can itself realise
income. This routinely surprises Americans in Japan, because a dollar balance that
"did nothing" produces a taxable yen gain when spent or converted. The precise
rule is **not verified** from an archived source here — see Open questions. Flagged
because it interacts directly with remittance planning in doc 09.

## 6. The crossover table — which categories the remittance basis can shelter

This is where doc 02 meets this document. For a **non-permanent resident**:

| Income | Category | Mode & rate | Foreign-source? | Shelterable by non-remittance? |
|---|---|---|---|---|
| Salary for work performed **in Japan** | 給与所得 | Aggregate, to 45% + 10% | **No** — Japan-source | **No.** Taxed in full |
| Salary for work performed **outside Japan** | 給与所得 | Aggregate | Yes — art. 95(4)(x) | Yes, if paid abroad |
| Gain on securities acquired **pre-arrival**, sold via foreign broker | 譲渡所得 | Separate, 20.315% | Yes — specified securities | **Yes** |
| Gain on securities acquired **post-arrival** | 譲渡所得 | Separate, 20.315% | **No** | **No.** Arising basis |
| Foreign dividends / interest | 配当・利子所得 | Varies | Yes — art. 95(4)(vi),(vii) | Yes, if paid abroad |
| Gain on **foreign real property** | 譲渡所得 | Separate | Yes — Order art. 225-4(1) | Yes |
| Anything paid into a Japanese account | — | — | — | **No** — bucket B |

The decisive insight: **salary for work performed in Japan is Japan-source and
cannot be sheltered at all**, however it is paid. Sourcing of employment income
follows where the *services are performed*, not where the employer sits or where
the money lands. A US employer paying a US bank account for work done in Tokyo
produces fully taxable Japanese income.

Conversely **capital gains on a pre-arrival portfolio are both the most
shelterable and the lowest-taxed** category. That asymmetry is the engine of the
whole strategy in doc 09.

## 7. Confidence

**Settled** — verified from archived NTA pages including their own worked examples:

- The national rate table for 令和7年 and the quick-deduction computation.
- The reconstruction surtax at 2.1% of base income tax, through 令和19年 (2037).
- Listed and unlisted securities at 20% national+local before the surtax → 20.315%.
- The real-property long/short split measured to 1 January of the sale year.
- The 2025 basic deduction band table, and its taper to zero above ¥25,000,000
  [`taxanswer-shotoku-1199`]. Corrected 2026-07-28: previously cited the wrong
  NTA page (see § 2).
- The employment income deduction schedule, capped at ¥1,950,000 above
  ¥8,500,000 [`taxanswer-shotoku-1410`]. Corrected 2026-07-28: previously said
  ¥6,600,000.

**Likely but unverified:**

- Inhabitant tax at 10%, the 4/6 split, and the 1 January rule. Widely reported and
  long-standing, but the Local Tax Act (地方税法) is not archived here.
- The three-year loss carryforward for listed securities and its filing conditions.
- The 39.63% short-term real property rate (the long-term 20.315% is verified).
- Crypto as miscellaneous income at aggregate rates.

**Open questions:**

1. **Archive the Local Tax Act** and verify the inhabitant tax rate, the per-capita
   levy, and the 1 January liability date. This affects every year of the model.
2. **Foreign currency gain rules** — when conversion is a realisation event, and
   whether a de minimis applies.
3. **Crypto reform status** as of 2026 — enacted or still proposed.
4. **Whether the 2025 reform altered the rate table itself**, as opposed to the
   deductions. The table above is taken from the current NTA page and is believed
   current, but the reform's full scope was not traced.
5. **Aggregate-vs-separate election interactions** for foreign dividends, which
   change the effective rate and the foreign tax credit position materially.

## Sources

| Label | Archived file | Original URL |
|---|---|---|
| NTA, income tax rates | `sources/japan-nta/taxanswer-shotoku-2260.html` | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm |
| NTA, listed share transfer income | `sources/japan-nta/taxanswer-shotoku-1463.html` | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1463.htm |
| NTA, capital gains generally | `sources/japan-nta/taxanswer-shotoku-1440.html` | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1440.htm |
| NTA, real property long/short term | `sources/japan-nta/taxanswer-joto-3202.html` | https://www.nta.go.jp/taxes/shiraberu/taxanswer/joto/3202.htm |
| NTA, basic deduction (No.1199) | `sources/japan-nta/taxanswer-shotoku-1199.htm` | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm |
| NTA, spouse special deduction (No.1195) | `sources/japan-nta/taxanswer-shotoku-1195.html` | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm |
| NTA, employment income deduction | `sources/japan-nta/taxanswer-shotoku-1410.html` | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm |
| ITA art. 95(4); Order art. 225-4 | `sources/japan-statutes/income-tax-enforcement-order.xml` | https://laws.e-gov.go.jp/api/1/lawdata/340CO0000000096 |

Retrieved 2026-07-28; see `sources/*/MANIFEST.tsv` for hashes.
