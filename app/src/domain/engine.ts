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
  const gainsJapan = toJpy(scenario.annualCapitalGainsJapan, fx);
  const gainsUs = toJpy(scenario.annualCapitalGainsUs, fx);
  const livingCost = toJpy(scenario.annualLivingCost, fx);

  let cashJapan = toJpy(scenario.prePositionedSavings, fx);
  let cashUs = toJpy(scenario.usSavings, fx);
  let savingsExhaustedIn: number | null = null;
  let underfundedIn: number | null = null;
  let carryforwardGeneral = 0;
  let carryforwardPassive = 0;

  for (const year of years) {
    const { phase, changedOn } = phaseForYear(year, scenario);
    const resident = phase !== 'nonResident';

    // Only FOREIGN-HELD gains can ever be shelterable, and then only if the
    // holdings pre-date arrival. Japanese-account gains fail art. 17(1) outright.
    const shelterableGains = scenario.gainsOnPreArrivalHoldings ? gainsUs : 0;
    const arisingBasisGains = scenario.gainsOnPreArrivalHoldings ? 0 : gainsUs;

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
      japanSitusGains: gainsJapan,
      shelterableGains,
      arisingBasisGains,
    });

    let fundedFromSavings = 0;
    let fundedFromRemittance = 0;
    let cashJapanAfter = cashJapan;

    /**
     * What the foreign pool could send this year. Measured before US tax, so
     * the Japanese fixed point below does not have to nest inside the US
     * computation; any resulting shortfall abroad is settled afterwards by
     * moving money the other way, which is untaxed and so cannot distort the
     * Japanese answer.
     */
    const sendableFromUs = Math.max(0, cashUs + gainsUs);

    for (let pass = 0; pass < 4; pass++) {
      // Inflows land where the asset sits: salary and Japanese-account gains in
      // Japan, foreign-account gains abroad. Japanese tax and living costs are
      // paid out of the Japanese pool.
      const yearFlow = salary + gainsJapan - livingCost - japan.total;
      const beforeRemitting = cashJapan + yearFlow;

      if (beforeRemitting >= 0) {
        // The year is self-funding, or the opening balance covers the gap.
        fundedFromSavings = Math.max(0, Math.min(cashJapan, -yearFlow));
        fundedFromRemittance = 0;
        cashJapanAfter = beforeRemitting;
      } else {
        // The opening balance is fully consumed; the rest must come from abroad.
        fundedFromSavings = Math.max(0, cashJapan);
        fundedFromRemittance = Math.min(-beforeRemitting, sendableFromUs);
        cashJapanAfter = beforeRemitting + fundedFromRemittance;
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
        japanSitusGains: gainsJapan,
        shelterableGains,
        arisingBasisGains,
      });
    }

    if (cashJapan > 0 && cashJapanAfter <= 0.5 && savingsExhaustedIn === null) {
      savingsExhaustedIn = year;
    }

    // A pool that cannot be covered from either side means the plan is short of
    // money, not that a balance is negative. Clamp and say so.
    if (cashJapanAfter < 0) {
      underfundedIn = underfundedIn ?? year;
      cashJapanAfter = 0;
    }

    // --- The US side, in USD -----------------------------------------------
    const us = computeUsYear({
      year,
      foreignEarnedIncome: salary / fx,
      japanSitusGains: gainsJapan / fx,
      japaneseTaxOnJapanSitusGains: japan.capitalGainsTaxOnJapanSitus / fx,
      foreignGains: gainsUs / fx,
      japaneseTaxOnForeignGains: japan.capitalGainsTaxOnForeign / fx,
      japaneseTaxOnEarned: (japan.employmentTax + japan.inhabitantTax) / fx,
      foreignInvestmentIncome: 0,
      filingStatus: scenario.filingStatus,
      elections: scenario.elections,
      carryforwardGeneral,
      carryforwardPassive,
    });

    carryforwardGeneral = us.carryforwardGeneral;
    carryforwardPassive = us.carryforwardPassive;

    // --- Settle the two pools ----------------------------------------------
    // Foreign-account gains land abroad and stay there; US tax is paid from
    // there too. Anything remitted to Japan has already left.
    let cashUsAfter = cashUs + gainsUs - us.total * fx - fundedFromRemittance;
    let repatriatedToUs = 0;

    if (cashUsAfter < 0) {
      // Money moving Japan to US is NOT a remittance — ITA art. 7 reaches
      // inbound transfers only — so covering a US tax bill this way is free.
      repatriatedToUs = Math.min(-cashUsAfter, Math.max(0, cashJapanAfter));
      cashUsAfter += repatriatedToUs;
      cashJapanAfter -= repatriatedToUs;
    }

    cashJapan = cashJapanAfter;
    cashUs = cashUsAfter;

    const combined = japan.total + us.total * fx;
    const economicIncome = resident ? salary + gainsJapan + gainsUs : 0;

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
            'Cash in Japan is spent, so the shortfall had to be remitted from abroad. The ' +
              'ordering rule is capped by THIS year\'s foreign-source income, so remitting ' +
              'accumulated gains from an earlier year, in a year with no new foreign income, ' +
              'costs nothing.',
          ]
        : []),
      ...(repatriatedToUs > 0
        ? [
            'Cash was moved from Japan back to the US to meet the US tax bill. That direction ' +
              'is untaxed — ITA art. 7 reaches inbound transfers only — so it costs nothing ' +
              'and does not touch the ordering rule.',
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
        capitalGainsTaxOnJapanSitus: japan.capitalGainsTaxOnJapanSitus,
        capitalGainsTaxOnForeign: japan.capitalGainsTaxOnForeign,
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
        repatriatedToUs,
        cashJapan: cashJapanAfter,
        cashUs: cashUsAfter,
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

  if (!scenario.gainsOnPreArrivalHoldings && scenario.annualCapitalGainsUs > 0) {
    warnings.push(
      'Foreign-held gains are on holdings acquired after arrival, so they are not specified ' +
        'securities under Enforcement Order art. 17(1) and are taxed on an arising basis ' +
        'whether or not anything is remitted. The shelter does not reach them.',
    );
  }

  if (scenario.annualCapitalGainsJapan > 0 && scenario.annualCapitalGainsUs > 0) {
    warnings.push(
      'Gains are split across a Japanese and a foreign account, and the two are treated in ' +
        'opposite directions. Japan taxes the Japanese-account gains as they arise but they ' +
        'keep their US credit; the foreign-held gains can be sheltered from Japan but then ' +
        'stay US-source under IRC 865(g)(2) with no credit to claim.',
    );
  }

  if (underfundedIn !== null) {
    warnings.push(
      `The plan runs short of money in ${underfundedIn}: living costs and tax exceed everything ` +
        'available on both sides. Figures from that year on assume the shortfall is met somehow, ' +
        'so treat them as the floor rather than the answer.',
    );
  }

  if (savingsExhaustedIn !== null) {
    const nprEnd = nonPermanentResidentEnd(scenario.residencyStart, scenario.priorPresence);
    const stillSheltered = `${savingsExhaustedIn}-12-31` < nprEnd;
    warnings.push(
      `Cash in Japan runs out in ${savingsExhaustedIn}` +
        (stillSheltered
          ? ', while the shelter is still running. From that year living costs have to be ' +
            'remitted, and the ordering rule starts reaching foreign income. Pre-positioning ' +
            'more, or spending less, buys sheltered years directly.'
          : ', after the shelter has already ended, so it costs nothing extra.'),
    );
  }

  const coveredAssets = toJpy(
    (scenario.annualCapitalGainsJapan + scenario.annualCapitalGainsUs) *
      scenario.projectionYears * 5,
    fx,
  );
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
