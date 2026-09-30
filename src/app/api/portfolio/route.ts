/**
 * GET /api/portfolio — Returns portfolio summary, holdings, warnings.
 */
import { NextResponse } from 'next/server';
import { getDb, runMigrations } from '@/db/client';
import { getAllTrades, getAllPrices, hasAnyTrades } from '@/db/repository';
import { seedDatabase } from '@/db/seed';
import { sortTrades, replay } from '@/domain/ledger';
import { buildPortfolio } from '@/domain/portfolio';

export async function GET() {
  try {
    const db = await getDb();
    await runMigrations(db);

    // Auto-seed if empty
    const hasTrades = await hasAnyTrades(db);
    if (!hasTrades) {
      await seedDatabase(db);
    }

    const trades = await getAllTrades(db);
    const priceEntries = await getAllPrices(db);

    if (trades.length === 0) {
      return NextResponse.json({
        total_value: '0',
        total_cost_basis: '0',
        total_realized_pnl: '0',
        total_unrealized_pnl: '0',
        total_pnl: '0',
        total_fees: '0',
        holdings: [],
        warnings: ['No trade data loaded. Import a CSV file or reset to sample data.'],
        prices_as_of: null,
      });
    }

    const sorted = sortTrades(trades);
    const { positions } = replay(sorted);
    const summary = buildPortfolio(positions, priceEntries);

    return NextResponse.json(summary);
  } catch (err) {
    console.error('Portfolio API error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load portfolio data.' } },
      { status: 500 },
    );
  }
}
