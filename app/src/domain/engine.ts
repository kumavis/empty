/**
 * Multi-year projection: ties the Japanese and US computations together.
 *
 * Order of operations matters. Japan is computed first because its tax on a
 * gain decides US sourcing under IRC 865(g)(2), which in turn decides whether
 * the foreign tax credit has any room (doc 05 section 1).
 */
import { computeJapanYear, realiseGains } from './japan';
import { computeUsYear } from './us';
import { exitTaxExposure, nonPermanentResidentEnd, phaseForYear } from './phases';
import type { Scenario, ScenarioResult, YearResult } from './types';

export function runScenario(scenario: Scenario): ScenarioResult {
  const years = scenario.income.map((y) => y.year).sort((a, b) => a - b);
  const warnings: string[] = [];
  const results: YearResult[] = [];

  const realised = realiseGains(scenario.disposals, scenario.lots, scenario);

  let carryforwardGeneral = 0;
  let carryforwardPassive = 0;

  for (const year of years) {
    const income = scenario.income.find((y) => y.year === year)!;
    const { phase, changedOn } = phaseForYear(year, scenario);

    const yearDisposals = realised.filter((r) => r.disposal.date.startsWith(String(year)));
    const shelterableGains = yearDisposals
      .filter((r) => r.specified)
      .reduce((s, r) => s + Math.max(0, r.gain), 0);
    const arisingBasisGains = yearDisposals
      .filter((r) => !r.specified)
      .reduce((s, r) => s + Math.max(0, r.gain), 0);

    // --- Japan first: its tax decides US sourcing ---------------------------
    const japan = computeJapanYear({
      year,
      phase,
      salaryForJapanWork: income.salaryForJapanWork,
      salaryForForeignWork: income.salaryForForeignWork,
      salaryPaidInJapan: income.salaryPaidInJapan,
      foreignInvestmentIncomeAbroad: income.foreignInvestmentIncomeAbroad,
      foreignInvestmentIncomePaidInJapan: income.foreignInvestmentIncomePaidInJapan,
      remittance: phase === 'nonPermanentResident' ? income.remittanceToJapan : 0,
      shelterableGains,
      arisingBasisGains,
    });

    // --- Then the US, in USD ------------------------------------------------
    const fx = scenario.fxJpyPerUsd;
    const totalGains = shelterableGains + arisingBasisGains;
    const us = computeUsYear({
      year,
      foreignEarnedIncome: (income.salaryForJapanWork + income.salaryForForeignWork) / fx,
      capitalGains: totalGains / fx,
      japaneseTaxOnGains: japan.capitalGainsTax / fx,
      japaneseTaxOnEarned: (japan.employmentTax + japan.inhabitantTax) / fx,
      foreignInvestmentIncome:
        (income.foreignInvestmentIncomeAbroad + income.foreignInvestmentIncomePaidInJapan) / fx,
      filingStatus: scenario.filingStatus,
      elections: scenario.elections,
      carryforwardGeneral,
      carryforwardPassive,
    });

    carryforwardGeneral = us.carryforwardGeneral;
    carryforwardPassive = us.carryforwardPassive;

    const combined = japan.total + us.total * fx;
    const economicIncome =
      income.salaryForJapanWork +
      income.salaryForForeignWork +
      income.foreignInvestmentIncomeAbroad +
      income.foreignInvestmentIncomePaidInJapan +
      totalGains;

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
      combined,
      effectiveRate: economicIncome > 0 ? combined / economicIncome : 0,
      notes: [
        // Enforcement Order art. 17(4)(vi) confines the remittance rules to the
        // non-permanent resident PORTION of a split year. This model applies the
        // year-end phase to the whole year, which overstates tax in an arrival
        // year and understates the shelter in a crossover year. Disclosed rather
        // than hidden — see doc 01 section 4.
        ...(changedOn
          ? [
              `Status changed on ${changedOn}. Enforcement Order art. 17(4)(vi) requires this ` +
                'year to be split, counting only income arising and remittances received within ' +
                'each phase. This model applies the year-end phase to the whole year, so figures ' +
                'for this year are approximate.',
            ]
          : []),
        ...japan.notes,
        ...us.notes,
      ],
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

  if (scenario.prePositionedFunds === 0) {
    warnings.push(
      'No funds are pre-positioned. Transfers made before residency begins fall outside ' +
        'the remittance regime entirely (Enforcement Order art. 17(4)(vi)) — the window ' +
        'closes on the day domicile attaches.',
    );
  }

  const postArrivalLots = scenario.lots.filter((l) => l.acquired >= scenario.residencyStart);
  if (postArrivalLots.length > 0) {
    warnings.push(
      `${postArrivalLots.length} lot(s) were acquired after arrival. Gains on these are taxed ` +
        'on an arising basis regardless of remittance, because they are not specified ' +
        'securities under Enforcement Order art. 17(1).',
    );
  }

  const coveredAssets = scenario.lots.reduce((s, l) => s + l.basis, 0);
  const exit = exitTaxExposure(scenario, coveredAssets);
  if (exit.exposed) warnings.push(`Exit tax: ${exit.reason}`);

  const totals = results.reduce(
    (acc, r) => ({
      japan: acc.japan + r.japan.total,
      us: acc.us + r.us.total * scenario.fxJpyPerUsd,
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
  };
}
