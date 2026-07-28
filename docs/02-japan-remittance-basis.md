# The remittance basis for non-permanent residents

```
As of:        2026-07-28
Applies to:   Japanese tax years 2017 onward (the securities rule below dates from the 2017 reform)
Verified by:  Income Tax Act art. 7 and art. 95(4), and Enforcement Order arts. 17 and 225-4,
              read verbatim from the e-Gov XML archived in sources/japan-statutes/
```

This is the most important document in the repository. It contains the rule the
whole plan turns on, and the rule is **not quite what most English-language
commentary says it is**.

---

## 1. The operative provision

Income Tax Act (所得税法, *shotokuzei-hō*) art. 7(1) sets out what each class of
taxpayer is taxed on. Item (ii) covers the non-permanent resident (非永住者,
*hi-eijūsha*):

> 二 非永住者 第九十五条第一項（外国税額控除）に規定する国外源泉所得（国外にある
> 有価証券の譲渡により生ずる所得として政令で定めるものを含む。以下この号において
> 「国外源泉所得」という。）以外の所得及び国外源泉所得で国内において支払われ、又は
> 国外から送金されたもの

Rendered:

> **(ii) Non-permanent resident:** income other than foreign-source income
> (国外源泉所得) as prescribed in art. 95(1) (Foreign Tax Credit) — such foreign-source
> income including that specified by Cabinet Order as arising from the transfer of
> securities located outside Japan — **and** foreign-source income **that is paid
> within Japan, or remitted from abroad**.

[ITA art. 7(1)(ii)] — `sources/japan-statutes/excerpt-ita-key-articles.txt`

Art. 7(2) then delegates the detail: *"Matters necessary concerning the scope of
the income listed in item (ii) of the preceding paragraph shall be prescribed by
Cabinet Order."* The Cabinet Order is the Order for Enforcement of the Income Tax
Act (所得税法施行令), and the relevant provision is **art. 17**. Almost everything
that matters in practice lives in that article, not in the Act.

## 2. The three buckets

A non-permanent resident's income divides into three, not two:

| Bucket | Taxed in Japan? |
|---|---|
| **A.** Income that is *not* foreign-source income | Always, in full, on an arising basis |
| **B.** Foreign-source income **paid within Japan** (国内において支払われ) | Always, in full, regardless of remittance |
| **C.** Foreign-source income paid abroad | **Only to the extent deemed remitted** |

Bucket B is routinely missed in commentary and is a live trap: it catches income
*credited to a Japanese account* even where the taxpayer never thought of
themselves as "remitting" anything. Foreign dividends paid directly into a
Japanese brokerage account are bucket B, and no remittance discipline will help.

**The user's stated hypothesis** — "sending money to Japan on foreign capital
gains during temporary residence is taxed, where untransmitted capital gains are
not" — is correct as to bucket C. But it understates the position in one
direction and overstates it in another, as sections 3 and 4 explain.

## 3. What actually counts as foreign-source income — the securities trap

Foreign-source income is defined by ITA art. 95(4), which lists seventeen
categories. The one that would naturally cover a share sale is item (iii):

> 三 国外にある資産の譲渡により生ずる所得として政令で定めるもの
> *(iii) income arising from the transfer of assets located outside Japan, **as
> specified by Cabinet Order***

That Cabinet Order is Enforcement Order art. 225-4, and its list is narrow:

1. foreign real property;
2. rights over foreign real property, foreign mining rights, foreign quarrying rights;
3. foreign timber;
4. shares in a foreign company where the holding exceeds a set proportion **and**
   the source country actually taxes the gain;
5. shares in a real-property-rich company (不動産関連法人 — 50%+ of asset value in
   foreign land);
6. golf-course company shares;
7. rights to use foreign golf courses and similar facilities.

[Enforcement Order art. 225-4] — `sources/japan-statutes/income-tax-enforcement-order.xml`

**Ordinary listed shares are not on that list.** A gain on Apple stock held in a
US brokerage account is *not* foreign-source income under art. 95(4)(iii). That
is exactly why art. 7(1)(ii) carries its own separate parenthetical extension
bringing in securities gains "as specified by Cabinet Order" — and that Cabinet
Order is art. 17(1).

### Enforcement Order art. 17(1): "specified securities"

Art. 17(1) defines **specified securities** (特定有価証券, *tokutei yūkashōken*) as
securities whose **date of acquisition falls _outside_** the window running

> from the day after the day ten years before the date of transfer, to the date of
> transfer — **limited to periods during which the person was a non-permanent
> resident** (その者が非永住者であつた期間に限る)

and which are additionally either (i) transferred on a foreign financial
instruments market, (ii) sold through a foreign securities broker, or (iii) held
in an account at a foreign broker or comparable institution.

Gains on **specified securities** are pulled into the definition of foreign-source
income and therefore **get remittance-basis protection**. Gains on everything
else — i.e. securities *acquired during the non-permanent resident period* — do
not, and are taxed on an arising basis whether or not a yen ever crosses the
border.

This inverts the naive reading, and it is the single most consequential finding
in this repository:

| Securities acquired | Sold while non-permanent resident | Treatment |
|---|---|---|
| **Before** Japanese residency began | via a foreign market/broker/account | Specified securities → foreign-source → **taxed only if remitted** |
| **During** the non-permanent resident period | anywhere | Not specified securities → **taxed in full on arising basis** |

So the pre-arrival portfolio is shielded; anything bought after arrival is not.
The shield does not depend on where the money sits, but on **when the asset was
acquired**.

Art. 17(2) supplies the matching rule for identifying lots: where securities of
the same issue were acquired at different times, **the earliest-acquired are
deemed transferred first** (先に取得をしたものから順次譲渡をしたものとした場合).
A forced FIFO. Pre-arrival lots are consumed first, which is favourable while the
taxpayer is not remitting, and unfavourable once they are.

Art. 17(3) preserves the acquisition date through share exchanges, splits,
mergers, spin-offs, conversions and option exercises — so a corporate action does
not silently reset a pre-arrival lot into a post-arrival one.

## 4. The ordering rule — art. 17(4)(i)

This is the machinery that decides how much of a remittance is taxed, and it is
**formulaic, not a tracing rule**:

> 一 非永住者が各年において国外から送金を受領した場合には、その金額の範囲内でその
> 非永住者のその年における国外源泉所得に係る所得で国外の支払に係るものについて
> 送金があつたものとみなす。ただし、その非永住者がその年における国外源泉所得以外の
> 所得（…「非国外源泉所得」…）に係る所得で国外の支払に係るものを有する場合は、まず
> その非国外源泉所得に係る所得について送金があつたものとみなし、なお残余があるときに
> 当該残余の金額の範囲内で国外源泉所得に係る所得について送金があつたものとみなす。

Rendered:

> **(i)** Where a non-permanent resident receives a remittance from abroad in any
> year, a remittance is **deemed** to have been made — up to the amount remitted —
> in respect of that person's **foreign-source income for that year that was paid
> abroad**. However, where the person also has **non-foreign-source income** for
> that year paid abroad, the remittance is deemed made **first** against that
> non-foreign-source income, and only any **remainder** is deemed made against
> foreign-source income.

Four consequences, all of which the calculator must implement:

**(a) It is a deeming rule, not a tracing rule.** The taxpayer does not get to say
"that transfer was from my pre-2026 savings." If there is foreign-source income
paid abroad in the year, a remittance in that year is deemed to carry it, up to
the lesser of the remittance and the income. **This is the strongest possible
support for the user's "fund Japan before residency begins" strategy** — not
because pre-arrival capital is traceable, but because in a year *before* residency
there is no non-permanent-resident year to deem against at all.

**(b) The deeming is capped by the year's income.** A ¥50m remittance in a year
with ¥3m of foreign-source income drags in ¥3m, not ¥50m. Remitting *pure
capital* in a year with *no* foreign-source income costs nothing. The exposure is
`min(remittance, foreign-source income paid abroad for that year)`, reduced first
by any non-foreign-source income paid abroad.

**(c) The stacking order is favourable.** Non-foreign-source income — which is
taxable anyway — absorbs the remittance first. Only the excess reaches the
shielded bucket.

**(d) It is annual.** The clock resets each calendar year. Nothing carries over.

### The measurement basis — art. 17(4)(ii)

The "income" being deemed remitted is computed under ITA arts. 23–35 and art. 69
(loss offsetting), **with two overrides**:

- for **employment income** and retirement income, the **gross receipts**
  (収入金額) are treated as the income amount — the employment income deduction is
  *not* applied for this purpose, so salary is measured gross and bites harder;
- for timber, **capital gains** and occasional income, the amount is receipts
  **less acquisition cost and transfer expenses** — so capital gains are measured
  **net**, i.e. the gain, not the gross proceeds. Selling a ¥100m position with a
  ¥95m basis exposes ¥5m, not ¥100m.

That asymmetry between earned income (gross) and capital gains (net) is a direct
answer to the user's question about how the categorisation differs, and it
favours capital gains.

### Split payments and multiple income types — art. 17(4)(iii)–(v)

- **(iii)** Where one category of income is paid partly in and partly outside
  Japan, it is apportioned pro rata by the receipts paid in each place.
- **(iv)** Where there are two or more categories of foreign-source income paid
  abroad, the deemed remittance is allocated across them **pro rata by amount**.
  The taxpayer cannot elect to have it land on the lowest-taxed category.
- **(v)** Amounts deemed remitted are then aggregated with same-type income to
  compute total income, so they enter the ordinary rate structure of their own
  category (see doc 03).

### Mid-year status changes — art. 17(4)(vi)

> 六 年の中途において、非永住者以外の居住者若しくは非居住者が非永住者となり、又は
> 非永住者が非永住者以外の居住者若しくは非居住者となつたときは、その者がその年に
> おいて非永住者であつた期間内に生じた…所得…及び当該期間内に国外から送金があつた
> 金額について前各号の規定を適用する。

Only income arising **during the non-permanent resident period**, and only
remittances received **during that period**, are counted. This is what makes
arrival-year timing a real lever: a remittance made in the same calendar year but
**before** the day residency begins is outside the rule entirely.

## 5. Worked example

Non-permanent resident, calendar year 2027. All amounts paid outside Japan:

| Item | Amount | Character |
|---|---|---|
| Salary from a US employer for work performed in Japan | ¥12,000,000 gross | **Non**-foreign-source (services performed in Japan → Japan-source) |
| Gain on shares bought 2019 (pre-arrival), sold via US broker | ¥8,000,000 net gain | Foreign-source (specified securities) |
| Gain on shares bought 2027 (post-arrival), sold via US broker | ¥2,000,000 net gain | **Not** specified securities → taxed in full regardless |
| Remittance to Japan during the year | ¥15,000,000 | — |

Computation:

1. The ¥2,000,000 post-arrival gain is **taxed in full** — bucket A, no remittance
   analysis. *(This is the item most people get wrong.)*
2. The salary is non-foreign-source income paid abroad. Under art. 17(4)(ii) it is
   measured **gross**: ¥12,000,000. It is taxable in full anyway as Japan-source.
3. Ordering under art. 17(4)(i): the ¥15,000,000 remittance is deemed made first
   against non-foreign-source income paid abroad → absorbs ¥12,000,000.
4. Remainder ¥3,000,000 is deemed made against foreign-source income → **¥3,000,000
   of the ¥8,000,000 pre-arrival gain becomes taxable**.
5. The remaining ¥5,000,000 of pre-arrival gain is **not taxed in Japan** this year.

Had the taxpayer remitted **¥12,000,000 or less**, the entire ¥8,000,000
foreign-source gain would have escaped Japanese tax that year — the salary would
have absorbed the whole remittance.

> The practical rule of thumb this yields: **during the non-permanent resident
> phase, keep annual remittances at or below your Japan-source income paid
> abroad.** Everything above that line reaches into shielded gains.

## 6. What counts as a remittance

The statute says only 国外から送金された ("remitted from abroad"). Neither art. 7
nor Enforcement Order art. 17 defines the mechanism, and this is where the
archived primary sources genuinely run out. What can be said:

- **Settled:** a bank transfer from a foreign account to a Japanese account is a
  remittance. Income *paid* into a Japanese account is caught by bucket B without
  needing to be a remittance at all.
- **Not established from the archived sources:** the treatment of a foreign credit
  card used in Japan and settled abroad; ATM withdrawals in Japan drawn on a
  foreign account; physically carrying cash; transfers between the taxpayer's own
  accounts; drawing on a foreign-secured loan. Commentary widely asserts that
  card and ATM use are remittances, and the NTA's general posture supports a
  substance-over-form reading, but **no primary source in this repository
  establishes it**. See Open questions.

### Reporting

Japanese financial institutions file a **report on overseas remittances**
(国外送金等調書, *kokugai sōkin-tō chōsho*) for cross-border transfers above a
threshold, so the tax authority sees the transfers independently of the return.
The threshold and the related asset-reporting statements are not yet verified from
a primary source in this repository — see Open questions.

## 7. Confidence

**Settled** — read directly from statute and Cabinet Order text archived here:

- The three-bucket structure of art. 7(1)(ii), including the "paid within Japan"
  limb.
- Art. 95(4)(iii) covers only assets specified by Cabinet Order, and Enforcement
  Order art. 225-4's list excludes ordinary listed shares.
- The specified-securities definition in Enforcement Order art. 17(1) and its
  acquisition-date window limited to the non-permanent resident period.
- The FIFO identification rule (art. 17(2)) and corporate-action continuity
  (art. 17(3)).
- The ordering rule, its annual character, and the income cap (art. 17(4)(i)).
- Gross measurement for employment income, net for capital gains (art. 17(4)(ii)).
- Pro-rata apportionment (art. 17(4)(iii)–(iv)) and the mid-year rule (art. 17(4)(vi)).

**Likely but unverified:**

- That the 2017 reform is the origin of the current art. 17(1) wording. The
  current text is archived and authoritative as it stands today; the amendment
  history and its transitional rules have **not** been traced. If the user
  acquired securities around 2017 this needs checking against the amending Act.
- That "remitted from abroad" reaches card and ATM use.

**Open questions:**

1. **What is a remittance, mechanically?** Needs NTA guidance (通達) or a ruling.
   Resolvable by retrieving the Basic Circular on the Income Tax Act
   (所得税基本通達) commentary to art. 7.
2. **Reporting thresholds** for the 国外送金等調書 and the foreign asset statement
   (国外財産調書). Resolvable from the Act on Submission of Statements of Overseas
   Assets.
3. **Transitional rules of the 2017 amendment** — whether securities acquired
   before a cut-off date are grandfathered.
4. **Proof of pre-arrival capital.** Since art. 17(4)(i) is a deeming rule rather
   than a tracing rule, documentary proof of the source of funds may matter less
   than commentary suggests — but what the NTA asks for on audit is not
   established here.

## Sources

| Label | Archived file | Original URL |
|---|---|---|
| ITA arts. 2, 7, 60-2, 95, 161 | `sources/japan-statutes/excerpt-ita-key-articles.txt` | derived from the XML below |
| Income Tax Act (full) | `sources/japan-statutes/income-tax-act.xml` | https://laws.e-gov.go.jp/api/1/lawdata/340AC0000000033 |
| Enforcement Order (full) | `sources/japan-statutes/income-tax-enforcement-order.xml` | https://laws.e-gov.go.jp/api/1/lawdata/340CO0000000096 |
| Enforcement Order arts. 14, 15, 17 | `sources/japan-statutes/excerpt-order-key-articles.txt` | derived from the XML above |
| NTA, scope of taxable income by taxpayer class | `sources/japan-nta/taxanswer-shotoku-2012.html` | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2012.htm |

Retrieved 2026-07-28; see `sources/*/MANIFEST.tsv` for hashes.
