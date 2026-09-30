import React from 'react';
import { IconLayoutDashboard, IconList, IconRotateCcw, IconUpload } from '@/components/common/Icons';

interface HeaderProps {
  activeTab: 'dashboard' | 'transactions';
  setActiveTab: (tab: 'dashboard' | 'transactions') => void;
  totalTrades: number;
  summaryLoading: boolean;
  onRefresh: () => void;
  onOpenImport: () => void;
  onOpenReset: () => void;
}

export function Header({
  activeTab,
  setActiveTab,
  totalTrades,
  summaryLoading,
  onRefresh,
  onOpenImport,
  onOpenReset,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-inner">
        {/* Brand & Live status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--primary) 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '1.05rem',
              color: '#070a12',
              boxShadow: '0 0 16px var(--primary-glow)',
            }}
          >
            ₿
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                Crypto Portfolio Analytics
              </h1>
              <span className="live-dot" title="Live DB Connected" />
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Executive Trading Ledger & Valuation
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="nav-tabs">
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
        <div className="header-actions">
          <button
            onClick={onRefresh}
            className="btn btn-secondary"
            title="Refresh Data"
            style={{ padding: '0.45rem 0.7rem' }}
          >
            <IconRotateCcw className={`w-3.5 h-3.5 ${summaryLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline" style={{ fontSize: '0.8rem' }}>Refresh</span>
          </button>
          <button
            onClick={onOpenImport}
            className="btn btn-primary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
          >
            <IconUpload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={onOpenReset}
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
  );
}
