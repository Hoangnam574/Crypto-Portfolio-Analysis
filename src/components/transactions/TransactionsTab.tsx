import React from 'react';
import type { TradeSnapshot, Symbol as AssetSymbol, Exchange, Side } from '@/domain/types';
import { SYMBOLS, EXCHANGES, SIDES } from '@/domain/types';
import { ASSET_METADATA, fmtUSD, fmtPrice, fmtQty, formatDate } from '@/components/common/Formatters';
import { IconAlertTriangle, IconX } from '@/components/common/Icons';

interface TransactionsTabProps {
  trades: TradeSnapshot[];
  totalTrades: number;
  tradesLoading: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  setPage: (page: number | ((p: number) => number)) => void;
  setPageSize: (size: number) => void;
  pageJumpInput: string;
  setPageJumpInput: (val: string) => void;
  handleJumpToPage: (e?: React.FormEvent) => void;

  // Filters
  symbolFilter: AssetSymbol | '';
  setSymbolFilter: (sym: AssetSymbol | '') => void;
  exchangeFilter: Exchange | '';
  setExchangeFilter: (ex: Exchange | '') => void;
  sideFilter: Side | '';
  setSideFilter: (side: Side | '') => void;
  fromDate: string;
  toDate: string;
  handleFromDateChange: (val: string) => void;
  handleToDateChange: (val: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  dateError: string | null;
  isFromYearInvalid: boolean;
  isToYearInvalid: boolean;
  isDateOrderInvalid: boolean;

  // Sorting
  txSortCol: keyof TradeSnapshot;
  txSortDir: 'asc' | 'desc';
  toggleTxSort: (col: keyof TradeSnapshot) => void;

  formulaProps: (
    title: string,
    formula: string,
    calc?: string,
    desc?: string,
    placement?: 'top' | 'bottom',
  ) => Record<string, any>;
}

export function TransactionsTab({
  trades,
  totalTrades,
  tradesLoading,
  page,
  pageSize,
  totalPages,
  setPage,
  setPageSize,
  pageJumpInput,
  setPageJumpInput,
  handleJumpToPage,

  symbolFilter,
  setSymbolFilter,
  exchangeFilter,
  setExchangeFilter,
  sideFilter,
  setSideFilter,
  fromDate,
  toDate,
  handleFromDateChange,
  handleToDateChange,
  clearFilters,
  hasActiveFilters,
  dateError,
  isFromYearInvalid,
  isToYearInvalid,
  isDateOrderInvalid,

  txSortCol,
  txSortDir,
  toggleTxSort,
  formulaProps,
}: TransactionsTabProps) {
  return (
    <section className="glass-panel" style={{ padding: '1.25rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
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
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Asset:
            </span>
            <button
              onClick={() => {
                setSymbolFilter('');
                setPage(1);
              }}
              className={`filter-chip ${symbolFilter === '' ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
            >
              All
            </button>
            {SYMBOLS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSymbolFilter(s);
                  setPage(1);
                }}
                className={`filter-chip ${symbolFilter === s ? 'active' : ''}`}
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Exchange Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Exchange:
            </span>
            <button
              onClick={() => {
                setExchangeFilter('');
                setPage(1);
              }}
              className={`filter-chip ${exchangeFilter === '' ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
            >
              All
            </button>
            {EXCHANGES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setExchangeFilter(ex);
                  setPage(1);
                }}
                className={`filter-chip ${exchangeFilter === ex ? 'active' : ''}`}
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              >
                {ex}
              </button>
            ))}
          </div>

          {/* Side Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Side:
            </span>
            <button
              onClick={() => {
                setSideFilter('');
                setPage(1);
              }}
              className={`filter-chip ${sideFilter === '' ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
            >
              All
            </button>
            {SIDES.map((sd) => (
              <button
                key={sd}
                onClick={() => {
                  setSideFilter(sd);
                  setPage(1);
                }}
                className={`filter-chip ${sideFilter === sd ? 'active' : ''}`}
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              >
                {sd}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Date Filters & Clear */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Date (UTC):
            </span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
              <input
                type="date"
                min="2010-01-01"
                max="2035-12-31"
                value={fromDate}
                onChange={(e) => handleFromDateChange(e.target.value)}
                style={{
                  background: 'var(--bg-surface)',
                  border: isFromYearInvalid || isDateOrderInvalid ? '1px solid var(--loss)' : '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  borderRadius: 6,
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.78rem',
                  outline: 'none',
                }}
                title="From date (UTC: 2010 - 2035)"
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>→</span>
              <input
                type="date"
                min="2010-01-01"
                max="2035-12-31"
                value={toDate}
                onChange={(e) => handleToDateChange(e.target.value)}
                style={{
                  background: 'var(--bg-surface)',
                  border: isToYearInvalid || isDateOrderInvalid ? '1px solid var(--loss)' : '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  borderRadius: 6,
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.78rem',
                  outline: 'none',
                }}
                title="To date (UTC: 2010 - 2035)"
              />
            </div>
            {dateError && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.72rem',
                  color: 'var(--loss)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 5,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontWeight: 600,
                }}
              >
                <IconAlertTriangle className="w-3.5 h-3.5" />
                {dateError}
              </span>
            )}
            {(hasActiveFilters || dateError) && (
              <button
                onClick={clearFilters}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
              >
                <IconX className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Page Size:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
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
              {/* 1. Trade ID */}
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
                <button
                  onClick={() => toggleTxSort('quantity')}
                  className="sort-header-btn"
                  {...formulaProps('Trade Quantity', 'Executed coin units in native token terms', undefined, 'Amount of cryptocurrency bought or sold')}
                >
                  Qty
                  <span className={`sort-indicator ${txSortCol === 'quantity' ? 'active' : ''}`}>
                    {txSortCol === 'quantity' && txSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
              {/* 7. Price */}
              <th className="text-center" style={{ width: '95px' }}>
                <button
                  onClick={() => toggleTxSort('price_usd')}
                  className="sort-header-btn"
                  {...formulaProps('Trade Execution Price', 'Unit fill price per token in USD', undefined, 'Spot fill rate on exchange')}
                >
                  Price
                  <span className={`sort-indicator ${txSortCol === 'price_usd' ? 'active' : ''}`}>
                    {txSortCol === 'price_usd' && txSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
              {/* 8. Fee */}
              <th className="text-center" style={{ width: '65px' }}>
                <button
                  onClick={() => toggleTxSort('fee_usd')}
                  className="sort-header-btn"
                  {...formulaProps('Trading Fee', 'Exchange transaction fee in USD', undefined, 'BUY: Added to cost basis | SELL: Subtracted from net proceeds')}
                >
                  Fee
                  <span className={`sort-indicator ${txSortCol === 'fee_usd' ? 'active' : ''}`}>
                    {txSortCol === 'fee_usd' && txSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
              {/* 9. Gross */}
              <th className="text-center" style={{ width: '95px' }}>
                <button
                  onClick={() => toggleTxSort('gross_value')}
                  className="sort-header-btn"
                  {...formulaProps('Gross Value', 'Quantity × Price', undefined, 'Total transaction volume prior to fee adjustment')}
                >
                  Gross
                  <span className={`sort-indicator ${txSortCol === 'gross_value' ? 'active' : ''}`}>
                    {txSortCol === 'gross_value' && txSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
              {/* 10. Position After */}
              <th className="text-center" style={{ width: '85px' }}>
                <button
                  onClick={() => toggleTxSort('position_qty')}
                  className="sort-header-btn"
                  {...formulaProps('Position After Trade', 'Prior Position + Trade Qty (BUY) / Prior Position - Trade Qty (SELL)', undefined, 'Cumulative token inventory held immediately following execution')}
                >
                  Pos After
                  <span className={`sort-indicator ${txSortCol === 'position_qty' ? 'active' : ''}`}>
                    {txSortCol === 'position_qty' && txSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
              {/* 11. Avg Cost After */}
              <th className="text-center" style={{ width: '95px' }}>
                <button
                  onClick={() => toggleTxSort('avg_cost')}
                  className="sort-header-btn"
                  {...formulaProps('Weighted Average Cost', 'BUY: (Prior Cost Basis + Gross + Fee) / New Balance | SELL: Unchanged', undefined, 'Cumulative average acquisition cost per token in inventory')}
                >
                  Avg Cost
                  <span className={`sort-indicator ${txSortCol === 'avg_cost' ? 'active' : ''}`}>
                    {txSortCol === 'avg_cost' && txSortDir === 'desc' ? '▼' : '▲'}
                  </span>
                </button>
              </th>
              {/* 12. Realized P&L */}
              <th className="text-center" style={{ width: '85px' }}>
                <button
                  onClick={() => toggleTxSort('realized_pnl')}
                  className="sort-header-btn"
                  {...formulaProps('Realized P&L', 'SELL: (Gross - Fee) - (Qty Sold × Prior Avg Cost) | BUY: $0', undefined, 'Locked-in net profit/loss generated by closing or trimming a position')}
                >
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
                    <td key={j}>
                      <div className="skeleton" style={{ height: 14, width: '80%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : trades.length === 0 ? (
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
              trades.map((t) => {
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
                      <strong style={{ color: meta.color }}>{t.symbol}</strong>
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
                    <td className="font-numeric text-center">{fmtQty(t.quantity)}</td>
                    <td className="font-numeric text-center">{fmtPrice(t.price_usd)}</td>
                    <td className="font-numeric text-center">
                      <span style={fee > 10 ? { color: '#fbbf24', fontWeight: 600 } : { color: 'var(--text-muted)' }}>
                        {fmtUSD(t.fee_usd)}
                      </span>
                    </td>
                    <td className="font-numeric text-center">{fmtUSD(t.gross_value)}</td>
                    <td className="font-numeric text-center" style={{ color: 'var(--text-secondary)' }}>
                      {fmtQty(t.position_qty)}
                    </td>
                    <td className="font-numeric text-center" style={{ color: 'var(--text-secondary)' }}>
                      {fmtPrice(t.avg_cost)}
                    </td>
                    <td className="font-numeric text-center">
                      {t.side === 'SELL' ? (
                        <span
                          style={{
                            color: rPnl > 0 ? 'var(--profit)' : rPnl < 0 ? 'var(--loss)' : 'inherit',
                            fontWeight: 700,
                          }}
                        >
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '1rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <span>
            Showing <strong>{trades.length}</strong> of <strong>{totalTrades}</strong> trades
          </span>
        </div>

        {/* Direct Jump Input & Prev/Next */}
        <form onSubmit={handleJumpToPage} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
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
            <span>
              of <strong>{totalPages}</strong>
            </span>
            <button type="submit" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}>
              Go
            </button>
          </div>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}
          >
            Next →
          </button>
        </form>
      </div>
    </section>
  );
}
