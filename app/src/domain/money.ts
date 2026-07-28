/**
 * Currency handling.
 *
 * The user thinks in dollars; the Japanese statute thinks in yen. Brackets,
 * the ¥100m exit tax threshold and the rounding rules are all denominated in
 * yen, so the engine computes in yen and only the presentation layer converts.
 * Displaying a yen figure as the primary number would make the tool harder to
 * reason about for someone planning from the US side, so USD leads and the yen
 * equivalent rides alongside.
 */

const USD_FMT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const JPY_FMT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const usd = (n: number): string => USD_FMT.format(Math.round(n));

export const jpy = (n: number): string => `¥${JPY_FMT.format(Math.round(n))}`;

/** Compact USD for tiles and axis ticks: $1.2M, $840k, $0. */
export function usdCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

/** Convert a yen amount computed by the engine into display dollars. */
export const toUsd = (yen: number, fxJpyPerUsd: number): number => yen / fxJpyPerUsd;

/** Convert a dollar input into the yen the engine works in. */
export const toJpy = (dollars: number, fxJpyPerUsd: number): number => dollars * fxJpyPerUsd;
