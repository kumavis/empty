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
const STOCK_H = 58;   // per stock panel
const GAP = 30;       // flow panel to first stock panel
const SUBGAP = 22;    // between the two stock panels

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
    cashJapan: y.cash.cashJapan / fx,
    cashUs: y.cash.cashUs / fx,
    remitted: y.cash.fundedFromRemittance / fx,
    phase: y.phase,
  }));

  if (rows.length === 0) return null;

  const maxFlow = Math.max(...rows.map((r) => r.japan + r.us + r.living), 1);
  /**
   * The two pools are the same unit but wildly different magnitudes — an
   * accumulating foreign pool can be twenty times the Japanese one, which
   * flattens the Japanese line onto the axis and hides the moment it runs dry.
   * A second y-axis on one frame would be the wrong fix; these are small
   * multiples instead, each with its own scale, stacked so both still align
   * vertically with the flow panel and with each other.
   */
  const maxJp = Math.max(...rows.map((r) => r.cashJapan), 1);
  const maxUs = Math.max(...rows.map((r) => r.cashUs), 1);

  const MIN_W = Math.max(460, rows.length * 46 + PAD.left + PAD.right);
  const W = Math.max(MIN_W, measured || MIN_W);
  const plotW = W - PAD.left - PAD.right;
  const H = PAD.top + FLOW_H + GAP + STOCK_H * 2 + SUBGAP + PAD.bottom;

  const bandW = plotW / rows.length;
  const barW = Math.min(38, bandW * 0.56);
  const xOf = (i: number) => PAD.left + bandW * (i + 0.5);

  const flowY = (v: number) => PAD.top + FLOW_H - (v / maxFlow) * FLOW_H;
  const jpTop = PAD.top + FLOW_H + GAP;
  const usTop = jpTop + STOCK_H + SUBGAP;
  const jpY = (v: number) => jpTop + STOCK_H - (v / maxJp) * STOCK_H;
  const usY = (v: number) => usTop + STOCK_H - (v / maxUs) * STOCK_H;

  const ticks = [0, 0.5, 1].map((f) => f * maxFlow);
  const nprEndYear = Number(nprEndsOn.slice(0, 4));
  const boundaryIdx = rows.findIndex((r) => r.year === nprEndYear);

  /**
   * Two lines rather than two stacked areas: the pools are alternatives, not
   * components of a total, and stacking them would imply a sum nobody spends.
   * Hue follows jurisdiction, exactly as it does in the flow panel above — so
   * vermilion is Japan and blue is the US throughout the page.
   */
  const points = (pick: (r: (typeof rows)[number]) => number, y: (v: number) => number) =>
    rows.map((r, i) => `${xOf(i)},${y(pick(r))}`).join(' ');
  const areaPath = (pick: (r: (typeof rows)[number]) => number, y: (v: number) => number) =>
    `M ${xOf(0)} ${y(pick(rows[0]))} ` +
    rows.map((r, i) => `L ${xOf(i)} ${y(pick(r))}`).join(' ') +
    ` L ${xOf(rows.length - 1)} ${y(0)} L ${xOf(0)} ${y(0)} Z`;

  return (
    <div className="chart">
      <div className="chart__head">
        <div>
          <h2>Where the money goes, and what is left on each side</h2>
          <p className="muted small">
            Living costs and Japanese tax are paid from cash in Japan; US tax from cash abroad.
            Only when the Japanese side runs dry does anything have to be remitted, and that is
            when the ordering rule starts to bite. The two lower panels use separate scales.
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
          <span className="swatch swatch--line-jp" />
          Cash in Japan
        </span>
        <span className="legend__item">
          <span className="swatch swatch--line-us" />
          Cash in US
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
                <th scope="col">Cash in US</th>
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
                  <td>{usd(r.cashJapan)}</td>
                  <td>{usd(r.cashUs)}</td>
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
            aria-label={`Annual tax and living costs by year, with cash held in Japan and in the US. Cash in Japan runs out in ${
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

            {/* Cash in Japan — its own panel and scale */}
            <path d={areaPath((r) => r.cashJapan, jpY)} className="cash-area cash-area--jp" />
            <polyline points={points((r) => r.cashJapan, jpY)} className="cash-line cash-line--jp" />
            <text x={PAD.left} y={jpTop - 5} className="panel-label">Cash in Japan</text>
            <text x={PAD.left - 8} y={jpTop + 8} className="axis" textAnchor="end">
              {usdCompact(maxJp)}
            </text>
            <line x1={PAD.left} x2={W - PAD.right} y1={jpY(0)} y2={jpY(0)} className="grid grid--base" />
            <text x={PAD.left - 8} y={jpY(0) + 4} className="axis" textAnchor="end">$0</text>

            {/* Cash in the US — separate scale, because it can be 20x larger */}
            <path d={areaPath((r) => r.cashUs, usY)} className="cash-area cash-area--us" />
            <polyline points={points((r) => r.cashUs, usY)} className="cash-line cash-line--us" />
            <text x={PAD.left} y={usTop - 5} className="panel-label">Cash in US · unremitted</text>
            <text x={PAD.left - 8} y={usTop + 8} className="axis" textAnchor="end">
              {usdCompact(maxUs)}
            </text>
            <line x1={PAD.left} x2={W - PAD.right} y1={usY(0)} y2={usY(0)} className="grid grid--base" />
            <text x={PAD.left - 8} y={usY(0) + 4} className="axis" textAnchor="end">$0</text>
            {result.savingsExhaustedIn !== null && (() => {
              const i = rows.findIndex((r) => r.year === result.savingsExhaustedIn);
              if (i < 0) return null;
              return (
                <g>
                  <circle cx={xOf(i)} cy={jpY(rows[i].cashJapan)} r={4.5} className="endpoint" />
                  <text x={xOf(i) + 8} y={jpY(rows[i].cashJapan) - 6} className="endpoint-label">
                    cash spent
                  </text>
                </g>
              );
            })()}
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
              <span><i style={{ background: 'var(--series-jp)' }} />Cash in Japan {usd(rows[hover].cashJapan)}</span>
              <span><i style={{ background: 'var(--series-us)' }} />Cash in US {usd(rows[hover].cashUs)}</span>
              {rows[hover].remitted > 0 && <span>Remitted {usd(rows[hover].remitted)}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
