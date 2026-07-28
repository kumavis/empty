/**
 * Japanese tax computation — docs/02 and docs/03.
 *
 * The centrepiece is `applyRemittanceOrdering`, which implements Enforcement
 * Order art. 17(4)(i). It is a DEEMING rule, not a tracing rule: the taxpayer
 * cannot designate which money was sent.
 */
import {
  JAPAN_RATES,
  basicDeductionFor,
  employmentIncomeDeduction,
  forYear,
  japanNationalTax,
  listedSecuritiesRate,
} from './rates';
import { nonPermanentResidentEnd, parseDate } from './phases';
import type { Disposal, Lot, ResidencyPhase, Scenario } from './types';

/**
 * Enforcement Order art. 17(4)(i) — the remittance ordering rule.
 *
 *   "Where a non-permanent resident receives a remittance from abroad in any
 *    year, a remittance is deemed to have been made, up to the amount remitted,
 *    in respect of that person's foreign-source income for that year paid
 *    abroad. However, where the person also has non-foreign-source income for
 *    that year paid abroad, the remittance is deemed made FIRST against that
 *    non-foreign-source income, and only any REMAINDER against foreign-source
 *    income."
 *
 * Three properties fall out, all of which the strategy in doc 09 depends on:
 *   - exposure is capped by the YEAR'S income, not by the size of the remittance;
 *   - non-foreign-source income (taxable anyway) absorbs the remittance first;
 *   - the rule is annual and resets, so realising gains in a non-remitting year
 *     costs nothing.
 */
export function applyRemittanceOrdering(input: {
  remittance: number;
  /** Non-foreign-source income paid abroad (e.g. salary for work done in Japan). */
  nonForeignSourceAbroad: number;
  /** Foreign-source income paid abroad — the shelterable pool. */
  foreignSourceAbroad: number;
}): { deemedRemitted: number; absorbedByNonForeignSource: number } {
  const { remittance, nonForeignSourceAbroad, foreignSourceAbroad } = input;
  if (remittance <= 0) return { deemedRemitted: 0, absorbedByNonForeignSource: 0 };

  const absorbed = Math.min(remittance, nonForeignSourceAbroad);
  const remainder = Math.max(0, remittance - nonForeignSourceAbroad);
  return {
    deemedRemitted: Math.min(remainder, foreignSourceAbroad),
    absorbedByNonForeignSource: absorbed,
  };
}

/**
 * Enforcement Order art. 17(1) — is this lot a "specified security" (特定有価証券)?
 *
 * Specified securities are those whose acquisition date falls OUTSIDE the window
 * running from ten years before the transfer to the transfer date, limited to
 * periods during which the person was a non-permanent resident. Only their gains
 * are foreign-source and so shelterable.
 *
 * The practical consequence, and the finding most commentary omits: a pre-arrival
 * portfolio is sheltered, while anything bought after arrival is taxed on an
 * arising basis whether or not it is remitted (doc 02 section 3).
 */
export function isSpecifiedSecurity(
  lot: Lot,
  transferDate: string,
  scenario: Scenario,
): boolean {
  // Art. 17(1) also requires a foreign market, broker or account.
  if (!lot.heldAbroad) return false;

  // Art. 17(1): 「…の日の十年前の日の翌日から当該譲渡の日までの期間」 — the day
  // AFTER the day ten years before, not that day itself.
  const tenYearsBefore = new Date(parseDate(transferDate));
  tenYearsBefore.setUTCFullYear(tenYearsBefore.getUTCFullYear() - 10);
  tenYearsBefore.setUTCDate(tenYearsBefore.getUTCDate() + 1);
  const windowStart = tenYearsBefore.toISOString().slice(0, 10);

  const nprStart = scenario.residencyStart;
  const nprEnd = nonPermanentResidentEnd(scenario.residencyStart, scenario.priorPresence);

  // The window is [10y before transfer, transfer] intersected with the
  // non-permanent resident period. Acquisition INSIDE it means NOT specified.
  const from = windowStart > nprStart ? windowStart : nprStart;
  // `nprEnd` is the FIRST day of non-NPR status, so the period is half-open:
  // an acquisition on that day itself is outside it.
  const acquiredInsideWindow =
    lot.acquired >= from && lot.acquired <= transferDate && lot.acquired < nprEnd;

  return !acquiredInsideWindow;
}

/**
 * Match disposals to lots under the forced FIFO of Enforcement Order art. 17(2):
 * "the earliest-acquired are deemed transferred first". The taxpayer cannot
 * choose to sell post-arrival lots first and preserve the sheltered ones.
 */
export function realiseGains(
  disposals: Disposal[],
  lots: Lot[],
  scenario: Scenario,
): Array<{ disposal: Disposal; gain: number; specified: boolean; lot: Lot }> {
  // Remaining units per lot, consumed oldest-first. The disposal's own lotId is
  // used only to identify the ISSUE (art. 17(2) applies FIFO within the same
  // issue); which lot is actually deemed sold is not the taxpayer's to choose.
  const remaining = new Map(lots.map((l) => [l.id, l.units]));
  const label = (id: string) => lots.find((l) => l.id === id)?.label ?? id;

  return disposals.flatMap((d) => {
    const issue = label(d.lotId);
    const queue = lots
      .filter((l) => label(l.id) === issue)
      .sort((a, b) => a.acquired.localeCompare(b.acquired));

    let toSell = d.units;
    const proceedsPerUnit = d.units > 0 ? d.proceeds / d.units : 0;
    const out: Array<{ disposal: Disposal; gain: number; specified: boolean; lot: Lot }> = [];

    for (const lot of queue) {
      if (toSell <= 0) break;
      const avail = remaining.get(lot.id) ?? 0;
      if (avail <= 0) continue;
      const take = Math.min(avail, toSell);
      remaining.set(lot.id, avail - take);
      toSell -= take;

      const unitBasis = lot.units > 0 ? lot.basis / lot.units : 0;
      // Art. 17(4)(ii): capital gains are measured NET of acquisition cost and
      // transfer expenses, unlike employment income which is measured gross.
      const gain = proceedsPerUnit * take - unitBasis * take;
      out.push({
        disposal: { ...d, units: take, proceeds: proceedsPerUnit * take },
        gain,
        specified: isSpecifiedSecurity(lot, d.date, scenario),
        lot,
      });
    }
    return out;
  });
}

export interface JapanYearInput {
  year: number;
  phase: ResidencyPhase;
  /** Salary for services performed in Japan — Japan-source, never shelterable. */
  salaryForJapanWork: number;
  salaryForForeignWork: number;
  salaryPaidInJapan: number;
  foreignInvestmentIncomeAbroad: number;
  foreignInvestmentIncomePaidInJapan: number;
  remittance: number;
  /**
   * Gains on securities held in a JAPANESE account or sold through a Japanese
   * broker. Enforcement Order art. 17(1) requires a foreign market, foreign
   * broker or foreign account for a security to be "specified", so these fail
   * the test whenever they were acquired and are non-foreign-source income.
   * ITA art. 7(1)(ii) taxes a non-permanent resident on all non-foreign-source
   * income, so these are taxed on an arising basis in every resident phase and
   * can never be sheltered by non-remittance.
   */
  japanSitusGains: number;
  /** Gains on specified securities held abroad — shelterable while a non-permanent resident. */
  shelterableGains: number;
  /** Gains on securities held abroad but acquired after arrival — arising basis. */
  arisingBasisGains: number;
  /**
   * Of `arisingBasisGains`, the portion whose proceeds are paid ABROAD. Art.
   * 17(4)(i)'s proviso makes non-foreign-source income paid abroad absorb the
   * remittance first, and these gains qualify — omitting them sends remittances
   * straight into the shelterable pool and over-taxes.
   */
  arisingBasisGainsPaidAbroad?: number;
  /**
   * Fraction of the year the person was a non-permanent resident, 0..1.
   * Enforcement Order art. 17(4)(vi) confines the remittance rules to that
   * portion; income and tax are apportioned by it rather than the whole year
   * taking the year-end phase.
   */
  residentFraction?: number;
  /**
   * Whether inhabitant tax is due for this year. It is keyed to residence on
   * 1 January and assessed on the PRIOR year's income (doc 03 section 3), so
   * the caller decides — this function only computes the amount.
   */
  inhabitantTaxDue?: boolean;
  /** Prior-year aggregate taxable income, which inhabitant tax is charged on. */
  inhabitantTaxBase?: number;
}

export interface JapanYearOutput {
  alwaysTaxable: number;
  shelterable: number;
  deemedRemitted: number;
  employmentTax: number;
  capitalGainsTax: number;
  /** Split out so IRC 865(g)(2) can be tested per bucket rather than in aggregate. */
  capitalGainsTaxOnJapanSitus: number;
  capitalGainsTaxOnForeign: number;
  inhabitantTax: number;
  total: number;
  notes: string[];
}

export function computeJapanYear(input: JapanYearInput): JapanYearOutput {
  const { rates } = forYear(JAPAN_RATES, input.year);
  const notes: string[] = [];

  if (input.phase === 'nonResident') {
    return {
      alwaysTaxable: 0,
      shelterable: 0,
      deemedRemitted: 0,
      employmentTax: 0,
      capitalGainsTax: 0,
      capitalGainsTaxOnJapanSitus: 0,
      capitalGainsTaxOnForeign: 0,
      inhabitantTax: 0,
      total: 0,
      notes: ['Non-resident: Japan taxes only Japan-source income. Remittances are irrelevant.'],
    };
  }

  const worldwide = input.phase === 'permanentResident';

  /**
   * Art. 17(4)(iii): where income of one category is paid partly inside and
   * partly outside Japan, the split is made PRO RATA within that category —
   * 「その各種所得に係る収入金額のうちに国内で支払われた金額…の占める割合を
   * 乗じて」. The paid-in-Japan total is therefore apportioned across the two
   * salary categories by their size, not subtracted from each in full.
   */
  const salaryAll = input.salaryForJapanWork + input.salaryForForeignWork;
  const paidInJapanCapped = Math.min(input.salaryPaidInJapan, salaryAll);
  const japanWorkShare = salaryAll > 0 ? input.salaryForJapanWork / salaryAll : 0;
  const paidInJapanDomestic = paidInJapanCapped * japanWorkShare;
  const paidInJapanForeign = paidInJapanCapped - paidInJapanDomestic;

  // --- Aggregate-taxed income (総合課税) -----------------------------------
  // Salary for work performed in Japan is Japan-source however it is paid, so
  // it is taxable in every resident phase (doc 03 section 6).
  let aggregateGross = input.salaryForJapanWork;

  if (worldwide) {
    aggregateGross += input.salaryForForeignWork;
  } else {
    // Non-permanent resident. Foreign salary is foreign-source: taxable if paid
    // in Japan (bucket B), otherwise only to the extent deemed remitted.
    aggregateGross += paidInJapanForeign;
    if (paidInJapanForeign > 0) {
      notes.push(
        'Foreign salary paid into a Japanese account is taxable regardless of remittance ' +
          '— the "paid within Japan" limb of ITA art. 7(1)(ii).',
      );
    }
  }

  // --- The remittance ordering rule ---------------------------------------
  // Art. 17(4)(ii) measures employment income GROSS for this purpose (no
  // employment income deduction), and capital gains NET.
  // Non-foreign-source income PAID ABROAD absorbs the remittance first. That is
  // salary for Japanese work paid outside Japan, plus gains on non-specified
  // securities whose proceeds stayed abroad — both are 非国外源泉所得.
  const nonForeignSourceAbroad = worldwide
    ? 0
    : Math.max(0, input.salaryForJapanWork - paidInJapanDomestic) +
      (input.arisingBasisGainsPaidAbroad ?? 0);
  const foreignSourceAbroad = worldwide
    ? 0
    : Math.max(0, input.salaryForForeignWork - paidInJapanForeign) +
      input.foreignInvestmentIncomeAbroad +
      input.shelterableGains;

  const ordering = worldwide
    ? { deemedRemitted: 0, absorbedByNonForeignSource: 0 }
    : applyRemittanceOrdering({
        remittance: input.remittance,
        nonForeignSourceAbroad,
        foreignSourceAbroad,
      });

  if (!worldwide && input.remittance > 0) {
    if (ordering.deemedRemitted === 0) {
      notes.push(
        `Remittance of ¥${Math.round(input.remittance).toLocaleString()} was fully absorbed by ` +
          'Japan-source income paid abroad. No foreign-source income was brought into tax.',
      );
    } else {
      notes.push(
        `¥${Math.round(ordering.deemedRemitted).toLocaleString()} of foreign-source income was ` +
          'deemed remitted and is taxable. Keeping the remittance at or below ' +
          `¥${Math.round(nonForeignSourceAbroad).toLocaleString()} would have avoided this.`,
      );
    }
  }

  // Art. 17(4)(iv): where several categories of foreign-source income are paid
  // abroad, the deemed remittance is allocated PRO RATA by amount. The taxpayer
  // cannot direct it at the lowest-taxed category.
  const gainShare = foreignSourceAbroad > 0 ? input.shelterableGains / foreignSourceAbroad : 0;
  const remittedGains = ordering.deemedRemitted * gainShare;
  const remittedOther = ordering.deemedRemitted - remittedGains;

  aggregateGross += worldwide
    ? input.foreignInvestmentIncomeAbroad
    : remittedOther;
  aggregateGross += input.foreignInvestmentIncomePaidInJapan;

  // --- Tax on aggregate income --------------------------------------------
  const salaryTotal = worldwide
    ? input.salaryForJapanWork + input.salaryForForeignWork
    : input.salaryForJapanWork + paidInJapanForeign;
  const employmentDeduction = employmentIncomeDeduction(salaryTotal);
  // 合計所得金額 after the employment deduction is what the basic deduction
  // tapers against — above ¥25m it is zero (No.1199).
  const totalIncomeForBasic = Math.max(0, aggregateGross - employmentDeduction);
  const deduction = employmentDeduction + basicDeductionFor(totalIncomeForBasic, rates);
  const aggregateTaxable = Math.max(0, aggregateGross - deduction);

  const national = japanNationalTax(aggregateTaxable, rates);
  const surtax =
    input.year <= rates.reconstructionSurtaxEndsAfter ? national * rates.reconstructionSurtax : 0;
  const employmentTax = national + surtax;

  // --- Separate self-assessment taxation (申告分離課税) ----------------------
  // Foreign-held gains: sheltered while a non-permanent resident unless deemed
  // remitted, plus anything acquired after arrival which is taxed as it arises.
  const taxableForeignGains = worldwide
    ? input.shelterableGains + input.arisingBasisGains
    : remittedGains + input.arisingBasisGains;

  const cgRate = listedSecuritiesRate(rates, input.year);
  // The 20.315% headline already contains the 5% local component, so inhabitant
  // tax below is charged on aggregate income only, to avoid double-counting.
  const capitalGainsTaxOnForeign = taxableForeignGains * cgRate;
  // Japanese-account gains are taxed at the same rate but on an arising basis in
  // every resident phase — remittance never enters the question.
  const capitalGainsTaxOnJapanSitus = input.japanSitusGains * cgRate;
  const capitalGainsTax = capitalGainsTaxOnForeign + capitalGainsTaxOnJapanSitus;

  if (!worldwide && input.japanSitusGains > 0) {
    notes.push(
      'Gains in a Japanese account are non-foreign-source, so ITA art. 7(1)(ii) taxes them ' +
        'in full however little is remitted. The remittance basis does not reach them — but ' +
        'because Japan does tax them, they keep their US foreign tax credit.',
    );
  }

  if (!worldwide && input.arisingBasisGains > 0) {
    notes.push(
      `¥${Math.round(input.arisingBasisGains).toLocaleString()} of gains are on securities ` +
        'acquired after arrival, so they are taxed on an arising basis regardless of ' +
        'remittance (Enforcement Order art. 17(1)).',
    );
  }

  // Inhabitant tax runs a year behind and is keyed to residence on 1 January
  // (doc 03 section 3), so the caller supplies both the trigger and the base.
  // Defaults preserve the same-year behaviour for direct callers and tests.
  const inhabitantDue = input.inhabitantTaxDue ?? true;
  const inhabitantBase = input.inhabitantTaxBase ?? aggregateTaxable;
  const inhabitantTax = inhabitantDue
    ? Math.max(0, inhabitantBase) * rates.inhabitantTaxRate + rates.inhabitantPerCapita
    : 0;

  return {
    alwaysTaxable: aggregateGross,
    shelterable: foreignSourceAbroad,
    deemedRemitted: ordering.deemedRemitted,
    employmentTax,
    capitalGainsTax,
    capitalGainsTaxOnJapanSitus,
    capitalGainsTaxOnForeign,
    inhabitantTax,
    total: employmentTax + capitalGainsTax + inhabitantTax,
    notes,
  };
}
