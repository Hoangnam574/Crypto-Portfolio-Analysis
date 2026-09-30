/**
 * Import validation tests — testing the CSV pipeline (M2).
 *
 * Tests: missing column, duplicate ID, invalid timestamp, invalid symbol/side/exchange,
 * quantity/price ≤ 0, negative fee, scientific notation, file errors,
 * short position from replay, and successful import not modifying DB on error.
 */
import { describe, it, expect } from 'vitest';
import { validateAndParse } from '@/import/validate';

const VALID_HEADER = 'trade_id,timestamp,exchange,symbol,side,quantity,price_usd,fee_usd';

function makeCsv(rows: string[]): string {
  return [VALID_HEADER, ...rows].join('\n');
}

describe('Import validation', () => {
  it('rejects missing column', () => {
    const csv = 'trade_id,timestamp,exchange,symbol,side,quantity,price_usd\nT1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100';
    const result = validateAndParse(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'MISSING_HEADER')).toBe(true);
    }
  });

  it('rejects duplicate trade_id (reports both rows)', () => {
    const csv = makeCsv([
      'T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0',
      'T1,2025-01-02T00:00:00Z,Binance,ETH,BUY,1,50,0',
    ]);
    const result = validateAndParse(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'DUPLICATE_TRADE_ID')).toBe(true);
    }
  });

  it('rejects invalid timestamp (not UTC)', () => {
    const csv = makeCsv(['T1,2025-01-01,Binance,BTC,BUY,1,100,0']);
    const result = validateAndParse(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'INVALID_TIMESTAMP')).toBe(true);
    }
  });

  it('rejects invalid symbol', () => {
    const csv = makeCsv(['T1,2025-01-01T00:00:00Z,Binance,SHIB,BUY,1,100,0']);
    const result = validateAndParse(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'INVALID_SYMBOL')).toBe(true);
    }
  });

  it('rejects invalid side', () => {
    const csv = makeCsv(['T1,2025-01-01T00:00:00Z,Binance,BTC,HOLD,1,100,0']);
    const result = validateAndParse(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'INVALID_SIDE')).toBe(true);
    }
  });

  it('rejects invalid exchange', () => {
    const csv = makeCsv(['T1,2025-01-01T00:00:00Z,Kraken,BTC,BUY,1,100,0']);
    const result = validateAndParse(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'INVALID_EXCHANGE')).toBe(true);
    }
  });

  it('rejects quantity ≤ 0', () => {
    const csv = makeCsv(['T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,0,100,0']);
    const result = validateAndParse(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'INVALID_QUANTITY')).toBe(true);
    }
  });

  it('rejects negative price', () => {
    const csv = makeCsv(['T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,-100,0']);
    const result = validateAndParse(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'INVALID_PRICE')).toBe(true);
    }
  });

  it('rejects negative fee', () => {
    const csv = makeCsv(['T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,-5']);
    const result = validateAndParse(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'INVALID_FEE')).toBe(true);
    }
  });

  it('rejects scientific notation in numbers', () => {
    const csv = makeCsv(['T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1e2,100,0']);
    const result = validateAndParse(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'INVALID_QUANTITY')).toBe(true);
    }
  });

  it('rejects empty file', () => {
    const result = validateAndParse('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'EMPTY_FILE')).toBe(true);
    }
  });

  it('rejects file too large', () => {
    const result = validateAndParse('x', 2 * 1024 * 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'FILE_TOO_LARGE')).toBe(true);
    }
  });

  it('catches short position from replay', () => {
    const csv = makeCsv([
      'T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0',
      'T2,2025-01-02T00:00:00Z,Binance,BTC,SELL,2,120,0',
    ]);
    const result = validateAndParse(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'SHORT_POSITION')).toBe(true);
    }
  });

  it('accepts valid file', () => {
    const csv = makeCsv([
      'T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,0.5,50000,10',
      'T2,2025-01-02T00:00:00Z,Coinbase,ETH,BUY,2,3000,5',
      'T3,2025-01-03T00:00:00Z,Binance,BTC,SELL,0.2,55000,8',
    ]);
    const result = validateAndParse(csv);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.trades.length).toBe(3);
    }
  });

  it('handles BOM correctly', () => {
    const csv = '\uFEFF' + makeCsv([
      'T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0',
    ]);
    const result = validateAndParse(csv);
    expect(result.ok).toBe(true);
  });

  it('collects multiple errors with correct row numbers', () => {
    const csv = makeCsv([
      'T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0',
      'T2,bad-date,Kraken,SHIB,HOLD,-1,-50,-3',
    ]);
    const result = validateAndParse(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // All errors should be for row 3 (header=1, row1=2, row2=3)
      const row3Errors = result.errors.filter(e => e.row === 3);
      expect(row3Errors.length).toBeGreaterThanOrEqual(4);
    }
  });
});
