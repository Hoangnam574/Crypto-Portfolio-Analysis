/**
 * repository.ts — Data access layer.
 *
 * Receives a Drizzle db instance (doesn't know about driver selection).
 * All trade imports use a single transaction for atomicity.
 */
import { eq, desc, asc, and, gte, lte, sql, count } from 'drizzle-orm';
import { trades, prices } from './schema';
import type { Database } from './client';
import type {
  Trade,
  PriceEntry,
  Exchange,
  Side,
  Symbol as AssetSymbol,
  TradesQueryParams,
} from '../domain/types';

/**
 * Replace all trades atomically: DELETE all + INSERT new in one transaction.
 * If anything fails, the old data is preserved.
 */
export async function replaceAllTrades(db: Database, newTrades: Trade[]): Promise<void> {
  await (db as any).transaction(async (tx: any) => {
    await tx.delete(trades);

    const BATCH_SIZE = 100;
    for (let i = 0; i < newTrades.length; i += BATCH_SIZE) {
      const batch = newTrades.slice(i, i + BATCH_SIZE);
      await tx.insert(trades).values(
        batch.map((t) => ({
          seq: t.seq,
          trade_id: t.trade_id,
          ts: t.timestamp,
          exchange: t.exchange,
          symbol: t.symbol,
          side: t.side,
          quantity: t.quantity,
          price_usd: t.price_usd,
          fee_usd: t.fee_usd,
        })),
      );
    }
  });
}

/**
 * Replace all prices atomically.
 */
export async function replaceAllPrices(db: Database, newPrices: PriceEntry[]) {
  await (db as any).transaction(async (tx: any) => {
    await tx.delete(prices);
    if (newPrices.length > 0) {
      await tx.insert(prices).values(
        newPrices.map((p) => ({
          symbol: p.symbol,
          price_usd: p.price_usd,
          as_of: new Date(p.as_of),
        })),
      );
    }
  });
}

/**
 * Get all trades sorted by (timestamp, seq).
 */
export async function getAllTrades(db: Database): Promise<Trade[]> {
  const rows = await db
    .select()
    .from(trades)
    .orderBy(asc(trades.ts), asc(trades.seq));

  return rows.map(dbRowToTrade);
}

/**
 * Get all prices.
 */
export async function getAllPrices(db: Database): Promise<PriceEntry[]> {
  const rows = await db.select().from(prices);
  return rows.map((r) => ({
    symbol: r.symbol as AssetSymbol,
    price_usd: r.price_usd,
    as_of: r.as_of.toISOString(),
  }));
}

/**
 * Query trades with filtering, sorting, and pagination (server-side).
 */
export async function queryTrades(
  db: Database,
  params: TradesQueryParams,
): Promise<{ rows: any[]; total: number }> {
  const {
    page = 1,
    pageSize = 25,
    symbol,
    exchange,
    side,
    from,
    to,
    sort = 'asc',
  } = params;

  // Build conditions
  const conditions = [];
  if (symbol) conditions.push(eq(trades.symbol, symbol));
  if (exchange) conditions.push(eq(trades.exchange, exchange));
  if (side) conditions.push(eq(trades.side, side));
  if (from) conditions.push(gte(trades.ts, new Date(from)));
  if (to) conditions.push(lte(trades.ts, new Date(to)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [countResult] = await db
    .select({ value: count() })
    .from(trades)
    .where(where);
  const total = countResult?.value ?? 0;

  // Get paginated rows
  const orderDir = sort === 'desc' ? desc : asc;
  const offset = (page - 1) * pageSize;

  const rows = await db
    .select()
    .from(trades)
    .where(where)
    .orderBy(orderDir(trades.ts), orderDir(trades.seq))
    .limit(pageSize)
    .offset(offset);

  return { rows: rows.map(dbRowToTrade), total };
}

/**
 * Check if database has any trades (for auto-seed check).
 */
export async function hasAnyTrades(db: Database): Promise<boolean> {
  const result = await db.select({ value: count() }).from(trades);
  return (result[0]?.value ?? 0) > 0;
}

/** Convert a DB row to domain Trade type */
function dbRowToTrade(row: any): Trade {
  return {
    seq: row.seq,
    trade_id: row.trade_id,
    timestamp: row.ts instanceof Date ? row.ts : new Date(row.ts),
    exchange: row.exchange as Exchange,
    symbol: row.symbol as AssetSymbol,
    side: row.side as Side,
    quantity: row.quantity,
    price_usd: row.price_usd,
    fee_usd: row.fee_usd,
  };
}
