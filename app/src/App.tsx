import { useMemo, useState } from 'react';
import { Glossary } from './components/Glossary';
import { T } from './components/Term';
import { runScenario } from './domain/engine';
import type { Scenario } from './domain/types';

const YEN = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const yen = (n: number) => `¥${YEN.format(Math.round(n))}`;
const compact = (n: number) => {
  const m = Math.round(n / 100_000) / 10;
  return `¥${m}m`;
};
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/**
 * A worked default: a high earner arriving in April 2026 with a pre-arrival
 * portfolio, realising a gain in the middle of the non-permanent resident phase
 * and again after it ends. Chosen so the phase boundary is visible in the output.
 */
const DEFAULT: Scenario = {
  name: 'Base case',
  residencyStart: '2026-04-01',
  holdsJapaneseNationality: false,
  priorPresence: [],
  visaPeriods: [{ from: '2026-04-01', table: 'table1' }],
  prePositionedFunds: 20_000_000,
  lots: [
    { id: 'pre', label: 'Pre-arrival portfolio', acquired: '2019-01-01', basis: 60_000_000, units: 1000, heldAbroad: true },
    { id: 'post', label: 'Bought after arrival', acquired: '2027-06-01', basis: 10_000_000, units: 200, heldAbroad: true },
  ],
  disposals: [
    { id: 'd1', lotId: 'pre', date: '2028-05-01', units: 200, proceeds: 20_000_000 },
    { id: 'd2', lotId: 'pre', date: '2032-05-01', units: 200, proceeds: 22_000_000 },
  ],
  income: [2026, 2027, 2028, 2029, 2030, 2031, 2032].map((year) => ({
    year,
    salaryForJapanWork: 18_000_000,
    salaryForForeignWork: 0,
    salaryPaidInJapan: 18_000_000,
    foreignInvestmentIncomeAbroad: 1_000_000,
    foreignInvestmentIncomePaidInJapan: 0,
    remittanceToJapan: 0,
  })),
  elections: { claimFeie: false, ftcBasis: 'accrued', claimTreatyResourcing: true },
  filingStatus: 'single',
  fxJpyPerUsd: 150,
};

const PHASE_LABEL: Record<string, string> = {
  nonResident: 'Non-resident',
  nonPermanentResident: 'Non-permanent',
  permanentResident: 'Worldwide',
};

export default function App() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT);
  const [showGlossary, setShowGlossary] = useState(false);

  const result = useMemo(() => runScenario(scenario), [scenario]);

  /** The counterfactual that isolates the value of remittance discipline. */
  const remitting = useMemo(
    () =>
      runScenario({
        ...scenario,
        income: scenario.income.map((y) => ({ ...y, remittanceToJapan: 30_000_000 })),
      }),
    [scenario],
  );

  const set = (patch: Partial<Scenario>) => setScenario((s) => ({ ...s, ...patch }));
  const setIncome = (year: number, patch: Partial<Scenario['income'][number]>) =>
    setScenario((s) => ({
      ...s,
      income: s.income.map((y) => (y.year === year ? { ...y, ...patch } : y)),
    }));

  const fx = scenario.fxJpyPerUsd;
  const avgRate =
    result.years.length > 0
      ? result.years.reduce((s, y) => s + y.effectiveRate, 0) / result.years.length
      : 0;

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">Interactive model · research, not advice</p>
          <h1>Moving from the US to Japan: what the tax actually costs</h1>
          <p className="header__sub">
            Models the three <T id="resident" /> phases, the{' '}
            <T id="remittance-basis" /> that shelters foreign income during the second, and the
            US <T id="foreign-tax-credit" /> that decides how much of the shelter survives.
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowGlossary(true)}>
          Term dictionary
        </button>
      </header>

      <div className="banner">
        <span className="banner__mark" aria-hidden="true">※</span>
        <span>
          <strong>Research, not tax advice.</strong> Figures rest on open questions recorded
          alongside the model — principally Japanese <T id="inhabitant-tax" /> rules and the
          capital gain rate differential adjustment. A transition year is not apportioned. Treat
          the output as directional, and the reasoning as the deliverable.
        </span>
      </div>

      {/* Summary before detail: the answer, then how it was reached. */}
      <div className="tiles">
        <div className="tile">
          <span className="tile__label">Combined tax</span>
          <span className="tile__value">{compact(result.totals.combined)}</span>
          <span className="tile__note">over {result.years.length} years</span>
        </div>
        <div className="tile tile--jp">
          <span className="tile__label">Japan</span>
          <span className="tile__value">{compact(result.totals.japan)}</span>
          <span className="tile__note">{pct(result.totals.japan / result.totals.combined)} of total</span>
        </div>
        <div className="tile tile--us">
          <span className="tile__label">United States</span>
          <span className="tile__value">{compact(result.totals.us)}</span>
          <span className="tile__note">after foreign tax credit</span>
        </div>
        <div className="tile">
          <span className="tile__label">Worldwide tax from</span>
          <span className="tile__value">{result.nprEndsOn}</span>
          <span className="tile__note">shelter ends · avg rate {pct(avgRate)}</span>
        </div>
      </div>

      <section className="card">
        <h2>The boundary</h2>
        <div className="tlwrap">
        <div className="tl">
          {result.years.map((y) => (
            <div
              key={y.year}
              className={`tl__seg tl__seg--${y.phase} ${y.phaseChangedOn ? 'tl__seg--boundary' : ''}`}
            >
              <span className="tl__yr">{y.year}</span>
              {y.phaseChangedOn && <span className="tl__mark">{y.phaseChangedOn}</span>}
              <span className="tl__amt">{compact(y.combined)}</span>
            </div>
          ))}
        </div>
        </div>
        <div className="legend">
          <span className="legend__item">
            <span className="swatch swatch--nonPermanentResident" />
            <T id="non-permanent-resident" /> — foreign income shelterable
          </span>
          <span className="legend__item">
            <span className="swatch swatch--permanentResident" />
            <T id="permanent-resident-tax" /> — worldwide
          </span>
        </div>
      </section>

      <div className="body">
        <aside className="panel">
          <h2>Scenario</h2>

          <label className="field">
            <span>
              Date <T id="domicile-jp" /> attaches
            </span>
            <input
              type="date"
              value={scenario.residencyStart}
              onChange={(e) => set({ residencyStart: e.target.value })}
            />
            <small>
              A question of fact, not of immigration status — usually arrival day, but never the
              date on a visa or residence card.
            </small>
          </label>

          <label className="field">
            <span>Planned departure</span>
            <input
              type="date"
              value={scenario.departure ?? ''}
              onChange={(e) => set({ departure: e.target.value || undefined })}
            />
            <small>
              Leaving in December rather than January avoids a year of <T id="inhabitant-tax" />.
            </small>
          </label>

          <label className="field">
            <span>Immigration status</span>
            <select
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
            <small>
              <T id="table-1-status" /> time never counts toward the <T id="exit-tax" />.
            </small>
          </label>

          <label className="field field--check">
            <input
              type="checkbox"
              checked={scenario.holdsJapaneseNationality}
              onChange={(e) => set({ holdsJapaneseNationality: e.target.checked })}
            />
            <span>Holds Japanese nationality</span>
          </label>

          <label className="field field--check">
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

          <label className="field">
            <span>Pre-positioned funds</span>
            <input
              type="number"
              step={1_000_000}
              value={scenario.prePositionedFunds}
              onChange={(e) => set({ prePositionedFunds: Number(e.target.value) })}
            />
            <small>Moved before residency, so outside the remittance regime entirely.</small>
          </label>

          <label className="field">
            <span>JPY per USD</span>
            <input
              type="number"
              value={fx}
              onChange={(e) => set({ fxJpyPerUsd: Number(e.target.value) || 1 })}
            />
          </label>

          <h3>Remittance by year</h3>
          <p className="muted small" style={{ marginBottom: 10 }}>
            The lever. Exposure is the remittance less Japan-source income, capped at the year's
            foreign income.
          </p>
          {scenario.income.map((y) => (
            <label key={y.year} className="field--inline">
              <span>{y.year}</span>
              <input
                type="number"
                step={1_000_000}
                value={y.remittanceToJapan}
                onChange={(e) => setIncome(y.year, { remittanceToJapan: Number(e.target.value) })}
              />
            </label>
          ))}
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
            <h2>What remittance discipline is worth</h2>
            <div className="compare">
              <div>
                <span className="compare__k">This scenario</span>
                <span className="compare__v">{yen(result.totals.combined)}</span>
              </div>
              <div>
                <span className="compare__k">Remitting ¥30m yearly</span>
                <span className="compare__v">{yen(remitting.totals.combined)}</span>
              </div>
              <div className="compare__delta">
                <span className="compare__k">Difference</span>
                <span className="compare__v">
                  {yen(remitting.totals.combined - result.totals.combined)}
                </span>
              </div>
            </div>
            <p className="muted small">
              Smaller than the Japanese tax avoided, because <T id="section-865-sourcing" />{' '}
              leaves an unremitted gain US-source and fully US-taxable. The shelter saves Japanese
              tax, not US tax — the correction that most English-language writing on this misses,
              because it is written for non-Americans.
            </p>
          </section>

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
                    <th scope="col">Effective</th>
                  </tr>
                </thead>
                <tbody>
                  {result.years.map((y) => (
                    <tr key={y.year}>
                      <td>{y.year}</td>
                      <td>
                        <span className={`pill pill--${y.phase}`}>{PHASE_LABEL[y.phase]}</span>
                      </td>
                      <td>{y.japan.deemedRemitted ? yen(y.japan.deemedRemitted) : '—'}</td>
                      <td className="num--jp">{yen(y.japan.total)}</td>
                      <td className="num--us">{yen(y.us.total * fx)}</td>
                      <td>
                        <strong>{yen(y.combined)}</strong>
                      </td>
                      <td>{pct(y.effectiveRate)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total</td>
                    <td className="num--jp">{yen(result.totals.japan)}</td>
                    <td className="num--us">{yen(result.totals.us)}</td>
                    <td>{yen(result.totals.combined)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="card">
            <h2>What the model did</h2>
            {result.years
              .filter((y) => y.notes.length > 0)
              .map((y) => (
                <div key={y.year} className="notes">
                  <h4>{y.year}</h4>
                  <ul>
                    {y.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              ))}
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
