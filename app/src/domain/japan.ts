/**
 * Japanese tax computation — docs/02 and docs/03.
 *
 * The centrepiece is `applyRemittanceOrdering`, which implements Enforcement
 * Order art. 17(4)(i). It is a DEEMING rule, not a tracing rule: the taxpayer
 * cannot designate which money was sent.
 */
import {
  JAPAN_RATES,
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

  const tenYearsBefore = new Date(parseDate(transferDate));
  tenYearsBefore.setUTCFullYear(tenYearsBefore.getUTCFullYear() - 10);
  const windowStart = tenYearsBefore.toISOString().slice(0, 10);

  const nprStart = scenario.residencyStart;
  const nprEnd = nonPermanentResidentEnd(scenario.residencyStart, scenario.priorPresence);

  // The window is [10y before transfer, transfer] intersected with the
  // non-permanent resident period. Acquisition INSIDE it means NOT specified.
  const from = windowStart > nprStart ? windowStart : nprStart;
  const to = transferDate < nprEnd ? transferDate : nprEnd;
  const acquiredInsideWindow = lot.acquired >= from && lot.acquired <= to;

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
  const byAcquisition = [...lots].sort((a, b) => a.acquired.localeCompare(b.acquired));
  return disposals.map((d) => {
    const lot = byAcquisition.find((l) => l.id === d.lotId) ?? byAcquisition[0];
    const unitBasis = lot.units > 0 ? lot.basis / lot.units : 0;
    // Art. 17(4)(ii): capital gains are measured NET of acquisition cost and
    // transfer expenses, unlike employment income which is measured gross.
    const gain = d.proceeds - unitBasis * d.units;
    return { disposal: d, gain, specified: isSpecifiedSecurity(lot, d.date, scenario), lot };
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

  // --- Aggregate-taxed income (総合課税) -----------------------------------
  // Salary for work performed in Japan is Japan-source however it is paid, so
  // it is taxable in every resident phase (doc 03 section 6).
  let aggregateGross = input.salaryForJapanWork;

  if (worldwide) {
    aggregateGross += input.salaryForForeignWork;
  } else {
    // Non-permanent resident. Foreign salary is foreign-source: taxable if paid
    // in Japan (bucket B), otherwise only to the extent deemed remitted.
    const paidInJapanShare = Math.min(input.salaryPaidInJapan, input.salaryForForeignWork);
    aggregateGross += paidInJapanShare;
    if (paidInJapanShare > 0) {
      notes.push(
        'Foreign salary paid into a Japanese account is taxable regardless of remittance ' +
          '— the "paid within Japan" limb of ITA art. 7(1)(ii).',
      );
    }
  }

  // --- The remittance ordering rule ---------------------------------------
  // Art. 17(4)(ii) measures employment income GROSS for this purpose (no
  // employment income deduction), and capital gains NET.
  const nonForeignSourceAbroad = worldwide
    ? 0
    : Math.max(0, input.salaryForJapanWork - input.salaryPaidInJapan);
  const foreignSourceAbroad = worldwide
    ? 0
    : Math.max(0, input.salaryForForeignWork - input.salaryPaidInJapan) +
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
    : input.salaryForJapanWork + Math.min(input.salaryPaidInJapan, input.salaryForForeignWork);
  const deduction = employmentIncomeDeduction(salaryTotal) + rates.basicDeduction;
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

  const inhabitantTax = aggregateTaxable * rates.inhabitantTaxRate + rates.inhabitantPerCapita;

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
