/**
 * US tax computation and the foreign tax credit — docs/05 and docs/06.
 *
 * The provisions that drive the result, and that simplified models usually
 * omit, are IRC 865(g)(2) (sourcing conditional on 10% foreign tax actually
 * paid), IRC 904(b)(2)(B) (capital gains scaled down in BOTH the numerator and
 * the denominator of the credit limitation), and IRC 1411 (a tax no foreign
 * credit can reach).
 */
import { US_RATES, forYear, progressiveTax } from './rates';
import type { Bracket, UsFilingFigures } from './rates';
import type { Elections } from './types';

/**
 * IRC 865(g)(2) — the interlock with the Japanese remittance basis.
 *
 *   "a United States citizen or resident alien shall not be treated as a
 *    nonresident with respect to any sale of personal property unless an income
 *    tax equal to at least 10 percent of the gain derived from such sale is
 *    actually paid to a foreign country with respect to that gain."
 *
 * So a gain sheltered from Japanese tax by non-remittance pays nothing, fails
 * the test, and stays US-SOURCE — fully US-taxable with no credit to claim.
 * This is why the Japanese shelter saves Japanese tax but not US tax
 * (doc 05 section 1).
 */
export function gainIsForeignSource(gain: number, foreignTaxPaidOnGain: number): boolean {
  if (gain <= 0) return false;
  return foreignTaxPaidOnGain >= 0.1 * gain;
}

/**
 * How much of a gain bucket is foreign-source, in dollars.
 *
 * The statute ties the test to a single transaction three times over — "any
 * sale … the gain derived from SUCH SALE … with respect to THAT GAIN" — but the
 * Japanese ordering rule taxes only a deemed-remitted SLICE of a year's gains,
 * with art. 17(4)(iv) spreading that slice pro rata across every sale. Two
 * readings follow, and doc 05 open question 4 records that neither is settled:
 *
 *   (a) Pro-rata: the deeming spreads evenly, so every sale bears the same
 *       effective rate. The bucket then passes or fails as a whole — a step
 *       function with a cliff at 49.2% remitted (10% / 20.315%).
 *   (b) Proportional: only the gain actually taxed is foreign-source; the rest
 *       is not. Continuous, and it never grants foreign-source treatment to a
 *       gain on which nothing was paid.
 *
 * This implements (b). Reading (a) lets a $10,000 change in living costs
 * re-source $100,000 of gain, and above the cliff hands foreign-basket room to
 * gains that bore no foreign tax at all — which is the harder outcome to
 * defend against "with respect to that gain". The choice is disclosed in the
 * UI; `foreignSourcePortion` returns what reading (a) would give when the
 * caller wants to compare.
 */
export function foreignSourceGainPortion(
  gain: number,
  foreignTaxPaidOnGain: number,
  rate: number,
): number {
  if (gain <= 0 || foreignTaxPaidOnGain <= 0 || rate <= 0) return 0;
  // The slice that actually bore tax, capped at the bucket.
  const taxedPortion = Math.min(gain, foreignTaxPaidOnGain / rate);
  // That slice still has to clear the 10% test on its own terms; at the
  // Japanese listed-securities rate it always does, but a lower rate would not.
  return gainIsForeignSource(taxedPortion, foreignTaxPaidOnGain) ? taxedPortion : 0;
}

export interface UsYearInput {
  year: number;
  /** Compensation for services performed abroad — foreign-source, general basket. */
  foreignEarnedIncome: number;
  /**
   * Gains split by where the securities sit. Japanese-account gains are taxed
   * on an arising basis so they clear 865(g)(2) whole; foreign-held gains are
   * taxed only on the deemed-remitted slice, so only that slice is foreign.
   */
  japanSitusGains: number;
  japaneseTaxOnJapanSitusGains: number;
  foreignGains: number;
  japaneseTaxOnForeignGains: number;
  /** The Japanese rate those gains bore, used to size the taxed slice. */
  japaneseCapitalGainsRate: number;
  /** Japanese tax on salary — general basket. */
  japaneseTaxOnEarned: number;
  foreignInvestmentIncome: number;
  filingStatus: 'single' | 'marriedJoint';
  elections: Elections;
  /** Fraction of the year the taxpayer qualified for section 911, 0..1. */
  feieQualifyingFraction?: number;
  /**
   * Unused credits brought forward under IRC 904(c), oldest first. Index 0 is
   * the oldest; anything older than 10 years has already been dropped.
   */
  carryforwardGeneral: number[];
  carryforwardPassive: number[];
}

export interface UsYearOutput {
  grossIncome: number;
  feieExcluded: number;
  taxBeforeCredit: number;
  creditGeneral: number;
  creditPassive: number;
  excessCredits: number;
  /** Credits that hit the 10-year wall this year and can never be used. */
  expiredCredits: number;
  niit: number;
  total: number;
  carryforwardGeneral: number[];
  carryforwardPassive: number[];
  notes: string[];
}

/** Walk the 0/15/20 brackets rather than applying one looked-up rate. */
function capitalGainsTax(
  ordinaryTaxable: number,
  gains: number,
  brackets: Bracket[],
): number {
  if (gains <= 0) return 0;
  // Long-term gains stack ON TOP of ordinary income, so each slice takes the
  // rate of the band it lands in — not a single rate for the whole gain.
  let tax = 0;
  let remaining = gains;
  let floor = Math.max(0, ordinaryTaxable);
  for (let i = 0; i < brackets.length && remaining > 0; i++) {
    const bandTop = brackets[i + 1]?.from ?? Infinity;
    if (floor >= bandTop) continue;
    const slice = Math.min(remaining, bandTop - floor);
    tax += slice * brackets[i].rate;
    floor += slice;
    remaining -= slice;
  }
  return tax;
}

/** The marginal LTCG rate at a given stacking point, for the 904(b) factor. */
function marginalLtcgRate(at: number, brackets: Bracket[]): number {
  let rate = brackets[0].rate;
  for (const b of brackets) if (at >= b.from) rate = b.rate;
  return rate;
}

export function computeUsYear(input: UsYearInput): UsYearOutput {
  const { rates } = forYear(US_RATES, input.year);
  const f: UsFilingFigures = rates.byStatus[input.filingStatus];
  const notes: string[] = [];

  const capitalGains = input.japanSitusGains + input.foreignGains;
  const japaneseTaxOnGains =
    input.japaneseTaxOnJapanSitusGains + input.japaneseTaxOnForeignGains;

  const grossIncome =
    input.foreignEarnedIncome + capitalGains + input.foreignInvestmentIncome;

  // --- IRC 911 -------------------------------------------------------------
  // Earned income only, and pro-rated by qualifying days: section 911(b)(2)(A)
  // caps the exclusion at "the exclusion amount computed on a daily basis".
  const qualifying = Math.min(1, Math.max(0, input.feieQualifyingFraction ?? 1));
  const feieCap = rates.feieMax * qualifying;
  const feieExcluded = input.elections.claimFeie
    ? Math.min(input.foreignEarnedIncome, feieCap)
    : 0;

  if (input.elections.claimFeie) {
    notes.push(
      'Section 911 excludes earned income only — it never reaches capital gains. Taxes ' +
        'allocable to the excluded slice also become non-creditable under section 911(d)(6).',
    );
    if (qualifying < 1) {
      notes.push(
        `Only part of the year qualified under section 911(d)(1), so the exclusion is ` +
          `pro-rated to $${Math.round(feieCap).toLocaleString()} per section 911(b)(2)(A).`,
      );
    }
  }

  const ordinaryIncome = Math.max(0, input.foreignEarnedIncome - feieExcluded);
  const investmentIncome = capitalGains + input.foreignInvestmentIncome;

  // --- Tax before credit ---------------------------------------------------
  // The standard deduction comes off total income, not ordinary income alone —
  // applying it only to ordinary income silently discards it whenever ordinary
  // income is below it, which is exactly the low-salary realisation year.
  const totalTaxableIncome = Math.max(0, ordinaryIncome + investmentIncome - f.standardDeduction);
  const ordinaryTaxable = Math.max(0, Math.min(ordinaryIncome, totalTaxableIncome));
  const gainsTaxable = Math.max(0, totalTaxableIncome - ordinaryTaxable);

  // Section 911(f) stacking: excluded income still sets the marginal rate.
  const ordinaryTax = input.elections.claimFeie
    ? Math.max(
        0,
        progressiveTax(ordinaryTaxable + feieExcluded, f.ordinaryBrackets) -
          progressiveTax(feieExcluded, f.ordinaryBrackets),
      )
    : progressiveTax(ordinaryTaxable, f.ordinaryBrackets);

  // 911(f)(1)(A)(i) computes the tax "as if taxable income were increased by
  // the amount excluded", which reaches the section 1(h) bands too — so the
  // gain stacks above the exclusion as well as above ordinary income.
  const stackFloor = ordinaryTaxable + feieExcluded;
  const capitalTax = capitalGainsTax(stackFloor, gainsTaxable, f.ltcgBrackets);
  const taxBeforeCredit = ordinaryTax + capitalTax;

  // --- NIIT, IRC 1411 ------------------------------------------------------
  // Chapter 2A, so section 901 credits do not reach it. Section 1411(d) adds
  // section 911 excluded income back into MAGI, which pre-FEIE gross already is.
  const niitBase = Math.max(0, Math.min(investmentIncome, grossIncome - f.niitThreshold));
  const niit = niitBase * rates.niitRate;
  if (niit > 0) {
    notes.push(
      `Net investment income tax of $${Math.round(niit).toLocaleString()} is not reached by ` +
        'the section 901 credit on the mainstream reading — section 1411 sits in chapter 2A — ' +
        'so it is paid on top of Japanese tax.',
    );
  }

  // --- The section 904 limitation, per basket ------------------------------
  const japanSitusForeign = foreignSourceGainPortion(
    input.japanSitusGains,
    input.japaneseTaxOnJapanSitusGains,
    input.japaneseCapitalGainsRate,
  );
  const foreignHeldForeign = foreignSourceGainPortion(
    input.foreignGains,
    input.japaneseTaxOnForeignGains,
    input.japaneseCapitalGainsRate,
  );
  const foreignSourceGains = japanSitusForeign + foreignHeldForeign;
  const usSourceGains = Math.max(0, capitalGains - foreignSourceGains);

  if (usSourceGains > 0) {
    notes.push(
      `$${Math.round(usSourceGains).toLocaleString()} of gain bore no Japanese tax, so IRC ` +
        '865(g)(2) leaves it US-source: no passive-basket room and nothing to credit. That is ' +
        'the cost of the shelter — it saves Japanese tax, not US tax.',
    );
  }
  if (input.japanSitusGains > 0 && japanSitusForeign > 0 && usSourceGains > 0) {
    notes.push(
      'The two gain buckets source in opposite directions: Japan taxed the Japanese-account ' +
        'gains, so those stay foreign-source and creditable, while the sheltered foreign-held ' +
        'gains do not. The gains you cannot shelter are the ones that earn US credit relief.',
    );
  }

  /**
   * Section 904(b)(2)(B) has TWO clauses and both must be applied:
   *   (i)  foreign-source taxable income includes gain only as reduced by the
   *        rate differential portion of foreign source net capital gain;
   *   (ii) ENTIRE taxable income likewise, reduced by the rate differential
   *        portion of net capital gain.
   * Form 1116's Line 18 worksheet makes the denominator adjustment mandatory
   * unless foreign net capital gain is under $20,000. Adjusting only the
   * numerator inflates the denominator and understates BOTH baskets.
   *
   * The factor is the official one: Form 1116 directs multiplying by 0.4054 at
   * a 15% rate and 0.5405 at 20%, i.e. rate / 37, and excludes 0%-rate gain.
   */
  const ltcgRate = marginalLtcgRate(stackFloor + gainsTaxable, f.ltcgBrackets);
  const differentialFactor = ltcgRate / rates.topOrdinaryRate;

  // Deductions are apportioned into the numerator by the gross-income ratio —
  // section 904(a)'s numerator is TAXABLE income from foreign sources, and a
  // model that uses gross overstates the credit (doc 06 section 2).
  const foreignGrossGeneral = Math.max(0, input.foreignEarnedIncome - feieExcluded);
  const foreignGrossPassive = foreignSourceGains * differentialFactor;
  const foreignGrossTotal = foreignGrossGeneral + foreignGrossPassive;
  const grossForRatio = Math.max(
    1,
    ordinaryIncome + input.foreignInvestmentIncome + capitalGains * differentialFactor,
  );
  const deductionShare = f.standardDeduction * Math.min(1, foreignGrossTotal / grossForRatio);

  const apportion = (grossPart: number) =>
    foreignGrossTotal > 0
      ? Math.max(0, grossPart - deductionShare * (grossPart / foreignGrossTotal))
      : 0;

  const generalNumerator = apportion(foreignGrossGeneral);
  const passiveNumerator = apportion(foreignGrossPassive);

  // Clause (ii): the denominator drops the same rate differential portion.
  const denominator = Math.max(
    1,
    totalTaxableIncome - gainsTaxable * (1 - differentialFactor),
  );

  // Section 904(a): foreign-source taxable income is capped at "the taxpayer's
  // entire taxable income", so the ratio can never exceed 1.
  const limitation = (numerator: number) =>
    taxBeforeCredit * Math.min(1, Math.max(0, numerator) / denominator);

  // Section 911(d)(6): taxes allocable to excluded income are not creditable.
  const creditableEarnedTax =
    input.foreignEarnedIncome > 0
      ? input.japaneseTaxOnEarned * (1 - feieExcluded / input.foreignEarnedIncome)
      : 0;

  const generalLimit = limitation(generalNumerator);
  const passiveLimit = limitation(passiveNumerator);

  // Section 904(c): carryforwards are used oldest-first and die after 10 years.
  const useOldestFirst = (pool: number[], current: number, limit: number) => {
    let room = limit;
    const takeCurrent = Math.min(current, room);
    room -= takeCurrent;
    const leftover: number[] = [];
    let fromPool = 0;
    for (const vintage of pool) {
      const take = Math.min(vintage, room);
      fromPool += take;
      room -= take;
      leftover.push(vintage - take);
    }
    return { credit: takeCurrent + fromPool, unusedCurrent: current - takeCurrent, leftover };
  };

  const gen = useOldestFirst(input.carryforwardGeneral, creditableEarnedTax, generalLimit);
  const pas = useOldestFirst(input.carryforwardPassive, japaneseTaxOnGains, passiveLimit);

  const roll = (leftover: number[], unusedCurrent: number) => {
    const aged = [...leftover, unusedCurrent];
    // Anything that has sat for 10 years is time-barred.
    const expired = aged.length > 10 ? aged.slice(0, aged.length - 10).reduce((a, b) => a + b, 0) : 0;
    return { pool: aged.slice(-10).filter((v, i, a) => v > 0 || i === a.length - 1), expired };
  };

  const rolledGeneral = roll(gen.leftover, gen.unusedCurrent);
  const rolledPassive = roll(pas.leftover, pas.unusedCurrent);

  const excessGeneral = gen.leftover.reduce((a, b) => a + b, 0) + gen.unusedCurrent;
  const excessPassive = pas.leftover.reduce((a, b) => a + b, 0) + pas.unusedCurrent;

  if (excessGeneral > 0 && japaneseTaxOnGains > pas.credit) {
    notes.push(
      `$${Math.round(excessGeneral).toLocaleString()} of excess general-basket credits cannot ` +
        'relieve the passive-basket shortfall — credits do not cross baskets (IRC 904(d)).',
    );
  }
  if (input.elections.claimTreatyResourcing && usSourceGains > 0) {
    notes.push(
      'Treaty re-sourcing under Convention art. 23(3) is elected but not modelled: IRC ' +
        '904(d)(6)(A) requires a SEPARATE limitation for each re-sourced item, which this ' +
        'engine does not compute. Any relief it would give is therefore missing here.',
    );
  }

  const total = Math.max(0, taxBeforeCredit - gen.credit - pas.credit) + niit;

  return {
    grossIncome,
    feieExcluded,
    taxBeforeCredit,
    creditGeneral: gen.credit,
    creditPassive: pas.credit,
    excessCredits: excessGeneral + excessPassive,
    expiredCredits: rolledGeneral.expired + rolledPassive.expired,
    niit,
    total,
    carryforwardGeneral: rolledGeneral.pool,
    carryforwardPassive: rolledPassive.pool,
    notes,
  };
}
