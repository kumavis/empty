/**
 * Tests anchor the engine to the worked examples in the research documents.
 * When a test fails, the doc is the authority, not the code.
 */
import { describe, expect, it } from 'vitest';
import { applyRemittanceOrdering, computeJapanYear, isSpecifiedSecurity } from './japan';
import { gainIsForeignSource } from './us';
import { runScenario } from './engine';
import { exitTaxExposure, nonPermanentResidentEnd, phaseOn } from './phases';
import { japanNationalTax, listedSecuritiesRate, JAPAN_RATES } from './rates';
import type { Lot, Scenario } from './types';

const baseScenario: Scenario = {
  name: 'test',
  residencyStart: '2026-04-01',
  holdsJapaneseNationality: false,
  priorPresence: [],
  visaPeriods: [{ from: '2026-04-01', table: 'table1' }],
  annualSalary: 0,
  annualCapitalGainsJapan: 0,
  annualCapitalGainsUs: 0,
  gainsOnPreArrivalHoldings: true,
  annualLivingCost: 0,
  prePositionedSavings: 0,
  projectionYears: 1,
  elections: { claimFeie: false, ftcBasis: 'accrued', claimTreatyResourcing: true },
  filingStatus: 'single',
  fxJpyPerUsd: 150,
};

describe('Japanese national income tax table', () => {
  it("reproduces the NTA's own worked example", () => {
    // NTA taxanswer shotoku/2260: 7,000,000 x 0.23 - 636,000 = 974,000
    expect(japanNationalTax(7_000_000, JAPAN_RATES[2025])).toBe(974_000);
  });

  it('produces the 20.315% headline rate on listed securities', () => {
    // 15% national + 0.315% reconstruction surtax on it + 5% local
    expect(listedSecuritiesRate(JAPAN_RATES[2025], 2027)).toBeCloseTo(0.20315, 6);
  });

  it('drops the reconstruction surtax after 2037', () => {
    expect(listedSecuritiesRate(JAPAN_RATES[2025], 2038)).toBeCloseTo(0.2, 6);
  });
});

describe('remittance ordering rule (Enforcement Order art. 17(4)(i))', () => {
  it('deems the remittance against non-foreign-source income first', () => {
    const r = applyRemittanceOrdering({
      remittance: 15_000_000,
      nonForeignSourceAbroad: 12_000_000,
      foreignSourceAbroad: 8_000_000,
    });
    // Doc 02 section 5: salary absorbs 12m, leaving 3m to reach the gains.
    expect(r.absorbedByNonForeignSource).toBe(12_000_000);
    expect(r.deemedRemitted).toBe(3_000_000);
  });

  it('shelters everything when the remittance stays within Japan-source income', () => {
    const r = applyRemittanceOrdering({
      remittance: 12_000_000,
      nonForeignSourceAbroad: 12_000_000,
      foreignSourceAbroad: 8_000_000,
    });
    // The operating rule from doc 09: keep remittances at or below Japan-source
    // income paid abroad and the shelter holds intact.
    expect(r.deemedRemitted).toBe(0);
  });

  it('caps exposure at the year’s foreign-source income, not the remittance', () => {
    const r = applyRemittanceOrdering({
      remittance: 50_000_000,
      nonForeignSourceAbroad: 0,
      foreignSourceAbroad: 3_000_000,
    });
    expect(r.deemedRemitted).toBe(3_000_000);
  });

  it('costs nothing to remit capital in a year with no foreign-source income', () => {
    const r = applyRemittanceOrdering({
      remittance: 50_000_000,
      nonForeignSourceAbroad: 0,
      foreignSourceAbroad: 0,
    });
    expect(r.deemedRemitted).toBe(0);
  });
});

describe('specified securities (Enforcement Order art. 17(1))', () => {
  const preArrival: Lot = {
    id: 'a', label: 'pre', acquired: '2019-06-01', basis: 1, units: 1, heldAbroad: true,
  };
  const postArrival: Lot = {
    id: 'b', label: 'post', acquired: '2027-06-01', basis: 1, units: 1, heldAbroad: true,
  };

  it('shelters a lot acquired before residency began', () => {
    expect(isSpecifiedSecurity(preArrival, '2029-01-01', baseScenario)).toBe(true);
  });

  it('does NOT shelter a lot acquired after arrival', () => {
    // The finding most commentary omits: post-arrival purchases are taxed on an
    // arising basis whether or not they are remitted.
    expect(isSpecifiedSecurity(postArrival, '2029-01-01', baseScenario)).toBe(false);
  });

  it('requires the security to be held abroad', () => {
    expect(
      isSpecifiedSecurity({ ...preArrival, heldAbroad: false }, '2029-01-01', baseScenario),
    ).toBe(false);
  });
});

describe('residency phases (ITA art. 2(1)(iv))', () => {
  it('makes residency start on arrival, not after 183 days', () => {
    expect(phaseOn('2026-03-31', baseScenario)).toBe('nonResident');
    expect(phaseOn('2026-04-01', baseScenario)).toBe('nonPermanentResident');
  });

  it('counts from the day after entry, per NTA circular 2-4の3', () => {
    // The five-year period runs from 2 April 2026 and is reached on 1 April
    // 2031; circular 2-3(3) puts the status change on the FOLLOWING day. A
    // naive fifth-anniversary calculation is a day early.
    expect(nonPermanentResidentEnd('2026-04-01', [])).toBe('2031-04-02');
    expect(phaseOn('2031-04-01', baseScenario)).toBe('nonPermanentResident');
    expect(phaseOn('2031-04-02', baseScenario)).toBe('permanentResident');
  });

  it('brings the boundary forward for prior presence, cumulatively', () => {
    // The statute says 合計 — aggregate, not consecutive.
    const end = nonPermanentResidentEnd('2026-04-01', [
      { from: '2020-01-01', to: '2021-01-01' },
    ]);
    expect(end < '2031-04-02').toBe(true);
  });

  it('carries 30 days to a month and 12 months to a year when aggregating', () => {
    // Circular 2-4の3 sums years, months and days separately and normalises
    // with a 30-day month — the NTA's own convention, not a rounding of ours.
    // Two 15-day stays (counted from the day after entry) make one month, so
    // the boundary moves back by a month rather than by 30 days.
    const end = nonPermanentResidentEnd('2026-04-01', [
      { from: '2020-01-01', to: '2020-01-16' },
      { from: '2021-01-01', to: '2021-01-16' },
    ]);
    expect(end).toBe('2031-03-02');
  });

  it('denies the phase entirely to a Japanese national', () => {
    const dual = { ...baseScenario, holdsJapaneseNationality: true };
    expect(phaseOn('2026-04-02', dual)).toBe('permanentResident');
  });
});

describe('exit tax (ITA art. 60-2(5), Enforcement Order art. 170(3)(i))', () => {
  it('never exposes a work-visa holder, however large the portfolio', () => {
    const s: Scenario = {
      ...baseScenario,
      departure: '2040-06-01',
      visaPeriods: [{ from: '2026-04-01', table: 'table1' }],
    };
    const r = exitTaxExposure(s, 1_000_000_000);
    expect(r.exposed).toBe(false);
    expect(r.qualifyingDays).toBe(0);
  });

  it('exposes a long-held Table 2 status holder above the threshold', () => {
    const s: Scenario = {
      ...baseScenario,
      departure: '2040-06-01',
      visaPeriods: [
        { from: '2026-04-01', to: '2030-01-01', table: 'table1' },
        { from: '2030-01-01', table: 'table2' },
      ],
    };
    expect(exitTaxExposure(s, 1_000_000_000).exposed).toBe(true);
  });

  it('does not expose below the ¥100m threshold', () => {
    const s: Scenario = {
      ...baseScenario,
      departure: '2040-06-01',
      visaPeriods: [{ from: '2026-04-01', table: 'table2' }],
    };
    expect(exitTaxExposure(s, 50_000_000).exposed).toBe(false);
  });
});

describe('IRC 865(g)(2) interlock', () => {
  it('sources a gain abroad only when 10% foreign tax was actually paid', () => {
    expect(gainIsForeignSource(100_000, 20_315)).toBe(true);
    expect(gainIsForeignSource(100_000, 0)).toBe(false);
    expect(gainIsForeignSource(100_000, 9_999)).toBe(false);
  });

  it('leaves an unremitted, Japan-sheltered gain US-source', () => {
    // The core correction: the Japanese shelter saves Japanese tax, not US tax.
    expect(gainIsForeignSource(500_000, 0)).toBe(false);
  });
});

describe('doc 02 section 5 worked example, end to end', () => {
  it('taxes 3,000,000 yen of the pre-arrival gain and shelters the rest', () => {
    const out = computeJapanYear({
      year: 2027,
      phase: 'nonPermanentResident',
      salaryForJapanWork: 12_000_000,
      salaryForForeignWork: 0,
      salaryPaidInJapan: 0,
      foreignInvestmentIncomeAbroad: 0,
      foreignInvestmentIncomePaidInJapan: 0,
      japanSitusGains: 0,
      remittance: 15_000_000,
      shelterableGains: 8_000_000,
      arisingBasisGains: 2_000_000,
    });

    expect(out.deemedRemitted).toBe(3_000_000);
    // Taxable gains = 3,000,000 deemed remitted + 2,000,000 arising basis.
    expect(out.capitalGainsTax).toBeCloseTo(5_000_000 * 0.20315, 0);
  });

  it('shelters the whole gain if the remittance stays at or below salary', () => {
    const out = computeJapanYear({
      year: 2027,
      phase: 'nonPermanentResident',
      salaryForJapanWork: 12_000_000,
      salaryForForeignWork: 0,
      salaryPaidInJapan: 0,
      foreignInvestmentIncomeAbroad: 0,
      foreignInvestmentIncomePaidInJapan: 0,
      japanSitusGains: 0,
      remittance: 12_000_000,
      shelterableGains: 8_000_000,
      arisingBasisGains: 0,
    });
    expect(out.deemedRemitted).toBe(0);
    expect(out.capitalGainsTax).toBe(0);
  });

  it('taxes everything once worldwide taxation begins', () => {
    const out = computeJapanYear({
      year: 2032,
      phase: 'permanentResident',
      salaryForJapanWork: 12_000_000,
      salaryForForeignWork: 0,
      salaryPaidInJapan: 0,
      foreignInvestmentIncomeAbroad: 0,
      foreignInvestmentIncomePaidInJapan: 0,
      japanSitusGains: 0,
      remittance: 0,
      shelterableGains: 8_000_000,
      arisingBasisGains: 0,
    });
    // No remittance at all, yet the gain is fully taxed — the shelter is gone.
    expect(out.capitalGainsTax).toBeCloseTo(8_000_000 * 0.20315, 0);
  });
});

describe('funding living costs — the burn model', () => {
  const base: Scenario = {
    ...baseScenario,
    residencyStart: '2026-01-01',
    annualSalary: 0,          // no salary, so living costs must come from somewhere else
    annualLivingCost: 50_000,
    prePositionedSavings: 120_000,
    projectionYears: 5,
    fxJpyPerUsd: 150,
  };

  it('spends pre-positioned savings before remitting anything', () => {
    const r = runScenario(base);
    // 120k of savings against 50k/year: years one and two are fully funded.
    expect(r.years[0].cash.fundedFromRemittance).toBe(0);
    expect(r.years[1].cash.fundedFromRemittance).toBe(0);
    expect(r.years[0].cash.savingsRemaining / 150).toBeCloseTo(70_000, 0);
  });

  it('reports the year the savings run out', () => {
    // Year three needs 50k against 20k left, so that is the year they go.
    expect(runScenario(base).savingsExhaustedIn).toBe(2028);
  });

  it('forces a remittance once savings are gone', () => {
    const r = runScenario(base);
    const after = r.years.find((y) => y.year === 2029)!;
    expect(after.cash.fundedFromSavings).toBe(0);
    expect(after.cash.fundedFromRemittance / 150).toBeCloseTo(50_000, 0);
  });

  it('taxes nothing on the forced remittance when there is no foreign income to reach', () => {
    // The ordering rule is capped by the YEAR's foreign-source income. Remitting
    // capital costs nothing when no foreign income arose that year.
    const r = runScenario(base);
    expect(r.years.find((y) => y.year === 2029)!.japan.deemedRemitted).toBe(0);
  });

  it('exposes foreign income once a remittance is forced in a year with gains', () => {
    const r = runScenario({ ...base, annualCapitalGainsUs: 80_000 });
    const exposed = r.years.find((y) => y.year === 2029)!;
    // Savings are gone, so living costs are remitted and reach the sheltered gain.
    expect(exposed.japan.deemedRemitted).toBeGreaterThan(0);
  });

  it('buys sheltered years directly by pre-positioning more', () => {
    const lean = runScenario({ ...base, annualCapitalGainsUs: 80_000 });
    const fat = runScenario({
      ...base, annualCapitalGainsUs: 80_000, prePositionedSavings: 260_000,
    });
    expect(fat.totals.combined).toBeLessThan(lean.totals.combined);
  });
});

describe('capital gains split by situs', () => {
  const base: Scenario = {
    ...baseScenario,
    residencyStart: '2026-01-01',
    annualSalary: 200_000,
    annualLivingCost: 60_000,
    prePositionedSavings: 500_000,   // large, so no remittance is ever forced
    projectionYears: 3,
    gainsOnPreArrivalHoldings: true,
  };

  it('taxes Japanese-account gains on an arising basis with nothing remitted', () => {
    const r = runScenario({ ...base, annualCapitalGainsJapan: 100_000 });
    const y = r.years[0];
    // Never a specified security under art. 17(1), so the shelter cannot reach it.
    expect(y.japan.deemedRemitted).toBe(0);
    expect(y.japan.capitalGainsTaxOnJapanSitus / 150).toBeCloseTo(100_000 * 0.20315, 0);
  });

  it('shelters foreign-held gains entirely when nothing is remitted', () => {
    const r = runScenario({ ...base, annualCapitalGainsUs: 100_000 });
    expect(r.years[0].japan.capitalGainsTaxOnForeign).toBe(0);
  });

  it('leaves the sheltered foreign gain US-source, so the US taxes it in full', () => {
    const sheltered = runScenario({ ...base, annualCapitalGainsUs: 100_000 });
    // No Japanese tax paid, so IRC 865(g)(2) fails and no credit is available.
    expect(sheltered.years[0].japan.capitalGainsTaxOnForeign).toBe(0);
    expect(sheltered.years[0].us.total).toBeGreaterThan(0);
  });

  it('keeps the US credit on the gain Japan actually taxed', () => {
    // The asymmetry: the bucket you CANNOT shelter is the one that earns relief.
    const jp = runScenario({ ...base, annualCapitalGainsJapan: 100_000 });
    const us = runScenario({ ...base, annualCapitalGainsUs: 100_000 });
    expect(jp.years[0].us.creditPassive).toBeGreaterThan(0);
    expect(us.years[0].us.creditPassive).toBe(0);
  });

  it('sources the two buckets in opposite directions in the same year', () => {
    const r = runScenario({
      ...base, annualCapitalGainsJapan: 100_000, annualCapitalGainsUs: 100_000,
    });
    const y = r.years[0];
    // Japan taxed one bucket and not the other, from one combined input.
    expect(y.japan.capitalGainsTaxOnJapanSitus).toBeGreaterThan(0);
    expect(y.japan.capitalGainsTaxOnForeign).toBe(0);
    expect(y.notes.some((n) => n.includes('opposite directions'))).toBe(true);
  });

  it('taxes both buckets once worldwide taxation begins', () => {
    const r = runScenario({
      ...base,
      residencyStart: '2026-01-01',
      projectionYears: 8,
      annualCapitalGainsJapan: 50_000,
      annualCapitalGainsUs: 50_000,
    });
    const after = r.years[r.years.length - 1];
    expect(after.phase).toBe('permanentResident');
    expect(after.japan.capitalGainsTaxOnForeign).toBeGreaterThan(0);
    expect(after.japan.capitalGainsTaxOnJapanSitus).toBeGreaterThan(0);
  });
});
