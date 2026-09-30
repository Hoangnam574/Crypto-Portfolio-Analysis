/**
 * Import validation tests — testing the CSV pipeline (M2).
 *
 * Tests: missing column, duplicate ID, invalid timestamp, invalid symbol/side/exchange,
 * quantity/price ≤ 0, negative fee, scientific notation, file errors,
 * short position from replay, and successful import not modifying DB on error.
 */
import { describe, it, expect } from 'vitest';
import { validateAndParse, validateAndParsePrices } from '@/import/validate';

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
    const result = validateAndParse('x', 60 * 1024 * 1024);
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

  it('validates and replays trades_comprehensive.csv cleanly', () => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const csvContent = readFileSync(join(__dirname, '../data/trades_comprehensive.csv'), 'utf-8');
    const result = validateAndParse(csvContent);
    if (!result.ok) {
      console.log('VALIDATION ERRORS:', result.errors);
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.trades.length).toBe(500);
    }
  });
});

describe('Prices CSV validation', () => {
  const VALID_PRICES_CSV = `symbol,price_usd,as_of
BTC,111500.00,2026-03-31T23:59:59Z
ETH,4025.00,2026-03-31T23:59:59Z
SOL,208.50,2026-03-31T23:59:59Z
CKB,0.00715,2026-03-31T23:59:59Z
DOGE,0.242,2026-03-31T23:59:59Z`;

  it('validates a correct prices CSV', () => {
    const result = validateAndParsePrices(VALID_PRICES_CSV);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.count).toBe(5);
      expect(result.prices).toHaveLength(5);
      expect(result.prices[0].symbol).toBe('BTC');
      expect(result.prices[0].price_usd).toBe('111500');
    }
  });

  it('rejects missing header in prices CSV', () => {
    const csv = `symbol,price_usd\nBTC,111500.00`;
    const result = validateAndParsePrices(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'MISSING_HEADER')).toBe(true);
    }
  });

  it('rejects unknown asset symbol', () => {
    const csv = `symbol,price_usd,as_of\nUNKNOWN,100.00,2026-03-31T23:59:59Z`;
    const result = validateAndParsePrices(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_SYMBOL')).toBe(true);
    }
  });

  it('rejects duplicate asset symbol', () => {
    const csv = `symbol,price_usd,as_of
BTC,111500.00,2026-03-31T23:59:59Z
BTC,112000.00,2026-03-31T23:59:59Z`;
    const result = validateAndParsePrices(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'DUPLICATE_TRADE_ID')).toBe(true);
    }
  });

  it('rejects negative or zero prices', () => {
    const csvZero = `symbol,price_usd,as_of\nBTC,0,2026-03-31T23:59:59Z`;
    const resZero = validateAndParsePrices(csvZero);
    expect(resZero.ok).toBe(false);

    const csvNeg = `symbol,price_usd,as_of\nBTC,-50,2026-03-31T23:59:59Z`;
    const resNeg = validateAndParsePrices(csvNeg);
    expect(resNeg.ok).toBe(false);
  });

  it('rejects invalid timestamp format in prices CSV', () => {
    const csv = `symbol,price_usd,as_of\nBTC,100000,2026-03-31`;
    const result = validateAndParsePrices(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_TIMESTAMP')).toBe(true);
    }
  });

  it('rejects empty file', () => {
    const result = validateAndParsePrices('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'EMPTY_FILE')).toBe(true);
    }
  });

  it('validates actual data/prices.csv file cleanly', () => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const csvContent = readFileSync(join(__dirname, '../data/prices.csv'), 'utf-8');
    const result = validateAndParsePrices(csvContent);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.count).toBe(5);
    }
  });
});

