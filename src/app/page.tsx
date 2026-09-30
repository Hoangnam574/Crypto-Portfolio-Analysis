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
} from '@/domain/types';

import { Header } from '@/components/dashboard/Header';
import { KpiGrid } from '@/components/dashboard/KpiGrid';
import { ChartsSection } from '@/components/dashboard/ChartsSection';
import { HoldingsTable } from '@/components/dashboard/HoldingsTable';
import { TransactionsTab } from '@/components/transactions/TransactionsTab';
import { ImportModal } from '@/components/modals/ImportModal';
import { ResetModal } from '@/components/modals/ResetModal';
import {
  FormulaTooltipPortal,
  createFormulaProps,
  FormulaTipState,
} from '@/components/tooltip/FormulaTooltip';
import { IconAlertTriangle } from '@/components/common/Icons';

export default function Dashboard() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions'>('dashboard');

  // Portfolio summary state
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Modals state
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
  const [pageJumpInput, setPageJumpInput] = useState('1');

  // Transactions column sort
  const [txSortCol, setTxSortCol] = useState<keyof TradeSnapshot>('timestamp');
  const [txSortDir, setTxSortDir] = useState<'asc' | 'desc'>('asc');

  // Holdings sort
  const [holdingsSortKey, setHoldingsSortKey] = useState<keyof Holding>('current_value');
  const [holdingsSortDir, setHoldingsSortDir] = useState<'asc' | 'desc'>('desc');

  // Interactive formula tooltip state
  const [formulaTip, setFormulaTip] = useState<FormulaTipState | null>(null);
  const formulaProps = useMemo(() => createFormulaProps(setFormulaTip), []);

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

  // Date validation state
  const fromYear = fromDate ? parseInt(fromDate.split('-')[0], 10) : null;
  const toYear = toDate ? parseInt(toDate.split('-')[0], 10) : null;
  const isFromYearInvalid = Boolean(fromYear !== null && (isNaN(fromYear) || fromYear < 2010 || fromYear > 2035));
  const isToYearInvalid = Boolean(toYear !== null && (isNaN(toYear) || toYear < 2010 || toYear > 2035));
  const isDateOrderInvalid = Boolean(
    fromDate && toDate && !isFromYearInvalid && !isToYearInvalid && fromDate > toDate,
  );
  const dateError = isDateOrderInvalid
    ? 'Start date cannot be after End date'
    : isFromYearInvalid || isToYearInvalid
    ? 'Year must be between 2010 and 2035'
    : null;

  const handleFromDateChange = (val: string) => {
    if (!val) {
      setFromDate('');
      setPage(1);
      return;
    }
    const parts = val.split('-');
    if (parts[0] && parts[0].length > 4) {
      parts[0] = parts[0].slice(0, 4);
      val = parts.join('-');
    }
    setFromDate(val);
    setPage(1);
  };

  const handleToDateChange = (val: string) => {
    if (!val) {
      setToDate('');
      setPage(1);
      return;
    }
    const parts = val.split('-');
    if (parts[0] && parts[0].length > 4) {
      parts[0] = parts[0].slice(0, 4);
      val = parts.join('-');
    }
    setToDate(val);
    setPage(1);
  };

  // Load transaction explorer rows (server-side global sorting)
  const loadTrades = useCallback(async () => {
    if (isDateOrderInvalid || isFromYearInvalid || isToYearInvalid) {
      setTrades([]);
      setTotalTrades(0);
      return;
    }

    try {
      setTradesLoading(true);
      setTradesError(null);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy: txSortCol,
        sortDir: txSortDir,
        sort: txSortDir,
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
  }, [
    page,
    pageSize,
    txSortCol,
    txSortDir,
    symbolFilter,
    exchangeFilter,
    sideFilter,
    fromDate,
    toDate,
    isDateOrderInvalid,
    isFromYearInvalid,
    isToYearInvalid,
  ]);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  // Page jump
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
      setHoldingsSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setHoldingsSortKey(key);
      setHoldingsSortDir('desc');
    }
  };

  // Transactions column sort
  const toggleTxSort = (col: keyof TradeSnapshot) => {
    if (txSortCol === col) {
      setTxSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setTxSortCol(col);
      setTxSortDir('asc');
    }
    setPage(1);
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ─── Top Navbar ────────────────────────────────────────────── */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalTrades={totalTrades}
        summaryLoading={summaryLoading}
        onRefresh={() => {
          loadPortfolio();
          loadTrades();
        }}
        onOpenImport={() => setImportOpen(true)}
        onOpenReset={() => setResetOpen(true)}
      />

      {/* ─── Main Content ─────────────────────────────────────────── */}
      <main className="main-wrapper">
        {/* Valuation Warning Banners */}
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

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <>
            <KpiGrid
              summary={summary}
              summaryLoading={summaryLoading}
              formulaProps={formulaProps}
            />
            <ChartsSection summary={summary} />
            <HoldingsTable
              summary={summary}
              summaryLoading={summaryLoading}
              sortedHoldings={sortedHoldings}
              holdingsSortKey={holdingsSortKey}
              holdingsSortDir={holdingsSortDir}
              toggleHoldingsSort={toggleHoldingsSort}
              formulaProps={formulaProps}
            />
          </>
        )}

        {/* TAB 2: TRANSACTIONS */}
        {activeTab === 'transactions' && (
          <TransactionsTab
            trades={trades}
            totalTrades={totalTrades}
            tradesLoading={tradesLoading}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            setPage={setPage}
            setPageSize={setPageSize}
            pageJumpInput={pageJumpInput}
            setPageJumpInput={setPageJumpInput}
            handleJumpToPage={handleJumpToPage}
            symbolFilter={symbolFilter}
            setSymbolFilter={setSymbolFilter}
            exchangeFilter={exchangeFilter}
            setExchangeFilter={setExchangeFilter}
            sideFilter={sideFilter}
            setSideFilter={setSideFilter}
            fromDate={fromDate}
            toDate={toDate}
            handleFromDateChange={handleFromDateChange}
            handleToDateChange={handleToDateChange}
            clearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            dateError={dateError}
            isFromYearInvalid={isFromYearInvalid}
            isToYearInvalid={isToYearInvalid}
            isDateOrderInvalid={isDateOrderInvalid}
            txSortCol={txSortCol}
            txSortDir={txSortDir}
            toggleTxSort={toggleTxSort}
            formulaProps={formulaProps}
          />
        )}
      </main>

      {/* ─── Modals ─────────────────────────────────────────────────── */}
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

      <ResetModal
        isOpen={resetOpen}
        resetting={resetting}
        onClose={() => setResetOpen(false)}
        onConfirm={handleReset}
      />

      {/* ─── Global Formula Tooltip ─────────────────────────────────── */}
      <FormulaTooltipPortal tip={formulaTip} />
    </div>
  );
}
