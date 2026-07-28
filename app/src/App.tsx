import { useMemo, useState } from 'react';
import { Chart } from './components/Chart';
import { Field } from './components/Field';
import { Glossary } from './components/Glossary';
import { T } from './components/Term';
import { csvFilename, toCsv } from './domain/csv';
import { runScenario } from './domain/engine';
import { jpy, toJpy, usd, usdCompact } from './domain/money';
import { checkDate, checkDeparture, checkMoney, checkRate, checkYears } from './domain/validate';
import type { Scenario } from './domain/types';

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/**
 * A worked default: a high earner arriving April 2026 on a work visa, with a
 * pre-arrival portfolio and two years of living costs pre-positioned. Chosen so
 * both boundaries are visible — the year savings run out, and the year the
 * shelter ends.
 */
const DEFAULT: Scenario = {
  name: 'Base case',
  residencyStart: '2026-04-01',
  holdsJapaneseNationality: false,
  priorPresence: [],
  visaPeriods: [{ from: '2026-04-01', table: 'table1' }],
  annualSalary: 180_000,
  annualCapitalGainsJapan: 20_000,
  annualCapitalGainsUs: 100_000,
  gainsOnPreArrivalHoldings: true,
  annualLivingCost: 130_000,
  prePositionedSavings: 60_000,
  projectionYears: 8,
  elections: { claimFeie: false, ftcBasis: 'accrued', claimTreatyResourcing: true },
  filingStatus: 'single',
  fxJpyPerUsd: 150,
};

/**
 * Collapse the per-year notes into one entry per distinct finding.
 *
 * Most notes are structural — the NIIT is uncreditable, the gain stays
 * US-source — and repeat identically every year. Listing them once against the
 * years they cover turns forty lines of repetition into the handful of distinct
 * things the model actually did.
 */
function groupNotes(years: { year: number; notes: string[] }[]) {
  const map = new Map<string, number[]>();
  for (const y of years) {
    for (const note of y.notes) {
      if (!map.has(note)) map.set(note, []);
      map.get(note)!.push(y.year);
    }
  }
  return [...map.entries()].map(([note, ys]) => ({ note, years: ys }));
}

/** "2026", "2026–2030", or "2026, 2028–2030" — contiguous runs collapse. */
function summariseYears(years: number[]): string {
  const runs: string[] = [];
  let start = years[0];
  let prev = years[0];
  for (const y of years.slice(1)) {
    if (y === prev + 1) { prev = y; continue; }
    runs.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = y;
  }
  runs.push(start === prev ? `${start}` : `${start}–${prev}`);
  return runs.join(', ');
}

const PHASE_LABEL: Record<string, string> = {
  nonResident: 'Non-resident',
  nonPermanentResident: 'Non-permanent',
  permanentResident: 'Worldwide',
};

export default function App() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT);
  const [showGlossary, setShowGlossary] = useState(false);

  const result = useMemo(() => runScenario(scenario), [scenario]);

  const set = (patch: Partial<Scenario>) => setScenario((s) => ({ ...s, ...patch }));
  const fx = scenario.fxJpyPerUsd;

  /** Every dollar figure carries its yen equivalent, since the statute is in yen. */
  const both = (dollars: number) => jpy(toJpy(dollars, fx));

  const avgRate =
    result.years.length > 0
      ? result.years.reduce((s, y) => s + y.effectiveRate, 0) / result.years.length
      : 0;

  /**
   * Hands the reviewer the whole projection: the inputs it was run with, both
   * currencies, the components rather than only totals, and the caveats. A
   * blob URL keeps it entirely client-side, which the artifact CSP requires.
   */
  const downloadCsv = () => {
    const generatedAt = new Date().toISOString();
    const blob = new Blob([`\ufeff${toCsv(scenario, result, generatedAt)}`], {
      // The BOM makes Excel read the yen sign and the Japanese terms as UTF-8
      // rather than as the local codepage.
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFilename(scenario, generatedAt);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const totalUsd = result.totals.combined / fx;
  const jpUsd = result.totals.japan / fx;
  const usUsd = result.totals.us / fx;

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">Interactive model · research, not advice</p>
          <h1>Moving from the US to Japan: what the tax actually costs</h1>
          <p className="header__sub">
            Models the three <T id="resident" /> phases, the <T id="remittance-basis" /> that
            shelters foreign income during the second, and the US{' '}
            <T id="foreign-tax-credit" /> that decides how much of the shelter survives. Figures
            are in US dollars, with the yen the statute is written in alongside.
          </p>
        </div>
        <div className="header__actions">
          <button className="btn" onClick={downloadCsv}>
            Download CSV
          </button>
          <button className="btn btn--primary" onClick={() => setShowGlossary(true)}>
            Term dictionary
          </button>
        </div>
      </header>

      <div className="banner">
        <span className="banner__mark" aria-hidden="true">※</span>
        <span>
          <strong>Research, not tax advice.</strong> Figures rest on open questions recorded
          alongside the model — principally Japanese <T id="inhabitant-tax" /> rules and the
          capital gain rate differential adjustment. A transition year is not apportioned, and a
          single exchange rate is assumed throughout. Treat the output as directional, and the
          reasoning as the deliverable.
        </span>
      </div>

      <div className="tiles">
        <div className="tile">
          <span className="tile__label">Combined tax</span>
          <span className="tile__value">{usdCompact(totalUsd)}</span>
          <span className="tile__note">{both(totalUsd)} over {result.years.length} years</span>
        </div>
        <div className="tile tile--jp">
          <span className="tile__label">Japan</span>
          <span className="tile__value">{usdCompact(jpUsd)}</span>
          <span className="tile__note">{both(jpUsd)}</span>
        </div>
        <div className="tile tile--us">
          <span className="tile__label">United States</span>
          <span className="tile__value">{usdCompact(usUsd)}</span>
          <span className="tile__note">after foreign tax credit</span>
        </div>
        <div className="tile">
          <span className="tile__label">
            {result.savingsExhaustedIn ? 'Cash in Japan runs out' : 'Worldwide tax from'}
          </span>
          <span className="tile__value">
            {result.savingsExhaustedIn ?? result.nprEndsOn.slice(0, 4)}
          </span>
          <span className="tile__note">
            {result.savingsExhaustedIn
              ? `shelter ends ${result.nprEndsOn} · avg rate ${pct(avgRate)}`
              : `avg rate ${pct(avgRate)}`}
          </span>
        </div>
      </div>

      <section className="card">
        <Chart result={result} fx={fx} nprEndsOn={result.nprEndsOn} />
      </section>

      <div className="body">
        <aside className="panel">
          <h2>Scenario</h2>

          <Field
            label={<>Date <T id="domicile-jp" /> attaches</>}
            type="date"
            value={scenario.residencyStart}
            check={(raw) => checkDate(raw, 'Residency start')}
            onCommit={(v) => set({ residencyStart: String(v) })}
            hint="A question of fact, not of immigration status — usually arrival day, but never the date on a visa or residence card."
          />

          <Field
            label="Planned departure"
            type="date"
            value={scenario.departure ?? ''}
            check={(raw) => checkDeparture(raw, scenario.residencyStart)}
            onCommit={(v) => set({ departure: String(v) || undefined })}
            hint="Optional. Leaving in December rather than January avoids a year of inhabitant tax."
          />

          <h3>Annual figures</h3>

          <Field
            label="Salary"
            type="text"
            prefix="$"
            value={String(scenario.annualSalary)}
            check={(raw) => checkMoney(raw, 'Salary', { max: 100_000_000 })}
            onCommit={(v) => set({ annualSalary: Number(v) })}
            secondary={`${both(scenario.annualSalary)} · for work performed in Japan, so Japan-source however it is paid`}
          />

          <Field
            label="Capital gains — US / foreign account"
            type="text"
            prefix="$"
            value={String(scenario.annualCapitalGainsUs)}
            check={(raw) => checkMoney(raw, 'Foreign capital gains', { max: 100_000_000 })}
            onCommit={(v) => set({ annualCapitalGainsUs: Number(v) })}
            secondary={`${both(scenario.annualCapitalGainsUs)} · shelterable from Japan, but then US-source with no credit`}
          />

          <label className="field--check">
            <input
              type="checkbox"
              checked={scenario.gainsOnPreArrivalHoldings}
              onChange={(e) => set({ gainsOnPreArrivalHoldings: e.target.checked })}
            />
            <span>
              Foreign holdings bought before arrival
              <small>
                Only these are specified securities under Enforcement Order art. 17(1), and only
                these are shelterable.
              </small>
            </span>
          </label>

          <Field
            label="Capital gains — Japanese account"
            type="text"
            prefix="$"
            value={String(scenario.annualCapitalGainsJapan)}
            check={(raw) => checkMoney(raw, 'Japanese capital gains', { max: 100_000_000 })}
            onCommit={(v) => set({ annualCapitalGainsJapan: Number(v) })}
            secondary={`${both(scenario.annualCapitalGainsJapan)} · never shelterable, but keeps its US foreign tax credit`}
          />

          <Field
            label="Cost of living in Japan"
            type="text"
            prefix="$"
            value={String(scenario.annualLivingCost)}
            check={(raw) => checkMoney(raw, 'Living cost', { max: 10_000_000 })}
            onCommit={(v) => set({ annualLivingCost: Number(v) })}
            secondary={`${both(scenario.annualLivingCost)} · what has to be funded each year`}
          />

          <h3>Position and horizon</h3>

          <Field
            label="Savings pre-positioned in Japan"
            type="text"
            prefix="$"
            value={String(scenario.prePositionedSavings)}
            check={(raw) => checkMoney(raw, 'Pre-positioned savings', { max: 100_000_000 })}
            onCommit={(v) => set({ prePositionedSavings: Number(v) })}
            secondary={`${both(scenario.prePositionedSavings)} · moved before domicile attached, so outside the regime`}
          />

          <Field
            label="Years to project"
            type="number"
            value={String(scenario.projectionYears)}
            check={checkYears}
            onCommit={(v) => set({ projectionYears: Number(v) })}
          />

          <Field
            label="Exchange rate"
            type="text"
            value={String(scenario.fxJpyPerUsd)}
            check={(raw) => checkRate(raw, 'Exchange rate')}
            onCommit={(v) => set({ fxJpyPerUsd: Number(v) })}
            hint="Yen per dollar. Held constant across the projection — a real plan would not be."
          />

          <h3>Status and elections</h3>

          <div className="field">
            <label htmlFor="visa">Immigration status</label>
            <div className="field__control">
              <select
                id="visa"
                value={scenario.visaPeriods[0]?.table ?? 'table1'}
                onChange={(e) =>
                  set({
                    visaPeriods: [
                      { from: scenario.residencyStart, table: e.target.value as 'table1' | 'table2' },
                    ],
                  })
                }
              >
                <option value="table1">Work visa — Appended Table 1</option>
                <option value="table2">Permanent Resident / Spouse — Table 2</option>
              </select>
            </div>
            <span className="field__hint">
              <T id="table-1-status" /> time never counts toward the <T id="exit-tax" />.
            </span>
          </div>

          <label className="field--check">
            <input
              type="checkbox"
              checked={scenario.holdsJapaneseNationality}
              onChange={(e) => set({ holdsJapaneseNationality: e.target.checked })}
            />
            <span>Holds Japanese nationality</span>
          </label>

          <label className="field--check">
            <input
              type="checkbox"
              checked={scenario.elections.claimFeie}
              onChange={(e) =>
                set({ elections: { ...scenario.elections, claimFeie: e.target.checked } })
              }
            />
            <span>
              Elect the <T id="feie" />
            </span>
          </label>
        </aside>

        <div className="stack">
          {result.warnings.length > 0 && (
            <section className="card card--warn">
              <h2>Findings</h2>
              <ul>
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <h2>Year by year</h2>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col">Phase</th>
                    <th scope="col">Deemed remitted</th>
                    <th scope="col">Japan</th>
                    <th scope="col">US</th>
                    <th scope="col">Combined</th>
                    <th scope="col">Cash in Japan</th>
                  </tr>
                </thead>
                <tbody>
                  {result.years.map((y) => (
                    <tr key={y.year}>
                      <td>{y.year}</td>
                      <td>
                        <span className={`pill pill--${y.phase}`}>{PHASE_LABEL[y.phase]}</span>
                      </td>
                      <td>{y.japan.deemedRemitted ? usd(y.japan.deemedRemitted / fx) : '—'}</td>
                      <td className="num--jp">{usd(y.japan.total / fx)}</td>
                      <td className="num--us">{usd(y.us.total)}</td>
                      <td><strong>{usd(y.combined / fx)}</strong></td>
                      <td>{usd(y.cash.savingsRemaining / fx)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total</td>
                    <td className="num--jp">{usd(jpUsd)}</td>
                    <td className="num--us">{usd(usUsd)}</td>
                    <td>{usd(totalUsd)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="muted small" style={{ marginTop: 10 }}>
              Combined total {both(totalUsd)}.
            </p>
          </section>

          <section className="card">
            <h2>What the model did</h2>
            <p className="muted small" style={{ marginBottom: 12 }}>
              Each finding is listed once, with the years it applies to.
            </p>
            <ul className="notes__list">
              {groupNotes(result.years).map(({ note, years }) => (
                <li key={note}>
                  <span className="notes__years">{summariseYears(years)}</span>
                  {note}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <footer className="foot">
        <span>
          Built on 38 archived primary sources — Japanese statutes from the e-Gov API, National
          Tax Agency guidance and circulars, the Internal Revenue Code, IRS publications, and the
          US–Japan Convention. Every term in the dictionary cites the text it comes from.
        </span>
        <span>
          Rate tables are 2025 figures. Projecting later years reuses them, since inventing
          brackets would be worse than reusing known ones.
        </span>
      </footer>

      {showGlossary && <Glossary onClose={() => setShowGlossary(false)} />}
    </div>
  );
}
