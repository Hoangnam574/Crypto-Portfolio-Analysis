/**
 * money.ts — Decimal configuration and formatting helpers.
 *
 * Rules:
 * - All domain math uses Decimal with precision 40.
 * - Numbers enter the domain as strings, never as JS `number`.
 * - Rounding only happens at display time.
 * - JSON serialization uses strings.
 */
import Decimal from 'decimal.js';

// Configure global precision — must be called before any Decimal usage
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

/** Parse a string to Decimal. Rejects NaN, Infinity, and scientific notation. */
export function parseDecimal(raw: string, label: string): Decimal {
  const trimmed = raw.trim();

  // Reject scientific notation (1e-5, 1E+3, etc.)
  if (/[eE]/.test(trimmed)) {
    throw new Error(`${label}: scientific notation not allowed ("${trimmed}")`);
  }

  // Reject empty, NaN, Infinity
  if (trimmed === '' || trimmed.toLowerCase() === 'nan' || trimmed.toLowerCase().includes('infinity')) {
    throw new Error(`${label}: invalid number ("${trimmed}")`);
  }

  try {
    return new Decimal(trimmed);
  } catch {
    throw new Error(`${label}: cannot parse as decimal ("${trimmed}")`);
  }
}

/** Format Decimal as USD string for display (2 decimal places) */
export function formatUSD(value: Decimal): string {
  return value.toFixed(2);
}

/**
 * Format price: if < $1, show up to 8 significant digits.
 * Otherwise show 2 decimal places.
 */
export function formatPrice(value: Decimal): string {
  if (value.abs().lt(1)) {
    return value.toSignificantDigits(8).toFixed();
  }
  return value.toFixed(2);
}

/** Format quantity: up to 8 decimal places, strip trailing zeros */
export function formatQuantity(value: Decimal): string {
  return value.toDecimalPlaces(8).toFixed();
}

/**
 * Format P&L percentage: returns string like "+12.34%" or "−5.67%"
 * Returns "—" when cost basis is zero (can't compute %).
 */
export function formatPnlPct(pnl: Decimal, costBasis: Decimal): string {
  if (costBasis.isZero()) return '—';
  const pct = pnl.div(costBasis).mul(100);
  const sign = pct.isPositive() ? '+' : '−';
  return `${sign}${pct.abs().toFixed(2)}%`;
}

/** Zero constant for comparisons */
export const ZERO = new Decimal(0);
