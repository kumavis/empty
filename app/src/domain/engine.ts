/**
 * Multi-year projection: ties the Japanese and US computations together, and
 * models how living costs are actually funded.
 *
 * Two orderings matter here.
 *
 * 1. Japan is computed before the US, because Japanese tax on a gain decides US
 *    sourcing under IRC 865(g)(2), which decides whether the foreign tax credit
 *    has any room (doc 05 section 1).
 *
 * 2. Living costs are funded in a fixed order: salary already in Japan first,
 *    then pre-positioned savings, and only then a remittance from abroad. That
 *    order is the whole strategy. Pre-positioned savings sit outside the
 *    remittance regime (Enforcement Order art. 17(4)(vi)), so spending them
 *    funds life in Japan without triggering the ordering rule — which means the
 *    year they run out is the year the shelter starts to leak.
 */
import { computeJapanYear } from './japan';
import { computeUsYear } from './us';
import { exitTaxExposure, nonPermanentResidentEnd, parseDate, phaseForYear } from './phases';
import { toJpy } from './money';
import type { Scenario, ScenarioResult, YearResult } from './types';

export function runScenario(scenario: Scenario): ScenarioResult {
  const fx = scenario.fxJpyPerUsd;
  const startYear = parseDate(scenario.residencyStart).getUTCFullYear();
  const years = Array.from({ length: scenario.projectionYears }, (_, i) => startYear + i);

  const warnings: string[] = [];
  const results: YearResult[] = [];

  // Everything below is in yen; the inputs arrive in dollars.
  const salary = toJpy(scenario.annualSalary, fx);
  const gains = toJpy(scenario.annualCapitalGains, fx);
  const livingCost = toJpy(scenario.annualLivingCost, fx);

  let savings = toJpy(scenario.prePositionedSavings, fx);
  let savingsExhaustedIn: number | null = null;
  let carryforwardGeneral = 0;
  let carryforwardPassive = 0;

  for (const year of years) {
    const { phase, changedOn } = phaseForYear(year, scenario);
    const resident = phase !== 'nonResident';

    // Gains on pre-arrival holdings are specified securities and shelterable;
    // anything bought after arrival is taxed on an arising basis regardless.
    const shelterableGains = scenario.gainsOnPreArrivalHoldings ? gains : 0;
    const arisingBasisGains = scenario.gainsOnPreArrivalHoldings ? 0 : gains;

    /**
     * Japanese tax and the forced remittance are mutually dependent: tax
     * reduces the salary available to live on, which raises the remittance,
     * which is itself taxable and raises the tax. The dependence is weak — the
     * remittance only ever adds foreign income on top of salary — so a short
     * fixed-point iteration converges to the yen in two or three passes.
     */
    let remittance = 0;
    let japan = computeJapanYear({
      year, phase,
      salaryForJapanWork: salary,
      salaryForForeignWork: 0,
      salaryPaidInJapan: salary,
      foreignInvestmentIncomeAbroad: 0,
      foreignInvestmentIncomePaidInJapan: 0,
      remittance: 0,
      shelterableGains,
      arisingBasisGains,
    });

    let fundedFromSavings = 0;
    let fundedFromRemittance = 0;
    let savingsAfter = savings;

    for (let pass = 0; pass < 4; pass++) {
      const netSalary = Math.max(0, salary - japan.total);
      const shortfall = livingCost - netSalary;

      if (shortfall <= 0) {
        // Salary more than covers living costs. The surplus is already-taxed
        // money sitting in Japan, so it joins the same pot: both it and the
        // pre-positioned savings can be spent without remitting anything.
        fundedFromSavings = 0;
        fundedFromRemittance = 0;
        savingsAfter = savings - shortfall;
      } else {
        fundedFromSavings = Math.min(shortfall, savings);
        fundedFromRemittance = shortfall - fundedFromSavings;
        savingsAfter = savings - fundedFromSavings;
      }

      // Only a non-permanent resident is exposed to the ordering rule at all.
      const nextRemittance = phase === 'nonPermanentResident' ? fundedFromRemittance : 0;
      if (Math.abs(nextRemittance - remittance) < 1) break;
      remittance = nextRemittance;

      japan = computeJapanYear({
        year, phase,
        salaryForJapanWork: salary,
        salaryForForeignWork: 0,
        salaryPaidInJapan: salary,
        foreignInvestmentIncomeAbroad: 0,
        foreignInvestmentIncomePaidInJapan: 0,
        remittance,
        shelterableGains,
        arisingBasisGains,
      });
    }

    if (savings > 0 && savingsAfter <= 0.5 && savingsExhaustedIn === null) {
      savingsExhaustedIn = year;
    }
    savings = savingsAfter;

    // --- The US side, in USD -----------------------------------------------
    const us = computeUsYear({
      year,
      foreignEarnedIncome: salary / fx,
      capitalGains: gains / fx,
      japaneseTaxOnGains: japan.capitalGainsTax / fx,
      japaneseTaxOnEarned: (japan.employmentTax + japan.inhabitantTax) / fx,
      foreignInvestmentIncome: 0,
      filingStatus: scenario.filingStatus,
      elections: scenario.elections,
      carryforwardGeneral,
      carryforwardPassive,
    });

    carryforwardGeneral = us.carryforwardGeneral;
    carryforwardPassive = us.carryforwardPassive;

    const combined = japan.total + us.total * fx;
    const economicIncome = resident ? salary + gains : 0;

    const notes: string[] = [
      // Enforcement Order art. 17(4)(vi) confines the remittance rules to the
      // non-permanent resident PORTION of a split year. This model applies the
      // year-end phase to the whole year — disclosed rather than hidden.
      ...(changedOn
        ? [
            `Status changed on ${changedOn}. Enforcement Order art. 17(4)(vi) requires this ` +
              'year to be split, counting only income arising and remittances received within ' +
              'each phase. This model applies the year-end phase to the whole year, so figures ' +
              'for this year are approximate.',
          ]
        : []),
      ...(fundedFromSavings > 0
        ? [
            'Living costs exceeded net salary, and the gap was met from cash already in ' +
              'Japan. That cash — pre-positioned savings plus accumulated salary surplus — ' +
              'sits outside the remittance regime, so it funds life in Japan without ' +
              'exposing any foreign income to the ordering rule.',
          ]
        : []),
      ...(fundedFromRemittance > 0 && phase === 'nonPermanentResident'
        ? [
            'Pre-positioned savings are spent, so living costs now have to be remitted. ' +
              'Every remitted dollar beyond Japan-source income paid abroad reaches foreign ' +
              'income under the ordering rule.',
          ]
        : []),
      ...japan.notes,
      ...us.notes,
    ];

    results.push({
      year,
      phase,
      phaseChangedOn: changedOn,
      japan: {
        alwaysTaxable: japan.alwaysTaxable,
        shelterable: japan.shelterable,
        deemedRemitted: japan.deemedRemitted,
        employmentTax: japan.employmentTax,
        capitalGainsTax: japan.capitalGainsTax,
        inhabitantTax: japan.inhabitantTax,
        total: japan.total,
      },
      us: {
        grossIncome: us.grossIncome,
        feieExcluded: us.feieExcluded,
        taxBeforeCredit: us.taxBeforeCredit,
        creditGeneral: us.creditGeneral,
        creditPassive: us.creditPassive,
        excessCredits: us.excessCredits,
        niit: us.niit,
        total: us.total,
      },
      cash: {
        netSalaryInJapan: Math.max(0, salary - japan.total),
        livingCost,
        fundedFromSavings,
        fundedFromRemittance,
        savingsRemaining: savingsAfter,
      },
      combined,
      effectiveRate: economicIncome > 0 ? combined / economicIncome : 0,
      notes,
    });
  }

  // --- Scenario-level findings ---------------------------------------------
  if (scenario.holdsJapaneseNationality) {
    warnings.push(
      'Japanese nationality is held, so non-permanent resident status is unavailable ' +
        '(ITA art. 2(1)(iv)). Worldwide taxation applies from day one and the remittance ' +
        'basis never exists.',
    );
  }

  if (scenario.prePositionedSavings === 0) {
    warnings.push(
      'No savings are pre-positioned, so living costs must be remitted from year one. ' +
        'Transfers made before domicile attaches fall outside the remittance regime entirely ' +
        '(Enforcement Order art. 17(4)(vi)) — and that window closes on the day it attaches.',
    );
  }

  if (!scenario.gainsOnPreArrivalHoldings && scenario.annualCapitalGains > 0) {
    warnings.push(
      'Gains are on holdings acquired after arrival, so they are not specified securities ' +
        'under Enforcement Order art. 17(1) and are taxed on an arising basis whether or not ' +
        'anything is remitted. The shelter does not reach them.',
    );
  }

  if (savingsExhaustedIn !== null) {
    const nprEnd = nonPermanentResidentEnd(scenario.residencyStart, scenario.priorPresence);
    const stillSheltered = `${savingsExhaustedIn}-12-31` < nprEnd;
    warnings.push(
      `Pre-positioned savings run out in ${savingsExhaustedIn}` +
        (stillSheltered
          ? ', while the shelter is still running. From that year living costs have to be ' +
            'remitted, and the ordering rule starts reaching foreign income. Pre-positioning ' +
            'more, or spending less, buys sheltered years directly.'
          : ', after the shelter has already ended, so it costs nothing extra.'),
    );
  }

  const coveredAssets = toJpy(scenario.annualCapitalGains * scenario.projectionYears * 5, fx);
  const exit = exitTaxExposure(scenario, coveredAssets);
  if (exit.exposed) warnings.push(`Exit tax: ${exit.reason}`);

  const totals = results.reduce(
    (acc, r) => ({
      japan: acc.japan + r.japan.total,
      us: acc.us + r.us.total * fx,
      combined: acc.combined + r.combined,
    }),
    { japan: 0, us: 0, combined: 0 },
  );

  return {
    years: results,
    totals,
    warnings,
    nprEndsOn: nonPermanentResidentEnd(scenario.residencyStart, scenario.priorPresence),
    exitTaxExposed: exit.exposed,
    savingsExhaustedIn,
  };
}
