/**
 * Input validation.
 *
 * A date input is edited a character at a time, so it passes through states
 * that are structurally valid but meaningless — typing "2026" into a year field
 * goes through 0002, 0020, 0202. Feeding those to the engine produces a
 * ten-thousand-year projection or a silently empty one. The rule here is that a
 * field in an intermediate state NEVER reaches the model: the last good value
 * stays in effect and the field explains what it wants.
 */

export interface Check {
  /** null when the value is usable. */
  error: string | null;
  /** Present when the value is usable; absent otherwise. */
  value?: number | string;
}

const OK = (value: number | string): Check => ({ error: null, value });
const BAD = (error: string): Check => ({ error });

/** Dates outside this range are being typed, not chosen. */
const MIN_YEAR = 1990;
const MAX_YEAR = 2100;

export function checkDate(raw: string, label: string): Check {
  if (!raw) return BAD(`${label} is required.`);

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return BAD(`Enter ${label.toLowerCase()} as a full date.`);

  const [, y, mo, d] = m;
  const year = Number(y);

  // The state a part-typed year passes through. Say what's wrong rather than
  // projecting eighteen centuries of tax.
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return BAD(`Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`);
  }

  // Reject 31 February and friends: Date rolls them forward silently.
  const probe = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(probe.getTime())) return BAD(`${label} is not a real date.`);
  if (probe.getUTCMonth() + 1 !== Number(mo) || probe.getUTCDate() !== Number(d)) {
    return BAD(`${label} is not a real date.`);
  }

  return OK(raw);
}

export function checkMoney(raw: string, label: string, opts: { max?: number } = {}): Check {
  const trimmed = raw.trim();
  if (trimmed === '') return BAD(`${label} is required.`);

  // Accept what people actually paste: $180,000 / 180000 / 1.8e5. Reject hex
  // and other Number() curiosities — "0x10" is a typo, not sixteen dollars.
  const cleaned = trimmed.replace(/[$,\s]/g, '');
  if (!/^\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(cleaned)) {
    return BAD(`${label} must be a number.`);
  }
  const n = Number(cleaned);

  if (!Number.isFinite(n)) return BAD(`${label} must be a number.`);
  if (n < 0) return BAD(`${label} cannot be negative.`);
  if (opts.max !== undefined && n > opts.max) {
    return BAD(`${label} looks too large — check the figure.`);
  }
  return OK(n);
}

export function checkRate(raw: string, label: string): Check {
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return BAD(`${label} must be a number.`);
  if (n <= 0) return BAD(`${label} must be above zero.`);
  if (n < 10 || n > 1000) return BAD(`${label} must be between 10 and 1000 yen per dollar.`);
  return OK(n);
}

export function checkYears(raw: string): Check {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return BAD('Enter a whole number of years.');
  const n = Number(trimmed);
  if (!Number.isInteger(n)) return BAD('Enter a whole number of years.');
  if (n < 1) return BAD('Project at least one year.');
  if (n > 30) return BAD('Projections beyond 30 years are not meaningful here.');
  return OK(n);
}

/**
 * A departure before arrival is the one cross-field check worth making — it is
 * easy to hit while editing and produces a silently empty projection.
 */
export function checkDeparture(departure: string, residencyStart: string): Check {
  if (!departure) return OK('');
  const own = checkDate(departure, 'Departure');
  if (own.error) return own;
  if (departure <= residencyStart) return BAD('Departure must be after residency starts.');
  return OK(departure);
}
