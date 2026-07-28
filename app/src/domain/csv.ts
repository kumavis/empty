/**
 * CSV export of a full projection, for review outside the tool.
 *
 * Written for someone checking the arithmetic, so it carries the inputs it was
 * run with, both currencies, and the components rather than only the totals —
 * a reviewer cannot verify a number they can only see rounded and combined.
 */
import type { Scenario, ScenarioResult } from './types';

/** RFC 4180: quote every field, and double any embedded quote. */
function cell(v: string | number): string {
  const s = typeof v === 'number' ? String(Math.round(v * 100) / 100) : v;
  return `"${s.replace(/"/g, '""')}"`;
}

const row = (cells: (string | number)[]) => cells.map(cell).join(',');

export function toCsv(scenario: Scenario, result: ScenarioResult, generatedAt: string): string {
  const fx = scenario.fxJpyPerUsd;
  const usd = (yen: number) => yen / fx;

  const lines: string[] = [];

  // --- Provenance: the figures mean nothing without the inputs behind them ---
  lines.push(row(['US to Japan tax projection']));
  lines.push(row(['Generated', generatedAt]));
  lines.push(row(['Research model, not tax advice. Figures are directional.']));
  lines.push('');

  lines.push(row(['INPUTS']));
  lines.push(row(['Field', 'Value', 'Note']));
  const inputs: [string, string | number, string][] = [
    ['Domicile attaches', scenario.residencyStart, 'ITA art. 2(1)(iii); a question of fact'],
    ['Departure', scenario.departure ?? '(none)', ''],
    ['Japanese nationality', scenario.holdsJapaneseNationality ? 'yes' : 'no',
      'If yes, non-permanent resident status is unavailable'],
    ['Immigration status', scenario.visaPeriods[0]?.table === 'table2'
      ? 'Appended Table 2' : 'Appended Table 1',
      'Table 1 time never counts toward the exit tax'],
    ['Annual salary (USD)', scenario.annualSalary, 'For work performed in Japan'],
    ['Capital gains, Japanese account (USD)', scenario.annualCapitalGainsJapan,
      'Never shelterable; keeps its US foreign tax credit'],
    ['Capital gains, foreign account (USD)', scenario.annualCapitalGainsUs,
      'Shelterable from Japan, then US-source under IRC 865(g)(2)'],
    ['Foreign holdings pre-date arrival', scenario.gainsOnPreArrivalHoldings ? 'yes' : 'no',
      'Enforcement Order art. 17(1) specified securities test'],
    ['Annual living cost (USD)', scenario.annualLivingCost, ''],
    ['Pre-positioned savings in Japan (USD)', scenario.prePositionedSavings,
      'Moved before domicile attached, so outside the remittance regime'],
    ['Savings held abroad (USD)', scenario.usSavings,
      'Sending any of it to Japan is a remittance; the reverse direction is untaxed'],
    ['Projection years', scenario.projectionYears, ''],
    ['Exchange rate (JPY per USD)', fx, 'Held constant across the projection'],
    ['FEIE elected', scenario.elections.claimFeie ? 'yes' : 'no', 'IRC section 911'],
    ['Worldwide taxation begins', result.nprEndsOn,
      'NTA circulars 2-3(3) and 2-4-3: counted from the day after entry'],
    ['Cash in Japan runs out', result.savingsExhaustedIn ?? '(not within projection)',
      'The year remittances become unavoidable'],
  ];
  for (const [k, v, note] of inputs) lines.push(row([k, v, note]));
  lines.push('');

  // --- Year by year, components not just totals -----------------------------
  lines.push(row(['YEAR BY YEAR']));
  lines.push(row([
    'Year', 'Phase', 'Status changed',
    'Japan: employment tax (USD)', 'Japan: inhabitant tax (USD)',
    'Japan: CGT on Japanese-account gains (USD)', 'Japan: CGT on foreign gains (USD)',
    'Japan: deemed remitted (USD)', 'Japan: total (USD)', 'Japan: total (JPY)',
    'US: tax before credit (USD)', 'US: general basket credit (USD)',
    'US: passive basket credit (USD)', 'US: excess credits (USD)', 'US: NIIT (USD)',
    'US: total (USD)',
    'Combined (USD)', 'Combined (JPY)', 'Effective rate',
    'Living cost (USD)', 'Funded from cash in Japan (USD)', 'Funded by remittance (USD)',
    'Repatriated to US (USD)', 'Cash in Japan at year end (USD)', 'Cash in US at year end (USD)',
  ]));

  for (const y of result.years) {
    lines.push(row([
      y.year,
      y.phase === 'nonPermanentResident' ? 'Non-permanent resident'
        : y.phase === 'permanentResident' ? 'Resident (worldwide)' : 'Non-resident',
      y.phaseChangedOn ?? '',
      usd(y.japan.employmentTax), usd(y.japan.inhabitantTax),
      usd(y.japan.capitalGainsTaxOnJapanSitus), usd(y.japan.capitalGainsTaxOnForeign),
      usd(y.japan.deemedRemitted), usd(y.japan.total), y.japan.total,
      y.us.taxBeforeCredit, y.us.creditGeneral, y.us.creditPassive,
      y.us.excessCredits, y.us.niit, y.us.total,
      usd(y.combined), y.combined, y.effectiveRate,
      usd(y.cash.livingCost), usd(y.cash.fundedFromSavings),
      usd(y.cash.fundedFromRemittance), usd(y.cash.repatriatedToUs),
      usd(y.cash.cashJapan), usd(y.cash.cashUs),
    ]));
  }

  lines.push(row([
    'TOTAL', '', '', '', '', '', '', '',
    usd(result.totals.japan), result.totals.japan,
    '', '', '', '', '', usd(result.totals.us),
    usd(result.totals.combined), result.totals.combined, '', '', '', '', '', '', '',
  ]));
  lines.push('');

  // --- Findings and model notes, so the reviewer sees the caveats too -------
  if (result.warnings.length > 0) {
    lines.push(row(['FINDINGS']));
    for (const w of result.warnings) lines.push(row([w]));
    lines.push('');
  }

  lines.push(row(['WHAT THE MODEL DID']));
  lines.push(row(['Years', 'Note']));
  const grouped = new Map<string, number[]>();
  for (const y of result.years) {
    for (const n of y.notes) {
      if (!grouped.has(n)) grouped.set(n, []);
      grouped.get(n)!.push(y.year);
    }
  }
  for (const [note, years] of grouped) {
    lines.push(row([years.join(' '), note]));
  }
  lines.push('');

  lines.push(row(['KNOWN APPROXIMATIONS']));
  for (const a of [
    'A transition year is not apportioned; Enforcement Order art. 17(4)(vi) requires splitting it.',
    'The IRC 904(b)(2)(B) rate differential factor is estimated, not taken from the Form 1116 instructions.',
    'Japanese inhabitant tax rules and their creditability are an open question in the research.',
    'A single exchange rate is applied across all years.',
    'Rate tables are 2025 figures, reused for later years.',
  ]) lines.push(row([a]));

  return lines.join('\n');
}

/** Filename that sorts and identifies without needing to be opened. */
export function csvFilename(scenario: Scenario, generatedAt: string): string {
  return `japan-tax-projection_${scenario.residencyStart}_${generatedAt.slice(0, 10)}.csv`;
}
