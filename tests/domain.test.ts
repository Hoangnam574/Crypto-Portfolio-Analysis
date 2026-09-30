/**
 * Domain unit tests for money.ts, ledger.ts, portfolio.ts.
 *
 * Includes specific numeric tests per IMPLEMENTATION_PLAN M9:
 * - Multiple BUYs at different prices
 * - BUY fee into average cost
 * - Partial SELL
 * - SELL fee deducted from proceeds
 * - Full close then BUY again (new avg cost)
 * - SELL causing short rejected
 * - Allocation when total = 0
 * - Missing price handling
 * - Tie-break same timestamp
 */
import { describe, it, expect } from 'vitest';
import { Decimal, parseDecimal, ZERO } from '@/domain/money';
import { replay, sortTrades, ShortPositionError } from '@/domain/ledger';
import { buildPortfolio } from '@/domain/portfolio';
import type { Trade, PriceEntry, Symbol } from '@/domain/types';

// ─── Helper ─────────────────────────────────────────────────────────
function makeTrade(overrides: Partial<Trade> & { symbol: Symbol; side: 'BUY' | 'SELL' }): Trade {
  return {
    seq: 1,
    trade_id: 'T-1',
    timestamp: new Date('2025-01-01T00:00:00Z'),
    exchange: 'Binance',
    quantity: '1',
    price_usd: '100',
    fee_usd: '0',
    ...overrides,
  };
}

// ─── money.ts ───────────────────────────────────────────────────────
describe('parseDecimal', () => {
  it('parses valid decimals', () => {
    expect(parseDecimal('123.456', 'test').toFixed()).toBe('123.456');
    expect(parseDecimal('0.00715000', 'test').toFixed()).toBe('0.00715');
  });

  it('rejects scientific notation', () => {
    expect(() => parseDecimal('1e-5', 'test')).toThrow('scientific notation');
    expect(() => parseDecimal('1E+3', 'test')).toThrow('scientific notation');
  });

  it('rejects NaN and Infinity', () => {
    expect(() => parseDecimal('NaN', 'test')).toThrow('invalid number');
    expect(() => parseDecimal('Infinity', 'test')).toThrow('invalid number');
  });

  it('rejects empty string', () => {
    expect(() => parseDecimal('', 'test')).toThrow('invalid number');
  });
});

// ─── ledger.ts ──────────────────────────────────────────────────────
describe('ledger.replay', () => {
  it('handles multiple BUYs at different prices', () => {
    const trades = sortTrades([
      makeTrade({ seq: 1, trade_id: 'T1', side: 'BUY', symbol: 'BTC', quantity: '1', price_usd: '100', fee_usd: '0' }),
      makeTrade({ seq: 2, trade_id: 'T2', side: 'BUY', symbol: 'BTC', quantity: '1', price_usd: '200', fee_usd: '0', timestamp: new Date('2025-01-02T00:00:00Z') }),
    ]);
    const { positions } = replay(trades);
    const pos = positions.get('BTC')!;
    expect(pos.quantity).toBe('2');
    // avg = (100 + 200) / 2 = 150
    expect(new Decimal(pos.avg_cost).toFixed(0)).toBe('150');
    expect(pos.total_cost).toBe('300');
  });

  it('includes BUY fee in cost basis and average cost', () => {
    const trades = sortTrades([
      makeTrade({ seq: 1, trade_id: 'T1', side: 'BUY', symbol: 'ETH', quantity: '2', price_usd: '100', fee_usd: '10' }),
    ]);
    const { positions } = replay(trades);
    const pos = positions.get('ETH')!;
    // cost = 2*100 + 10 = 210, avg = 210/2 = 105
    expect(pos.total_cost).toBe('210');
    expect(new Decimal(pos.avg_cost).toFixed(0)).toBe('105');
  });

  it('handles partial SELL correctly', () => {
    const trades = sortTrades([
      makeTrade({ seq: 1, trade_id: 'T1', side: 'BUY', symbol: 'SOL', quantity: '10', price_usd: '100', fee_usd: '0' }),
      makeTrade({ seq: 2, trade_id: 'T2', side: 'SELL', symbol: 'SOL', quantity: '3', price_usd: '120', fee_usd: '0', timestamp: new Date('2025-01-02T00:00:00Z') }),
    ]);
    const { positions, snapshots } = replay(trades);
    const pos = positions.get('SOL')!;
    // After sell: qty = 7, cost = 1000 - 3*100 = 700, avg still 100
    expect(pos.quantity).toBe('7');
    expect(new Decimal(pos.avg_cost).toFixed(0)).toBe('100');
    // Realized = 3*120 - 0 - 3*100 = 360 - 300 = 60
    expect(snapshots[1].realized_pnl).toBe('60');
  });

  it('deducts SELL fee from proceeds (not from cost)', () => {
    const trades = sortTrades([
      makeTrade({ seq: 1, trade_id: 'T1', side: 'BUY', symbol: 'BTC', quantity: '1', price_usd: '100', fee_usd: '0' }),
      makeTrade({ seq: 2, trade_id: 'T2', side: 'SELL', symbol: 'BTC', quantity: '1', price_usd: '120', fee_usd: '5', timestamp: new Date('2025-01-02T00:00:00Z') }),
    ]);
    const { snapshots } = replay(trades);
    // Net proceeds = 120 - 5 = 115, cost removed = 100
    // Realized = 115 - 100 = 15
    expect(snapshots[1].realized_pnl).toBe('15');
  });

  it('resets after full close, new BUY starts fresh', () => {
    const trades = sortTrades([
      makeTrade({ seq: 1, trade_id: 'T1', side: 'BUY', symbol: 'ETH', quantity: '2', price_usd: '100', fee_usd: '0' }),
      makeTrade({ seq: 2, trade_id: 'T2', side: 'SELL', symbol: 'ETH', quantity: '2', price_usd: '150', fee_usd: '0', timestamp: new Date('2025-01-02T00:00:00Z') }),
      makeTrade({ seq: 3, trade_id: 'T3', side: 'BUY', symbol: 'ETH', quantity: '1', price_usd: '200', fee_usd: '5', timestamp: new Date('2025-01-03T00:00:00Z') }),
    ]);
    const { positions } = replay(trades);
    const pos = positions.get('ETH')!;
    // After full close and re-buy: qty = 1, cost = 200+5 = 205, avg = 205
    expect(pos.quantity).toBe('1');
    expect(pos.total_cost).toBe('205');
    expect(new Decimal(pos.avg_cost).toFixed(0)).toBe('205');
    // Old avg of 100 should NOT affect new avg
  });

  it('throws ShortPositionError for overselling', () => {
    const trades = sortTrades([
      makeTrade({ seq: 1, trade_id: 'T1', side: 'BUY', symbol: 'DOGE', quantity: '100', price_usd: '1', fee_usd: '0' }),
      makeTrade({ seq: 2, trade_id: 'T2', side: 'SELL', symbol: 'DOGE', quantity: '150', price_usd: '1', fee_usd: '0', timestamp: new Date('2025-01-02T00:00:00Z') }),
    ]);
    expect(() => replay(trades)).toThrow(ShortPositionError);
  });

  it('uses seq as tie-breaker for same timestamp', () => {
    const ts = new Date('2025-01-01T00:00:00Z');
    const trades = sortTrades([
      makeTrade({ seq: 2, trade_id: 'T2', side: 'SELL', symbol: 'BTC', quantity: '1', price_usd: '120', fee_usd: '0', timestamp: ts }),
      makeTrade({ seq: 1, trade_id: 'T1', side: 'BUY', symbol: 'BTC', quantity: '1', price_usd: '100', fee_usd: '0', timestamp: ts }),
    ]);
    // seq 1 (BUY) should be processed before seq 2 (SELL)
    const { snapshots } = replay(trades);
    expect(snapshots[0].side).toBe('BUY');
    expect(snapshots[1].side).toBe('SELL');
  });
});

// ─── portfolio.ts ───────────────────────────────────────────────────
describe('buildPortfolio', () => {
  it('computes allocation correctly', () => {
    const positions = new Map<Symbol, any>([
      ['BTC', { symbol: 'BTC', quantity: '1', avg_cost: '100', total_cost: '100', realized_pnl: '0', total_fees: '0' }],
      ['ETH', { symbol: 'ETH', quantity: '1', avg_cost: '50', total_cost: '50', realized_pnl: '0', total_fees: '0' }],
    ]);
    const prices: PriceEntry[] = [
      { symbol: 'BTC', price_usd: '200', as_of: '2025-01-01T00:00:00Z' },
      { symbol: 'ETH', price_usd: '100', as_of: '2025-01-01T00:00:00Z' },
    ];
    const result = buildPortfolio(positions, prices);
    // BTC value = 200, ETH value = 100, total = 300
    // BTC alloc = 200/300*100 = 66.666...
    const btcHolding = result.holdings.find(h => h.symbol === 'BTC')!;
    expect(parseFloat(btcHolding.allocation_pct!)).toBeCloseTo(66.67, 1);
  });

  it('returns allocation 0 when total value is 0', () => {
    const positions = new Map<Symbol, any>([
      ['BTC', { symbol: 'BTC', quantity: '0', avg_cost: '0', total_cost: '0', realized_pnl: '50', total_fees: '5' }],
    ]);
    const prices: PriceEntry[] = [
      { symbol: 'BTC', price_usd: '100', as_of: '2025-01-01T00:00:00Z' },
    ];
    const result = buildPortfolio(positions, prices);
    const btcHolding = result.holdings.find(h => h.symbol === 'BTC')!;
    expect(btcHolding.allocation_pct).toBe('0');
    // Realized should still show
    expect(btcHolding.realized_pnl).toBe('50');
  });

  it('handles missing price with warnings', () => {
    const positions = new Map<Symbol, any>([
      ['BTC', { symbol: 'BTC', quantity: '1', avg_cost: '100', total_cost: '100', realized_pnl: '0', total_fees: '0' }],
    ]);
    const result = buildPortfolio(positions, []); // no prices
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.total_value).toBeNull();
    const btcHolding = result.holdings.find(h => h.symbol === 'BTC')!;
    expect(btcHolding.current_value).toBeNull();
    expect(btcHolding.unrealized_pnl).toBeNull();
  });
});
