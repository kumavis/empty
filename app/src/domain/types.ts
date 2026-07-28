/**
 * The input model, taken from docs/09-strategy-levers.md section 5.
 *
 * Every field here exists because the research showed it changes the answer.
 * Where a field encodes a legal test, the governing provision is named so the
 * arithmetic can be traced back to an archived source.
 */

/** ISO date, `YYYY-MM-DD`. */
export type IsoDate = string;

/** Currency amounts are held in minor-unit-free numbers; JPY has no cents. */
export type JPY = number;
export type USD = number;

/**
 * Japanese residency classification.
 *
 * Statutory terms, not the informal "temporary resident" (doc 01 section 1).
 * `nonPermanentResident` is 非永住者; `permanentResident` is the statute's
 * 非永住者以外の居住者, defined only by negation.
 */
export type ResidencyPhase =
  | 'nonResident'
  | 'nonPermanentResident'
  | 'permanentResident';

/**
 * Immigration status category, which matters ONLY for the exit tax.
 *
 * Enforcement Order art. 170(3)(i) excludes Appended Table 1 (activity-based
 * work and study) periods from the exit tax's five-year count, while Table 2
 * (status-based: Permanent Resident, Spouse of a Japanese National) periods
 * count. Income tax residency ignores this entirely — see doc 04 section 1.
 */
export type VisaTable = 'table1' | 'table2';

export interface VisaPeriod {
  from: IsoDate;
  /** Open-ended when omitted. */
  to?: IsoDate;
  table: VisaTable;
}

/** A prior stay in Japan, which shortens the non-permanent resident phase. */
export interface PriorPresence {
  from: IsoDate;
  to: IsoDate;
}

/**
 * A securities lot. The acquisition date is load-bearing: Enforcement Order
 * art. 17(1) shelters only securities acquired OUTSIDE the non-permanent
 * resident period (doc 02 section 3).
 */
export interface Lot {
  id: string;
  label: string;
  acquired: IsoDate;
  /** Cost basis in the reporting currency. */
  basis: number;
  /** Units held, used for partial disposals under the forced FIFO of art. 17(2). */
  units: number;
  /**
   * Held at a broker outside Japan. Art. 17(1) additionally requires the
   * security to be traded on a foreign market, sold through a foreign broker,
   * or held in a foreign account.
   */
  heldAbroad: boolean;
}

/** A planned disposal. */
export interface Disposal {
  id: string;
  lotId: string;
  date: IsoDate;
  units: number;
  /** Gross proceeds. Gain is derived against the lot's basis. */
  proceeds: number;
}

/** Income for one calendar year. */
export interface YearIncome {
  year: number;
  /**
   * Salary for services performed IN Japan. Japan-source however it is paid,
   * so it can never be sheltered by non-remittance (doc 03 section 6). It is
   * simultaneously foreign-source for US purposes under IRC 861(a)(3).
   */
  salaryForJapanWork: number;
  /** Salary for services performed outside Japan. Foreign-source for Japan. */
  salaryForForeignWork: number;
  /** Of the total salary, the portion paid into a Japanese account. */
  salaryPaidInJapan: number;
  /** Foreign dividends and interest paid outside Japan. */
  foreignInvestmentIncomeAbroad: number;
  /**
   * Foreign investment income paid INTO Japan. Always taxable regardless of
   * remittance — the "paid within Japan" limb of ITA art. 7(1)(ii), the bucket
   * most commentary misses (doc 02 section 2).
   */
  foreignInvestmentIncomePaidInJapan: number;
  /** Total remitted to Japan during the year, while a non-permanent resident. */
  remittanceToJapan: number;
}

export interface Elections {
  /** IRC section 911. Usually the wrong call at Japanese rates — doc 06 section 7. */
  claimFeie: boolean;
  /** IRC section 905(a). Accrual matches the inhabitant tax lag — doc 06 section 6. */
  ftcBasis: 'paid' | 'accrued';
  /** Convention art. 23(3)(c) re-sourcing, disclosed on Form 8833. */
  claimTreatyResourcing: boolean;
}

export interface Scenario {
  name: string;
  /** Date Japanese domicile (住所) attaches. Normally arrival day — doc 01 section 3. */
  residencyStart: IsoDate;
  /** Planned departure, if any. */
  departure?: IsoDate;
  /**
   * Holding Japanese nationality makes non-permanent resident status
   * unavailable entirely (ITA art. 2(1)(iv)) and collapses the whole plan.
   */
  holdsJapaneseNationality: boolean;
  priorPresence: PriorPresence[];
  visaPeriods: VisaPeriod[];
  /** Annual salary in USD for services performed in Japan. Japan-source however paid. */
  annualSalary: number;
  /** Annual realised capital gains in USD. */
  annualCapitalGains: number;
  /**
   * Whether the gains arise on holdings acquired BEFORE arrival. Only those are
   * specified securities under Enforcement Order art. 17(1) and so shelterable;
   * anything bought after arrival is taxed on an arising basis.
   */
  gainsOnPreArrivalHoldings: boolean;
  /** Annual cost of living in Japan, in USD. Drives the remittance requirement. */
  annualLivingCost: number;
  /**
   * Savings moved to Japan BEFORE domicile attached, in USD. Outside the
   * remittance regime entirely, so spending them funds life in Japan without
   * triggering the ordering rule — until they run out.
   */
  prePositionedSavings: number;
  /** Number of years to project from the year residency begins. */
  projectionYears: number;
  elections: Elections;
  filingStatus: 'single' | 'marriedJoint';
  /** JPY per USD. A single rate is a simplification; see the caveat in the UI. */
  fxJpyPerUsd: number;
}

/** Per-year output. All amounts in JPY unless the field says otherwise. */
export interface YearResult {
  year: number;
  phase: ResidencyPhase;
  /** Set when the phase boundary falls inside this year. */
  phaseChangedOn?: IsoDate;

  japan: {
    /** Income taxable regardless of remittance. */
    alwaysTaxable: number;
    /** Foreign-source income paid abroad, the shelterable pool. */
    shelterable: number;
    /** Of the shelterable pool, the amount the ordering rule brings into tax. */
    deemedRemitted: number;
    employmentTax: number;
    capitalGainsTax: number;
    inhabitantTax: number;
    total: number;
  };

  us: {
    grossIncome: number;
    feieExcluded: number;
    taxBeforeCredit: number;
    /** Per-basket credit actually allowed. */
    creditGeneral: number;
    creditPassive: number;
    /** Credits generated but not usable this year; carried under section 904(c). */
    excessCredits: number;
    niit: number;
    total: number;
  };

  /** Where the money to live on came from, and what is left. */
  cash: {
    /** Salary net of Japanese tax, available in Japan without remitting. */
    netSalaryInJapan: number;
    livingCost: number;
    /** Living cost met by drawing down pre-positioned savings. */
    fundedFromSavings: number;
    /** Living cost that had to be remitted, triggering the ordering rule. */
    fundedFromRemittance: number;
    /** Pre-positioned savings remaining at year end. */
    savingsRemaining: number;
  };

  combined: number;
  /** Effective rate on total economic income. */
  effectiveRate: number;
  notes: string[];
}

export interface ScenarioResult {
  years: YearResult[];
  totals: { japan: number; us: number; combined: number };
  /** Non-fatal findings surfaced in the UI, e.g. a lever the scenario is missing. */
  warnings: string[];
  nprEndsOn: IsoDate;
  exitTaxExposed: boolean;
  /**
   * The year pre-positioned savings run out — the year remittances become
   * unavoidable and the shelter starts to leak. null if they last the projection.
   */
  savingsExhaustedIn: number | null;
}
