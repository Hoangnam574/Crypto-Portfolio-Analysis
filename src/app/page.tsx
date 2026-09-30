'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  PortfolioSummary,
  TradesResponse,
  TradeSnapshot,
  Holding,
  Symbol as AssetSymbol,
  Exchange,
  Side,
  ImportError,
} from '@/domain/types';
import { SYMBOLS, EXCHANGES, SIDES } from '@/domain/types';

// ─── Asset Meta & Color Tokens ───────────────────────────────────────

const ASSET_METADATA: Record<string, { name: string; color: string; bg: string }> = {
  BTC: { name: 'Bitcoin', color: '#f7931a', bg: 'rgba(247, 147, 26, 0.15)' },
  ETH: { name: 'Ethereum', color: '#8c8cf7', bg: 'rgba(140, 140, 247, 0.15)' },
  SOL: { name: 'Solana', color: '#14f195', bg: 'rgba(20, 241, 149, 0.15)' },
  CKB: { name: 'Nervos Network', color: '#00e1a5', bg: 'rgba(0, 225, 165, 0.15)' },
  DOGE: { name: 'Dogecoin', color: '#c2a633', bg: 'rgba(194, 166, 51, 0.15)' },
};

// ─── Formatters ──────────────────────────────────────────────────────

function fmtUSD(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtPrice(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(n)) return '—';
  if (Math.abs(n) < 1 && Math.abs(n) > 0) {
    return '$' + n.toPrecision(6);
  }
  return fmtUSD(value);
}

function fmtQty(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(n)) return '—';
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, '') || '0';
}

function fmtPnl(value?: string | number | null, costBasis?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return { text: '—', pct: '', isProfit: false, isLoss: false, ariaLabel: 'unavailable' };
  }
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(n)) {
    return { text: '—', pct: '', isProfit: false, isLoss: false, ariaLabel: 'unavailable' };
  }

  const formatted = fmtUSD(Math.abs(n));
  const cb = costBasis ? (typeof costBasis === 'number' ? costBasis : parseFloat(costBasis)) : 0;
  const pctStr = cb > 0 ? ` (${((n / cb) * 100).toFixed(1)}%)` : '';

  if (n > 0) {
    return { text: `+${formatted}`, pct: pctStr, isProfit: true, isLoss: false, ariaLabel: `profit ${formatted}` };
  }
  if (n < 0) {
    return { text: `−${formatted}`, pct: pctStr, isProfit: false, isLoss: true, ariaLabel: `loss ${formatted}` };
  }
  return { text: formatted, pct: '', isProfit: false, isLoss: false, ariaLabel: 'break even' };
}

function formatDate(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toISOString().replace('T', ' ').slice(0, 16);
  } catch {
    return isoStr;
  }
}

// ─── SVG Icons ───────────────────────────────────────────────────────

function IconLayoutDashboard({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}

function IconList({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function IconArrowUpRight({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M17 7H7M17 7V17" />
    </svg>
  );
}

function IconArrowDownRight({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7l10 10M17 7v10H7" />
    </svg>
  );
}

function IconUpload({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconRotateCcw({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function IconAlertTriangle({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconX({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Main Dashboard Page ─────────────────────────────────────────────

export default function Dashboard() {
  // Tabs: 'dashboard' | 'transactions'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions'>('dashboard');

  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Modals
  const [importOpen, setImportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Transactions state
  const [trades, setTrades] = useState<TradeSnapshot[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [tradesError, setTradesError] = useState<string | null>(null);
  const [totalTrades, setTotalTrades] = useState(0);

  // Explorer filters & server sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [symbolFilter, setSymbolFilter] = useState<AssetSymbol | ''>('');
  const [exchangeFilter, setExchangeFilter] = useState<Exchange | ''>('');
  const [sideFilter, setSideFilter] = useState<Side | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Page Jump Input State
  const [pageJumpInput, setPageJumpInput] = useState('1');

  // Transactions column sort state (supports sorting by every column!)
  const [txSortCol, setTxSortCol] = useState<keyof TradeSnapshot>('timestamp');
  const [txSortDir, setTxSortDir] = useState<'asc' | 'desc'>('asc');

  // Holdings sort state
  const [holdingsSortKey, setHoldingsSortKey] = useState<keyof Holding>('current_value');
  const [holdingsSortDir, setHoldingsSortDir] = useState<'asc' | 'desc'>('desc');

  // Load portfolio summary
  const loadPortfolio = useCallback(async () => {
    try {
      setSummaryLoading(true);
      setSummaryError(null);
      const res = await fetch('/api/portfolio');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data: PortfolioSummary = await res.json();
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to load portfolio:', err);
      setSummaryError(err.message || 'Unable to connect to database server.');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Load transaction explorer rows
  const loadTrades = useCallback(async () => {
    try {
      setTradesLoading(true);
      setTradesError(null);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort: sortOrder,
      });
      if (symbolFilter) params.set('symbol', symbolFilter);
      if (exchangeFilter) params.set('exchange', exchangeFilter);
      if (sideFilter) params.set('side', sideFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await fetch(`/api/trades?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data: TradesResponse = await res.json();
      setTrades(data.rows || []);
      setTotalTrades(data.total || 0);
      setPageJumpInput(String(data.page || page));
    } catch (err: any) {
      console.error('Failed to load trades:', err);
      setTradesError(err.message || 'Unable to load transactions.');
    } finally {
      setTradesLoading(false);
    }
  }, [page, pageSize, sortOrder, symbolFilter, exchangeFilter, sideFilter, fromDate, toDate]);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  // Handle direct page jump
  const totalPages = Math.max(1, Math.ceil(totalTrades / pageSize));

  const handleJumpToPage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const p = parseInt(pageJumpInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setPage(p);
    } else {
      setPageJumpInput(String(page));
    }
  };

  // Reset database handler
  const handleReset = async () => {
    try {
      setResetting(true);
      const res = await fetch('/api/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      setResetOpen(false);
      await Promise.all([loadPortfolio(), loadTrades()]);
    } catch (err: any) {
      alert(`Reset error: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  // Sort holdings table
  const sortedHoldings = useMemo(() => {
    if (!summary?.holdings) return [];
    return [...summary.holdings].sort((a, b) => {
      const valA = parseFloat(String(a[holdingsSortKey] ?? '0')) || 0;
      const valB = parseFloat(String(b[holdingsSortKey] ?? '0')) || 0;
      return holdingsSortDir === 'desc' ? valB - valA : valA - valB;
    });
  }, [summary?.holdings, holdingsSortKey, holdingsSortDir]);

  const toggleHoldingsSort = (key: keyof Holding) => {
    if (holdingsSortKey === key) {
      setHoldingsSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setHoldingsSortKey(key);
      setHoldingsSortDir('desc');
    }
  };

  // Sort transactions table by ANY of the 12 columns
  const sortedTrades = useMemo(() => {
    if (!trades) return [];
    return [...trades].sort((a, b) => {
      const field = txSortCol;
      let comp = 0;
      if (field === 'timestamp') {
        comp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else if (['quantity', 'price_usd', 'fee_usd', 'gross_value', 'position_qty', 'avg_cost', 'realized_pnl', 'seq'].includes(field)) {
        const numA = parseFloat(String(a[field] || '0')) || 0;
        const numB = parseFloat(String(b[field] || '0')) || 0;
        comp = numA - numB;
      } else {
        comp = String(a[field] || '').localeCompare(String(b[field] || ''));
      }
      return txSortDir === 'desc' ? -comp : comp;
    });
  }, [trades, txSortCol, txSortDir]);

  const toggleTxSort = (col: keyof TradeSnapshot) => {
    if (txSortCol === col) {
      const newDir = txSortDir === 'asc' ? 'desc' : 'asc';
      setTxSortDir(newDir);
      if (col === 'timestamp') setSortOrder(newDir);
    } else {
      setTxSortCol(col);
      setTxSortDir('asc');
      if (col === 'timestamp') setSortOrder('asc');
    }
  };

  const hasActiveFilters = Boolean(symbolFilter || exchangeFilter || sideFilter || fromDate || toDate);

  const clearFilters = () => {
    setSymbolFilter('');
    setExchangeFilter('');
    setSideFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  // KPI Calculations
  const totalPnlInfo = fmtPnl(summary?.total_pnl, summary?.total_cost_basis);
  const realizedPnlInfo = fmtPnl(summary?.total_realized_pnl, summary?.total_cost_basis);
  const unrealizedPnlInfo = fmtPnl(summary?.total_unrealized_pnl, summary?.total_cost_basis);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ─── Top Navbar ────────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(11, 16, 28, 0.95)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Brand & Live status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(245, 158, 11, 0.35)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#070a12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                  Crypto Portfolio Analytics
                </h1>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.1rem' }}>
                <span className="pulse-dot" />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  Valued as of: <strong style={{ color: 'var(--text-primary)' }}>{summary?.prices_as_of ? formatDate(summary.prices_as_of) : '2026-03-31 23:59 UTC'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', padding: '0.25rem', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <IconLayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`nav-tab ${activeTab === 'transactions' ? 'active' : ''}`}
            >
              <IconList className="w-4 h-4" />
              <span>Transactions</span>
              <span className="tab-badge">{totalTrades}</span>
            </button>
          </div>

          {/* Top Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              onClick={() => { loadPortfolio(); loadTrades(); }}
              className="btn btn-secondary"
              title="Refresh Data"
              style={{ padding: '0.45rem 0.7rem' }}
            >
              <IconRotateCcw className={`w-3.5 h-3.5 ${summaryLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline" style={{ fontSize: '0.8rem' }}>Refresh</span>
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="btn btn-primary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
            >
              <IconUpload className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>
            <button
              onClick={() => setResetOpen(true)}
              className="btn btn-danger"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
              title="Reset to 200 synthetic sample trades"
            >
              <IconRotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─────────────────────────────────────────── */}
      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.25rem 1.5rem', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Warning Banners */}
        {summary?.warnings && summary.warnings.length > 0 && (
          <div
            style={{
              padding: '0.85rem 1.15rem',
              borderRadius: 10,
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <IconAlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div style={{ fontSize: '0.82rem', color: '#fef3c7' }}>
              <strong>Valuation Notice:</strong> {summary.warnings.join(' ')}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 1: DASHBOARD (KPIs, Charts, Holdings Table)
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <>
            {/* ─── 6 Headline KPI Cards ───────────────────────────────── */}
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.85rem' }}>
              {/* 1. Portfolio Value */}
              <div className="glass-card" style={{ padding: '1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="kpi-label">Current Value</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--cyan)', background: 'var(--cyan-glow)', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 600 }}>USD</span>
                </div>
                <div className="font-numeric" style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '0.4rem', color: '#fff' }}>
                  {summaryLoading ? <div className="skeleton" style={{ height: 28, width: '70%' }} /> : fmtUSD(summary?.total_value)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Active positions across 5 assets
                </div>
              </div>

              {/* 2. Total Cost Basis */}
              <div className="glass-card" style={{ padding: '1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="kpi-label">Cost Basis</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Weighted-Avg</span>
                </div>
                <div className="font-numeric" style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-primary)' }}>
                  {summaryLoading ? <div className="skeleton" style={{ height: 28, width: '70%' }} /> : fmtUSD(summary?.total_cost_basis)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Capitalized BUY fees included
                </div>
              </div>

              {/* 3. Realized P&L */}
              <div className="glass-card" style={{ padding: '1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="kpi-label">Realized P&L</span>
                  {realizedPnlInfo.isProfit && <span className="badge-profit"><IconArrowUpRight /> WIN</span>}
                  {realizedPnlInfo.isLoss && <span className="badge-loss"><IconArrowDownRight /> LOSS</span>}
                </div>
                <div
                  className="font-numeric"
                  style={{
                    fontSize: '1.55rem',
                    fontWeight: 800,
                    marginTop: '0.4rem',
                    color: realizedPnlInfo.isProfit ? 'var(--profit)' : realizedPnlInfo.isLoss ? 'var(--loss)' : 'inherit',
                  }}
                >
                  {summaryLoading ? <div className="skeleton" style={{ height: 28, width: '70%' }} /> : `${realizedPnlInfo.text}${realizedPnlInfo.pct}`}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Net of SELL fee deductions
                </div>
              </div>

              {/* 4. Unrealized P&L */}
              <div className="glass-card" style={{ padding: '1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="kpi-label">Unrealized P&L</span>
                  {unrealizedPnlInfo.isProfit && <span className="badge-profit"><IconArrowUpRight /> PAPER</span>}
                  {unrealizedPnlInfo.isLoss && <span className="badge-loss"><IconArrowDownRight /> LOSS</span>}
                </div>
                <div
                  className="font-numeric"
                  style={{
                    fontSize: '1.55rem',
                    fontWeight: 800,
                    marginTop: '0.4rem',
                    color: unrealizedPnlInfo.isProfit ? 'var(--profit)' : unrealizedPnlInfo.isLoss ? 'var(--loss)' : 'inherit',
                  }}
                >
                  {summaryLoading ? <div className="skeleton" style={{ height: 28, width: '70%' }} /> : `${unrealizedPnlInfo.text}${unrealizedPnlInfo.pct}`}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Value minus active cost basis
                </div>
              </div>

              {/* 5. Total P&L */}
              <div className="glass-card" style={{ padding: '1.1rem', borderColor: totalPnlInfo.isProfit ? 'var(--profit-border)' : totalPnlInfo.isLoss ? 'var(--loss-border)' : 'var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="kpi-label" style={{ color: totalPnlInfo.isProfit ? 'var(--profit)' : 'var(--primary)' }}>Net Total P&L</span>
                  <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 4, background: 'rgba(255,255,255,0.06)', fontWeight: 600 }}>R + U</span>
                </div>
                <div
                  className="font-numeric"
                  style={{
                    fontSize: '1.55rem',
                    fontWeight: 800,
                    marginTop: '0.4rem',
                    color: totalPnlInfo.isProfit ? 'var(--profit)' : totalPnlInfo.isLoss ? 'var(--loss)' : '#fff',
                  }}
                >
                  {summaryLoading ? <div className="skeleton" style={{ height: 28, width: '70%' }} /> : `${totalPnlInfo.text}${totalPnlInfo.pct}`}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Cumulative portfolio return
                </div>
              </div>

              {/* 6. Total Fees Paid */}
              <div className="glass-card" style={{ padding: '1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="kpi-label">Trading Fees</span>
                  <span style={{ fontSize: '0.65rem', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>BINANCE + CB</span>
                </div>
                <div className="font-numeric" style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '0.4rem', color: '#fbbf24' }}>
                  {summaryLoading ? <div className="skeleton" style={{ height: 28, width: '70%' }} /> : fmtUSD(summary?.total_fees)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  200 executions tracked
                </div>
              </div>
            </section>

            {/* ─── Visual Analytics Section ───────────────────────────── */}
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem' }}>
              {/* Chart 1: Donut Asset Allocation */}
              <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Asset Allocation</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Distribution of portfolio value across assets</p>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Reconciles to 100%</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '1.5rem', flex: 1 }}>
                  <div style={{ position: 'relative', width: 170, height: 170 }}>
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
                      <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Total Value</span>
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
                        <div key={h.symbol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.85rem', fontSize: '0.8rem' }}>
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

              {/* Chart 2: P&L Comparison (Realized vs Unrealized) */}
              <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>P&L Distribution by Asset</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Realized vs Unrealized gain/loss breakdown</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--profit)' }} /> Realized
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--cyan)' }} /> Unrealized
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1, minHeight: 170, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PnlBarChart holdings={summary?.holdings || []} />
                </div>
              </div>
            </section>

            {/* ─── Holdings Table Section ──────────────────────────────── */}
            <section className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Portfolio Holdings Breakdown</h2>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Comprehensive position valuation and performance across all 5 assets
                  </p>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Click column headers to sort
                </span>
              </div>

              <div className="table-container">
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th className="sticky-col text-center">Asset</th>
                      <th className="text-center">
                        <button onClick={() => toggleHoldingsSort('quantity')} className="sort-header-btn">
                          Balance
                          <span className={`sort-indicator ${holdingsSortKey === 'quantity' ? 'active' : ''}`}>
                            {holdingsSortKey === 'quantity' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                          </span>
                        </button>
                      </th>
                      <th className="text-center">
                        <button onClick={() => toggleHoldingsSort('current_price')} className="sort-header-btn">
                          Price
                          <span className={`sort-indicator ${holdingsSortKey === 'current_price' ? 'active' : ''}`}>
                            {holdingsSortKey === 'current_price' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                          </span>
                        </button>
                      </th>
                      <th className="text-center">
                        <button onClick={() => toggleHoldingsSort('cost_basis')} className="sort-header-btn">
                          Cost Basis
                          <span className={`sort-indicator ${holdingsSortKey === 'cost_basis' ? 'active' : ''}`}>
                            {holdingsSortKey === 'cost_basis' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                          </span>
                        </button>
                      </th>
                      <th className="text-center">
                        <button onClick={() => toggleHoldingsSort('avg_cost')} className="sort-header-btn">
                          Avg Cost
                          <span className={`sort-indicator ${holdingsSortKey === 'avg_cost' ? 'active' : ''}`}>
                            {holdingsSortKey === 'avg_cost' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                          </span>
                        </button>
                      </th>
                      <th className="text-center">
                        <button onClick={() => toggleHoldingsSort('current_value')} className="sort-header-btn">
                          Value
                          <span className={`sort-indicator ${holdingsSortKey === 'current_value' ? 'active' : ''}`}>
                            {holdingsSortKey === 'current_value' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                          </span>
                        </button>
                      </th>
                      <th className="text-center">
                        <button onClick={() => toggleHoldingsSort('realized_pnl')} className="sort-header-btn">
                          Realized P&L
                          <span className={`sort-indicator ${holdingsSortKey === 'realized_pnl' ? 'active' : ''}`}>
                            {holdingsSortKey === 'realized_pnl' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                          </span>
                        </button>
                      </th>
                      <th className="text-center">
                        <button onClick={() => toggleHoldingsSort('unrealized_pnl')} className="sort-header-btn">
                          Unrealized P&L
                          <span className={`sort-indicator ${holdingsSortKey === 'unrealized_pnl' ? 'active' : ''}`}>
                            {holdingsSortKey === 'unrealized_pnl' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                          </span>
                        </button>
                      </th>
                      <th className="text-center">
                        <button onClick={() => toggleHoldingsSort('total_pnl')} className="sort-header-btn">
                          Total P&L
                          <span className={`sort-indicator ${holdingsSortKey === 'total_pnl' ? 'active' : ''}`}>
                            {holdingsSortKey === 'total_pnl' && holdingsSortDir === 'desc' ? '▼' : '▲'}
                          </span>
                        </button>
                      </th>
                      <th className="text-center">
                        <button onClick={() => toggleHoldingsSort('allocation_pct')} className="sort-header-btn">
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
                            <td key={j}><div className="skeleton" style={{ height: 16, width: '85%' }} /></td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      sortedHoldings.map((h) => {
                        const meta = ASSET_METADATA[h.symbol] || { name: h.symbol, color: '#ccc', bg: 'rgba(255,255,255,0.1)' };
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
                                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.8rem', lineHeight: 1.2 }}>{h.symbol}</div>
                                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>{meta.name}</div>
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
                              <span style={{ color: rPnl.isProfit ? 'var(--profit)' : rPnl.isLoss ? 'var(--loss)' : 'inherit', fontWeight: 600 }}>
                                {rPnl.text}
                              </span>
                            </td>
                            <td className="font-numeric text-center">
                              <span style={{ color: uPnl.isProfit ? 'var(--profit)' : uPnl.isLoss ? 'var(--loss)' : 'inherit', fontWeight: 600 }}>
                                {uPnl.text}
                              </span>
                            </td>
                            <td className="font-numeric text-center">
                              <span style={{ color: tPnl.isProfit ? 'var(--profit)' : tPnl.isLoss ? 'var(--loss)' : 'inherit', fontWeight: 700 }}>
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
                      <td className="sticky-col text-left" style={{ paddingLeft: '1rem' }}>Total</td>
                      <td className="font-numeric text-center">—</td>
                      <td className="font-numeric text-center">—</td>
                      <td className="font-numeric text-center">{fmtUSD(summary?.total_cost_basis)}</td>
                      <td className="font-numeric text-center">—</td>
                      <td className="font-numeric text-center" style={{ color: '#fff' }}>{fmtUSD(summary?.total_value)}</td>
                      <td className="font-numeric text-center" style={{ color: realizedPnlInfo.isProfit ? 'var(--profit)' : 'var(--loss)' }}>
                        {realizedPnlInfo.text}
                      </td>
                      <td className="font-numeric text-center" style={{ color: unrealizedPnlInfo.isProfit ? 'var(--profit)' : 'var(--loss)' }}>
                        {unrealizedPnlInfo.text}
                      </td>
                      <td className="font-numeric text-center" style={{ color: totalPnlInfo.isProfit ? 'var(--profit)' : 'var(--loss)' }}>
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
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 2: TRANSACTIONS (Filters, Table Fits Screen, Sort, Jump Page)
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'transactions' && (
          <section className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Transaction Ledger & Audit Trail</h2>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  Chronological trade executions with post-trade balance snapshots. Click any column header to sort.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Showing:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{trades.length}</strong>
                <span style={{ color: 'var(--text-muted)' }}>of</span>
                <strong style={{ color: 'var(--primary)' }}>{totalTrades}</strong>
                <span style={{ color: 'var(--text-muted)' }}>records</span>
              </div>
            </div>

            {/* Filter Bar */}
            <div
              style={{
                padding: '0.85rem',
                borderRadius: 10,
                background: 'rgba(7, 10, 18, 0.45)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              {/* Row 1: Symbol, Exchange, Side chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center' }}>
                {/* Asset Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Asset:</span>
                  <button onClick={() => { setSymbolFilter(''); setPage(1); }} className={`filter-chip ${symbolFilter === '' ? 'active' : ''}`} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
                    All
                  </button>
                  {SYMBOLS.map((s) => (
                    <button key={s} onClick={() => { setSymbolFilter(s); setPage(1); }} className={`filter-chip ${symbolFilter === s ? 'active' : ''}`} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
                      {s}
                    </button>
                  ))}
                </div>

                {/* Exchange Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Exchange:</span>
                  <button onClick={() => { setExchangeFilter(''); setPage(1); }} className={`filter-chip ${exchangeFilter === '' ? 'active' : ''}`} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
                    All
                  </button>
                  {EXCHANGES.map((ex) => (
                    <button key={ex} onClick={() => { setExchangeFilter(ex); setPage(1); }} className={`filter-chip ${exchangeFilter === ex ? 'active' : ''}`} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
                      {ex}
                    </button>
                  ))}
                </div>

                {/* Side Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Side:</span>
                  <button onClick={() => { setSideFilter(''); setPage(1); }} className={`filter-chip ${sideFilter === '' ? 'active' : ''}`} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
                    All
                  </button>
                  {SIDES.map((sd) => (
                    <button key={sd} onClick={() => { setSideFilter(sd); setPage(1); }} className={`filter-chip ${sideFilter === sd ? 'active' : ''}`} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
                      {sd}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Date Filters & Clear */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date (UTC):</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                      borderRadius: 6,
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.78rem',
                    }}
                    title="From date"
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>→</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                      borderRadius: 6,
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.78rem',
                    }}
                    title="To date"
                  />
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="btn btn-secondary" style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}>
                      <IconX className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Page Size:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                      borderRadius: 6,
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.78rem',
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Compact Transactions Table (Fits 1 screen without horizontal scrolling) */}
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="compact-table">
                <thead>
                  <tr>
                    {/* 1. ID */}
                    <th className="sticky-col text-center" style={{ width: '75px' }}>
                      <button onClick={() => toggleTxSort('trade_id')} className="sort-header-btn">
                        ID
                        <span className={`sort-indicator ${txSortCol === 'trade_id' ? 'active' : ''}`}>
                          {txSortCol === 'trade_id' && txSortDir === 'desc' ? '▼' : '▲'}
                        </span>
                      </button>
                    </th>
                    {/* 2. Timestamp */}
                    <th className="text-center" style={{ width: '120px' }}>
                      <button onClick={() => toggleTxSort('timestamp')} className="sort-header-btn">
                        Time (UTC)
                        <span className={`sort-indicator ${txSortCol === 'timestamp' ? 'active' : ''}`}>
                          {txSortCol === 'timestamp' && txSortDir === 'desc' ? '▼' : '▲'}
                        </span>
                      </button>
                    </th>
                    {/* 3. Exchange */}
                    <th className="text-center" style={{ width: '45px' }}>
                      <button onClick={() => toggleTxSort('exchange')} className="sort-header-btn">
                        Ex
                        <span className={`sort-indicator ${txSortCol === 'exchange' ? 'active' : ''}`}>
                          {txSortCol === 'exchange' && txSortDir === 'desc' ? '▼' : '▲'}
                        </span>
                      </button>
                    </th>
                    {/* 4. Symbol */}
                    <th className="text-center" style={{ width: '50px' }}>
                      <button onClick={() => toggleTxSort('symbol')} className="sort-header-btn">
                        Asset
                        <span className={`sort-indicator ${txSortCol === 'symbol' ? 'active' : ''}`}>
                          {txSortCol === 'symbol' && txSortDir === 'desc' ? '▼' : '▲'}
                        </span>
                      </button>
                    </th>
                    {/* 5. Side */}
                    <th className="text-center" style={{ width: '55px' }}>
                      <button onClick={() => toggleTxSort('side')} className="sort-header-btn">
                        Side
                        <span className={`sort-indicator ${txSortCol === 'side' ? 'active' : ''}`}>
                          {txSortCol === 'side' && txSortDir === 'desc' ? '▼' : '▲'}
                        </span>
                      </button>
                    </th>
                    {/* 6. Quantity */}
                    <th className="text-center" style={{ width: '85px' }}>
                      <button onClick={() => toggleTxSort('quantity')} className="sort-header-btn">
                        Qty
                        <span className={`sort-indicator ${txSortCol === 'quantity' ? 'active' : ''}`}>
                          {txSortCol === 'quantity' && txSortDir === 'desc' ? '▼' : '▲'}
                        </span>
                      </button>
                    </th>
                    {/* 7. Price */}
                    <th className="text-center" style={{ width: '95px' }}>
                      <button onClick={() => toggleTxSort('price_usd')} className="sort-header-btn">
                        Price
                        <span className={`sort-indicator ${txSortCol === 'price_usd' ? 'active' : ''}`}>
                          {txSortCol === 'price_usd' && txSortDir === 'desc' ? '▼' : '▲'}
                        </span>
                      </button>
                    </th>
                    {/* 8. Fee */}
                    <th className="text-center" style={{ width: '65px' }}>
                      <button onClick={() => toggleTxSort('fee_usd')} className="sort-header-btn">
                        Fee
                        <span className={`sort-indicator ${txSortCol === 'fee_usd' ? 'active' : ''}`}>
                          {txSortCol === 'fee_usd' && txSortDir === 'desc' ? '▼' : '▲'}
                        </span>
                      </button>
                    </th>
                    {/* 9. Gross */}
                    <th className="text-center" style={{ width: '95px' }}>
                      <button onClick={() => toggleTxSort('gross_value')} className="sort-header-btn">
                        Gross
                        <span className={`sort-indicator ${txSortCol === 'gross_value' ? 'active' : ''}`}>
                          {txSortCol === 'gross_value' && txSortDir === 'desc' ? '▼' : '▲'}
                        </span>
                      </button>
                    </th>
                    {/* 10. Position After */}
                    <th className="text-center" style={{ width: '85px' }}>
                      <button onClick={() => toggleTxSort('position_qty')} className="sort-header-btn">
                        Pos After
                        <span className={`sort-indicator ${txSortCol === 'position_qty' ? 'active' : ''}`}>
                          {txSortCol === 'position_qty' && txSortDir === 'desc' ? '▼' : '▲'}
                        </span>
                      </button>
                    </th>
                    {/* 11. Avg Cost After */}
                    <th className="text-center" style={{ width: '95px' }}>
                      <button onClick={() => toggleTxSort('avg_cost')} className="sort-header-btn">
                        Avg Cost
                        <span className={`sort-indicator ${txSortCol === 'avg_cost' ? 'active' : ''}`}>
                          {txSortCol === 'avg_cost' && txSortDir === 'desc' ? '▼' : '▲'}
                        </span>
                      </button>
                    </th>
                    {/* 12. Realized P&L */}
                    <th className="text-center" style={{ width: '85px' }}>
                      <button onClick={() => toggleTxSort('realized_pnl')} className="sort-header-btn">
                        Realized
                        <span className={`sort-indicator ${txSortCol === 'realized_pnl' ? 'active' : ''}`}>
                          {txSortCol === 'realized_pnl' && txSortDir === 'desc' ? '▼' : '▲'}
                        </span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tradesLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 12 }).map((_, j) => (
                          <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                        ))}
                      </tr>
                    ))
                  ) : sortedTrades.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>No transactions match your filter criteria.</p>
                        {hasActiveFilters && (
                          <button onClick={clearFilters} className="btn btn-secondary" style={{ marginTop: '0.65rem' }}>
                            Clear All Filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    sortedTrades.map((t) => {
                      const rPnl = parseFloat(t.realized_pnl || '0');
                      const fee = parseFloat(t.fee_usd || '0');
                      const meta = ASSET_METADATA[t.symbol] || { color: '#ccc' };

                      return (
                        <tr key={t.trade_id}>
                          <td className="sticky-col text-center font-numeric" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            {t.trade_id}
                          </td>
                          <td className="text-center font-numeric" style={{ fontSize: '0.74rem' }}>
                            {formatDate(t.timestamp)}
                          </td>
                          <td className="text-center">
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.1rem 0.35rem',
                                borderRadius: 4,
                                background: t.exchange === 'Binance' ? 'rgba(240, 185, 11, 0.12)' : 'rgba(0, 82, 255, 0.12)',
                                color: t.exchange === 'Binance' ? '#f0b90b' : '#3b82f6',
                                fontWeight: 600,
                              }}
                            >
                              {t.exchange === 'Binance' ? 'BIN' : 'CB'}
                            </span>
                          </td>
                          <td className="text-center">
                            <strong style={{ color: meta.color }}>
                              {t.symbol}
                            </strong>
                          </td>
                          <td className="text-center">
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: 4,
                                fontWeight: 700,
                                background: t.side === 'BUY' ? 'var(--profit-bg)' : 'var(--loss-bg)',
                                color: t.side === 'BUY' ? 'var(--profit)' : 'var(--loss)',
                              }}
                            >
                              {t.side}
                            </span>
                          </td>
                          <td className="text-center font-numeric">{fmtQty(t.quantity)}</td>
                          <td className="text-center font-numeric">{fmtPrice(t.price_usd)}</td>
                          <td className="text-center font-numeric">
                            <span style={fee > 10 ? { color: '#fbbf24', fontWeight: 600 } : { color: 'var(--text-muted)' }}>
                              {fmtUSD(t.fee_usd)}
                            </span>
                          </td>
                          <td className="text-center font-numeric">{fmtUSD(t.gross_value)}</td>
                          <td className="text-center font-numeric" style={{ color: 'var(--text-secondary)' }}>
                            {fmtQty(t.position_qty)}
                          </td>
                          <td className="text-center font-numeric" style={{ color: 'var(--text-secondary)' }}>
                            {fmtPrice(t.avg_cost)}
                          </td>
                          <td className="text-center font-numeric">
                            {t.side === 'SELL' ? (
                              <span style={{ color: rPnl > 0 ? 'var(--profit)' : rPnl < 0 ? 'var(--loss)' : 'inherit', fontWeight: 700 }}>
                                {fmtUSD(t.realized_pnl)}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ─── Pagination Toolbar with Direct Page Jump ────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <span>Showing <strong>{trades.length}</strong> of <strong>{totalTrades}</strong> trades</span>
              </div>

              {/* Direct Jump Input & Prev/Next */}
              <form onSubmit={handleJumpToPage} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}
                >
                  ← Prev
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span>Page</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageJumpInput}
                    onChange={(e) => setPageJumpInput(e.target.value)}
                    className="page-jump-input"
                    title="Enter page number"
                  />
                  <span>of <strong>{totalPages}</strong></span>
                  <button type="submit" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}>
                    Go
                  </button>
                </div>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}
                >
                  Next →
                </button>
              </form>
            </div>
          </section>
        )}
      </main>

      {/* ─── Import Modal Dialog ─────────────────────────────────── */}
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            setImportOpen(false);
            loadPortfolio();
            loadTrades();
          }}
        />
      )}

      {/* ─── Reset Confirmation Dialog ───────────────────────────── */}
      {resetOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 440, padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(244, 63, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--loss)' }}>
                <IconAlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>Reset Database?</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Restore original 200 synthetic trades</p>
              </div>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              This action will purge current records and reseed the database using the 200 sample transactions and price snapshots from <code style={{ color: 'var(--cyan)' }}>/data</code>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button onClick={() => setResetOpen(false)} className="btn btn-secondary" disabled={resetting}>
                Cancel
              </button>
              <button onClick={handleReset} className="btn btn-danger" disabled={resetting}>
                {resetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom SVG Donut Chart Component ────────────────────────────────

function DonutChart({ holdings, totalValue }: { holdings: Holding[]; totalValue: string }) {
  const activeHoldings = holdings.filter(h => parseFloat(h.current_value || '0') > 0);
  const total = parseFloat(totalValue) || 1;

  let cumulativeAngle = 0;
  const segments = activeHoldings.map(h => {
    const val = parseFloat(h.current_value || '0');
    const angle = (val / total) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return {
      symbol: h.symbol,
      value: val,
      color: ASSET_METADATA[h.symbol]?.color || '#888',
      startAngle,
      angle,
    };
  });

  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
      {segments.map((seg, idx) => {
        const strokeDasharray = `${(seg.angle / 360) * 283} 283`;
        const strokeDashoffset = -((seg.startAngle / 360) * 283);
        return (
          <circle
            key={idx}
            cx="50"
            cy="50"
            r="45"
            fill="transparent"
            stroke={seg.color}
            strokeWidth="10"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-width 0.2s ease', cursor: 'pointer' }}
          />
        );
      })}
    </svg>
  );
}

// ─── Custom Grouped Bar Chart Component ──────────────────────────────

function PnlBarChart({ holdings }: { holdings: Holding[] }) {
  const maxVal = Math.max(
    ...holdings.map(h => Math.max(Math.abs(parseFloat(h.realized_pnl || '0')), Math.abs(parseFloat(h.unrealized_pnl || '0')))),
    100,
  );

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {holdings.map(h => {
        const rVal = parseFloat(h.realized_pnl || '0');
        const uVal = parseFloat(h.unrealized_pnl || '0');
        const rPct = (Math.abs(rVal) / maxVal) * 100;
        const uPct = (Math.abs(uVal) / maxVal) * 100;

        return (
          <div key={h.symbol} style={{ display: 'grid', gridTemplateColumns: '46px 1fr 90px', alignItems: 'center', gap: '0.65rem', fontSize: '0.75rem' }}>
            <span style={{ fontWeight: 700, color: ASSET_METADATA[h.symbol]?.color }}>{h.symbol}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {/* Realized Bar — always green to match legend */}
              <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${rPct}%`, background: 'var(--profit)', borderRadius: 3 }} />
              </div>
              {/* Unrealized Bar — always cyan to match legend */}
              <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${uPct}%`, background: 'var(--cyan)', borderRadius: 3 }} />
              </div>
            </div>
            <div className="font-numeric" style={{ textAlign: 'right', fontSize: '0.72rem' }}>
              <div style={{ color: rVal >= 0 ? 'var(--profit)' : 'var(--loss)' }}>{fmtUSD(rVal)}</div>
              <div style={{ color: uVal >= 0 ? 'var(--profit)' : 'var(--loss)' }}>{fmtUSD(uVal)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Import Modal with Structured Error Handling ─────────────────────

function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorResult, setErrorResult] = useState<{
    message: string;
    errors: ImportError[];
    summary: Record<string, number>;
  } | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    try {
      setUploading(true);
      setErrorResult(null);

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok && data.ok) {
        onSuccess();
      } else {
        setErrorResult({
          message: data.message || 'Validation failed. No data was changed.',
          errors: data.errors || [],
          summary: data.summary || {},
        });
      }
    } catch (err: any) {
      setErrorResult({
        message: err.message || 'Network error uploading CSV.',
        errors: [],
        summary: {},
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Import Trade History</h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Atomic replacement of portfolio transactions</p>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-icon">
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
          }}
          style={{
            border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border-default)'}`,
            borderRadius: 12,
            padding: '2rem 1.25rem',
            textAlign: 'center',
            background: dragOver ? 'rgba(245, 158, 11, 0.05)' : 'rgba(7, 10, 18, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => {
            const el = document.getElementById('csv-file-input');
            if (el) el.click();
          }}
        >
          <input
            id="csv-file-input"
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.[0]) setFile(e.target.files[0]);
            }}
          />
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-surface-elevated)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', marginBottom: '0.75rem' }}>
            <IconUpload className="w-4 h-4" />
          </div>
          <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>
            {file ? file.name : 'Click or drag & drop trades.csv'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Maximum file size: 1 MB (UTF-8 formatted)'}
          </p>
        </div>

        {/* Error Details */}
        {errorResult && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ padding: '0.65rem 0.85rem', borderRadius: 8, background: 'rgba(244, 63, 94, 0.1)', border: '1px solid var(--loss-border)', color: '#fda4af', fontSize: '0.8rem', fontWeight: 600 }}>
              {errorResult.message}
            </div>

            {errorResult.errors.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th className="text-left">Row</th>
                      <th className="text-left">Col</th>
                      <th className="text-right">Value</th>
                      <th className="text-left">Reason</th>
                      <th className="text-left">Remediation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorResult.errors.slice(0, 50).map((err, idx) => (
                      <tr key={idx}>
                        <td className="text-left font-numeric">{err.row ?? '—'}</td>
                        <td className="text-left" style={{ color: 'var(--cyan)' }}>{err.column ?? '—'}</td>
                        <td className="text-right font-numeric" style={{ color: 'var(--loss)' }}>{err.value ?? '—'}</td>
                        <td className="text-left">{err.message}</td>
                        <td className="text-left" style={{ color: 'var(--text-secondary)' }}>{err.hint}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleUpload} className="btn btn-primary" disabled={!file || uploading}>
            {uploading ? 'Validating...' : 'Validate & Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
