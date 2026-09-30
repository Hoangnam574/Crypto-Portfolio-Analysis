/**
 * portfolio.ts — Build portfolio summary from positions and current prices.
 *
 * Rules:
 * - Asset missing price: currentPrice = null, excluded from total value/unrealized.
 *   Realized P&L is still counted. warnings[] lists excluded assets.
 * - Closed positions with realized ≠ 0 still appear in holdings.
 * - Allocation returns "0" when total value is 0 (no divide-by-zero).
 */
import { Decimal, ZERO } from './money';
import type { Position, PriceEntry, Holding, PortfolioSummary, Symbol } from './types';

export function buildPortfolio(
  positions: Map<Symbol, Position>,
  prices: PriceEntry[],
): PortfolioSummary {
  const priceMap = new Map<Symbol, Decimal>();
  let pricesAsOf: string | null = null;

  for (const p of prices) {
    priceMap.set(p.symbol, new Decimal(p.price_usd));
    pricesAsOf = p.as_of; // All prices should have the same as_of
  }

  const warnings: string[] = [];
  const holdings: Holding[] = [];

  let totalValue = ZERO;
  let totalCostBasis = ZERO;
  let totalRealizedPnl = ZERO;
  let totalUnrealizedPnl = ZERO;
  let totalFees = ZERO;
  let hasAnyValue = true; // track if we can compute total value
  const missingPriceSymbols: Symbol[] = [];

  for (const [symbol, pos] of positions) {
    const qty = new Decimal(pos.quantity);
    const avgCost = new Decimal(pos.avg_cost);
    const costBasis = new Decimal(pos.total_cost);
    const realizedPnl = new Decimal(pos.realized_pnl);
    const fees = new Decimal(pos.total_fees);

    totalRealizedPnl = totalRealizedPnl.plus(realizedPnl);
    totalFees = totalFees.plus(fees);
    totalCostBasis = totalCostBasis.plus(costBasis);

    const currentPrice = priceMap.get(symbol) ?? null;

    if (currentPrice === null && !qty.isZero()) {
      // Asset has quantity but no price — cannot value
      missingPriceSymbols.push(symbol);
      hasAnyValue = false;

      holdings.push({
        symbol,
        quantity: pos.quantity,
        avg_cost: pos.avg_cost,
        current_price: null,
        cost_basis: costBasis.toFixed(),
        current_value: null,
        unrealized_pnl: null,
        realized_pnl: realizedPnl.toFixed(),
        total_pnl: null,
        allocation_pct: null,
      });
      continue;
    }

    // Compute value (even for zero-quantity positions with price available)
    const currentValue = currentPrice ? qty.mul(currentPrice) : ZERO;
    const unrealizedPnl = currentPrice ? currentValue.minus(costBasis) : ZERO;

    totalValue = totalValue.plus(currentValue);
    totalUnrealizedPnl = totalUnrealizedPnl.plus(unrealizedPnl);

    holdings.push({
      symbol,
      quantity: pos.quantity,
      avg_cost: pos.avg_cost,
      current_price: currentPrice ? currentPrice.toFixed() : null,
      cost_basis: costBasis.toFixed(),
      current_value: currentValue.toFixed(),
      unrealized_pnl: unrealizedPnl.toFixed(),
      realized_pnl: realizedPnl.toFixed(),
      total_pnl: realizedPnl.plus(unrealizedPnl).toFixed(),
      allocation_pct: '0', // computed below after we know total
    });
  }

  // Compute allocation percentages
  if (hasAnyValue && !totalValue.isZero()) {
    for (const h of holdings) {
      if (h.current_value !== null) {
        const val = new Decimal(h.current_value);
        h.allocation_pct = val.div(totalValue).mul(100).toFixed();
      }
    }
  }

  // Add warnings for missing prices
  if (missingPriceSymbols.length > 0) {
    warnings.push(
      `Missing price data for: ${missingPriceSymbols.join(', ')}. ` +
      `These assets are excluded from total portfolio value and unrealized P&L calculations.`,
    );
  }

  // Sort holdings by current value descending (nulls last)
  holdings.sort((a, b) => {
    if (a.current_value === null && b.current_value === null) return 0;
    if (a.current_value === null) return 1;
    if (b.current_value === null) return -1;
    return new Decimal(b.current_value).minus(new Decimal(a.current_value)).toNumber();
  });

  return {
    total_value: hasAnyValue ? totalValue.toFixed() : null,
    total_cost_basis: totalCostBasis.toFixed(),
    total_realized_pnl: totalRealizedPnl.toFixed(),
    total_unrealized_pnl: hasAnyValue ? totalUnrealizedPnl.toFixed() : null,
    total_pnl: hasAnyValue
      ? totalRealizedPnl.plus(totalUnrealizedPnl).toFixed()
      : null,
    total_fees: totalFees.toFixed(),
    holdings,
    warnings,
    prices_as_of: pricesAsOf,
  };
}
