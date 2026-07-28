/**
 * Where the money goes, and how long the savings last.
 *
 * TWO panels, not one chart with two y-scales. Annual outflows (a flow, in
 * dollars per year) and the savings balance (a stock, in dollars) are different
 * measures; overlaying them on a shared frame with two axes would let the
 * reader infer crossings that mean nothing. They share the x-axis instead, so
 * the year the savings area hits zero lines up vertically with the year
 * remittances appear in the stack — which is the whole point of the pairing.
 *
 * Palette is validated: scripts/validate_palette.js passes all six checks in
 * both modes for these steps. Series identity is carried by legend AND direct
 * labels on the stack, never by colour alone.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { usd, usdCompact } from '../domain/money';
import type { ScenarioResult } from '../domain/types';

interface Props {
  result: ScenarioResult;
  fx: number;
  nprEndsOn: string;
}

const SERIES = [
  { key: 'japan', label: 'Japan tax', varName: '--series-jp' },
  { key: 'us', label: 'US tax', varName: '--series-us' },
  { key: 'living', label: 'Living cost', varName: '--series-live' },
] as const;

const PAD = { top: 28, right: 16, bottom: 26, left: 56 };
const FLOW_H = 190;
const STOCK_H = 96;
const GAP = 34;

export function Chart({ result, fx, nprEndsOn }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const clipId = useId();

  /**
   * The chart fills whatever width it is given rather than scaling a fixed
   * viewBox, so labels and strokes keep their intended size at every container
   * width instead of being stretched with the geometry.
   */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setMeasured(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = result.years.map((y) => ({
    year: y.year,
    japan: y.japan.total / fx,
    us: y.us.total,
    living: y.cash.livingCost / fx,
    savings: y.cash.savingsRemaining / fx,
    remitted: y.cash.fundedFromRemittance / fx,
    phase: y.phase,
  }));

  if (rows.length === 0) return null;

  const maxFlow = Math.max(...rows.map((r) => r.japan + r.us + r.living), 1);
  const maxStock = Math.max(...rows.map((r) => r.savings), 1);

  const MIN_W = Math.max(460, rows.length * 46 + PAD.left + PAD.right);
  const W = Math.max(MIN_W, measured || MIN_W);
  const plotW = W - PAD.left - PAD.right;
  const H = PAD.top + FLOW_H + GAP + STOCK_H + PAD.bottom;

  const bandW = plotW / rows.length;
  const barW = Math.min(38, bandW * 0.56);
  const xOf = (i: number) => PAD.left + bandW * (i + 0.5);

  const flowY = (v: number) => PAD.top + FLOW_H - (v / maxFlow) * FLOW_H;
  const stockTop = PAD.top + FLOW_H + GAP;
  const stockY = (v: number) => stockTop + STOCK_H - (v / maxStock) * STOCK_H;

  const ticks = [0, 0.5, 1].map((f) => f * maxFlow);
  const nprEndYear = Number(nprEndsOn.slice(0, 4));
  const boundaryIdx = rows.findIndex((r) => r.year === nprEndYear);

  // The savings area, closed to the baseline.
  const savingsPath =
    `M ${xOf(0)} ${stockY(rows[0].savings)} ` +
    rows.map((r, i) => `L ${xOf(i)} ${stockY(r.savings)}`).join(' ') +
    ` L ${xOf(rows.length - 1)} ${stockY(0)} L ${xOf(0)} ${stockY(0)} Z`;

  return (
    <div className="chart">
      <div className="chart__head">
        <div>
          <h2>Where the money goes, and how long the savings last</h2>
          <p className="muted small">
            Living costs come first from salary already in Japan, then from cash already there
            — pre-positioned savings plus any accumulated surplus — and only then by remitting,
            which is when the ordering rule starts to bite.
          </p>
        </div>
        <button className="btn btn--ghost" onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      <div className="legend">
        {SERIES.map((s) => (
          <span key={s.key} className="legend__item">
            <span className="swatch" style={{ background: `var(${s.varName})` }} />
            {s.label}
          </span>
        ))}
        <span className="legend__item">
          <span className="swatch swatch--savings" />
          Cash in Japan
        </span>
      </div>

      {showTable ? (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">Japan tax</th>
                <th scope="col">US tax</th>
                <th scope="col">Living cost</th>
                <th scope="col">Remitted</th>
                <th scope="col">Cash in Japan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year}>
                  <td>{r.year}</td>
                  <td>{usd(r.japan)}</td>
                  <td>{usd(r.us)}</td>
                  <td>{usd(r.living)}</td>
                  <td>{r.remitted > 0 ? usd(r.remitted) : '—'}</td>
                  <td>{usd(r.savings)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chartwrap" ref={wrapRef}>
          <svg
            width={W}
            height={H}
            role="img"
            aria-label={`Annual tax and living costs by year, with cash available in Japan. That cash runs out in ${
              result.savingsExhaustedIn ?? 'no year within the projection'
            }.`}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <clipPath id={clipId}>
                <rect x={PAD.left} y={PAD.top} width={plotW} height={FLOW_H} />
              </clipPath>
            </defs>

            {/* Recessive grid */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left} x2={W - PAD.right} y1={flowY(t)} y2={flowY(t)}
                  className="grid"
                />
                <text x={PAD.left - 8} y={flowY(t) + 4} className="axis" textAnchor="end">
                  {usdCompact(t)}
                </text>
              </g>
            ))}

            {/* The statutory boundary, marked once and labelled */}
            {boundaryIdx >= 0 && (
              <g clipPath={`url(#${clipId})`}>
                <line
                  x1={xOf(boundaryIdx) - bandW / 2}
                  x2={xOf(boundaryIdx) - bandW / 2}
                  y1={PAD.top}
                  y2={PAD.top + FLOW_H}
                  className="boundary"
                />
              </g>
            )}
            {/* Stacked outflows. 2px surface gap between segments. */}
            {rows.map((r, i) => {
              const segs = [
                { key: 'japan', v: r.japan, varName: '--series-jp' },
                { key: 'us', v: r.us, varName: '--series-us' },
                { key: 'living', v: r.living, varName: '--series-live' },
              ];
              let acc = 0;
              return (
                <g
                  key={r.year}
                  onMouseEnter={() => setHover(i)}
                  className={hover !== null && hover !== i ? 'dim' : ''}
                >
                  <rect
                    x={xOf(i) - bandW / 2} y={PAD.top} width={bandW} height={FLOW_H}
                    fill="transparent"
                  />
                  {segs.map((s) => {
                    const y0 = acc;
                    acc += s.v;
                    const top = flowY(acc);
                    const h = Math.max(0, flowY(y0) - top - 2);
                    return (
                      <rect
                        key={s.key}
                        x={xOf(i) - barW / 2}
                        y={top}
                        width={barW}
                        height={h}
                        rx={2}
                        fill={`var(${s.varName})`}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Savings stock, its own panel and its own scale */}
            <path d={savingsPath} className="savings-area" />
            <polyline
              points={rows.map((r, i) => `${xOf(i)},${stockY(r.savings)}`).join(' ')}
              className="savings-line"
            />
            {result.savingsExhaustedIn !== null && (() => {
              const i = rows.findIndex((r) => r.year === result.savingsExhaustedIn);
              if (i < 0) return null;
              return (
                <g>
                  <circle cx={xOf(i)} cy={stockY(rows[i].savings)} r={4.5} className="endpoint" />
                  <text x={xOf(i) + 8} y={stockY(rows[i].savings) - 6} className="endpoint-label">
                    cash spent
                  </text>
                </g>
              );
            })()}
            <line
              x1={PAD.left} x2={W - PAD.right} y1={stockY(0)} y2={stockY(0)}
              className="grid grid--base"
            />
            <text x={PAD.left - 8} y={stockTop + 4} className="axis" textAnchor="end">
              {usdCompact(maxStock)}
            </text>
            <text x={PAD.left - 8} y={stockY(0) + 4} className="axis" textAnchor="end">
              $0
            </text>

            {/* Drawn last so no bar paints over it, and sat above the plot. */}
            {boundaryIdx >= 0 && (
              <text
                x={xOf(boundaryIdx) - bandW / 2 + (boundaryIdx > rows.length - 2 ? -5 : 5)}
                y={PAD.top - 9}
                textAnchor={boundaryIdx > rows.length - 2 ? 'end' : 'start'}
                className="boundary-label"
              >
                ← sheltered · worldwide tax →
              </text>
            )}

            {/* Shared x-axis */}
            {rows.map((r, i) => (
              <text key={r.year} x={xOf(i)} y={H - 8} className="axis" textAnchor="middle">
                {r.year}
              </text>
            ))}
          </svg>

          {hover !== null && (
            <div
              className="tip"
              style={{
                left: `${(xOf(hover) / W) * 100}%`,
                transform: hover > rows.length / 2 ? 'translateX(-100%)' : 'translateX(8px)',
              }}
            >
              <strong>{rows[hover].year}</strong>
              <span><i style={{ background: 'var(--series-jp)' }} />Japan tax {usd(rows[hover].japan)}</span>
              <span><i style={{ background: 'var(--series-us)' }} />US tax {usd(rows[hover].us)}</span>
              <span><i style={{ background: 'var(--series-live)' }} />Living {usd(rows[hover].living)}</span>
              <span className="tip__rule" />
              <span>Cash in Japan {usd(rows[hover].savings)}</span>
              {rows[hover].remitted > 0 && <span>Remitted {usd(rows[hover].remitted)}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
