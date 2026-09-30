/**
 * tests/repository.test.ts
 *
 * Tests the persistence layer using in-memory PGlite.
 * Verifies atomic replaceAllTrades and transaction rollback behavior (M3).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, runMigrations } from '../src/db/client';
import type { Database } from '../src/db/client';
import {
  replaceAllTrades,
  getAllTrades,
  hasAnyTrades,
  replaceAllPrices,
  getAllPrices,
  queryTrades,
} from '../src/db/repository';
import type { Trade, PriceEntry } from '../src/domain/types';

describe('Repository Layer with PGlite', () => {
  let db: Database;

  beforeEach(async () => {
    const testEnv = createTestDb();
    db = testEnv.db;
    await runMigrations(db);
  });

  const sampleTrades: Trade[] = [
    {
      seq: 1,
      trade_id: 't-1',
      timestamp: new Date('2026-01-01T10:00:00Z'),
      exchange: 'Binance',
      symbol: 'BTC',
      side: 'BUY',
      quantity: '1.5',
      price_usd: '40000.00',
      fee_usd: '10.00',
    },
    {
      seq: 2,
      trade_id: 't-2',
      timestamp: new Date('2026-01-02T10:00:00Z'),
      exchange: 'Coinbase',
      symbol: 'ETH',
      side: 'BUY',
      quantity: '10.0',
      price_usd: '2500.00',
      fee_usd: '5.00',
    },
    {
      seq: 3,
      trade_id: 't-3',
      timestamp: new Date('2026-01-03T10:00:00Z'),
      exchange: 'Binance',
      symbol: 'BTC',
      side: 'SELL',
      quantity: '0.5',
      price_usd: '45000.00',
      fee_usd: '12.00',
    },
  ];

  it('initially has no trades', async () => {
    const hasTrades = await hasAnyTrades(db);
    expect(hasTrades).toBe(false);

    const all = await getAllTrades(db);
    expect(all).toHaveLength(0);
  });

  it('inserts trades and retrieves them sorted', async () => {
    await replaceAllTrades(db, sampleTrades);

    const hasTrades = await hasAnyTrades(db);
    expect(hasTrades).toBe(true);

    const all = await getAllTrades(db);
    expect(all).toHaveLength(3);
    expect(all[0].trade_id).toBe('t-1');
    expect(all[1].trade_id).toBe('t-2');
    expect(all[2].trade_id).toBe('t-3');
  });

  it('atomically replaces trades with new dataset', async () => {
    await replaceAllTrades(db, sampleTrades);

    const replacement: Trade[] = [
      {
        seq: 1,
        trade_id: 'new-1',
        timestamp: new Date('2026-02-01T12:00:00Z'),
        exchange: 'Binance',
        symbol: 'SOL',
        side: 'BUY',
        quantity: '50',
        price_usd: '100',
        fee_usd: '2',
      },
    ];

    await replaceAllTrades(db, replacement);

    const all = await getAllTrades(db);
    expect(all).toHaveLength(1);
    expect(all[0].trade_id).toBe('new-1');
    expect(all[0].symbol).toBe('SOL');
  });

  it('rolls back completely if an error occurs during replaceAllTrades', async () => {
    // Seed initial data
    await replaceAllTrades(db, sampleTrades);
    const initialTrades = await getAllTrades(db);
    expect(initialTrades).toHaveLength(3);

    // Attempt replacing with a batch that will fail constraint (duplicate trade_id in batch)
    const duplicateBatch: Trade[] = [
      {
        seq: 1,
        trade_id: 'dup-1',
        timestamp: new Date('2026-02-01T12:00:00Z'),
        exchange: 'Binance',
        symbol: 'SOL',
        side: 'BUY',
        quantity: '10',
        price_usd: '100',
        fee_usd: '1',
      },
      {
        seq: 2,
        trade_id: 'dup-1', // DUPLICATE KEY violates trades_trade_id_idx
        timestamp: new Date('2026-02-02T12:00:00Z'),
        exchange: 'Coinbase',
        symbol: 'ETH',
        side: 'BUY',
        quantity: '5',
        price_usd: '2000',
        fee_usd: '2',
      },
    ];

    // Transaction must fail
    await expect(replaceAllTrades(db, duplicateBatch)).rejects.toThrow();

    // Verify rollback: original trades are still intact!
    const tradesAfterRollback = await getAllTrades(db);
    expect(tradesAfterRollback).toHaveLength(3);
    expect(tradesAfterRollback.map((t) => t.trade_id)).toEqual(['t-1', 't-2', 't-3']);
  });

  it('supports querying with filters, pagination, and sorting', async () => {
    await replaceAllTrades(db, sampleTrades);

    // Filter by symbol
    const btcResult = await queryTrades(db, { symbol: 'BTC' });
    expect(btcResult.total).toBe(2);
    expect(btcResult.rows).toHaveLength(2);

    // Filter by exchange
    const cbResult = await queryTrades(db, { exchange: 'Coinbase' });
    expect(cbResult.total).toBe(1);
    expect(cbResult.rows[0].trade_id).toBe('t-2');

    // Filter by side
    const sellResult = await queryTrades(db, { side: 'SELL' });
    expect(sellResult.total).toBe(1);
    expect(sellResult.rows[0].trade_id).toBe('t-3');

    // Filter by date range
    const dateResult = await queryTrades(db, {
      from: '2026-01-01T00:00:00Z',
      to: '2026-01-02T12:00:00Z',
    });
    expect(dateResult.total).toBe(2);

    // Pagination
    const pageResult = await queryTrades(db, { page: 1, pageSize: 2 });
    expect(pageResult.total).toBe(3);
    expect(pageResult.rows).toHaveLength(2);

    // Sort descending
    const descResult = await queryTrades(db, { sort: 'desc' });
    expect(descResult.rows[0].trade_id).toBe('t-3');
    expect(descResult.rows[2].trade_id).toBe('t-1');
  });

  it('manages prices table correctly', async () => {
    const samplePrices: PriceEntry[] = [
      { symbol: 'BTC', price_usd: '65000.50', as_of: '2026-03-31T23:59:59Z' },
      { symbol: 'ETH', price_usd: '3500.25', as_of: '2026-03-31T23:59:59Z' },
    ];

    await replaceAllPrices(db, samplePrices);
    const retrieved = await getAllPrices(db);

    expect(retrieved).toHaveLength(2);
    const btc = retrieved.find((p) => p.symbol === 'BTC');
    expect(btc?.price_usd).toBe('65000.500000000000000000');
  });
});
