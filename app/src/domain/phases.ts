/**
 * Residency phase computation — docs/01-japan-residency-status.md.
 *
 * Two clocks run independently and count different things:
 *   - the income tax clock counts DAYS OF PRESENCE and ignores visa category;
 *   - the exit tax clock counts VISA CATEGORY and ignores ordinary work visas.
 * Conflating them is the most common error in this area, so they are computed
 * by separate functions here rather than sharing a helper.
 */
import type {
  IsoDate,
  PriorPresence,
  ResidencyPhase,
  Scenario,
  VisaPeriod,
} from './types';

const DAY = 86_400_000;

export function parseDate(d: IsoDate): Date {
  return new Date(`${d}T00:00:00Z`);
}

export function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function addYears(d: IsoDate, years: number): IsoDate {
  const date = parseDate(d);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return toIso(date);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.max(0, Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / DAY));
}

/**
 * The date non-permanent resident status ends.
 *
 * ITA art. 2(1)(iv): status holds while the AGGREGATE (合計) period of domicile
 * or residence in Japan within the preceding ten years is five years or less.
 * The count is cumulative, not consecutive, so prior stays inside the ten-year
 * look-back bring the boundary forward.
 *
 * SIMPLIFICATION, flagged in doc 01 Confidence: whether the aggregate is counted
 * in days, and how part-days at each end are treated, is not established from the
 * archived sources. This models a straight day count and subtracts prior presence
 * that falls within the look-back window. For a single continuous stay it reduces
 * to the fifth anniversary of arrival, which is the natural reading.
 */
export function nonPermanentResidentEnd(
  residencyStart: IsoDate,
  priorPresence: PriorPresence[] = [],
): IsoDate {
  const FIVE_YEARS_DAYS = daysBetween(residencyStart, addYears(residencyStart, 5));
  const lookbackStart = addYears(residencyStart, -10);

  // Only prior presence inside the ten-year look-back counts against the budget.
  const priorDays = priorPresence.reduce((sum, p) => {
    const from = p.from < lookbackStart ? lookbackStart : p.from;
    if (p.to <= from) return sum;
    return sum + daysBetween(from, p.to);
  }, 0);

  const remaining = Math.max(0, FIVE_YEARS_DAYS - priorDays);
  const end = parseDate(residencyStart);
  end.setUTCDate(end.getUTCDate() + remaining);
  return toIso(end);
}

/** Which phase applies on a given date. */
export function phaseOn(date: IsoDate, scenario: Scenario): ResidencyPhase {
  const { residencyStart, departure, holdsJapaneseNationality, priorPresence } = scenario;
  if (date < residencyStart) return 'nonResident';
  if (departure && date >= departure) return 'nonResident';

  // ITA art. 2(1)(iv) requires the absence of Japanese nationality. A dual
  // national is a full resident from day one, with no remittance basis at all.
  if (holdsJapaneseNationality) return 'permanentResident';

  return date < nonPermanentResidentEnd(residencyStart, priorPresence)
    ? 'nonPermanentResident'
    : 'permanentResident';
}

/**
 * The phase for a calendar year, plus the date of any mid-year change.
 *
 * Enforcement Order art. 17(4)(vi) expressly contemplates status changing
 * mid-year and confines the remittance rules to the non-permanent resident
 * portion — so status is NOT assigned for a whole tax year (doc 01 section 4).
 * The phase reported is the one in force at year end, with the change date
 * carried alongside so callers can apportion.
 */
export function phaseForYear(
  year: number,
  scenario: Scenario,
): { phase: ResidencyPhase; changedOn?: IsoDate } {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const atStart = phaseOn(start, scenario);
  const atEnd = phaseOn(end, scenario);
  if (atStart === atEnd) return { phase: atEnd };

  // Find the transition date among the candidates that can fall inside the year.
  const candidates = [
    scenario.residencyStart,
    nonPermanentResidentEnd(scenario.residencyStart, scenario.priorPresence),
    scenario.departure,
  ].filter((d): d is IsoDate => !!d && d >= start && d <= end);

  return { phase: atEnd, changedOn: candidates.sort()[0] };
}

/**
 * Exit tax exposure — docs/04-japan-exit-tax-and-leaving.md.
 *
 * ITA art. 60-2(5) disapplies the charge where EITHER covered assets are under
 * 100 million yen OR the qualifying residence period within the preceding ten
 * years is five years or less. Enforcement Order art. 170(3)(i) then excludes
 * Immigration Appended Table 1 (work visa) periods from that count — so an
 * ordinary work-visa holder never starts the clock, however long they stay or
 * however large the portfolio.
 */
export function exitTaxExposure(
  scenario: Scenario,
  coveredAssetValue: number,
): { exposed: boolean; qualifyingDays: number; reason: string } {
  const THRESHOLD = 100_000_000;
  const departure = scenario.departure;
  if (!departure) {
    return { exposed: false, qualifyingDays: 0, reason: 'No departure planned.' };
  }

  const lookbackStart = addYears(departure, -10);
  const qualifyingDays = countTable2Days(scenario.visaPeriods, lookbackStart, departure);
  const fiveYearsDays = daysBetween(lookbackStart, addYears(lookbackStart, 5));

  if (coveredAssetValue < THRESHOLD) {
    return {
      exposed: false,
      qualifyingDays,
      reason:
        'Covered assets are below the ¥100m threshold, so art. 60-2(5) disapplies the charge.',
    };
  }
  if (qualifyingDays <= fiveYearsDays) {
    return {
      exposed: false,
      qualifyingDays,
      reason:
        'Qualifying residence is 5 years or less. Time on an Appended Table 1 work visa is ' +
        'excluded by Enforcement Order art. 170(3)(i), so work-visa years never count.',
    };
  }
  return {
    exposed: true,
    qualifyingDays,
    reason:
      'Over 5 years of Appended Table 2 status within the preceding 10 years, with covered ' +
      'assets at or above ¥100m: departure triggers a deemed disposal of the whole portfolio.',
  };
}

/** Days spent under a Table 2 status within a window; Table 1 days are excluded. */
function countTable2Days(periods: VisaPeriod[], from: IsoDate, to: IsoDate): number {
  return periods
    .filter((p) => p.table === 'table2')
    .reduce((sum, p) => {
      const start = p.from < from ? from : p.from;
      const end = !p.to || p.to > to ? to : p.to;
      return end <= start ? sum : sum + daysBetween(start, end);
    }, 0);
}
