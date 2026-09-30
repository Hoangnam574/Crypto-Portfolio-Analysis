import React from 'react';
import type { Holding, PortfolioSummary } from '@/domain/types';
import { ASSET_METADATA, fmtUSD, fmtPrice, fmtQty, fmtPnl } from '@/components/common/Formatters';

interface HoldingsTableProps {
  summary: PortfolioSummary | null;
  summaryLoading: boolean;
  sortedHoldings: Holding[];
  holdingsSortKey: keyof Holding;
  holdingsSortDir: 'asc' | 'desc';
  toggleHoldingsSort: (key: keyof Holding) => void;
  formulaProps: (
    title: string,
    formula: string,
    calc?: string,
    desc?: string,
    placement?: 'top' | 'bottom',
  ) => Record<string, any>;
}

export function HoldingsTable({
  summary,
  summaryLoading,
  sortedHoldings,
  holdingsSortKey,
  holdingsSortDir,
  toggleHoldingsSort,
  formulaProps,
}: HoldingsTableProps) {
  const totalPnlInfo = fmtPnl(summary?.total_pnl, summary?.total_cost_basis);
  const realizedPnlInfo = fmtPnl(summary?.total_realized_pnl, summary?.total_cost_basis);
  const unrealizedPnlInfo = fmtPnl(summary?.total_unrealized_pnl, summary?.total_cost_basis);

  return (
    <section className="glass-panel" style={{ padding: '1.25rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Portfolio Holdings Breakdown</h2>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            Comprehensive position valuation and performance across all 5 assets
          </p>
        </div>
      </div>

      <div className="table-container">
        <table className="compact-table">
          <thead>
            <tr>
              <th className="sticky-col text-center">Asset</th>
              <th className="text-center">
                <button
                  onClick={() => toggleHoldingsSort('quantity')}
                  className="sort-header-btn"
                  {...formulaProps('Holding Balance', 'Total BUY Qty - Total SELL Qty', undefined, 'Current coin units held in portfolio')}
                >
                  Balance
                  <span className={`sort-indicator ${holdingsSortKey === 'quantity' ? 'active' : ''}`}>
                    {holdingsSortKey === 'quantity' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
              <th className="text-center">
                <button
                  onClick={() => toggleHoldingsSort('current_price')}
                  className="sort-header-btn"
                  {...formulaProps('Market Price', 'Snapshot Price from prices.csv', undefined, 'Reference price from closing snapshot')}
                >
                  Price
                  <span className={`sort-indicator ${holdingsSortKey === 'current_price' ? 'active' : ''}`}>
                    {holdingsSortKey === 'current_price' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
              <th className="text-center">
                <button
                  onClick={() => toggleHoldingsSort('cost_basis')}
                  className="sort-header-btn"
                  {...formulaProps('Holding Cost Basis', 'Balance × Weighted Avg Cost', undefined, 'Total invested capital remaining in active holding')}
                >
                  Cost Basis
                  <span className={`sort-indicator ${holdingsSortKey === 'cost_basis' ? 'active' : ''}`}>
                    {holdingsSortKey === 'cost_basis' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
              <th className="text-center">
                <button
                  onClick={() => toggleHoldingsSort('avg_cost')}
                  className="sort-header-btn"
                  {...formulaProps('Average Cost Basis', 'Remaining Cost Basis / Balance', undefined, 'Weighted average cost per coin including fees')}
                >
                  Avg Cost
                  <span className={`sort-indicator ${holdingsSortKey === 'avg_cost' ? 'active' : ''}`}>
                    {holdingsSortKey === 'avg_cost' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
              <th className="text-center">
                <button
                  onClick={() => toggleHoldingsSort('current_value')}
                  className="sort-header-btn"
                  {...formulaProps('Current Market Value', 'Balance × Current Market Price', undefined, 'Market valuation of open position')}
                >
                  Value
                  <span className={`sort-indicator ${holdingsSortKey === 'current_value' ? 'active' : ''}`}>
                    {holdingsSortKey === 'current_value' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
              <th className="text-center">
                <button
                  onClick={() => toggleHoldingsSort('realized_pnl')}
                  className="sort-header-btn"
                  {...formulaProps('Realized P&L', '∑ (Net Sell Proceeds - Cost Removed)', undefined, 'Cumulative profit/loss locked in from closed sell orders')}
                >
                  Realized P&L
                  <span className={`sort-indicator ${holdingsSortKey === 'realized_pnl' ? 'active' : ''}`}>
                    {holdingsSortKey === 'realized_pnl' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
              <th className="text-center">
                <button
                  onClick={() => toggleHoldingsSort('unrealized_pnl')}
                  className="sort-header-btn"
                  {...formulaProps('Unrealized P&L', 'Current Value - Cost Basis', undefined, 'Paper profit/loss based on current market price')}
                >
                  Unrealized P&L
                  <span className={`sort-indicator ${holdingsSortKey === 'unrealized_pnl' ? 'active' : ''}`}>
                    {holdingsSortKey === 'unrealized_pnl' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
              <th className="text-center">
                <button
                  onClick={() => toggleHoldingsSort('total_pnl')}
                  className="sort-header-btn"
                  {...formulaProps('Total P&L', 'Realized P&L + Unrealized P&L', undefined, 'Combined total return for this asset')}
                >
                  Total P&L
                  <span className={`sort-indicator ${holdingsSortKey === 'total_pnl' ? 'active' : ''}`}>
                    {holdingsSortKey === 'total_pnl' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
              <th className="text-center">
                <button
                  onClick={() => toggleHoldingsSort('allocation_pct')}
                  className="sort-header-btn"
                  {...formulaProps('Portfolio Allocation %', '(Asset Value / Total Portfolio Value) × 100%', undefined, 'Percentage share of this asset in total portfolio')}
                >
                  Alloc %
                  <span className={`sort-indicator ${holdingsSortKey === 'allocation_pct' ? 'active' : ''}`}>
                    {holdingsSortKey === 'allocation_pct' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {summaryLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j}>
                      <div className="skeleton" style={{ height: 16, width: '85%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              sortedHoldings.map((h) => {
                const meta = ASSET_METADATA[h.symbol] || {
                  name: h.symbol,
                  color: '#ccc',
                  bg: 'rgba(255,255,255,0.1)',
                };
                const rPnl = fmtPnl(h.realized_pnl, h.cost_basis);
                const uPnl = fmtPnl(h.unrealized_pnl, h.cost_basis);
                const tPnl = fmtPnl(h.total_pnl, h.cost_basis);
                const alloc = parseFloat(h.allocation_pct || '0');

                return (
                  <tr key={h.symbol}>
                    <td className="sticky-col text-left" style={{ paddingLeft: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.65rem' }}>
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: meta.bg,
                            color: meta.color,
                            border: `1px solid ${meta.color}40`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            flexShrink: 0,
                          }}
                        >
                          {h.symbol.slice(0, 3)}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.8rem', lineHeight: 1.2 }}>
                            {h.symbol}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>
                            {meta.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="font-numeric text-center">{fmtQty(h.quantity)}</td>
                    <td className="font-numeric text-center">{fmtPrice(h.current_price)}</td>
                    <td className="font-numeric text-center">{fmtUSD(h.cost_basis)}</td>
                    <td className="font-numeric text-center">{fmtPrice(h.avg_cost)}</td>
                    <td className="font-numeric text-center" style={{ fontWeight: 700, color: '#fff' }}>
                      {fmtUSD(h.current_value)}
                    </td>
                    <td className="font-numeric text-center">
                      <span
                        style={{
                          color: rPnl.isProfit ? 'var(--profit)' : rPnl.isLoss ? 'var(--loss)' : 'inherit',
                          fontWeight: 600,
                        }}
                      >
                        {rPnl.text}
                      </span>
                    </td>
                    <td className="font-numeric text-center">
                      <span
                        style={{
                          color: uPnl.isProfit ? 'var(--profit)' : uPnl.isLoss ? 'var(--loss)' : 'inherit',
                          fontWeight: 600,
                        }}
                      >
                        {uPnl.text}
                      </span>
                    </td>
                    <td className="font-numeric text-center">
                      <span
                        style={{
                          color: tPnl.isProfit ? 'var(--profit)' : tPnl.isLoss ? 'var(--loss)' : 'inherit',
                          fontWeight: 700,
                        }}
                      >
                        {tPnl.text}
                      </span>
                    </td>
                    <td className="font-numeric text-center">
                      <span style={{ color: alloc > 0 ? meta.color : 'var(--text-muted)', fontWeight: 700 }}>
                        {alloc.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky-col text-left" style={{ paddingLeft: '1rem' }}>
                Total
              </td>
              <td className="font-numeric text-center">—</td>
              <td className="font-numeric text-center">—</td>
              <td className="font-numeric text-center">{fmtUSD(summary?.total_cost_basis)}</td>
              <td className="font-numeric text-center">—</td>
              <td className="font-numeric text-center" style={{ color: '#fff' }}>
                {fmtUSD(summary?.total_value)}
              </td>
              <td
                className="font-numeric text-center"
                style={{ color: realizedPnlInfo.isProfit ? 'var(--profit)' : 'var(--loss)' }}
              >
                {realizedPnlInfo.text}
              </td>
              <td
                className="font-numeric text-center"
                style={{ color: unrealizedPnlInfo.isProfit ? 'var(--profit)' : 'var(--loss)' }}
              >
                {unrealizedPnlInfo.text}
              </td>
              <td
                className="font-numeric text-center"
                style={{ color: totalPnlInfo.isProfit ? 'var(--profit)' : 'var(--loss)' }}
              >
                {totalPnlInfo.text}
              </td>
              <td className="font-numeric text-center" style={{ color: 'var(--primary)' }}>
                100.0%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
