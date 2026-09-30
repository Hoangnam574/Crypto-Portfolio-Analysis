/**
 * tests/api.test.ts
 *
 * Direct integration tests for Next.js route handlers:
 * - GET /api/health
 * - GET /api/portfolio
 * - GET /api/trades (filtering, pagination, invalid param handling)
 * - POST /api/import (valid import, validation errors, invalid file)
 * - POST /api/reset
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createTestDb, runMigrations, setDb } from '../src/db/client';
import { seedDatabase } from '../src/db/seed';
import { GET as healthHandler } from '../src/app/api/health/route';
import { GET as portfolioHandler } from '../src/app/api/portfolio/route';
import { GET as tradesHandler } from '../src/app/api/trades/route';
import { POST as importHandler } from '../src/app/api/import/route';
import { POST as resetHandler } from '../src/app/api/reset/route';

describe('API Route Handlers', () => {
  beforeAll(async () => {
    const { db } = createTestDb();
    setDb(db);
    await runMigrations(db);
    await seedDatabase(db, true);
  });

  afterAll(() => {
    setDb(null);
  });

  describe('GET /api/health', () => {
    it('returns 200 with status ok and timestamp', async () => {
      const res = await healthHandler();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('GET /api/portfolio', () => {
    it('returns 200 with complete portfolio summary and holdings', async () => {
      const res = await portfolioHandler();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.total_value).toBeDefined();
      expect(data.total_cost_basis).toBeDefined();
      expect(data.total_realized_pnl).toBeDefined();
      expect(data.total_unrealized_pnl).toBeDefined();
      expect(data.total_pnl).toBeDefined();
      expect(data.total_fees).toBeDefined();
      expect(Array.isArray(data.holdings)).toBe(true);
      expect(data.holdings.length).toBeGreaterThan(0);
      expect(data.prices_as_of).toBeDefined();
    });
  });

  describe('GET /api/trades', () => {
    it('returns paginated trades with snapshots and total', async () => {
      const req = new NextRequest('http://localhost:3000/api/trades?page=1&pageSize=10');
      const res = await tradesHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.rows).toHaveLength(10);
      expect(data.page).toBe(1);
      expect(data.pageSize).toBe(10);
      expect(data.total).toBe(200);

      // Verify snapshot properties
      const first = data.rows[0];
      expect(first.trade_id).toBeDefined();
      expect(first.timestamp).toBeDefined();
      expect(first.exchange).toBeDefined();
      expect(first.symbol).toBeDefined();
      expect(first.side).toBeDefined();
      expect(first.gross_value).toBeDefined();
      expect(first.position_qty).toBeDefined();
      expect(first.avg_cost).toBeDefined();
    });

    it('filters trades by symbol and side', async () => {
      const req = new NextRequest('http://localhost:3000/api/trades?symbol=BTC&side=BUY');
      const res = await tradesHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.rows.every((r: any) => r.symbol === 'BTC' && r.side === 'BUY')).toBe(true);
    });

    it('returns 400 for invalid symbol query param', async () => {
      const req = new NextRequest('http://localhost:3000/api/trades?symbol=UNKNOWN');
      const res = await tradesHandler(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error.code).toBe('INVALID_PARAM');
    });

    it('returns 400 for invalid side query param', async () => {
      const req = new NextRequest('http://localhost:3000/api/trades?side=HOLD');
      const res = await tradesHandler(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error.code).toBe('INVALID_PARAM');
    });

    it('returns 400 for invalid date query param', async () => {
      const req = new NextRequest('http://localhost:3000/api/trades?from=invalid-date');
      const res = await tradesHandler(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error.code).toBe('INVALID_PARAM');
    });

    it('returns 400 for out-of-bounds year in date param', async () => {
      const req = new NextRequest('http://localhost:3000/api/trades?from=213123-12-31');
      const res = await tradesHandler(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error.code).toBe('INVALID_PARAM');
    });

    it('returns 400 when from date is strictly after to date', async () => {
      const req = new NextRequest('http://localhost:3000/api/trades?from=2026-03-31T00:00:00Z&to=2026-01-01T00:00:00Z');
      const res = await tradesHandler(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error.code).toBe('INVALID_PARAM');
      expect(data.error.message).toContain('from date cannot be after to date');
    });


    it('sorts trades across all pages globally by price_usd desc', async () => {
      const reqPage1 = new NextRequest('http://localhost:3000/api/trades?page=1&pageSize=10&sortBy=price_usd&sortDir=desc');
      const resPage1 = await tradesHandler(reqPage1);
      expect(resPage1.status).toBe(200);
      const data1 = await resPage1.json();

      const reqPage2 = new NextRequest('http://localhost:3000/api/trades?page=2&pageSize=10&sortBy=price_usd&sortDir=desc');
      const resPage2 = await tradesHandler(reqPage2);
      expect(resPage2.status).toBe(200);
      const data2 = await resPage2.json();

      const minPricePage1 = Math.min(...data1.rows.map((r: any) => parseFloat(r.price_usd)));
      const maxPricePage2 = Math.max(...data2.rows.map((r: any) => parseFloat(r.price_usd)));
      expect(minPricePage1).toBeGreaterThanOrEqual(maxPricePage2);
    });

    it('sorts trades across all pages globally by timestamp desc', async () => {
      const reqPage1 = new NextRequest('http://localhost:3000/api/trades?page=1&pageSize=10&sortBy=timestamp&sortDir=desc');
      const resPage1 = await tradesHandler(reqPage1);
      const data1 = await resPage1.json();

      const reqPage2 = new NextRequest('http://localhost:3000/api/trades?page=2&pageSize=10&sortBy=timestamp&sortDir=desc');
      const resPage2 = await tradesHandler(reqPage2);
      const data2 = await resPage2.json();

      const minTimePage1 = Math.min(...data1.rows.map((r: any) => new Date(r.timestamp).getTime()));
      const maxTimePage2 = Math.max(...data2.rows.map((r: any) => new Date(r.timestamp).getTime()));
      expect(minTimePage1).toBeGreaterThanOrEqual(maxTimePage2);
    });
  });


  describe('POST /api/import', () => {
    it('returns 400 when no file is uploaded', async () => {
      const formData = new FormData();
      const req = new NextRequest('http://localhost:3000/api/import', {
        method: 'POST',
        body: formData,
      });

      const res = await importHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('NO_FILE');
    });

    it('returns 422 with detailed errors when CSV has schema errors', async () => {
      const badCsv = `trade_id,timestamp,exchange,symbol,side,quantity,price_usd,fee_usd
t1,2026-01-01T00:00:00Z,Binance,BTC,BUY,-1.5,50000,10`;

      const formData = new FormData();
      const file = new File([badCsv], 'bad.csv', { type: 'text/csv' });
      formData.append('file', file);

      const req = new NextRequest('http://localhost:3000/api/import', {
        method: 'POST',
        body: formData,
      });

      const res = await importHandler(req);
      expect(res.status).toBe(422);

      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.errors).toBeDefined();
      expect(data.errors.length).toBeGreaterThan(0);
      expect(data.message).toContain('No data was changed');
    });

    it('successfully imports valid CSV and updates trades', async () => {
      const validCsv = `trade_id,timestamp,exchange,symbol,side,quantity,price_usd,fee_usd
imp-1,2026-01-01T00:00:00Z,Binance,BTC,BUY,1.0,40000,5
imp-2,2026-01-02T00:00:00Z,Coinbase,BTC,SELL,0.5,45000,5`;

      const formData = new FormData();
      const file = new File([validCsv], 'trades.csv', { type: 'text/csv' });
      formData.append('file', file);

      const req = new NextRequest('http://localhost:3000/api/import', {
        method: 'POST',
        body: formData,
      });

      const res = await importHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.count).toBe(2);

      // Verify that portfolio reflects the new import
      const portRes = await portfolioHandler();
      const portData = await portRes.json();
      const btcHolding = portData.holdings.find((h: any) => h.symbol === 'BTC');
      expect(btcHolding).toBeDefined();
      expect(btcHolding.quantity).toBe('0.5');

      // Reset back to sample data for clean state
      await resetHandler();
    });
  });

  describe('POST /api/reset', () => {
    it('reseeds database to sample 200 trades', async () => {
      const res = await resetHandler();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.ok).toBe(true);

      const req = new NextRequest('http://localhost:3000/api/trades');
      const tradesRes = await tradesHandler(req);
      const tradesData = await tradesRes.json();
      expect(tradesData.total).toBe(200);
    });
  });
});
