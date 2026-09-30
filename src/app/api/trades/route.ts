/**
 * GET /api/trades — Query trades with filtering, sorting, pagination.
 *
 * Query params: page, pageSize, symbol, exchange, side, from, to, sort
 * Returns: { rows: TradeSnapshot[], total, page, pageSize }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb, runMigrations } from '@/db/client';
import { getAllTrades, hasAnyTrades } from '@/db/repository';
import { seedDatabase } from '@/db/seed';
import { sortTrades, replay } from '@/domain/ledger';
import { Decimal } from '@/domain/money';
import { EXCHANGES, SIDES, SYMBOLS } from '@/domain/types';
import type { TradesQueryParams, Exchange, Side, Symbol as AssetSymbol, TradeSnapshot } from '@/domain/types';

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
      const parsedFrom = new Date(from);
      const year = parsedFrom.getUTCFullYear();
      if (isNaN(parsedFrom.getTime()) || year < 2000 || year > 2099) {
        return NextResponse.json(
          { error: { code: 'INVALID_PARAM', message: 'from must be a valid date between 2000 and 2099' } },
          { status: 400 },
        );
      }
      params.from = from;
    }

    const to = searchParams.get('to');
    if (to) {
      const parsedTo = new Date(to);
      const year = parsedTo.getUTCFullYear();
      if (isNaN(parsedTo.getTime()) || year < 2000 || year > 2099) {
        return NextResponse.json(
          { error: { code: 'INVALID_PARAM', message: 'to must be a valid date between 2000 and 2099' } },
          { status: 400 },
        );
      }
      params.to = to;
    }

    if (params.from && params.to) {
      if (new Date(params.from).getTime() > new Date(params.to).getTime()) {
        return NextResponse.json(
          { error: { code: 'INVALID_PARAM', message: 'from date cannot be after to date' } },
          { status: 400 },
        );
      }
    }


    const sortDirParam = searchParams.get('sortDir') || searchParams.get('sort');
    const sortDir: 'asc' | 'desc' = sortDirParam === 'desc' ? 'desc' : 'asc';
    params.sort = sortDir;
    params.sortDir = sortDir;

    const sortBy = (searchParams.get('sortBy') as keyof TradeSnapshot) || 'timestamp';
    params.sortBy = sortBy;

    // To get snapshots (post-trade positions and realized P&L), replay all trades chronologically
    const allTrades = await getAllTrades(db);
    const chronologicallySorted = sortTrades(allTrades);
    const { snapshots } = replay(chronologicallySorted);

    // Apply filtering across all snapshots
    let filtered = snapshots;
    if (params.symbol) {
      filtered = filtered.filter((s) => s.symbol === params.symbol);
    }
    if (params.exchange) {
      filtered = filtered.filter((s) => s.exchange === params.exchange);
    }
    if (params.side) {
      filtered = filtered.filter((s) => s.side === params.side);
    }
    if (params.from) {
      const fromTime = new Date(params.from).getTime();
      filtered = filtered.filter((s) => new Date(s.timestamp).getTime() >= fromTime);
    }
    if (params.to) {
      const toTime = new Date(params.to).getTime();
      filtered = filtered.filter((s) => new Date(s.timestamp).getTime() <= toTime);
    }

    const total = filtered.length;

    // Sort ALL matching snapshots across ALL pages by requested column and direction
    filtered.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'timestamp') {
        const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        comp = timeDiff !== 0 ? timeDiff : a.seq - b.seq;
      } else if (
        [
          'quantity',
          'price_usd',
          'fee_usd',
          'gross_value',
          'position_qty',
          'avg_cost',
          'realized_pnl',
          'seq',
        ].includes(sortBy)
      ) {
        const numA = new Decimal(a[sortBy] || '0');
        const numB = new Decimal(b[sortBy] || '0');
        comp = numA.cmp(numB);
        if (comp === 0) comp = a.seq - b.seq;
      } else {
        comp = String(a[sortBy] || '').localeCompare(String(b[sortBy] || ''));
        if (comp === 0) comp = a.seq - b.seq;
      }
      return sortDir === 'desc' ? -comp : comp;
    });

    // Paginate globally sorted rows
    const currentPage = params.page || 1;
    const currentPageSize = params.pageSize || 25;
    const offset = (currentPage - 1) * currentPageSize;
    const responseRows = filtered.slice(offset, offset + currentPageSize);

    return NextResponse.json({
      rows: responseRows,
      total,
      page: currentPage,
      pageSize: currentPageSize,
    });

  } catch (err) {
    console.error('Trades API error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load trade data.' } },
      { status: 500 },
    );
  }
}
