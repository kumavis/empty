/**
 * Rate tables, versioned by tax year.
 *
 * Every figure here traces to docs/03-japan-income-categories-and-rates.md or
 * docs/05-us-taxation-and-sourcing.md, and through them to an archived source.
 * A figure without a year attached is a defect (docs/CONVENTIONS.md rule 4), so
 * tables are keyed by year and resolved with `forYear`.
 */

export interface Bracket {
  /** Lower bound, inclusive. */
  from: number;
  rate: number;
  /** Japan's tables are published as rate-minus-offset rather than as a walk. */
  quickDeduction?: number;
}

export interface JapanRates {
  year: number;
  /** National income tax on aggregate taxable income (課税総所得金額). */
  nationalBrackets: Bracket[];
  /** Special reconstruction income tax (復興特別所得税), a surtax on the tax. */
  reconstructionSurtax: number;
  /** Last year the reconstruction surtax applies. */
  reconstructionSurtaxEndsAfter: number;
  /** Local inhabitant tax (住民税) flat rate. UNVERIFIED — doc 03 section 3. */
  inhabitantTaxRate: number;
  /** Per-capita inhabitant levy (均等割). UNVERIFIED. */
  inhabitantPerCapita: number;
  /** Listed securities (上場株式等): national component. */
  listedSecuritiesNational: number;
  /** Listed securities: local component. */
  listedSecuritiesLocal: number;
  /**
   * Basic deduction (基礎控除), tapered by the taxpayer's 合計所得金額.
   * Bands are [threshold, amount], read as "total income at or below threshold
   * takes this amount"; the final entry is the above-everything case.
   */
  basicDeductionBands: Array<{ upTo: number; amount: number }>;
}

/**
 * 令和7年 (2025) onward. Verified against the NTA's own worked example:
 * 7,000,000 x 0.23 - 636,000 = 974,000.
 * Source: sources/japan-nta/taxanswer-shotoku-2260.html
 */
const JAPAN_2025: JapanRates = {
  year: 2025,
  nationalBrackets: [
    { from: 0, rate: 0.05, quickDeduction: 0 },
    { from: 1_950_000, rate: 0.1, quickDeduction: 97_500 },
    { from: 3_300_000, rate: 0.2, quickDeduction: 427_500 },
    { from: 6_950_000, rate: 0.23, quickDeduction: 636_000 },
    { from: 9_000_000, rate: 0.33, quickDeduction: 1_536_000 },
    { from: 18_000_000, rate: 0.4, quickDeduction: 2_796_000 },
    { from: 40_000_000, rate: 0.45, quickDeduction: 4_796_000 },
  ],
  reconstructionSurtax: 0.021,
  reconstructionSurtaxEndsAfter: 2037,
  inhabitantTaxRate: 0.1,
  inhabitantPerCapita: 5_000,
  listedSecuritiesNational: 0.15,
  listedSecuritiesLocal: 0.05,
  // 令和7年分. Source: sources/japan-nta/taxanswer-shotoku-1199.htm (No.1199
  // 基礎控除), 根拠法令 所法86・措法41の16の2. The 令和7年 middle bands
  // (880k/680k/630k) are a one-year uplift; 令和8年 onward flattens them to
  // 580,000 — see JAPAN_2026 below.
  basicDeductionBands: [
    { upTo: 1_320_000, amount: 950_000 },
    { upTo: 3_360_000, amount: 880_000 },
    { upTo: 4_890_000, amount: 680_000 },
    { upTo: 6_550_000, amount: 630_000 },
    { upTo: 23_500_000, amount: 580_000 },
    { upTo: 24_000_000, amount: 480_000 },
    { upTo: 24_500_000, amount: 320_000 },
    { upTo: 25_000_000, amount: 160_000 },
    { upTo: Infinity, amount: 0 },
  ],
};

/** 令和8年分以降: the same table with the 令和7年-only middle bands removed. */
const JAPAN_2026: JapanRates = {
  ...JAPAN_2025,
  year: 2026,
  basicDeductionBands: [
    { upTo: 1_320_000, amount: 950_000 },
    { upTo: 23_500_000, amount: 580_000 },
    { upTo: 24_000_000, amount: 480_000 },
    { upTo: 24_500_000, amount: 320_000 },
    { upTo: 25_000_000, amount: 160_000 },
    { upTo: Infinity, amount: 0 },
  ],
};

export const JAPAN_RATES: Record<number, JapanRates> = {
  2025: JAPAN_2025,
  2026: JAPAN_2026,
};

/**
 * The basic deduction for a given 合計所得金額.
 *
 * It tapers to zero above ¥25,000,000, so a high earner — the case this
 * calculator exists for — gets nothing. Applying a flat ¥580,000 (as this
 * module previously did) overstates the deduction by up to that amount.
 */
export function basicDeductionFor(totalIncome: number, rates: JapanRates): number {
  for (const band of rates.basicDeductionBands) {
    if (totalIncome <= band.upTo) return band.amount;
  }
  return 0;
}

export type FilingStatus = 'single' | 'marriedJoint';

/** Figures that differ by filing status. */
export interface UsFilingFigures {
  ordinaryBrackets: Bracket[];
  ltcgBrackets: Bracket[];
  standardDeduction: number;
  /** IRC 1411(b): $250,000 on a joint return, $200,000 otherwise. */
  niitThreshold: number;
}

export interface UsRates {
  year: number;
  byStatus: Record<FilingStatus, UsFilingFigures>;
  /** Net investment income tax. NOT creditable — doc 05 section 3. */
  niitRate: number;
  /** IRC section 911 maximum exclusion. */
  feieMax: number;
  /** Top ordinary rate, used for the section 904(b)(2)(B) scaling. */
  topOrdinaryRate: number;
}

/**
 * 2025 and 2026 figures.
 *
 * UNVERIFIED, and flagged as such in the UI: the bracket thresholds are
 * asserted from general knowledge, not transcribed from a Revenue Procedure
 * (doc 05 section 5). The married-joint thresholds are the conventional
 * doubling of the single ones, EXCEPT the NIIT threshold, which IRC 1411(b)
 * fixes at $250,000 and is therefore not a doubling — that one figure is
 * statutory and archived.
 */
const US_2025: UsRates = {
  year: 2025,
  byStatus: {
    single: {
      ordinaryBrackets: [
        { from: 0, rate: 0.1 },
        { from: 11_925, rate: 0.12 },
        { from: 48_475, rate: 0.22 },
        { from: 103_350, rate: 0.24 },
        { from: 197_300, rate: 0.32 },
        { from: 250_525, rate: 0.35 },
        { from: 626_350, rate: 0.37 },
      ],
      ltcgBrackets: [
        { from: 0, rate: 0 },
        { from: 48_350, rate: 0.15 },
        { from: 533_400, rate: 0.2 },
      ],
      standardDeduction: 15_000,
      niitThreshold: 200_000,
    },
    marriedJoint: {
      ordinaryBrackets: [
        { from: 0, rate: 0.1 },
        { from: 23_850, rate: 0.12 },
        { from: 96_950, rate: 0.22 },
        { from: 206_700, rate: 0.24 },
        { from: 394_600, rate: 0.32 },
        { from: 501_050, rate: 0.35 },
        { from: 751_600, rate: 0.37 },
      ],
      ltcgBrackets: [
        { from: 0, rate: 0 },
        { from: 96_700, rate: 0.15 },
        { from: 600_050, rate: 0.2 },
      ],
      standardDeduction: 30_000,
      niitThreshold: 250_000,
    },
  },
  niitRate: 0.038,
  feieMax: 130_000,
  topOrdinaryRate: 0.37,
};

const US_2026: UsRates = { ...US_2025, year: 2026, feieMax: 132_900 };

export const US_RATES: Record<number, UsRates> = { 2025: US_2025, 2026: US_2026 };

/**
 * Resolve the table for a year, falling back to the latest year defined.
 *
 * Projecting a future year with today's table is the only honest option — the
 * alternative is inventing brackets — but the caller must surface it, which
 * `didExtrapolate` supports.
 */
export function forYear<T extends { year: number }>(
  table: Record<number, T>,
  year: number,
): { rates: T; didExtrapolate: boolean } {
  const exact = table[year];
  if (exact) return { rates: exact, didExtrapolate: false };
  const years = Object.keys(table).map(Number).sort((a, b) => a - b);
  const nearest = years.filter((y) => y <= year).pop() ?? years[0];
  return { rates: table[nearest], didExtrapolate: true };
}

/** Japan publishes its table as rate-minus-offset; apply it that way. */
export function japanNationalTax(taxableIncome: number, rates: JapanRates): number {
  if (taxableIncome <= 0) return 0;
  // Statute rounds taxable income down to the nearest 1,000 yen first.
  const base = Math.floor(taxableIncome / 1000) * 1000;
  let chosen = rates.nationalBrackets[0];
  for (const b of rates.nationalBrackets) if (base >= b.from) chosen = b;
  return Math.max(0, base * chosen.rate - (chosen.quickDeduction ?? 0));
}

/** Walk a conventional progressive table. */
export function progressiveTax(taxableIncome: number, brackets: Bracket[]): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const { from, rate } = brackets[i];
    const to = brackets[i + 1]?.from ?? Infinity;
    if (taxableIncome <= from) break;
    tax += (Math.min(taxableIncome, to) - from) * rate;
  }
  return tax;
}

/**
 * The headline 20.315% on listed securities: 15% national, 0.315%
 * reconstruction surtax on that national component, and 5% local.
 */
export function listedSecuritiesRate(rates: JapanRates, year: number): number {
  const surtax = year <= rates.reconstructionSurtaxEndsAfter ? rates.reconstructionSurtax : 0;
  return (
    rates.listedSecuritiesNational * (1 + surtax) + rates.listedSecuritiesLocal
  );
}

/**
 * The employment income deduction (給与所得控除), 令和7年分以降.
 *
 * Transcribed from sources/japan-nta/taxanswer-shotoku-1410-v2.htm. The
 * schedule caps at ¥1,950,000 above ¥8,500,000 of gross salary — NOT above
 * ¥6,600,000, which is what doc 03 previously said. For a high earner it is
 * therefore a fixed ¥1,950,000.
 *
 * The 令和2年–令和6年 schedule this module previously implemented had a
 * ¥1,625,000 breakpoint and a "×40% − 100,000" band; neither exists from
 * 令和7年. Below ¥6,600,000 the NTA directs use of 別表第五 rather than this
 * table, which is not archived here — immaterial at the incomes modelled, and
 * recorded as a limitation rather than silently approximated.
 */
export function employmentIncomeDeduction(grossSalary: number): number {
  if (grossSalary <= 1_900_000) return Math.min(grossSalary, 650_000);
  if (grossSalary <= 3_600_000) return grossSalary * 0.3 + 80_000;
  if (grossSalary <= 6_600_000) return grossSalary * 0.2 + 440_000;
  if (grossSalary <= 8_500_000) return grossSalary * 0.1 + 1_100_000;
  return 1_950_000;
}
