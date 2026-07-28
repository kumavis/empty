# Getting money and assets back out of Japan

```
As of:        2026-07-28
Applies to:   Japanese tax years 2015 onward (the exit tax took effect 1 July 2015)
Verified by:  Income Tax Act arts. 60-2 and 60-3 and Enforcement Order art. 170(3),
              read verbatim from the e-Gov XML in sources/japan-statutes/
```

The user asks about "the tax implications of moving funds out of Japan after
residence". There are two quite different questions hiding in that sentence, and
conflating them is the usual mistake:

1. **Moving money** out of Japan — a transfer of already-taxed capital. This is
   generally **not a taxable event**.
2. **Ceasing to be a resident** while holding appreciated assets — which can
   trigger a **deemed disposal** of the entire portfolio under the exit tax.

The second is where the money is, and it has a striking answer for someone on a
work visa.

## 1. The exit tax (国外転出時課税制度)

Income Tax Act art. 60-2 imposes a **deemed disposal at market value** on
departure. Art. 60-2(1) defines departure (国外転出) as *"国内に住所及び居所を有
しないこととなること"* — ceasing to have both a domicile and a residence in Japan —
and applies the charge to securities (有価証券), silent-partnership interests, and
(under later paragraphs) unsettled margin and derivative positions.

Valuation date depends on filing posture [art. 60-2(1)(i)–(ii)]:

- if a **tax agent** (納税管理人, *nōzei kanrinin*) is notified before the return for
  the year of departure is filed → value **at the time of departure**;
- otherwise → value **three months before** the scheduled departure date.

### The two exclusions — art. 60-2(5)

> (5) 前各項の規定は、…当該各号に定める金額が**一億円未満**である居住者又は当該国外
> 転出をする日前**十年以内**に国内に住所若しくは居所を有していた期間として政令で定める
> 期間の合計が**五年以下**である居住者については、適用しない。

The exit tax does **not** apply to a resident who either:

- **(a)** holds covered assets worth **less than ¥100,000,000** at departure; **or**
- **(b)** had, **within the ten years before departure**, an aggregate period of
  domicile or residence in Japan **of five years or less**, *as that period is
  defined by Cabinet Order*.

Both are escape hatches. Limb (b) is where it gets interesting.

### The work-visa exclusion — Enforcement Order art. 170(3)(i)

The Cabinet Order that defines the period for limb (b) is Enforcement Order
art. 170(3):

> 三 法第六十条の二第五項に規定する国内に住所又は居所を有していた期間として政令で
> 定める期間は、次に掲げる期間とする。
> 　一 国内に住所又は居所を有していた期間（**出入国管理及び難民認定法…別表第一
> 　　（在留資格）の上欄の在留資格をもつて在留していた期間を除く。**）

> **(i)** the period during which the person had a domicile or residence in Japan,
> **excluding any period spent under a status of residence listed in the upper
> column of Appended Table 1 (Statuses of Residence) of the Immigration Control and
> Refugee Recognition Act**.

[Enforcement Order art. 170(3)(i)] — `sources/japan-statutes/income-tax-enforcement-order.xml`

**Appended Table 1** of the Immigration Control Act is the *activity-based* visa
list — Engineer/Specialist in Humanities/International Services, Intra-company
Transferee, Business Manager, Highly Skilled Professional, Professor, Researcher,
Student, and so on. **Appended Table 2** is the *status-based* list — Permanent
Resident (永住者), Spouse or Child of a Japanese National (日本人の配偶者等),
Spouse or Child of a Permanent Resident, and Long-Term Resident (定住者).

The consequence is decisive:

> **Time spent on an ordinary work visa never counts toward the exit tax's
> five-year clock.** A US citizen who lives in Japan for fifteen years on an
> Engineer or Highly Skilled Professional visa, holding ¥1bn of securities, is
> **not subject to the exit tax at all** — the clock never started.

And the mirror image, which is the real risk:

> **Switching to a Table 2 status starts the clock.** Marrying a Japanese national
> and taking a Spouse visa, or obtaining immigration Permanent Residence, begins
> accumulating time. Once that Table 2 time exceeds five years within the preceding
> ten, a departure with ¥100m+ of securities triggers a deemed disposal of the
> entire portfolio at up to 20.315%.

This reverses the intuition from doc 01: for **income tax residency**, visa
category is irrelevant and day-count is everything. For the **exit tax**, visa
category is everything.

> **Immigration Permanent Residence is a tax event.** It is usually presented as a
> pure convenience upgrade. For someone with a large portfolio it silently arms a
> deemed-disposal charge five years later. This deserves explicit modelling in the
> calculator.

### Deferral

Art. 60-2 is paired with a deferral election (納税猶予, *nōzei yūyo*) under ITA
art. 137-2, referenced in Enforcement Order art. 170(3)(ii). Deferral runs
**five years**, extendable to **ten**, and requires appointing a tax agent and
lodging security. If the assets are actually sold during the deferral the tax
crystallises; if the person returns to Japan still holding them the charge can be
unwound. The detailed conditions are **not fully traced** here — see Open questions.

### Gift and inheritance variants

Art. 60-3 applies the same deemed-disposal logic where covered assets pass **to a
non-resident** by gift or inheritance. A Japan-resident holder who gifts a foreign
portfolio to a US-resident child can trigger the charge without anyone leaving.

## 2. Departure mechanics

- **Final return.** A person leaving mid-year files for the period through
  departure. Appointing a **tax agent** (納税管理人) before departure preserves the
  normal filing timetable and, for exit-tax purposes, secures the more favourable
  departure-date valuation under art. 60-2(1)(i).
- **Inhabitant tax lag.** Inhabitant tax is assessed on the previous year's income
  and keyed to residence on **1 January** (doc 03 §3). Someone who leaves in
  **December of year N** avoids being a 1 January resident of year N+1 and so
  avoids the inhabitant tax bill on year N's income. Someone who leaves in
  **February of year N+1** pays it in full. On a large income year that timing
  difference is roughly **10% of a full year's income** — probably the largest
  single lever in departure planning, and it costs nothing but a calendar choice.

  *This rests on the unverified inhabitant tax rules flagged in doc 03; confirm
  against the Local Tax Act before relying on it.*

## 3. Moving the money itself

An **outbound** transfer of funds is not an income event. Japanese income tax
attaches to income, and art. 7's remittance rule is expressly about income
*"remitted from abroad"* — inbound. Nothing in art. 7 or Enforcement Order art. 17
taxes an outbound transfer. Capital that has already borne Japanese tax, or that
was never within the Japanese tax net, can leave without a further charge.

Two real costs remain:

- **Currency gain.** Converting yen back to dollars can realise a foreign exchange
  gain on both sides. The Japanese rule is unverified (doc 03 §5); the US side is
  in doc 05.
- **Reporting.** Cross-border transfers above a threshold are reported by the
  financial institution (国外送金等調書). Threshold unverified — doc 02 Open questions.

## 4. Inheritance and gift tax — the exposure that dwarfs everything else

Japanese **inheritance tax** (相続税, *sōzokuzei*) reaches **55%** at the top and,
in some configurations, applies to **worldwide** assets of a foreign national
resident in Japan. Scope turns on the same Appended Table 1/Table 2 distinction as
the exit tax, together with a "ten years within the preceding fifteen" test, as
modified by reforms in 2017 and 2021 that were designed to stop Japan's regime
deterring foreign workers.

The broad shape — that a Table 1 work-visa holder is generally limited to
Japan-situs assets, while Table 2 status and long residence expose worldwide assets
— matches the exit tax logic. But **none of this is verified here**: the
Inheritance Tax Act (相続税法) has not been archived, and the interaction of the
2017 and 2021 reforms is intricate.

> Flagged prominently because a 55% worldwide inheritance charge can exceed every
> income tax consideration in this repository combined. It is out of scope for the
> calculator's first version but must not be silently dropped.

## 5. Confidence

**Settled** — from statute and Cabinet Order text archived here:

- The exit tax's deemed-disposal mechanism, the two valuation dates, and their
  dependence on appointing a tax agent [art. 60-2(1)].
- The ¥100,000,000 threshold and the five-years-in-ten test as *alternative*
  exclusions [art. 60-2(5)].
- **That Appended Table 1 (work visa) periods are excluded from the exit tax's
  five-year count** [Enforcement Order art. 170(3)(i)]. This is the key finding and
  it is read directly from the Cabinet Order.
- That art. 60-3 extends the charge to gifts and bequests to non-residents.
- That the remittance rule in art. 7 is inbound-only, so outbound transfers are not
  themselves taxed.

**Likely but unverified:**

- The deferral period (5 years, extendable to 10) and its security requirements.
  The article reference (137-2) is confirmed; the terms are not.
- The inhabitant tax departure timing benefit — arithmetically sound, but resting
  on doc 03's unverified inhabitant tax rules.
- The precise contents of Immigration Appended Tables 1 and 2. The *exclusion
  mechanism* is verified from the Cabinet Order; the *visa lists* are from general
  knowledge, and the Immigration Control Act is not archived here.

**Open questions:**

1. **Archive the Immigration Control and Refugee Recognition Act** and reproduce
   Appended Tables 1 and 2 verbatim. The whole exit-tax conclusion turns on which
   table a given visa sits in.
2. **Deferral terms** under ITA art. 137-2 — security, interest, and the unwind.
3. **Inheritance and gift tax scope** — archive the Inheritance Tax Act and work
   through the Table 1/Table 2 and ten-in-fifteen tests properly.
4. **Whether switching from Table 1 to Table 2 status re-starts or back-dates the
   count.** Art. 170(3)(i) excludes Table 1 *periods*, implying only Table 2 time
   accumulates — but whether prior Table 1 time can ever be revived is not settled
   by the text alone. This determines how long after obtaining Permanent Residence
   the exposure begins, and is directly decisive for planning.
5. **Whether "residence" (居所) can persist** after departure where a Japanese home
   is retained, defeating the art. 60-2(1) definition of departure.

## Sources

| Label | Archived file | Original URL |
|---|---|---|
| ITA arts. 60-2, 60-3 | `sources/japan-statutes/excerpt-ita-key-articles.txt` | derived from the XML below |
| Income Tax Act (full) | `sources/japan-statutes/income-tax-act.xml` | https://laws.e-gov.go.jp/api/1/lawdata/340AC0000000033 |
| Enforcement Order art. 170 | `sources/japan-statutes/income-tax-enforcement-order.xml` | https://laws.e-gov.go.jp/api/1/lawdata/340CO0000000096 |

Retrieved 2026-07-28; see `sources/*/MANIFEST.tsv` for hashes.
