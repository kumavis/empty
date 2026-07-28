# Review findings — 2026-07-28

Four independent reviews of the calculator against the archived sources and the
briefs: the Japanese engine, the US engine, the user-visible copy and glossary,
and adversarial testing of the projection loop.

**Nothing here is fixed yet.** This document is the triage list. Items are
ranked within each section by how badly they mislead a reader of the output.

Authority order used throughout, per `CONVENTIONS.md`: archived primary source
beats brief, brief beats code. Where a brief contradicts the archive, that is
recorded as a **research defect** — those are the most serious entries here,
because the briefs are what the calculator and every summary rest on.

---

## A. Research defects — a brief contradicts the archived source

### A1. Doc 03's basic deduction cites a page that does not contain it

`docs/03-japan-income-categories-and-rates.md` §§ 2, 7 give the ¥580,000 basic
deduction (基礎控除), the tiered amounts and a taper to zero above ¥25,000,000,
cited to `sources/japan-nta/taxanswer-shotoku-1195.html`.

That archived page is **No.1195 配偶者特別控除 — the spouse special deduction.**
It states no basic deduction rule; 基礎控除 appears only in a footnote pointing
at an unarchived PDF, and the ¥580,000 on the page is the *spouse's* income
threshold. `sources/japan-nta/MANIFEST.tsv` also mis-describes the page as
"Basic deduction".

Doc 03 § 7 lists the figure under **Settled — verified from archived NTA
pages**. It is not verified by anything in this repository.

Consequences: `rates.ts` applies `basicDeduction: 580_000` unconditionally with
no taper, so on the app's own default (¥27m salary) the deduction should
already be zero on doc 03's own statement of the rule.

**To close:** archive the real 基礎控除 source (NTA No.1199 or the 令和7年
reform material), restate § 2 from it, correct the MANIFEST description, move
the entry out of Settled until done, and implement the taper.

### A2. Doc 06 omits half of IRC § 904(b)(2)(B)

The statute has two clauses. `sources/us-code/irc-904.html.txt`:

> (i) … the taxable income from sources outside the United States shall include
> gain … only in an amount equal to foreign source capital gain net income
> **reduced by the rate differential portion of foreign source net capital
> gain**,
> (ii) **the entire taxable income shall include gain … only in an amount equal
> to capital gain net income reduced by the rate differential portion of net
> capital gain**

Clause (ii) adjusts the **denominator**. `docs/06-us-foreign-tax-credit.md` § 4
step 5c states the limitation as `numerator / total_taxable_income` with no
denominator adjustment, and § 5 describes only the numerator scaling. Form
1116's Line 18 worksheet confirms the denominator adjustment is mandatory here
(it is waived only where foreign net capital gain is under $20,000).

`us.ts` faithfully implements the incomplete doc. On doc 06 § 9's **own worked
example** the code returns $11,950 of US tax where the doc predicts ~$3,800 —
a 3.1× overstatement.

Corollary, recorded because it corrects a claim made in the code: the numerator
factor `ltcgRate / topOrdinaryRate` is **exactly** the official one. Form 1116
specifies 0.4054 and 0.5405, i.e. 15/37 and 20/37, and excludes 0%-rate gains
entirely, which `ltcgRate = 0` reproduces. The comment in `us.ts` calling the
factor an approximation is wrong; the defect was always the missing clause.

**To close:** restate doc 06 § 4 step 5c with both clauses, then implement (ii).

### A3. Doc 03's employment income deduction flattening point is wrong

Doc 03 §§ 2, 7 say the 給与所得控除 flattens above ¥6,600,000. The archived
`taxanswer-shotoku-1410` table flattens above **¥8,500,000**. The same archived
page carries the 令和7年分以降 schedule (¥1,900,000 まで → 650,000 flat, then
30%+80,000 / 20%+440,000 / 10%+1,100,000 / 1,950,000 cap); `rates.ts`
implements the superseded 令和2–6年 shape with a 1,625,000 breakpoint and a
`×0.4 − 100,000` band that no longer exists.

### A4. Doc 01's confidence section contradicts its own § 3

`docs/01-japan-residency-status.md` still lists under **Likely but unverified**
that "how the five-year aggregate is counted in days … is not established from
the archived sources". § 3 of the same document now establishes exactly that
from circulars 2-4, 2-4の2 and 2-4の3, which are archived in
`sources/japan-nta/tsutatsu-shotoku-2-1.htm`. Stale text; it makes the app's
boundary date look unsupported by its own brief.

---

## B. Code defects that make the output silently wrong

### B1. The fixed-point iteration never converges

`engine.ts`. Because the engine passes `salaryPaidInJapan = salary`,
`nonForeignSourceAbroad` is always 0 and `deemedRemitted = min(remittance,
shelterableGains)`, so d(tax)/d(remittance) is exactly the listed-securities
rate **0.20315**. Successive differences are `0.20315ⁿ · x₁`, so the `< 1` yen
test can only pass on pass 3 when the first-pass remittance is under ~119 yen.
Any real remittance runs all four passes and exits by exhaustion, always
**understating** (the map is monotone and converges from below — it does not
oscillate). 12–15 passes are needed. The docstring claiming convergence "to the
yen in two or three passes" is false.

Worse, the year-end balance is computed from the *previous* pass's tax, so the
reported `cashJapan` can be internally inconsistent with the reported tax — one
measured case shows a true balance of −¥15,337 reported as ¥0 with no
underfunded flag.

### B2. `sendableFromUs` is measured before US tax

`engine.ts`. The foreign pool's capacity is sized before the US bill is
computed, so the model remits money that does not exist and Japan taxes it.
Measured: Japanese tax overstated by **¥1,289,839 ($8,599)**, combined tax
**+7.48%**, leaving the foreign pool at −¥6,349,196.

### B3. The departure year is taxed at zero in Japan

`phases.ts` + `japan.ts`. `phaseForYear` returns the **year-end** phase for the
whole year; in a departure year that is `nonResident`, so `computeJapanYear`
early-returns all zeros — salary, gains, inhabitant tax. On the UI default that
deletes roughly ¥8m of Japanese tax.

The README's "a transition year is not apportioned" disclosure describes the
NPR→PR crossover, where the effect is an over-charge. This is the same code
path producing a total **under**-charge, in a field the UI invites you to fill.
One day of input moves the answer ¥18.9m ($125,787).

Related: with arrival *and* departure in the same year the two transitions
cancel, `changedOn` is never set, and the art. 17(4)(vi) disclosure note is
suppressed entirely.

### B4. Capital gains are taxed at a single marginal rate

`us.ts`. `capitalTax = investmentIncome * ltcgRate` applies one looked-up rate
to the whole gain instead of walking the 0/15/20 brackets, and the standard
deduction is discarded whenever ordinary income falls below it. Measured:
$100,000 gain with no salary gives $15,000 where § 1(h) gives **$5,498** — a
2.7× overstatement, in exactly the post-departure and low-salary realisation
years this project exists to analyse.

### B5. `filingStatus` is accepted and never used

`us.ts`, `rates.ts`. `marriedJoint` produces byte-identical output to `single`.
IRC § 1411(b) sets the NIIT threshold at $250,000 for a joint return; the code
hardcodes $200,000. The ordinary brackets, the LTCG thresholds and the standard
deduction are all single-filer figures.

### B6. The ten-year look-back window is frozen at `residencyStart`

`phases.ts`. Circular 2-4の2: 「過去10年以内」とは、判定する日の10年前の同日
から、判定する日の前日まで — the window is measured from the day being judged
and slides. Anchoring it to `residencyStart` charges prior presence against the
five-year budget permanently. Measured: a 2018–2020 prior stay yields a
boundary of 2028-04-02 where the sliding window gives ~2031-04-02 — the shelter
cut short by nearly three years. Latent only because there is no
prior-presence editor.

### B7. `nprEndsOn` can predate `residencyStart`

`phases.ts`. `remainingMonths` is clamped at 0 but `remainingDays =
-prior.days` is not. `nonPermanentResidentEnd('2026-04-01', [{from:
'2018-01-01', to: '2024-06-15'}])` returns **`2026-03-19`**, exported by the
CSV as "Worldwide taxation begins".

### B8. `savingsExhaustedIn` cannot fire when repatriation drains the pool

`engine.ts`. The exhaustion test runs on `cashJapanAfter` *before*
`repatriatedToUs` is subtracted, and the `cashJapan > 0` guard then makes it
unfireable forever. Non-monotonic in a way that is visible to a user: at
$375,000 of living cost the warning fires; at $380,000 — strictly worse — it
disappears, and the pool is actually exhausted a year earlier.

### B9. `cashUs` is reported negative with no clamp and no warning

`engine.ts` clamps and flags only the Japanese pool. A measured case reports
`cashUs = -543,196` with `warnings = []` — a projection that reads as healthy
while the foreign pool is overdrawn and ¥15,000,000 of pre-positioned savings
has vanished. Compounds silently across years.

### B10. No deduction apportionment into the § 904 numerator

`us.ts`. § 904(a)'s numerator is *taxable* income from foreign sources; Form
1116 apportions the standard deduction into it by the gross-income ratio. The
code uses gross. Doc 06 § 2 warns in terms that this "overstates the credit".

### B11. § 904(a)'s numerator cap is missing

`us.ts`. The statute caps foreign-source taxable income at "not in excess of
the taxpayer's entire taxable income"; the code divides without the cap, so the
ratio can exceed 1. The year's tax is still right (clamped downstream) but the
carryforward is understated permanently — $3,020 in the measured case. Doc 06
§ 2 omits the parenthetical too.

### B12. `claimTreatyResourcing` is declared, defaults true, and is never read

`types.ts`, `App.tsx`. There is no third basket and no per-item limitation, so
IRC § 904(d)(6)(A) is entirely absent — and doc 06 § 9's worked example is
prefaced "assume the treaty re-sourcing in doc 07 applies". `ftcBasis` is dead
in the same way: the engine always credits the same year's inhabitant tax,
silently resolving what the UI presents as an election.

### B13. The exit-tax covered-asset value is invented

`engine.ts`: `coveredAssets = (gainsJapan + gainsUs) × projectionYears × 5`.
ITA art. 60-2(1) tests 当該有価証券等の価額 — the **value** at departure. There
is no covered-asset input, doc 09 § 5 lists one as required, and the ¥100m
conclusion flips purely by lengthening the projection horizon: N=5 gives
not exposed, N=10 gives exposed, same person and portfolio.

### B14. The § 865(g)(2) per-bucket test hides a 49.2% cliff

`us.ts`. Japanese tax lands on only the deemed-remitted slice but is compared
against the whole bucket, so the real threshold is "≥49.2% of the bucket
remitted", as a step function. Measured: a $10,000 change in living cost
re-sources $100,000 of gain, and above the cliff the code grants foreign-source
treatment to the ~50% of the bucket on which no Japanese tax was paid.

The modelling choice is a documented open question (doc 05 OQ4). The defects
around it are not: the note asserting "no Japanese tax to credit" is false in
every partial case (one measured run carries $7,644 forward while saying
otherwise), no note fires at all in the aggressive pass-on-partial case, and
the code comment still claims the aggregate treatment it no longer uses.

### B15. Inhabitant tax is charged in-year with no 1 January test

`japan.ts`. Doc 03 § 3: it runs a year behind and is keyed to residence on
1 January. Doc 09 calls the resulting departure-timing choice "probably the
single largest one-off saving available", and the UI puts that advice in a
field hint — but the model cannot express it. Produces an arrival-year bill
that should not exist, no post-departure bill, and feeds the mistimed amount
into the FTC in the wrong year.

### B16. Smaller engine defects

- Arising-basis gains are omitted from the ordering rule's first absorption,
  though art. 17(4)(i)'s proviso reaches them.
- `salaryPaidInJapan` is subtracted from both the Japan-work and foreign-work
  figures; art. 17(4)(iii)'s pro-rata apportionment within each category is not
  implemented. This is the root cause of the "¥0" advice string in C1.
- The specified-securities window is off by one at both ends — the statute says
  十年前の日の**翌日**, and the NPR period is half-open.
- The 30-day-month carry and the calendar-day subtraction do not compose,
  giving ±1–2 days in a function whose purpose is exact NTA arithmetic.
- `phaseChangedOn` takes the earliest candidate rather than the transition that
  produced the year-end phase.
- `effectiveRate` is 0 while `combined` is positive in non-resident years, and
  those zeros are averaged into the headline rate.
- § 911(f) stacking is applied to ordinary income but not to the capital gain
  rate bracket, and the FEIE is not pro-rated by qualifying days.
- § 904(c)'s 10-year expiry and FIFO ordering are not modelled.
- `realiseGains` does not implement the art. 17(2) FIFO its comment claims —
  it uses the lot the disposal names. Currently dead code.
- Exit-tax period counting counts Table 2 days affirmatively rather than all
  residence minus Table 1, and ignores Order 170(3)(ii)–(iii).
- No numeric guards in the engine: `fxJpyPerUsd: 0` puts literal `NaN` in the
  CSV; negative gains produce negative tax.

---

## C. User-visible copy that is false or misleading

### C1. The flagship lever renders as "keep the remittance at or below ¥0"

Because `nonForeignSourceAbroad` is structurally zero (B16), the advice string
meant to carry doc 02 § 5's headline rule is nonsense, and the lever cannot be
exercised in the UI at all.

### C2. "shelter ends" shows the first day of worldwide taxation

`App.tsx` labels `nprEndsOn` as the end of the shelter; it is the day after.
The same value is labelled correctly two lines above and in the CSV.

### C3. The footer's glossary claim is false

"Every term in the dictionary cites the text it comes from" — six entries cite
a repo brief under `docs/` rather than an archived source, which
`glossary/SCHEMA.md` requires. `Term.tsx` then renders those labels as
hyperlinks to unrelated external URLs. Three of the six could cite archived
files that already exist.

### C4. Two code comments claim UI disclosures that do not exist

`us.ts` ("a simplification the UI flags") and `rates.ts` ("approximations
flagged in the UI"). Neither is flagged in the banner or the CSV.

### C5. Warnings that contradict the engine's own numbers

Four measured cases, including: a Japanese national told "the remittance basis
never exists" and then that "the ordering rule starts reaching foreign income";
the same shelter warning firing three years after departure; and "living costs
must be remitted from year one" while every year's remittance is zero.

### C6. Confidence overstated against the briefs

- The inhabitant-tax departure lever is stated as settled; doc 03 § 3 and doc
  09 both carry an explicit unverified caveat.
- Outbound transfers are called "untaxed / costs nothing"; doc 04 § 3 flags an
  unverified currency-gain exposure on both sides.
- The banner names the wrong two open questions. Doc 09 ranks **the
  no-step-up-on-becoming-resident assumption first** — "highest-value item to
  verify" — and it appears nowhere in the UI.
- The specified-securities test is stated with only its acquisition-date limb,
  omitting the foreign market / broker / account requirement.

### C7. Scope omissions the briefs call potentially dominant

None disclosed anywhere in the UI, though "Combined tax" reads as the whole
burden: US state tax (doc 08: "can exceed every Japanese lever in doc 09
combined"), Japanese inheritance tax (doc 04 § 4: "must not be silently
dropped"), social insurance premiums (doc 07 § 5), and PFICs (doc 05 § 4). One
"what this does not model" line beside the banner would close all four.

### C8. Terminology drifts from the statutory terms

`PHASE_LABEL` uses "Non-permanent" and "Worldwide" where the CSV uses the full
statutory terms, so the app disagrees with its own export. The glossary entries
`non-permanent-resident` and `permanent-resident-tax` are referenced by no
`<T>` anywhere. "the three Resident (居住者) phases" is wrong on its face —
非居住者 is by definition not a 居住者.

### C9. Smaller copy defects

- `validate.ts` accepts an exchange rate of 10–1000 while its message says
  "roughly 100–200"; validation labels do not match the field labels they sit
  under; `checkMoney`/`checkYears` accept hex literals.
- "38 archived primary sources" — two archived files are byte-identical, so it
  is 37 distinct documents.
- The gains hint claims "shelterable from Japan" unconditionally, including
  when the pre-arrival checkbox is unticked, which the Findings panel then
  contradicts.
- "Rate tables are 2025 figures" — a distinct 2026 US table exists, and
  `forYear`'s `didExtrapolate` flag is computed and discarded.
- The chart's aria-label reads "runs out in no year within the projection".

---

## D. Checked and found correct

Recorded so a future reviewer does not re-litigate them.

- `applyRemittanceOrdering` matches art. 17(4)(i) exactly, including the
  absorption order and the cap, and reproduces doc 02 § 5's worked example. The
  bug is in what is fed to it, not in it.
- The Japanese rate tables match the archived pages exactly: all seven brackets
  and quick deductions, the ¥1,000 round-down, the NTA's own 7,000,000 × 0.23 −
  636,000 = 974,000 check, the 2.1% surtax through 2037, and the 20.315%
  composition. Applying the surtax once to aggregate tax and once inside
  `listedSecuritiesRate` while charging inhabitant tax only on aggregate income
  is subtle and correct — no double count.
- Both limbs of ITA art. 60-2(5) are implemented in the right direction, and
  the Order art. 170(3)(i) Table 1 exclusion is applied the right way round.
- The `japanSitusGains` treatment is **correct** on the sources: art. 95(4)(iii)
  plus Order art. 225-4 exclude listed shares from foreign-source, and Order
  17(1)'s foreign market / broker / account test fails for a Japanese account.
  Only the word "never" overstates — a foreign 不動産関連法人 share would be
  foreign-source whatever account holds it.
- NIIT is correctly non-creditable and correctly reasoned: § 901 credits
  chapter 1 tax, § 1411 sits in chapter 2A. The § 1411(d) MAGI add-back for
  excluded FEIE income is right. Only the filing-status threshold is wrong.
- § 911(d)(6)'s haircut, the general/passive basket split, and the
  Japan-before-US ordering are all correct. The § 865(g)(2) block quote is
  verbatim-accurate against the archive.
- **CSV integrity is clean.** Eight scenarios generated and parsed: every data
  row *and* the hand-padded TOTAL row are exactly 25 fields matching the
  header, the TOTAL's non-empty cells land in the right columns, and quoting is
  RFC 4180-clean. This had been flagged as a likely defect; it is not one.
- No overflow, NaN or negative tax at scale ($1 to $1e300 salary, fx 10–1000,
  30-year projections) through validated inputs. The fixed point does not
  oscillate. Leap-year boundaries are consistent.
- Glossary integrity is mechanically clean: 53 entries, unique ids, every
  `seeAlso` resolves, every `<T>` call site resolves, no missing fields. The
  only problem is the six `docs/` paths in C3.
