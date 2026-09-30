/**
 * ledger.ts — Replay trades to compute positions and per-trade snapshots.
 *
 * This is the core accounting engine. It uses average cost basis method:
 * - BUY: cost += qty*price + fee, qty += q, avg = cost/qty
 * - SELL: net = qty*price - fee, removed = avgBefore * q, realized = net - removed
 *         then qty -= q, cost -= removed
 * - When qty reaches exactly 0: reset cost = 0, avg = 0
 * - SELL exceeding held quantity throws ShortPositionError
 *
 * Trades MUST be sorted by (timestamp, seq) before calling replay.
 */
import { Decimal, ZERO } from './money';
import type { Trade, TradeSnapshot, Position, Symbol } from './types';

export class ShortPositionError extends Error {
  constructor(
    public readonly trade_id: string,
    public readonly symbol: string,
    public readonly attempted_qty: Decimal,
    public readonly held_qty: Decimal,
    public readonly seq: number,
  ) {
    const deficit = attempted_qty.minus(held_qty);
    super(
      `Cannot sell ${attempted_qty.toFixed()} ${symbol} — only ${held_qty.toFixed()} held (deficit: ${deficit.toFixed()}). Trade: ${trade_id}`,
    );
    this.name = 'ShortPositionError';
  }
}

interface MutablePosition {
  quantity: Decimal;
  cost: Decimal; // total cost basis
  avgCost: Decimal;
  realizedPnl: Decimal;
  totalFees: Decimal;
}

export interface ReplayResult {
  positions: Map<Symbol, Position>;
  snapshots: TradeSnapshot[];
}

/**
 * Sort trades by (timestamp, seq) for deterministic replay.
 * This ensures consistent results regardless of input order.
 */
export function sortTrades(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const timeDiff = a.timestamp.getTime() - b.timestamp.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.seq - b.seq;
  });
}

/**
 * Replay a list of trades to compute final positions and per-trade snapshots.
 * Trades must already be sorted by (timestamp, seq).
 */
export function replay(sortedTrades: Trade[]): ReplayResult {
  const posMap = new Map<Symbol, MutablePosition>();
  const snapshots: TradeSnapshot[] = [];

  for (const trade of sortedTrades) {
    const qty = new Decimal(trade.quantity);
    const price = new Decimal(trade.price_usd);
    const fee = new Decimal(trade.fee_usd);
    const grossValue = qty.mul(price);

    // Get or create position
    let pos = posMap.get(trade.symbol);
    if (!pos) {
      pos = {
        quantity: ZERO,
        cost: ZERO,
        avgCost: ZERO,
        realizedPnl: ZERO,
        totalFees: ZERO,
      };
      posMap.set(trade.symbol, pos);
    }

    // Accumulate fees regardless of side
    pos.totalFees = pos.totalFees.plus(fee);

    let snapshotRealized = ZERO;

    if (trade.side === 'BUY') {
      // BUY: cost += qty*price + fee, qty += q, avg = cost/qty
      pos.cost = pos.cost.plus(grossValue).plus(fee);
      pos.quantity = pos.quantity.plus(qty);
      pos.avgCost = pos.quantity.isZero() ? ZERO : pos.cost.div(pos.quantity);
    } else {
      // SELL
      // Check for short position
      if (qty.gt(pos.quantity)) {
        throw new ShortPositionError(
          trade.trade_id,
          trade.symbol,
          qty,
          pos.quantity,
          trade.seq,
        );
      }

      // Capture average cost BEFORE selling
      const avgBefore = pos.avgCost;

      // Net proceeds = qty * price - fee
      const netProceeds = grossValue.minus(fee);

      // Cost removed = avgBefore * qty sold
      const costRemoved = avgBefore.mul(qty);

      // Realized P&L = net proceeds - cost removed
      snapshotRealized = netProceeds.minus(costRemoved);
      pos.realizedPnl = pos.realizedPnl.plus(snapshotRealized);

      // Update position
      pos.quantity = pos.quantity.minus(qty);
      pos.cost = pos.cost.minus(costRemoved);

      // When quantity reaches exactly 0, explicitly reset to avoid floating dust
      if (pos.quantity.isZero()) {
        pos.cost = ZERO;
        pos.avgCost = ZERO;
      } else {
        // Recalculate avg cost from remaining cost and quantity
        pos.avgCost = pos.cost.div(pos.quantity);
      }
    }

    snapshots.push({
      trade_id: trade.trade_id,
      seq: trade.seq,
      timestamp: trade.timestamp.toISOString(),
      exchange: trade.exchange,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      price_usd: trade.price_usd,
      fee_usd: trade.fee_usd,
      gross_value: grossValue.toFixed(),
      position_qty: pos.quantity.toFixed(),
      avg_cost: pos.avgCost.toFixed(),
      realized_pnl: snapshotRealized.toFixed(),
    });
  }

  // Convert mutable positions to output format
  const positions = new Map<Symbol, Position>();
  for (const [symbol, pos] of posMap) {
    positions.set(symbol, {
      symbol,
      quantity: pos.quantity.toFixed(),
      avg_cost: pos.avgCost.toFixed(),
      total_cost: pos.cost.toFixed(),
      realized_pnl: pos.realizedPnl.toFixed(),
      total_fees: pos.totalFees.toFixed(),
    });
  }

  return { positions, snapshots };
}
