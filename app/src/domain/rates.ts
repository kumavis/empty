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
  /** Basic deduction (基礎控除) base amount. */
  basicDeduction: number;
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
  basicDeduction: 580_000,
};

export const JAPAN_RATES: Record<number, JapanRates> = { 2025: JAPAN_2025 };

export interface UsRates {
  year: number;
  ordinaryBrackets: Bracket[];
  /** Long-term capital gain brackets, by taxable income. */
  ltcgBrackets: Bracket[];
  /** Net investment income tax. NOT creditable — doc 05 section 3. */
  niitRate: number;
  niitThreshold: number;
  standardDeduction: number;
  /** IRC section 911 maximum exclusion. */
  feieMax: number;
  /** Top ordinary rate, used for the section 904(b)(2)(B) scaling. */
  topOrdinaryRate: number;
}

/**
 * 2025 and 2026 figures. FEIE amounts are from IRS material and are marked
 * "likely but unverified" in doc 05; the bracket thresholds below are
 * approximations flagged in the UI, not transcribed from a Revenue Procedure.
 */
const US_2025: UsRates = {
  year: 2025,
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
  niitRate: 0.038,
  niitThreshold: 200_000,
  standardDeduction: 15_000,
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
 * The employment income deduction (給与所得控除).
 *
 * The schedule flattens above 6,600,000 yen of gross salary, so for a high
 * earner this is effectively a fixed and small amount (doc 03 section 2).
 * UNVERIFIED in its lower bands; the cap is what matters here.
 */
export function employmentIncomeDeduction(grossSalary: number): number {
  if (grossSalary <= 1_625_000) return Math.min(grossSalary, 650_000);
  if (grossSalary <= 1_800_000) return grossSalary * 0.4 - 100_000;
  if (grossSalary <= 3_600_000) return grossSalary * 0.3 + 80_000;
  if (grossSalary <= 6_600_000) return grossSalary * 0.2 + 440_000;
  if (grossSalary <= 8_500_000) return grossSalary * 0.1 + 1_100_000;
  return 1_950_000;
}
