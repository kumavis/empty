/**
 * Multi-year projection: ties the Japanese and US computations together, and
 * models how living costs are actually funded.
 *
 * Three orderings matter.
 *
 * 1. Japan is computed before the US, because Japanese tax on a gain decides US
 *    sourcing under IRC 865(g)(2), which decides whether the foreign tax credit
 *    has any room (doc 05 section 1).
 *
 * 2. Living costs are funded in a fixed order: cash already in Japan first,
 *    then a remittance from abroad. That order is the whole strategy —
 *    pre-positioned money sits outside the remittance regime (Enforcement Order
 *    art. 17(4)(vi)), so the year it runs out is the year the shelter leaks.
 *
 * 3. The Japanese tax, the US tax and the remittance are MUTUALLY dependent, so
 *    they are solved jointly rather than in one pass. See `solveYear`.
 */
import { computeJapanYear } from './japan';
import { computeUsYear } from './us';
import { listedSecuritiesRate, JAPAN_RATES, forYear } from './rates';
import { exitTaxExposure, nonPermanentResidentEnd, parseDate, phaseOn } from './phases';
import { toJpy } from './money';
import type { IsoDate, ResidencyPhase, Scenario, ScenarioResult, YearResult } from './types';

/** Guard every numeric input so a bad value cannot reach the tax arithmetic. */
const safe = (n: number, fallback = 0) => (Number.isFinite(n) && n >= 0 ? n : fallback);

/**
 * How much of a calendar year fell in each phase.
 *
 * Enforcement Order art. 17(4)(vi) confines the remittance rules to the
 * non-permanent resident PORTION of a split year, and a departure year is not a
 * non-resident year — it is a resident year that ended early. Applying the
 * year-end phase to the whole year (as this engine previously did) zeroed the
 * entire departure year's Japanese tax.
 */
function phaseSplit(year: number, scenario: Scenario) {
  const days: Record<ResidencyPhase, number> = {
    nonResident: 0,
    nonPermanentResident: 0,
    permanentResident: 0,
  };
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const changes: IsoDate[] = [];
  let previous: ResidencyPhase | null = null;

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const phase = phaseOn(iso, scenario);
    days[phase] += 1;
    if (previous !== null && phase !== previous) changes.push(iso);
    previous = phase;
  }

  const total = days.nonResident + days.nonPermanentResident + days.permanentResident;
  return {
    days,
    total,
    changes,
    residentFraction: (days.nonPermanentResident + days.permanentResident) / total,
    nprFraction: days.nonPermanentResident / total,
    /** The phase that governs the resident portion; PR wins if the year crossed. */
    governing: (days.permanentResident > 0
      ? 'permanentResident'
      : days.nonPermanentResident > 0
        ? 'nonPermanentResident'
        : 'nonResident') as ResidencyPhase,
  };
}

export function runScenario(scenario: Scenario): ScenarioResult {
  const fx = safe(scenario.fxJpyPerUsd, 150) || 150;
  const startYear = parseDate(scenario.residencyStart).getUTCFullYear();
  const projectionYears = Math.max(1, Math.min(30, Math.floor(safe(scenario.projectionYears, 1))));
  const years = Array.from({ length: projectionYears }, (_, i) => startYear + i);

  const warnings: string[] = [];
  const results: YearResult[] = [];

  const salaryFull = toJpy(safe(scenario.annualSalary), fx);
  const gainsJapanFull = toJpy(safe(scenario.annualCapitalGainsJapan), fx);
  const gainsUsFull = toJpy(safe(scenario.annualCapitalGainsUs), fx);
  const livingCost = toJpy(safe(scenario.annualLivingCost), fx);

  let cashJapan = toJpy(safe(scenario.prePositionedSavings), fx);
  let cashUs = toJpy(safe(scenario.usSavings), fx);
  let savingsExhaustedIn: number | null = null;
  let underfundedIn: number | null = null;
  let carryforwardGeneral: number[] = [];
  let carryforwardPassive: number[] = [];
  /** Inhabitant tax is assessed on the PRIOR year's income (doc 03 section 3). */
  let priorYearAggregate = 0;
  let extrapolatedFrom: number | null = null;

  for (const year of years) {
    const split = phaseSplit(year, scenario);
    const resident = split.residentFraction > 0;
    const phase = split.governing;

    const { didExtrapolate } = forYear(JAPAN_RATES, year);
    if (didExtrapolate && extrapolatedFrom === null) extrapolatedFrom = year;

    // Income accrues only while resident. A departure year is a part-year of
    // Japanese tax, not a free one.
    const frac = split.residentFraction;
    const salary = salaryFull * frac;
    const gainsJapan = gainsJapanFull * frac;
    const gainsUs = gainsUsFull * frac;
    const cgRate = listedSecuritiesRate(forYear(JAPAN_RATES, year).rates, year);

    // Only foreign-held gains on pre-arrival holdings can ever be shelterable.
    const shelterableGains = scenario.gainsOnPreArrivalHoldings ? gainsUs : 0;
    const arisingBasisGains = scenario.gainsOnPreArrivalHoldings ? 0 : gainsUs;

    // Inhabitant tax: keyed to residence on 1 January, charged on last year's
    // income. Both conditions are the caller's to decide, not the formula's.
    const residentOn1Jan = phaseOn(`${year}-01-01`, scenario) !== 'nonResident';

    const japanArgs = (remittance: number) =>
      ({
        year,
        phase,
        salaryForJapanWork: salary,
        salaryForForeignWork: 0,
        salaryPaidInJapan: salary,
        foreignInvestmentIncomeAbroad: 0,
        foreignInvestmentIncomePaidInJapan: 0,
        remittance,
        japanSitusGains: gainsJapan,
        shelterableGains,
        arisingBasisGains,
        arisingBasisGainsPaidAbroad: arisingBasisGains,
        residentFraction: frac,
        inhabitantTaxDue: residentOn1Jan && priorYearAggregate > 0,
        inhabitantTaxBase: priorYearAggregate,
      }) as const;

    const usArgs = (japan: ReturnType<typeof computeJapanYear>) => ({
      year,
      foreignEarnedIncome: salary / fx,
      japanSitusGains: gainsJapan / fx,
      japaneseTaxOnJapanSitusGains: japan.capitalGainsTaxOnJapanSitus / fx,
      foreignGains: gainsUs / fx,
      japaneseTaxOnForeignGains: japan.capitalGainsTaxOnForeign / fx,
      japaneseCapitalGainsRate: cgRate,
      japaneseTaxOnEarned: (japan.employmentTax + japan.inhabitantTax) / fx,
      foreignInvestmentIncome: 0,
      filingStatus: scenario.filingStatus,
      elections: scenario.elections,
      feieQualifyingFraction: frac,
      carryforwardGeneral,
      carryforwardPassive,
    });

    /**
     * Solve the year.
     *
     * The dependency is circular: Japanese tax reduces the cash available to
     * live on, which raises the remittance, which is itself taxable; and the
     * remittance is limited by what the foreign pool can send AFTER its own US
     * tax, which depends on the Japanese tax through the foreign tax credit.
     *
     * The map is monotone with slope equal to the listed-securities rate
     * (0.20315), so it is a contraction and converges — but geometrically, not
     * in the two or three passes this loop once claimed. At that slope a 1-yen
     * tolerance needs about 15 iterations; 60 is a generous ceiling that costs
     * nothing and removes the possibility of exiting by exhaustion.
     */
    let remittance = 0;
    let japan = computeJapanYear(japanArgs(0));
    let us = computeUsYear(usArgs(japan));
    let fundedFromSavings = 0;
    let fundedFromRemittance = 0;
    let cashJapanAfter = cashJapan;
    let cashUsAfter = cashUs;
    let repatriatedToUs = 0;

    for (let pass = 0; pass < 60; pass++) {
      const usTaxJpy = us.total * fx;
      // What the foreign pool can actually send, net of its own US bill.
      const sendable = Math.max(0, cashUs + gainsUs - usTaxJpy);

      const yearFlow = salary + gainsJapan - livingCost - japan.total;
      const beforeRemitting = cashJapan + yearFlow;

      if (beforeRemitting >= 0) {
        fundedFromSavings = Math.max(0, Math.min(cashJapan, -yearFlow));
        fundedFromRemittance = 0;
        cashJapanAfter = beforeRemitting;
      } else {
        fundedFromSavings = Math.max(0, cashJapan);
        fundedFromRemittance = Math.min(-beforeRemitting, sendable);
        cashJapanAfter = beforeRemitting + fundedFromRemittance;
      }

      const next = phase === 'nonPermanentResident' ? fundedFromRemittance : 0;
      const converged = Math.abs(next - remittance) < 1;
      remittance = next;
      japan = computeJapanYear(japanArgs(remittance));
      us = computeUsYear(usArgs(japan));
      if (converged) break;
    }

    // Settle the pools. Foreign-held gains land abroad; US tax is paid there.
    cashUsAfter = cashUs + gainsUs - us.total * fx - fundedFromRemittance;
    if (cashUsAfter < 0) {
      // Japan to US is NOT a remittance — ITA art. 7 reaches inbound transfers
      // only — so covering a US bill this way is free.
      repatriatedToUs = Math.min(-cashUsAfter, Math.max(0, cashJapanAfter));
      cashUsAfter += repatriatedToUs;
      cashJapanAfter -= repatriatedToUs;
    }

    // Exhaustion is tested AFTER repatriation, or a pool drained by a US bill
    // never registers — and the guard then makes it unfireable forever.
    if (cashJapan > 0 && cashJapanAfter <= 0.5 && savingsExhaustedIn === null) {
      savingsExhaustedIn = year;
    }
    // Either pool going short means the plan is underfunded, not that a balance
    // is negative. Clamp both and say so.
    if (cashJapanAfter < -0.5 || cashUsAfter < -0.5) {
      underfundedIn = underfundedIn ?? year;
    }
    cashJapanAfter = Math.max(0, cashJapanAfter);
    cashUsAfter = Math.max(0, cashUsAfter);

    carryforwardGeneral = us.carryforwardGeneral;
    carryforwardPassive = us.carryforwardPassive;
    priorYearAggregate = japan.alwaysTaxable > 0 ? japan.alwaysTaxable : 0;

    const combined = japan.total + us.total * fx;
    const economicIncome = salary + gainsJapan + gainsUs;

    const notes: string[] = [
      ...(split.changes.length > 0
        ? [
            `Status changed on ${split.changes.join(' and ')}. Income and Japanese tax for this ` +
              `year are apportioned by the ${Math.round(frac * 100)}% of it spent resident, per ` +
              'Enforcement Order art. 17(4)(vi). Apportioning by days is an approximation — the ' +
              'statute counts income actually arising in each phase.',
          ]
        : []),
      ...(fundedFromSavings > 0
        ? [
            'Living costs and Japanese tax exceeded income, and the gap came from cash already ' +
              'in Japan. That cash sits outside the remittance regime, so it funds life in ' +
              'Japan without exposing any foreign income to the ordering rule.',
          ]
        : []),
      ...(fundedFromRemittance > 0 && phase === 'nonPermanentResident'
        ? [
            'Cash in Japan ran short, so the balance had to be remitted from abroad. The ' +
              "ordering rule is capped by THIS year's foreign-source income, so remitting " +
              'accumulated gains in a later year with no new realisation costs nothing.',
          ]
        : []),
      ...(repatriatedToUs > 0
        ? [
            'Cash moved from Japan back to the US to meet the US tax bill. That direction is ' +
              'untaxed as a remittance — ITA art. 7 reaches inbound transfers only — though ' +
              'doc 04 section 3 flags an unverified currency-gain exposure on the conversion.',
          ]
        : []),
      ...japan.notes,
      ...us.notes,
    ];

    results.push({
      year,
      phase,
      phaseChangedOn: split.changes[split.changes.length - 1],
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
        fundedFromSavings: fundedFromSavings + repatriatedToUs,
        fundedFromRemittance,
        repatriatedToUs,
        cashJapan: cashJapanAfter,
        cashUs: cashUsAfter,
      },
      combined,
      // Rate on the income that actually arose; a year with no income and a
      // residual US bill has no meaningful rate, so it is reported as null.
      effectiveRate: economicIncome > 0 ? combined / economicIncome : null,
      notes,
    });

    cashJapan = cashJapanAfter;
    cashUs = cashUsAfter;
    void resident;
  }

  // --- Scenario-level findings ---------------------------------------------
  const nprEndsOn = scenario.holdsJapaneseNationality
    ? scenario.residencyStart
    : nonPermanentResidentEnd(scenario.residencyStart, scenario.priorPresence);
  const anyNprYear = results.some((r) => r.phase === 'nonPermanentResident');

  if (scenario.holdsJapaneseNationality) {
    warnings.push(
      'Japanese nationality is held, so non-permanent resident status is unavailable ' +
        '(ITA art. 2(1)(iv)). Worldwide taxation applies from day one and the remittance ' +
        'basis never exists.',
    );
  }

  if (scenario.prePositionedSavings === 0 && anyNprYear) {
    warnings.push(
      'No savings are pre-positioned, so any shortfall must be remitted from year one. ' +
        'Transfers made before domicile attaches fall outside the remittance regime entirely ' +
        '(Enforcement Order art. 17(4)(vi)) — and that window closes on the day it attaches.',
    );
  }

  if (!scenario.gainsOnPreArrivalHoldings && scenario.annualCapitalGainsUs > 0 && anyNprYear) {
    warnings.push(
      'Foreign-held gains are on holdings acquired after arrival, so they are not specified ' +
        'securities under Enforcement Order art. 17(1) and are taxed on an arising basis ' +
        'whether or not anything is remitted. The shelter does not reach them.',
    );
  }

  if (scenario.annualCapitalGainsJapan > 0 && scenario.annualCapitalGainsUs > 0 && anyNprYear) {
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
        'so treat them as a floor rather than an answer.',
    );
  }

  if (savingsExhaustedIn !== null) {
    const stillSheltered =
      anyNprYear &&
      !scenario.holdsJapaneseNationality &&
      `${savingsExhaustedIn}-12-31` < nprEndsOn;
    const everRemits = results.some((r) => r.cash.fundedFromRemittance > 0);
    warnings.push(
      `Cash in Japan runs out in ${savingsExhaustedIn}` +
        (stillSheltered && everRemits
          ? ', while the shelter is still running. From that year any shortfall has to be ' +
            'remitted, and the ordering rule starts reaching foreign income. Pre-positioning ' +
            'more, or spending less, buys sheltered years directly.'
          : ', but nothing had to be remitted as a result, so it costs nothing extra here.'),
    );
  }

  const exit = exitTaxExposure(scenario, toJpy(safe(scenario.coveredAssetValue), fx));
  if (exit.exposed) warnings.push(`Exit tax: ${exit.reason}`);
  if (scenario.departure && scenario.coveredAssetValue === 0) {
    warnings.push(
      'No covered-asset value is set, so the ¥100m exit tax threshold (ITA art. 60-2(5)) is ' +
        'tested against zero and will never trigger. Enter the market value of securities held ' +
        'at departure to test it properly.',
    );
  }

  if (extrapolatedFrom !== null) {
    warnings.push(
      `Rate tables run out after the latest archived year, so ${extrapolatedFrom} onward reuse ` +
        'the most recent table. Inventing future brackets would be worse, but later years are ' +
        'correspondingly less reliable.',
    );
  }

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
    nprEndsOn,
    exitTaxExposed: exit.exposed,
    savingsExhaustedIn,
    underfundedIn,
  };
}
