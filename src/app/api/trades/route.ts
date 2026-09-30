/**
 * GET /api/trades — Query trades with filtering, sorting, pagination.
 *
 * Query params: page, pageSize, symbol, exchange, side, from, to, sort
 * Returns: { rows: TradeSnapshot[], total, page, pageSize }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb, runMigrations } from '@/db/client';
import { getAllTrades, queryTrades, hasAnyTrades } from '@/db/repository';
import { seedDatabase } from '@/db/seed';
import { sortTrades, replay } from '@/domain/ledger';
import { EXCHANGES, SIDES, SYMBOLS } from '@/domain/types';
import type { TradesQueryParams, Exchange, Side, Symbol as AssetSymbol } from '@/domain/types';

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    await runMigrations(db);

    // Auto-seed if empty
    const hasTrades = await hasAnyTrades(db);
    if (!hasTrades) {
      await seedDatabase(db);
    }

    const { searchParams } = new URL(request.url);

    // Parse & validate query params
    const params: TradesQueryParams = {};

    const page = searchParams.get('page');
    if (page) {
      const n = parseInt(page, 10);
      if (isNaN(n) || n < 1) {
        return NextResponse.json(
          { error: { code: 'INVALID_PARAM', message: 'page must be a positive integer' } },
          { status: 400 },
        );
      }
      params.page = n;
    }

    const pageSize = searchParams.get('pageSize');
    if (pageSize) {
      const n = parseInt(pageSize, 10);
      if (isNaN(n) || n < 1 || n > 100) {
        return NextResponse.json(
          { error: { code: 'INVALID_PARAM', message: 'pageSize must be 1-100' } },
          { status: 400 },
        );
      }
      params.pageSize = n;
    }

    const symbol = searchParams.get('symbol');
    if (symbol) {
      if (!SYMBOLS.includes(symbol as AssetSymbol)) {
        return NextResponse.json(
          { error: { code: 'INVALID_PARAM', message: `symbol must be one of: ${SYMBOLS.join(', ')}` } },
          { status: 400 },
        );
      }
      params.symbol = symbol as AssetSymbol;
    }

    const exchange = searchParams.get('exchange');
    if (exchange) {
      if (!EXCHANGES.includes(exchange as Exchange)) {
        return NextResponse.json(
          { error: { code: 'INVALID_PARAM', message: `exchange must be one of: ${EXCHANGES.join(', ')}` } },
          { status: 400 },
        );
      }
      params.exchange = exchange as Exchange;
    }

    const side = searchParams.get('side');
    if (side) {
      if (!SIDES.includes(side as Side)) {
        return NextResponse.json(
          { error: { code: 'INVALID_PARAM', message: 'side must be BUY or SELL' } },
          { status: 400 },
        );
      }
      params.side = side as Side;
    }

    const from = searchParams.get('from');
    if (from) {
      if (isNaN(new Date(from).getTime())) {
        return NextResponse.json(
          { error: { code: 'INVALID_PARAM', message: 'from must be a valid ISO-8601 date' } },
          { status: 400 },
        );
      }
      params.from = from;
    }

    const to = searchParams.get('to');
    if (to) {
      if (isNaN(new Date(to).getTime())) {
        return NextResponse.json(
          { error: { code: 'INVALID_PARAM', message: 'to must be a valid ISO-8601 date' } },
          { status: 400 },
        );
      }
      params.to = to;
    }

    params.sort = searchParams.get('sort') === 'desc' ? 'desc' : 'asc';

    // Query trades from DB (filtered, paginated)
    const { rows: dbRows, total } = await queryTrades(db, params);

    // To get snapshots (position after each trade), we need to replay ALL trades
    // and then filter/paginate from the snapshots
    const allTrades = await getAllTrades(db);
    const sorted = sortTrades(allTrades);
    const { snapshots } = replay(sorted);

    // Create a map from trade_id to snapshot
    const snapshotMap = new Map(snapshots.map((s) => [s.trade_id, s]));

    // Map the paginated DB rows to their snapshots
    const responseRows = dbRows.map((trade) => {
      const snapshot = snapshotMap.get(trade.trade_id);
      return snapshot || {
        trade_id: trade.trade_id,
        seq: trade.seq,
        timestamp: trade.timestamp.toISOString(),
        exchange: trade.exchange,
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.quantity,
        price_usd: trade.price_usd,
        fee_usd: trade.fee_usd,
        gross_value: '0',
        position_qty: '0',
        avg_cost: '0',
        realized_pnl: '0',
      };
    });

    return NextResponse.json({
      rows: responseRows,
      total,
      page: params.page || 1,
      pageSize: params.pageSize || 25,
    });
  } catch (err) {
    console.error('Trades API error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load trade data.' } },
      { status: 500 },
    );
  }
}
