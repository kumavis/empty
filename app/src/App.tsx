import { useMemo, useState } from 'react';
import { Glossary } from './components/Glossary';
import { T } from './components/Term';
import { runScenario } from './domain/engine';
import { nonPermanentResidentEnd } from './domain/phases';
import type { Scenario } from './domain/types';

const YEN = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const yen = (n: number) => `¥${YEN.format(Math.round(n))}`;
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

export default function App() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT);
  const [showGlossary, setShowGlossary] = useState(false);

  const result = useMemo(() => runScenario(scenario), [scenario]);

  /** The counterfactual that isolates the value of remittance discipline. */
  const remittingResult = useMemo(
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

  const nprEnd = nonPermanentResidentEnd(scenario.residencyStart, scenario.priorPresence);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>US → Japan tax calculator</h1>
          <p className="muted">
            Interactive model of the three <T id="resident" /> phases, the{' '}
            <T id="remittance-basis" />, and the US <T id="foreign-tax-credit" />.
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowGlossary(true)}>
          Term dictionary
        </button>
      </header>

      <div className="banner">
        <strong>Research, not tax advice.</strong> Figures rest on the open questions flagged in{' '}
        <code>docs/</code> — notably Japanese <T id="inhabitant-tax" /> rules and the capital gain
        rate differential adjustment. Treat output as directional.
      </div>

      <div className="layout">
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
              A question of fact, not of immigration status — usually arrival day, but not the
              date of any visa or residence card. Worldwide taxation begins{' '}
              <strong>{nprEnd}</strong>, counting from the day after entry per NTA circular
              2-4の3.
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
              Leaving in December rather than January avoids a year of{' '}
              <T id="inhabitant-tax" />.
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
              <option value="table2">Permanent Resident / Spouse — Appended Table 2</option>
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
            <span>Pre-positioned funds (before residency)</span>
            <input
              type="number"
              step={1_000_000}
              value={scenario.prePositionedFunds}
              onChange={(e) => set({ prePositionedFunds: Number(e.target.value) })}
            />
            <small>Transfers before residency fall outside the remittance regime entirely.</small>
          </label>

          <label className="field">
            <span>JPY per USD</span>
            <input
              type="number"
              value={scenario.fxJpyPerUsd}
              onChange={(e) => set({ fxJpyPerUsd: Number(e.target.value) || 1 })}
            />
          </label>

          <h3>Annual remittance to Japan</h3>
          <p className="muted small">
            The lever. Exposure is <code>min(remittance − Japan-source income, foreign income)</code>.
          </p>
          {scenario.income.map((y) => (
            <label key={y.year} className="field field--inline">
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

        <main className="results">
          <section className="card">
            <h2>Phase timeline</h2>
            <div className="timeline">
              {result.years.map((y) => (
                <div key={y.year} className={`tl tl--${y.phase}`} title={y.phase}>
                  <span className="tl__year">{y.year}</span>
                  {y.phaseChangedOn && <span className="tl__flag">→ {y.phaseChangedOn}</span>}
                </div>
              ))}
            </div>
            <p className="legend">
              <span className="legend__item">
                <span className="key key--nonResident" />
                <T id="non-resident" />
              </span>
              <span className="legend__item">
                <span className="key key--nonPermanentResident" />
                <T id="non-permanent-resident" />
              </span>
              <span className="legend__item">
                <span className="key key--permanentResident" />
                <T id="permanent-resident-tax" />
              </span>
            </p>
          </section>

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
            <h2>Remittance discipline is worth…</h2>
            <div className="compare">
              <div>
                <span className="muted">This scenario</span>
                <strong>{yen(result.totals.combined)}</strong>
              </div>
              <div>
                <span className="muted">Remitting ¥30m every year</span>
                <strong>{yen(remittingResult.totals.combined)}</strong>
              </div>
              <div className="compare__delta">
                <span className="muted">Difference</span>
                <strong>{yen(remittingResult.totals.combined - result.totals.combined)}</strong>
              </div>
            </div>
            <p className="muted small">
              Smaller than the Japanese tax avoided, because <T id="section-865-sourcing" /> leaves
              an unremitted gain US-source and fully US-taxable. The shelter saves Japanese tax,
              not US tax.
            </p>
          </section>

          <section className="card">
            <h2>Year by year</h2>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Phase</th>
                    <th>Deemed remitted</th>
                    <th>Japan tax</th>
                    <th>US tax</th>
                    <th>Combined</th>
                    <th>Effective</th>
                  </tr>
                </thead>
                <tbody>
                  {result.years.map((y) => (
                    <tr key={y.year}>
                      <td>{y.year}</td>
                      <td>
                        <span className={`pill pill--${y.phase}`}>
                          {y.phase === 'nonPermanentResident'
                            ? 'Non-permanent'
                            : y.phase === 'permanentResident'
                              ? 'Worldwide'
                              : 'Non-resident'}
                        </span>
                      </td>
                      <td>{y.japan.deemedRemitted ? yen(y.japan.deemedRemitted) : '—'}</td>
                      <td>{yen(y.japan.total)}</td>
                      <td>{yen(y.us.total * scenario.fxJpyPerUsd)}</td>
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
                    <td>{yen(result.totals.japan)}</td>
                    <td>{yen(result.totals.us)}</td>
                    <td>
                      <strong>{yen(result.totals.combined)}</strong>
                    </td>
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
        </main>
      </div>

      {showGlossary && <Glossary onClose={() => setShowGlossary(false)} />}
    </div>
  );
}
