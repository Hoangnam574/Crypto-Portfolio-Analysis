/**
 * Golden test: compare TypeScript replay results against Python oracle output.
 * Compares each asset position to 1e-20 precision.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Decimal } from '@/domain/money';
import { sortTrades, replay } from '@/domain/ledger';
import { buildPortfolio } from '@/domain/portfolio';
import { validateAndParse } from '@/import/validate';
import type { PriceEntry, Symbol } from '@/domain/types';
import { parse } from 'csv-parse/sync';

const TOLERANCE = new Decimal('1e-20');

function assertClose(actual: string, expected: string, label: string) {
  const a = new Decimal(actual);
  const e = new Decimal(expected);
  const diff = a.minus(e).abs();
  if (diff.gt(TOLERANCE)) {
    throw new Error(
      `${label}: expected ${expected} but got ${actual} (diff: ${diff.toFixed()})`,
    );
  }
}

describe('Golden test — TS vs Python oracle', () => {
  const goldenPath = join(__dirname, 'fixtures', 'golden.json');
  const tradesPath = join(__dirname, '..', 'data', 'trades.csv');
  const pricesPath = join(__dirname, '..', 'data', 'prices.csv');

  let golden: any;

  try {
    golden = JSON.parse(readFileSync(goldenPath, 'utf-8'));
  } catch {
    console.warn('Golden file not found. Run: python scripts/oracle.py');
  }

  if (!golden) {
    it.skip('Golden file not available', () => {});
    return;
  }

  it('validates and parses 200 trades successfully', () => {
    const content = readFileSync(tradesPath, 'utf-8');
    const result = validateAndParse(content, content.length);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.trades.length).toBe(200);
    }
  });

  it('matches oracle positions for each asset', () => {
    const content = readFileSync(tradesPath, 'utf-8');
    const result = validateAndParse(content, content.length);
    if (!result.ok) throw new Error('Validation failed');

    const sorted = sortTrades(result.trades);
    const { positions } = replay(sorted);

    for (const [symbol, expected] of Object.entries(golden.positions) as [string, any][]) {
      const actual = positions.get(symbol as Symbol);
      expect(actual).toBeDefined();
      if (!actual) continue;

      assertClose(actual.quantity, expected.quantity, `${symbol}.quantity`);
      assertClose(actual.avg_cost, expected.avg_cost, `${symbol}.avg_cost`);
      assertClose(actual.total_cost, expected.total_cost, `${symbol}.total_cost`);
      assertClose(actual.realized_pnl, expected.realized_pnl, `${symbol}.realized_pnl`);
      assertClose(actual.total_fees, expected.total_fees, `${symbol}.total_fees`);
    }
  });

  it('matches oracle portfolio totals', () => {
    const content = readFileSync(tradesPath, 'utf-8');
    const result = validateAndParse(content, content.length);
    if (!result.ok) throw new Error('Validation failed');

    const sorted = sortTrades(result.trades);
    const { positions } = replay(sorted);

    // Load prices
    const pricesContent = readFileSync(pricesPath, 'utf-8');
    const priceRecords = parse(pricesContent, { columns: true, skip_empty_lines: true, trim: true, bom: true });
    const priceEntries: PriceEntry[] = priceRecords.map((r: any) => ({
      symbol: r.symbol as Symbol,
      price_usd: r.price_usd,
      as_of: r.as_of,
    }));

    const portfolio = buildPortfolio(positions, priceEntries);
    const goldenPortfolio = golden.portfolio;

    if (goldenPortfolio.total_value !== null) {
      assertClose(portfolio.total_value!, goldenPortfolio.total_value, 'total_value');
    }
    assertClose(portfolio.total_cost_basis, goldenPortfolio.total_cost_basis, 'total_cost_basis');
    assertClose(portfolio.total_realized_pnl, goldenPortfolio.total_realized_pnl, 'total_realized_pnl');
    if (goldenPortfolio.total_unrealized_pnl !== null) {
      assertClose(portfolio.total_unrealized_pnl!, goldenPortfolio.total_unrealized_pnl, 'total_unrealized_pnl');
    }
    assertClose(portfolio.total_fees, goldenPortfolio.total_fees, 'total_fees');
  });

  it('matches all 200 per-trade snapshots', () => {
    const content = readFileSync(tradesPath, 'utf-8');
    const result = validateAndParse(content, content.length);
    if (!result.ok) throw new Error('Validation failed');

    const sorted = sortTrades(result.trades);
    const { snapshots } = replay(sorted);

    expect(snapshots.length).toBe(golden.snapshots.length);

    for (let i = 0; i < snapshots.length; i++) {
      const actual = snapshots[i];
      const expected = golden.snapshots[i];
      const label = `snapshot[${i}] (${actual.trade_id})`;

      expect(actual.trade_id).toBe(expected.trade_id);
      assertClose(actual.position_qty, expected.position_qty, `${label}.position_qty`);
      assertClose(actual.avg_cost, expected.avg_cost, `${label}.avg_cost`);
      assertClose(actual.realized_pnl, expected.realized_pnl, `${label}.realized_pnl`);
    }
  });
});
