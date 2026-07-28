/**
 * US tax computation and the foreign tax credit — docs/05 and docs/06.
 *
 * The two provisions that drive the result, and that simplified models usually
 * omit, are IRC 865(g)(2) (sourcing conditional on 10% foreign tax actually
 * paid) and IRC 904(b)(2)(B) (capital gains scaled down in the credit
 * limitation numerator).
 */
import { US_RATES, forYear, progressiveTax } from './rates';
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
 *
 * NOTE, doc 05 open question 4: the statute says "any sale", implying the test
 * is applied sale-by-sale. Under the Japanese ordering rule a partial deemed
 * remittance may mean tax is paid on only part of a year's gains, splitting the
 * sourcing within one year. This models it in aggregate, which is a
 * simplification the UI flags.
 */
export function gainIsForeignSource(gain: number, foreignTaxPaidOnGain: number): boolean {
  if (gain <= 0) return false;
  return foreignTaxPaidOnGain >= 0.1 * gain;
}

export interface UsYearInput {
  year: number;
  /** Compensation for services performed abroad — foreign-source, general basket. */
  foreignEarnedIncome: number;
  /**
   * Gains split by where the securities sit, because IRC 865(g)(2) is applied
   * to each bucket separately. The statute says "any sale", implying a
   * sale-by-sale test (doc 05 open question 4); testing per bucket is closer to
   * that than one aggregate test, and it surfaces the asymmetry that matters:
   * the gains Japan taxes are the ones that keep their US credit.
   */
  japanSitusGains: number;
  japaneseTaxOnJapanSitusGains: number;
  foreignGains: number;
  japaneseTaxOnForeignGains: number;
  /** Japanese tax on salary — general basket. */
  japaneseTaxOnEarned: number;
  foreignInvestmentIncome: number;
  filingStatus: 'single' | 'marriedJoint';
  elections: Elections;
  /** Unused credits brought forward under IRC 904(c). */
  carryforwardGeneral: number;
  carryforwardPassive: number;
}

export interface UsYearOutput {
  grossIncome: number;
  feieExcluded: number;
  taxBeforeCredit: number;
  creditGeneral: number;
  creditPassive: number;
  excessCredits: number;
  niit: number;
  total: number;
  carryforwardGeneral: number;
  carryforwardPassive: number;
  notes: string[];
}

export function computeUsYear(input: UsYearInput): UsYearOutput {
  const { rates } = forYear(US_RATES, input.year);
  const notes: string[] = [];

  const capitalGains = input.japanSitusGains + input.foreignGains;
  const japaneseTaxOnGains =
    input.japaneseTaxOnJapanSitusGains + input.japaneseTaxOnForeignGains;

  const grossIncome =
    input.foreignEarnedIncome + capitalGains + input.foreignInvestmentIncome;

  // --- IRC 911 -------------------------------------------------------------
  // Earned income only. Never reaches capital gains (doc 05 section 2).
  const feieExcluded = input.elections.claimFeie
    ? Math.min(input.foreignEarnedIncome, rates.feieMax)
    : 0;

  if (input.elections.claimFeie) {
    notes.push(
      'Section 911 excludes earned income only — it never reaches capital gains. Taxes ' +
        'allocable to the excluded slice also become non-creditable under section 911(d)(6).',
    );
  }

  const ordinaryIncome = Math.max(0, input.foreignEarnedIncome - feieExcluded);
  const investmentIncome = capitalGains + input.foreignInvestmentIncome;
  const totalTaxableIncome = Math.max(
    0,
    ordinaryIncome + investmentIncome - rates.standardDeduction,
  );

  // --- Tax before credit ---------------------------------------------------
  // Section 911(f) stacking: excluded income still sets the marginal rate. The
  // ordinary tax is computed as the tax on everything less the tax on the
  // exclusion, so the exclusion removes income from tax but not from the rate.
  const ordinaryTaxable = Math.max(0, ordinaryIncome - rates.standardDeduction);
  const stackedBase = ordinaryTaxable + feieExcluded;
  const ordinaryTax = input.elections.claimFeie
    ? Math.max(
        0,
        progressiveTax(stackedBase, rates.ordinaryBrackets) -
          progressiveTax(feieExcluded, rates.ordinaryBrackets),
      )
    : progressiveTax(ordinaryTaxable, rates.ordinaryBrackets);

  // Long-term gains stack on top of ordinary income for bracket purposes.
  const ltcgRate = ltcgRateFor(ordinaryTaxable + investmentIncome, rates.ltcgBrackets);
  const capitalTax = investmentIncome * ltcgRate;
  const taxBeforeCredit = ordinaryTax + capitalTax;

  // --- NIIT, IRC 1411 ------------------------------------------------------
  // Sits in chapter 2A, so section 901 credits do not reach it. Structurally
  // uncreditable, and paid on top of any Japanese tax (doc 05 section 3).
  const niitBase = Math.max(0, Math.min(investmentIncome, grossIncome - rates.niitThreshold));
  const niit = niitBase * rates.niitRate;
  if (niit > 0) {
    notes.push(
      `Net investment income tax of $${Math.round(niit).toLocaleString()} is not creditable ` +
        'against foreign tax on the mainstream reading, so it is paid on top of Japanese tax.',
    );
  }

  // --- The section 904 limitation, per basket ------------------------------
  // Tested per bucket, so a sheltered foreign gain going US-source does not drag
  // a fully-taxed Japanese-account gain out of the foreign basket with it.
  const japanSitusIsForeign = gainIsForeignSource(
    input.japanSitusGains, input.japaneseTaxOnJapanSitusGains,
  );
  const foreignIsForeign = gainIsForeignSource(
    input.foreignGains, input.japaneseTaxOnForeignGains,
  );
  const foreignSourceGains =
    (japanSitusIsForeign ? input.japanSitusGains : 0) +
    (foreignIsForeign ? input.foreignGains : 0);

  if (input.foreignGains > 0 && !foreignIsForeign) {
    notes.push(
      'Japanese tax on the foreign-held gains is under 10% of the gain, so IRC 865(g)(2) ' +
        'leaves them US-source. There is no passive-basket limitation room and no Japanese ' +
        'tax to credit — the gain simply bears full US tax. This is the cost of the shelter: ' +
        'it saves Japanese tax, not US tax.',
    );
  }

  if (input.japanSitusGains > 0 && japanSitusIsForeign && input.foreignGains > 0 && !foreignIsForeign) {
    notes.push(
      'The two gain buckets source in opposite directions. Japan taxed the Japanese-account ' +
        'gains at over 10%, so those are foreign-source and creditable; the sheltered ' +
        'foreign-held gains stay US-source and are not. The gains you cannot shelter are the ' +
        'ones that earn US credit relief.',
    );
  }

  // Section 904(b)(2)(B): foreign-source capital gains taxed at preferential US
  // rates are scaled down in the numerator, on the logic that the US should not
  // surrender credit as though it had taxed them at ordinary rates.
  //
  // APPROXIMATION, flagged in doc 06 open question 1: the exact line-by-line
  // computation in the Form 1116 instructions has not been transcribed. The
  // direction and rough magnitude are right; the precise figure is not.
  const rateDifferentialFactor = ltcgRate / rates.topOrdinaryRate;
  const passiveNumerator = foreignSourceGains * rateDifferentialFactor;

  const generalNumerator = input.foreignEarnedIncome - feieExcluded;

  const limitation = (numerator: number) =>
    totalTaxableIncome > 0
      ? taxBeforeCredit * (Math.max(0, numerator) / totalTaxableIncome)
      : 0;

  // Section 911(d)(6): taxes allocable to excluded income are not creditable.
  const creditableEarnedTax =
    input.foreignEarnedIncome > 0
      ? input.japaneseTaxOnEarned * (1 - feieExcluded / input.foreignEarnedIncome)
      : 0;

  const generalLimit = limitation(generalNumerator);
  const passiveLimit = limitation(passiveNumerator);

  const generalAvailable = creditableEarnedTax + input.carryforwardGeneral;
  const passiveAvailable = japaneseTaxOnGains + input.carryforwardPassive;

  const creditGeneral = Math.min(generalAvailable, generalLimit);
  const creditPassive = Math.min(passiveAvailable, passiveLimit);

  const excessGeneral = Math.max(0, generalAvailable - creditGeneral);
  const excessPassive = Math.max(0, passiveAvailable - creditPassive);

  if (excessGeneral > 0 && passiveAvailable > creditPassive) {
    notes.push(
      `$${Math.round(excessGeneral).toLocaleString()} of excess general-basket credits cannot ` +
        'relieve the passive-basket shortfall — credits do not cross baskets (IRC 904(d)).',
    );
  }

  const total = Math.max(0, taxBeforeCredit - creditGeneral - creditPassive) + niit;

  return {
    grossIncome,
    feieExcluded,
    taxBeforeCredit,
    creditGeneral,
    creditPassive,
    excessCredits: excessGeneral + excessPassive,
    niit,
    total,
    // Section 904(c): carry back 1 year, forward 10. This models the
    // carryforward only; the one-year carryback would need a second pass.
    carryforwardGeneral: excessGeneral,
    carryforwardPassive: excessPassive,
    notes,
  };
}

function ltcgRateFor(taxableIncome: number, brackets: { from: number; rate: number }[]): number {
  let rate = brackets[0].rate;
  for (const b of brackets) if (taxableIncome >= b.from) rate = b.rate;
  return rate;
}
