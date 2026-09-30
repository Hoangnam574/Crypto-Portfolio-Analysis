import React from 'react';
import type { PortfolioSummary } from '@/domain/types';
import { fmtUSD, fmtPnl } from '@/components/common/Formatters';
import { IconArrowUpRight, IconArrowDownRight } from '@/components/common/Icons';

interface KpiGridProps {
  summary: PortfolioSummary | null;
  summaryLoading: boolean;
  formulaProps: (
    title: string,
    formula: string,
    calc?: string,
    desc?: string,
    placement?: 'top' | 'bottom',
  ) => Record<string, any>;
}

export function KpiGrid({ summary, summaryLoading, formulaProps }: KpiGridProps) {
  const totalPnlInfo = fmtPnl(summary?.total_pnl, summary?.total_cost_basis);
  const realizedPnlInfo = fmtPnl(summary?.total_realized_pnl, summary?.total_cost_basis);
  const unrealizedPnlInfo = fmtPnl(summary?.total_unrealized_pnl, summary?.total_cost_basis);

  return (
    <section className="kpi-grid">
      {/* 1. Portfolio Value */}
      <div
        className="glass-card kpi-card"
        style={{ padding: '1rem' }}
        {...formulaProps(
          'Current Portfolio Value',
          '∑ (Asset Balance × Market Price)',
          fmtUSD(summary?.total_value),
          'Valuation based on prices.csv closing price snapshot',
          'bottom',
        )}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span className="kpi-label">Current Value</span>
          <span
            style={{
              fontSize: '0.65rem',
              color: 'var(--cyan)',
              background: 'var(--cyan-glow)',
              padding: '0.1rem 0.35rem',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            USD
          </span>
        </div>
        <div
          className="font-numeric kpi-card-value"
          style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '0.35rem', color: '#fff' }}
        >
          {summaryLoading ? <div className="skeleton" style={{ height: 26, width: '70%' }} /> : fmtUSD(summary?.total_value)}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Active positions across 5 assets
        </div>
      </div>

      {/* 2. Total Cost Basis */}
      <div
        className="glass-card kpi-card"
        style={{ padding: '1rem' }}
        {...formulaProps(
          'Total Cost Basis',
          '∑ (Asset Balance × Weighted Avg Cost)',
          fmtUSD(summary?.total_cost_basis),
          'Capitalizes BUY gross value + fees; deducts avg cost proportionally on sells',
          'bottom',
        )}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span className="kpi-label">Cost Basis</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Weighted-Avg</span>
        </div>
        <div
          className="font-numeric kpi-card-value"
          style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--text-primary)' }}
        >
          {summaryLoading ? <div className="skeleton" style={{ height: 26, width: '70%' }} /> : fmtUSD(summary?.total_cost_basis)}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Capitalized BUY fees included
        </div>
      </div>

      {/* 3. Realized P&L */}
      <div
        className="glass-card kpi-card"
        style={{ padding: '1rem' }}
        {...formulaProps(
          'Cumulative Realized P&L',
          '∑ (Net Proceeds - Cost Basis Removed)',
          `${realizedPnlInfo.text}${realizedPnlInfo.pct}`,
          'Net Proceeds = Gross - Fee; Cost Removed = Qty Sold × Pre-trade Avg Cost',
          'bottom',
        )}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span className="kpi-label">Realized P&L</span>
          {realizedPnlInfo.isProfit && <span className="badge-profit"><IconArrowUpRight /> WIN</span>}
          {realizedPnlInfo.isLoss && <span className="badge-loss"><IconArrowDownRight /> LOSS</span>}
        </div>
        <div
          className="font-numeric kpi-card-value"
          style={{
            fontSize: '1.45rem',
            fontWeight: 800,
            marginTop: '0.35rem',
            color: realizedPnlInfo.isProfit ? 'var(--profit)' : realizedPnlInfo.isLoss ? 'var(--loss)' : 'inherit',
          }}
        >
          {summaryLoading ? <div className="skeleton" style={{ height: 26, width: '70%' }} /> : `${realizedPnlInfo.text}${realizedPnlInfo.pct}`}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Net of SELL fee deductions
        </div>
      </div>

      {/* 4. Unrealized P&L */}
      <div
        className="glass-card kpi-card"
        style={{ padding: '1rem' }}
        {...formulaProps(
          'Total Unrealized P&L (Paper Return)',
          'Current Portfolio Value - Total Cost Basis',
          `${fmtUSD(summary?.total_value)} - ${fmtUSD(summary?.total_cost_basis)} = ${unrealizedPnlInfo.text}`,
          'Paper return on active holdings vs current snapshot prices',
          'bottom',
        )}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span className="kpi-label">Unrealized P&L</span>
          {unrealizedPnlInfo.isProfit && <span className="badge-profit"><IconArrowUpRight /> PAPER</span>}
          {unrealizedPnlInfo.isLoss && <span className="badge-loss"><IconArrowDownRight /> LOSS</span>}
        </div>
        <div
          className="font-numeric kpi-card-value"
          style={{
            fontSize: '1.45rem',
            fontWeight: 800,
            marginTop: '0.35rem',
            color: unrealizedPnlInfo.isProfit ? 'var(--profit)' : unrealizedPnlInfo.isLoss ? 'var(--loss)' : 'inherit',
          }}
        >
          {summaryLoading ? <div className="skeleton" style={{ height: 26, width: '70%' }} /> : `${unrealizedPnlInfo.text}${unrealizedPnlInfo.pct}`}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Value minus active cost basis
        </div>
      </div>

      {/* 5. Total P&L */}
      <div
        className="glass-card kpi-card"
        style={{
          padding: '1rem',
          borderColor: totalPnlInfo.isProfit
            ? 'var(--profit-border)'
            : totalPnlInfo.isLoss
            ? 'var(--loss-border)'
            : 'var(--border-subtle)',
        }}
        {...formulaProps(
          'Net Total Portfolio P&L',
          'Realized P&L + Unrealized P&L',
          `${realizedPnlInfo.text} + ${unrealizedPnlInfo.text} = ${totalPnlInfo.text}`,
          'All-time combined trading performance combining realized gains and open paper returns',
          'bottom',
        )}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span
            className="kpi-label"
            style={{ color: totalPnlInfo.isProfit ? 'var(--profit)' : 'var(--primary)' }}
          >
            Net Total P&L
          </span>
          <span
            style={{
              fontSize: '0.65rem',
              padding: '0.1rem 0.35rem',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.06)',
              fontWeight: 600,
            }}
          >
            R + U
          </span>
        </div>
        <div
          className="font-numeric kpi-card-value"
          style={{
            fontSize: '1.45rem',
            fontWeight: 800,
            marginTop: '0.35rem',
            color: totalPnlInfo.isProfit ? 'var(--profit)' : totalPnlInfo.isLoss ? 'var(--loss)' : '#fff',
          }}
        >
          {summaryLoading ? <div className="skeleton" style={{ height: 26, width: '70%' }} /> : `${totalPnlInfo.text}${totalPnlInfo.pct}`}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Cumulative portfolio return
        </div>
      </div>

      {/* 6. Total Fees Paid */}
      <div
        className="glass-card kpi-card"
        style={{ padding: '1rem' }}
        {...formulaProps(
          'Total Trading Fees',
          '∑ BUY Fees + ∑ SELL Fees',
          fmtUSD(summary?.total_fees),
          'Sum of all broker / exchange fees paid across Binance and Coinbase',
          'bottom',
        )}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span className="kpi-label">Trading Fees</span>
          <span
            style={{
              fontSize: '0.62rem',
              color: '#fbbf24',
              background: 'rgba(251, 191, 36, 0.1)',
              padding: '0.1rem 0.35rem',
              borderRadius: 4,
            }}
          >
            BINANCE + CB
          </span>
        </div>
        <div
          className="font-numeric kpi-card-value"
          style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '0.35rem', color: '#fbbf24' }}
        >
          {summaryLoading ? <div className="skeleton" style={{ height: 26, width: '70%' }} /> : fmtUSD(summary?.total_fees)}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          200 executions tracked
        </div>
      </div>
    </section>
  );
}
