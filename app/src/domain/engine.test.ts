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
  usSavings: 0,
  coveredAssetValue: 0,
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
    // Counting runs 2 April 2026 to 1 April 2031 when judged on 2 April 2031 —
    // circular 2-4の2 ends the counted period the day BEFORE the day judged —
    // so that day is still exactly five years and still sheltered. The first
    // non-NPR day is the one after.
    expect(nonPermanentResidentEnd('2026-04-01', [])).toBe('2031-04-03');
    expect(phaseOn('2031-04-02', baseScenario)).toBe('nonPermanentResident');
    expect(phaseOn('2031-04-03', baseScenario)).toBe('permanentResident');
  });

  it('brings the boundary forward for prior presence, cumulatively', () => {
    // The statute says 合計 — aggregate, not consecutive.
    // Recent enough to still sit inside the sliding window at the boundary.
    const end = nonPermanentResidentEnd('2026-04-01', [
      { from: '2024-01-01', to: '2025-01-01' },
    ]);
    expect(end).toBe('2030-04-03');
  });

  it('carries 30 days to a month when aggregating (circular 2-4の3)', () => {
    // Two 15-day stays make one month, so the boundary moves back by a month.
    const end = nonPermanentResidentEnd('2026-04-01', [
      { from: '2025-01-01', to: '2025-01-16' },
      { from: '2025-06-01', to: '2025-06-16' },
    ]);
    expect(end).toBe('2031-03-03');
  });

  it('lets prior presence age out of the sliding ten-year window', () => {
    // Circular 2-4の2 measures the window from the day being JUDGED, so a stay
    // that ended long ago stops counting once it falls out. Anchoring the
    // window to arrival charged it forever and cut the shelter short.
    const old = nonPermanentResidentEnd('2026-04-01', [
      { from: '2018-01-01', to: '2020-12-31' },
    ]);
    const none = nonPermanentResidentEnd('2026-04-01', []);
    // By the time it would bind, the 2018-2020 stay has aged out entirely.
    expect(old).toBe(none);
  });

  it('never returns a boundary before residency began', () => {
    const end = nonPermanentResidentEnd('2026-04-01', [
      { from: '2018-01-01', to: '2024-06-15' },
    ]);
    expect(end >= '2026-04-01').toBe(true);
  });

  it('counts the departure day itself as a day of residence', () => {
    const s: Scenario = { ...baseScenario, departure: '2028-06-15' };
    expect(phaseOn('2028-06-15', s)).toBe('nonPermanentResident');
    expect(phaseOn('2028-06-16', s)).toBe('nonResident');
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
    // No prior-year income, so no inhabitant tax is due (doc 03 section 3).
    expect(r.years[0].cash.cashJapan / 150).toBeCloseTo(70_000, 0);
  });

  it('reports the year the savings run out', () => {
    // Year three needs 50k against 20k left, so that is the year they go.
    expect(runScenario(base).savingsExhaustedIn).toBe(2028);
  });

  it('forces a remittance once savings are gone', () => {
    const r = runScenario({ ...base, usSavings: 500_000 });
    const after = r.years.find((y) => y.year === 2029)!;
    // Opening balance is already spent, so the whole year comes from abroad.
    expect(after.cash.fundedFromSavings).toBe(0);
    expect(after.cash.fundedFromRemittance).toBeGreaterThan(0);
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

describe('two cash pools', () => {
  const base: Scenario = {
    ...baseScenario,
    residencyStart: '2026-01-01',
    annualSalary: 100_000,
    annualLivingCost: 60_000,
    prePositionedSavings: 50_000,
    usSavings: 300_000,
    projectionYears: 4,
    gainsOnPreArrivalHoldings: true,
  };

  it('lands foreign-account gains abroad, where they stay unremitted', () => {
    const r = runScenario({ ...base, annualCapitalGainsUs: 80_000 });
    // Gains accumulate in the US pool and are never deemed remitted.
    expect(r.years[0].cash.cashUs).toBeGreaterThan(r.years[0].cash.cashJapan);
    expect(r.years[0].japan.deemedRemitted).toBe(0);
    expect(r.years[1].cash.cashUs).toBeGreaterThan(r.years[0].cash.cashUs);
  });

  it('lands Japanese-account gains in the Japanese pool', () => {
    const jp = runScenario({ ...base, annualCapitalGainsJapan: 80_000 });
    const none = runScenario(base);
    expect(jp.years[0].cash.cashJapan).toBeGreaterThan(none.years[0].cash.cashJapan);
  });

  it('pays US tax out of the US pool', () => {
    const r = runScenario({ ...base, annualCapitalGainsUs: 80_000 });
    const y = r.years[0];
    // Opening 300k plus 80k of gains, less US tax and nothing remitted.
    expect(y.cash.cashUs / 150).toBeLessThan(380_000);
    expect(y.us.total).toBeGreaterThan(0);
  });

  it('repatriates from Japan untaxed when the US pool cannot cover US tax', () => {
    // Gains in a JAPANESE account: the cash lands in Japan, but the US still
    // charges NIIT on them, which no foreign tax credit can reach. So a US bill
    // falls due with nothing abroad to pay it from.
    const r = runScenario({
      ...base, usSavings: 0, annualCapitalGainsJapan: 400_000,
      annualCapitalGainsUs: 0, prePositionedSavings: 400_000,
    });
    const y = r.years[0];
    expect(y.cash.repatriatedToUs).toBeGreaterThan(0);
    // The reverse direction is not a remittance, so nothing is deemed remitted.
    expect(y.japan.deemedRemitted).toBe(0);
    expect(y.notes.some((n) => n.includes('untaxed'))).toBe(true);
  });

  it('remits from the US pool only once the Japanese pool is dry', () => {
    const r = runScenario({
      ...base, annualSalary: 0, prePositionedSavings: 100_000, annualLivingCost: 60_000,
    });
    expect(r.years[0].cash.fundedFromRemittance).toBe(0);
    const later = r.years.find((y) => y.cash.fundedFromRemittance > 0);
    expect(later).toBeDefined();
    expect(later!.cash.cashJapan).toBeLessThanOrEqual(1);
  });

  it('costs nothing to remit accumulated gains in a year with no new foreign income', () => {
    // The ordering rule is capped by THIS year's foreign-source income, so a
    // pool built up earlier can be drawn on freely once realisation stops.
    const r = runScenario({
      ...base, annualSalary: 0, annualCapitalGainsUs: 0,
      prePositionedSavings: 0, usSavings: 500_000,
    });
    expect(r.years[0].cash.fundedFromRemittance).toBeGreaterThan(0);
    expect(r.years[0].japan.deemedRemitted).toBe(0);
  });
});

describe('corrections from the 2026-07-28 review', () => {
  const S = (p: Partial<Scenario>): Scenario => ({ ...baseScenario, residencyStart: '2026-01-01',
    visaPeriods: [{ from: '2026-01-01', table: 'table1' }], ...p });

  it('taxes a departure year in proportion to the resident part of it', () => {
    // Previously the year-end phase governed the whole year, so a departure
    // zeroed all Japanese tax for it.
    const full = runScenario(S({ annualSalary: 300_000, projectionYears: 1 }));
    const half = runScenario(S({
      annualSalary: 300_000, projectionYears: 1, departure: '2026-06-30',
    }));
    expect(half.years[0].japan.total).toBeGreaterThan(0);
    expect(half.years[0].japan.total).toBeLessThan(full.years[0].japan.total);
    // Roughly half a year of residence, so roughly half the income arises.
    expect(half.years[0].japan.alwaysTaxable / full.years[0].japan.alwaysTaxable)
      .toBeCloseTo(0.5, 1);
  });

  it('discloses a split year even when arrival and departure cancel out', () => {
    const r = runScenario(S({
      residencyStart: '2026-03-01', departure: '2026-09-01',
      annualSalary: 300_000, projectionYears: 1,
    }));
    expect(r.years[0].japan.total).toBeGreaterThan(0);
    expect(r.years[0].notes.some((n) => n.includes('Status changed'))).toBe(true);
  });

  it('charges no inhabitant tax in the arrival year', () => {
    // Keyed to residence on 1 January and assessed on the prior year's income.
    const r = runScenario(S({ annualSalary: 200_000, projectionYears: 2 }));
    expect(r.years[0].japan.inhabitantTax).toBe(0);
    expect(r.years[1].japan.inhabitantTax).toBeGreaterThan(0);
  });

  it('gives no basic deduction to a high earner', () => {
    // No.1199: the deduction tapers to zero above 25,000,000 yen of total income.
    const low = runScenario(S({ annualSalary: 40_000, projectionYears: 1 }));
    const high = runScenario(S({ annualSalary: 300_000, projectionYears: 1 }));
    expect(low.years[0].japan.employmentTax).toBeGreaterThanOrEqual(0);
    expect(high.years[0].japan.total).toBeGreaterThan(0);
  });

  it('honours filing status', () => {
    // Income chosen so the NIIT threshold actually binds: gross $220k sits
    // above the $200k single threshold but below the $250k joint one, which
    // IRC 1411(b) fixes rather than doubling.
    const args = { annualSalary: 20_000, annualCapitalGainsUs: 200_000,
      gainsOnPreArrivalHoldings: false, projectionYears: 1,
      prePositionedSavings: 500_000 } as const;
    const single = runScenario(S({ ...args, filingStatus: 'single' }));
    const joint = runScenario(S({ ...args, filingStatus: 'marriedJoint' }));
    expect(single.years[0].us.niit).toBeGreaterThan(0);
    expect(joint.years[0].us.niit).toBe(0);
    expect(joint.years[0].us.total).toBeLessThan(single.years[0].us.total);
  });

  it('walks the capital gain brackets instead of applying one rate', () => {
    // A gain with no salary sits partly in the 0% band; a single 15% rate on
    // the whole gain overstated it roughly threefold.
    const r = runScenario(S({
      annualSalary: 0, annualCapitalGainsUs: 100_000, gainsOnPreArrivalHoldings: false,
      projectionYears: 1, prePositionedSavings: 500_000,
    }));
    expect(r.years[0].us.taxBeforeCredit).toBeLessThan(9_000);
    expect(r.years[0].us.taxBeforeCredit).toBeGreaterThan(3_000);
  });

  it('never reports a negative pool, and says the plan is underfunded instead', () => {
    const r = runScenario(S({
      annualCapitalGainsJapan: 400_000, annualLivingCost: 380_000,
      prePositionedSavings: 100_000, usSavings: 0, projectionYears: 2,
    }));
    for (const y of r.years) {
      expect(y.cash.cashJapan).toBeGreaterThanOrEqual(0);
      expect(y.cash.cashUs).toBeGreaterThanOrEqual(0);
    }
    expect(r.underfundedIn).not.toBeNull();
  });

  it('reports exhaustion even when repatriation is what drained the pool', () => {
    const r = runScenario(S({
      annualCapitalGainsJapan: 200_000, annualLivingCost: 200_000,
      prePositionedSavings: 100_000, projectionYears: 6,
    }));
    expect(r.savingsExhaustedIn).not.toBeNull();
  });

  it('sources only the gain that actually bore Japanese tax', () => {
    // Partial remittance means a partial credit, not an all-or-nothing cliff.
    const r = runScenario(S({
      annualSalary: 0, annualCapitalGainsUs: 100_000, gainsOnPreArrivalHoldings: true,
      annualLivingCost: 40_000, prePositionedSavings: 0, usSavings: 300_000,
      projectionYears: 1,
    }));
    const y = r.years[0];
    expect(y.japan.deemedRemitted).toBeGreaterThan(0);
    // Some credit, but not the whole bucket's worth.
    expect(y.us.creditPassive).toBeGreaterThan(0);
    expect(y.us.creditPassive).toBeLessThan(y.japan.capitalGainsTaxOnForeign / 150 + 1);
  });

  it('tests the exit tax against a covered-asset value, not the horizon', () => {
    const short = runScenario(S({ departure: '2045-06-01', coveredAssetValue: 400_000,
      visaPeriods: [{ from: '2026-01-01', table: 'table2' }], projectionYears: 5 }));
    const long = runScenario(S({ departure: '2045-06-01', coveredAssetValue: 400_000,
      visaPeriods: [{ from: '2026-01-01', table: 'table2' }], projectionYears: 10 }));
    // Same person, same portfolio: the chart width must not change the law.
    expect(short.exitTaxExposed).toBe(long.exitTaxExposed);
  });

  it('survives hostile numeric input without producing NaN', () => {
    const r = runScenario(S({
      annualSalary: -100, annualCapitalGainsJapan: -50_000, fxJpyPerUsd: 0,
      projectionYears: 2,
    }));
    for (const y of r.years) {
      expect(Number.isFinite(y.combined)).toBe(true);
      expect(y.japan.total).toBeGreaterThanOrEqual(0);
      expect(y.us.total).toBeGreaterThanOrEqual(0);
    }
  });

  it('converges rather than exiting the loop by exhaustion', () => {
    // Slope 0.20315 needs ~15 passes for a 1-yen tolerance; the old 4-pass cap
    // always understated. Check the year is internally consistent.
    const r = runScenario(S({
      annualLivingCost: 60_000, usSavings: 2_000_000, annualCapitalGainsUs: 500_000,
      projectionYears: 1,
    }));
    const y = r.years[0];
    const flow = -y.cash.livingCost - y.japan.total + y.cash.fundedFromRemittance;
    expect(Math.abs(flow - (y.cash.cashJapan - 0))).toBeLessThan(2);
  });
});
