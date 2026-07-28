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

export function addMonths(d: IsoDate, months: number): IsoDate {
  const date = parseDate(d);
  const targetDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  // Clamp to the month's length, so 31 Jan + 1 month is 28/29 Feb rather than
  // rolling into March.
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(targetDay, lastDay));
  return toIso(date);
}

/** A period expressed the way the NTA counts one: years, months and days. */
interface Ymd {
  years: number;
  months: number;
  days: number;
}

/**
 * Decompose a half-open period [from, toExclusive) into calendar years, months
 * and days.
 *
 * NTA circular 2-4の3: "計算は暦に従って計算し、1月に満たない期間は日をもって
 * 数える" — count by the calendar, and count any part-month in days. So a period
 * is NOT a flat day count; whole calendar years and months are taken off first.
 */
function decompose(from: IsoDate, toExclusive: IsoDate): Ymd {
  if (toExclusive <= from) return { years: 0, months: 0, days: 0 };
  let years = 0;
  while (addYears(from, years + 1) <= toExclusive) years++;
  const afterYears = addYears(from, years);
  let months = 0;
  while (addMonths(afterYears, months + 1) <= toExclusive) months++;
  const afterMonths = addMonths(afterYears, months);
  return { years, months, days: daysBetween(afterMonths, toExclusive) };
}

/**
 * Normalise an aggregate the way NTA circular 2-4の3 directs: sum the years,
 * months and days of each period separately, then carry 30 days into one month
 * and 12 months into one year.
 *
 * The 30-day month is the NTA's own convention, not an approximation of ours.
 */
function normalise(parts: Ymd[]): Ymd {
  let days = parts.reduce((s, p) => s + p.days, 0);
  let months = parts.reduce((s, p) => s + p.months, 0);
  let years = parts.reduce((s, p) => s + p.years, 0);
  months += Math.floor(days / 30);
  days %= 30;
  years += Math.floor(months / 12);
  months %= 12;
  return { years, months, days };
}

/**
 * The first date on which the taxpayer is no longer a non-permanent resident.
 *
 * ITA art. 2(1)(iv): status holds while the AGGREGATE (合計) period of domicile
 * or residence in Japan within the preceding ten years is five years or less.
 * Three NTA circulars fix the arithmetic that the statute leaves open:
 *
 *   2-4の3  Count by the calendar. Each stay runs from the day AFTER entry
 *           (入国の日の翌日) to the day of departure. Aggregate by summing
 *           years, months and days separately, carrying 30 days to a month and
 *           12 months to a year.
 *   2-4の2  "Within the preceding ten years" runs from the same day ten years
 *           before the date being judged, to the day BEFORE that date.
 *   2-3(3)  Status changes the day AFTER the aggregate passes five years
 *           ("5年以内の日までの間は非永住者、その翌日以後は…").
 *
 * So a clean five-year stay from 1 April 2026 counts from 2 April 2026, reaches
 * five years on 1 April 2031, and worldwide taxation begins on 2 April 2031 —
 * a day later than a naive anniversary calculation gives.
 */
export function nonPermanentResidentEnd(
  residencyStart: IsoDate,
  priorPresence: PriorPresence[] = [],
): IsoDate {
  /**
   * The look-back SLIDES. Circular 2-4の2: 「過去10年以内」とは、判定する日の
   * 10年前の同日から、判定する日の前日までをいう — it is measured from the day
   * being judged, not from arrival. Anchoring it to `residencyStart` (as this
   * function previously did) charges prior presence against the budget forever,
   * even after it has aged out of the window.
   *
   * Because the window moves with the candidate date, the boundary is found by
   * search rather than arithmetic: walk forward and take the first day on which
   * the aggregate, measured over that day's own window, exceeds five years.
   */
  const aggregateOn = (judgeDay: IsoDate): Ymd => {
    const windowStart = addYears(judgeDay, -10);
    // 2-4の2: the counted period ends the day BEFORE the day being judged.
    const windowEnd = judgeDay;

    const parts = priorPresence.map((p) => {
      // Each stay runs from the day after entry to the day of departure (2-4の3).
      const from = maxDate(addDays(p.from, 1), windowStart);
      const toExclusive = minDate(addDays(p.to, 1), windowEnd);
      return decompose(from, toExclusive < from ? from : toExclusive);
    });

    const currentFrom = maxDate(addDays(residencyStart, 1), windowStart);
    parts.push(decompose(currentFrom, windowEnd < currentFrom ? currentFrom : windowEnd));

    return normalise(parts);
  };

  const exceedsFive = (p: Ymd) =>
    p.years > 5 || (p.years === 5 && (p.months > 0 || p.days > 0));

  // Bracket the answer, then bisect. The aggregate is monotone in the judge
  // day for a fixed history, so bisection is exact.
  let lo = addDays(residencyStart, 1);
  let hi = addYears(residencyStart, 11);
  if (!exceedsFive(aggregateOn(hi))) return hi;

  while (daysBetween(lo, hi) > 1) {
    const mid = addDays(lo, Math.floor(daysBetween(lo, hi) / 2));
    if (exceedsFive(aggregateOn(mid))) hi = mid;
    else lo = mid;
  }
  // 2-3(3): status runs to and including the last day at five years or less, so
  // the first non-NPR day is the one after it — which is `hi`.
  return hi;
}

const maxDate = (a: IsoDate, b: IsoDate) => (a > b ? a : b);
const minDate = (a: IsoDate, b: IsoDate) => (a < b ? a : b);

function addDays(d: IsoDate, n: number): IsoDate {
  const date = parseDate(d);
  date.setUTCDate(date.getUTCDate() + n);
  return toIso(date);
}

/** Which phase applies on a given date. */
export function phaseOn(date: IsoDate, scenario: Scenario): ResidencyPhase {
  const { residencyStart, departure, holdsJapaneseNationality, priorPresence } = scenario;
  if (date < residencyStart) return 'nonResident';
  // 2-4の3 counts 「入国の日の翌日から出国の日まで」, so the departure day
  // itself is still a day of residence.
  if (departure && date > departure) return 'nonResident';

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
