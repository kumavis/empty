# Japanese residency classification and the three phases

```
As of:        2026-07-28
Applies to:   Japanese tax years 2025 onward (the classification rules are long-standing)
Verified by:  Income Tax Act art. 2(1)(iii)-(v) and art. 7(1), and Enforcement Order
              arts. 14-15, read verbatim from the e-Gov XML in sources/japan-statutes/
```

## 1. The correct terms

The user's informal phases — "before residence / temporary residence / long term
residence" — map onto three statutory classes. Use these terms; the informal ones
do not appear in the law and "temporary resident" in particular is not a Japanese
tax concept at all.

| Phase (informal) | Statutory class | Japanese |
|---|---|---|
| before residence | **non-resident** | 非居住者 (*hi-kyojūsha*) |
| temporary residence | **non-permanent resident** | 非永住者 (*hi-eijūsha*) |
| long term residence | **resident other than a non-permanent resident** | 非永住者以外の居住者 |

The third is universally called a **permanent resident for tax purposes**
(永住者, *eijūsha*) in practice, but note the statute defines it only by negation.

> **False friend, and an important one:** 永住者 as a *tax* class has nothing to do
> with 永住者 as an *immigration* status. The tax test counts days of presence and
> is blind to visa category. A person can be a tax "permanent resident" on a
> two-year work visa, and a non-permanent resident while holding immigration
> Permanent Residence. (The distinction reverses for the exit tax — see doc 04 —
> where visa category is decisive and day-count is not.)

## 2. The definitions, verbatim

Income Tax Act (所得税法) art. 2(1):

> 三 **居住者** 国内に住所を有し、又は現在まで引き続いて一年以上居所を有する個人をいう。
> 四 **非永住者** 居住者のうち、日本の国籍を有しておらず、かつ、過去十年以内において
> 　　国内に住所又は居所を有していた期間の合計が五年以下である個人をいう。
> 五 **非居住者** 居住者以外の個人をいう。

Rendered:

- **(iii) Resident** — an individual who has a **domicile** (住所, *jūsho*) in
  Japan, **or** who has had a **residence** (居所, *kyosho*) in Japan
  **continuously for one year or more** up to the present.
- **(iv) Non-permanent resident** — a resident who **does not hold Japanese
  nationality** and whose **aggregate** period of having had a domicile or
  residence in Japan **within the past ten years is five years or less**.
- **(v) Non-resident** — an individual who is not a resident.

[ITA art. 2(1)(iii)–(v)] — `sources/japan-statutes/excerpt-ita-key-articles.txt`

Three points fall straight out of the text:

1. **The five-year test is cumulative, not consecutive.** The statute says
   合計 ("aggregate"). Separate stints in Japan add together across the ten-year
   look-back. A prior two-year posting a decade ago can still be inside the window.
2. **The boundary is "five years or less" (五年以下).** At exactly five years the
   taxpayer is *still* a non-permanent resident. The status changes when the
   aggregate **exceeds** five years.
3. **Nationality is an element.** A US citizen with no Japanese nationality
   satisfies it. A dual US-Japanese national **cannot** be a non-permanent
   resident at all — they are a full resident from day one, taxed on worldwide
   income immediately, with no remittance-basis phase. If there is any Japanese
   nationality in the picture, the entire strategy in doc 09 collapses; establish
   this first.

## 3. Domicile, residence, and the date the clock starts

Everything in doc 09 keys off the exact date residency begins, so the mechanics of
住所 matter.

- **Domicile** (住所) is the centre of one's life. The Income Tax Act does not
  define it; it borrows the Civil Code concept (生活の本拠).
- **Residence** (居所) is a place one actually lives without it being the centre of
  one's life.

Residency therefore begins on **either** of two triggers:

- **domicile** — effective **immediately**, on the day the centre of life moves; or
- **residence for one continuous year** — effective only **after** a year has run.

In a genuine relocation the domicile limb almost always fires on arrival, so
residency starts on **day one**, not after 183 days or after a year.

### The presumptions

Enforcement Order art. 14(1) — **presumed to have a domicile in Japan**:

> 一 その者が国内において、継続して一年以上居住することを通常必要とする職業を有すること。
> 二 その者が日本の国籍を有し、かつ、…国内において継続して一年以上居住するものと
> 　　推測するに足りる事実があること。

> **(i)** the person has an **occupation in Japan that ordinarily requires
> residence for a continuous period of one year or more**; or
> **(ii)** the person holds Japanese nationality and has a spouse or relatives
> sharing a livelihood in Japan, or other facts sufficient to infer residence for
> a year or more.

Art. 14(2) extends the presumption to a spouse and dependent relatives sharing a
livelihood with such a person.

Art. 15 is the mirror image — **presumed not to have a domicile in Japan** where
the person has an occupation abroad ordinarily requiring a year or more of
residence, or holds foreign nationality or foreign permanent residence and has no
livelihood-sharing family in Japan.

[Enforcement Order arts. 14–15] — `sources/japan-statutes/excerpt-order-key-articles.txt`

**Practical effect:** a US citizen arriving on an employment contract of a year or
more is presumed domiciled in Japan **from arrival**, by art. 14(1)(i). Note the
presumption turns on the *nature of the occupation*, not the visa or the contract
label. Note also that art. 14(1)(ii)'s family-based limb applies only to Japanese
nationals — a foreign national's family in Japan does not trigger that limb
directly, though it remains evidence on the general 住所 question.

### The 183-day myth

**183 days plays no part in Japanese domestic residency law.** It appears nowhere
in ITA art. 2 or Enforcement Order arts. 14–15. The figure comes from the treaty's
short-stay employment exemption (Convention art. 14(2)) and from other countries'
domestic rules. Anyone counting to 183 to decide Japanese residency is applying
the wrong test — the domicile limb can make someone resident on day one.

## 4. The timeline model

For an arrival on date `A`, with no prior Japanese presence:

```
        A                                      A + 5 years
────────┼──────────────────────────────────────────┼─────────────────►
 non-   │        non-permanent resident            │  resident other than
resident│        (remittance basis available)      │  a non-permanent resident
        │                                          │  (worldwide taxation)
```

- **Phase 1 — non-resident**, up to the day before `A`. Taxed only on Japan-source
  income [ITA art. 7(1)(iii)]. Foreign income and gains are outside Japanese tax
  entirely, and remittances are irrelevant.
- **Phase 2 — non-permanent resident**, from `A` until the aggregate presence
  within the preceding ten years exceeds five years. Taxed under the three-bucket
  rule in doc 02.
- **Phase 3 — resident other than a non-permanent resident**. Taxed on **worldwide
  income** [ITA art. 7(1)(i): 非永住者以外の居住者 全ての所得 — "all income"]. The
  remittance basis is gone, and so is the specified-securities shelter.

### The boundary is tested continuously, not annually

This is the point most commentary gets wrong. Art. 2(1)(iv) defines the status by
reference to the aggregate period "within the past ten years" — a condition
evaluated at a point in time, not a status assigned for a whole tax year. Status
therefore **changes mid-year**, on the day the aggregate tips past five years.

Enforcement Order art. 17(4)(vi) confirms this by expressly contemplating a person
who "in the middle of a year" becomes, or ceases to be, a non-permanent resident,
and applying the remittance rules only to income arising and remittances received
**within the non-permanent resident portion of that year**. A rule for splitting
the year would be unnecessary if status were determined annually.

**Consequence for planning:** the crossover year is split. Gains realised before
the crossover date are still under the remittance basis; gains realised after it
are taxed worldwide. The date is therefore a hard, knowable deadline — see doc 09.

## 5. How residency ends

Residency ends when domicile and residence both cease — 国外転出 ("departure from
Japan"), which ITA art. 60-2(1) defines as *"国内に住所及び居所を有しないこととなる
こと"* ("ceasing to have both a domicile and a residence in Japan"). Enforcement
Order art. 15's presumptions apply in reverse: taking up an occupation abroad
ordinarily requiring a year or more supports non-residence from departure.

Departure carries its own consequences — a final return, a tax agent, the
inhabitant tax lag and possibly the exit tax. Those are in doc 04.

## 6. Confidence

**Settled** — from statute and Cabinet Order text archived here:

- The three classes and their definitions, including the cumulative five-year
  aggregate, the "five years or less" boundary, and the nationality element.
- The two alternative triggers for residency (domicile, or one year of residence).
- The presumptions in Enforcement Order arts. 14–15 and their asymmetric treatment
  of Japanese versus foreign nationals.
- That 183 days has no role in the domestic residency test.
- That status can change mid-year, evidenced by Enforcement Order art. 17(4)(vi).

**Likely but unverified:**

- **How the five-year aggregate is counted in days.** Whether part-days at each
  end count, and whether the count is in days or months, is not established from
  the archived sources. For a single continuous stay the fifth anniversary of
  arrival is the natural reading and is what the calculator should assume, but it
  should be flagged as an assumption. Resolvable from the Basic Circular on the
  Income Tax Act (所得税基本通達) at art. 2.
- **Whether brief absences interrupt the period.** For someone travelling
  frequently this could move the crossover date materially.

**Open questions:**

1. **What ends "residence" (居所) for someone who keeps a Japanese dwelling** after
   moving away — relevant to departure planning in doc 04.
2. **Prior Japanese presence.** If the user has any earlier time in Japan within
   ten years of arrival, it shortens phase 2 directly. This is a taxpayer-specific
   input the calculator must collect, not a legal question.

## Sources

| Label | Archived file | Original URL |
|---|---|---|
| ITA arts. 2, 7, 60-2, 95, 161 | `sources/japan-statutes/excerpt-ita-key-articles.txt` | derived from the XML below |
| Income Tax Act (full) | `sources/japan-statutes/income-tax-act.xml` | https://laws.e-gov.go.jp/api/1/lawdata/340AC0000000033 |
| Enforcement Order arts. 14, 15, 17 | `sources/japan-statutes/excerpt-order-key-articles.txt` | derived from the XML below |
| Enforcement Order (full) | `sources/japan-statutes/income-tax-enforcement-order.xml` | https://laws.e-gov.go.jp/api/1/lawdata/340CO0000000096 |
| NTA, taxpayer categories | `sources/japan-nta/taxanswer-shotoku-2010.html` | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2010.htm |
| US-Japan Convention (art. 14 short-stay) | `sources/treaty/us-japan-treaty-2003.pdf` | https://home.treasury.gov/system/files/131/Treaty-Japan-11-6-2003.pdf |

Retrieved 2026-07-28; see `sources/*/MANIFEST.tsv` for hashes.
