import React from 'react';
import type { PortfolioSummary } from '@/domain/types';
import { ASSET_METADATA, fmtUSD } from '@/components/common/Formatters';
import { DonutChart } from '@/components/dashboard/charts/DonutChart';
import { PnlBarChart } from '@/components/dashboard/charts/PnlBarChart';

interface ChartsSectionProps {
  summary: PortfolioSummary | null;
}

export function ChartsSection({ summary }: ChartsSectionProps) {
  return (
    <section className="charts-grid">
      {/* Chart 1: Donut Asset Allocation */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
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
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Asset Allocation</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Distribution of portfolio value across assets
            </p>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Reconciles to 100%</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '1.5rem', flex: 1 }}>
          <div style={{ position: 'relative', width: 170, height: 170, flexShrink: 0 }}>
            <DonutChart holdings={summary?.holdings || []} totalValue={summary?.total_value || '0'} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                Total Value
              </span>
              <span className="font-numeric" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                {fmtUSD(summary?.total_value)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: '170px' }}>
            {(summary?.holdings || []).map((h) => {
              const meta = ASSET_METADATA[h.symbol] || { name: h.symbol, color: '#ccc' };
              const alloc = parseFloat(h.allocation_pct || '0');
              return (
                <div
                  key={h.symbol}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.85rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: meta.color }} />
                    <span style={{ fontWeight: 600 }}>{h.symbol}</span>
                  </div>
                  <div className="font-numeric" style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{fmtUSD(h.current_value)}</span>
                    <strong style={{ minWidth: 44, textAlign: 'right', color: alloc > 0 ? meta.color : 'var(--text-muted)' }}>
                      {alloc.toFixed(1)}%
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart 2: P&L Distribution by Asset */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>P&L Distribution by Asset</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Realized vs Unrealized gain/loss breakdown
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.72rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--profit)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Realized</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--cyan)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Unrealized</span>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PnlBarChart holdings={summary?.holdings || []} />
        </div>
      </div>
    </section>
  );
}
