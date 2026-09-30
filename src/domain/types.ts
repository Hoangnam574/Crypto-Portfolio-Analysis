/**
 * Core type contracts for the crypto portfolio analytics application.
 * All monetary/numeric values are represented as strings for JSON serialization.
 * Internally the domain uses Decimal for precision.
 */

// ─── Raw Trade (from CSV) ──────────────────────────────────────────
export interface RawTrade {
  trade_id: string;
  timestamp: string; // ISO-8601 UTC
  exchange: string;
  symbol: string;
  side: string;
  quantity: string;
  price_usd: string;
  fee_usd: string;
}

// ─── Validated Trade ────────────────────────────────────────────────
export type Exchange = 'Binance' | 'Coinbase';
export type Side = 'BUY' | 'SELL';
export type Symbol = 'BTC' | 'ETH' | 'SOL' | 'CKB' | 'DOGE';

export const EXCHANGES: readonly Exchange[] = ['Binance', 'Coinbase'] as const;
export const SIDES: readonly Side[] = ['BUY', 'SELL'] as const;
export const SYMBOLS: readonly Symbol[] = ['BTC', 'ETH', 'SOL', 'CKB', 'DOGE'] as const;

export interface Trade {
  seq: number; // row number in file, used as tie-breaker
  trade_id: string;
  timestamp: Date;
  exchange: Exchange;
  symbol: Symbol;
  side: Side;
  quantity: string; // Decimal string
  price_usd: string; // Decimal string
  fee_usd: string; // Decimal string
}

export interface TradeSnapshot {
  trade_id: string;
  seq: number;
  timestamp: string; // ISO-8601 UTC
  exchange: Exchange;
  symbol: Symbol;
  side: Side;
  quantity: string;
  price_usd: string;
  fee_usd: string;
  gross_value: string; // qty * price
  // State after this trade
  position_qty: string;
  avg_cost: string;
  realized_pnl: string; // only non-zero for SELL
}

export interface Position {
  symbol: Symbol;
  quantity: string;
  avg_cost: string;
  total_cost: string; // quantity * avg_cost (cost basis)
  realized_pnl: string;
  total_fees: string;
}

// ─── Portfolio Valuation ────────────────────────────────────────────
export interface PriceEntry {
  symbol: Symbol;
  price_usd: string;
  as_of: string; // ISO-8601 UTC
}

export interface Holding {
  symbol: Symbol;
  quantity: string;
  avg_cost: string;
  current_price: string | null; // null if price missing
  cost_basis: string;
  current_value: string | null;
  unrealized_pnl: string | null;
  realized_pnl: string;
  total_pnl: string | null;
  allocation_pct: string | null; // percentage of total portfolio value
}

export interface PortfolioSummary {
  total_value: string | null;
  total_cost_basis: string;
  total_realized_pnl: string;
  total_unrealized_pnl: string | null;
  total_pnl: string | null;
  total_fees: string;
  holdings: Holding[];
  warnings: string[];
  prices_as_of: string | null;
}

// ─── Import Errors ──────────────────────────────────────────────────
export type ImportErrorCode =
  | 'MISSING_HEADER'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_EXCHANGE'
  | 'INVALID_SYMBOL'
  | 'INVALID_SIDE'
  | 'INVALID_QUANTITY'
  | 'INVALID_PRICE'
  | 'INVALID_FEE'
  | 'DUPLICATE_TRADE_ID'
  | 'SHORT_POSITION'
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'INVALID_NUMBER_FORMAT';

export interface ImportError {
  row: number | null;
  column: string | null;
  value: string | null;
  code: ImportErrorCode;
  message: string;
  hint: string;
}

export type ImportResult =
  | {
      ok: true;
      trades: Trade[];
      count: number;
    }
  | {
      ok: false;
      errors: ImportError[];
      summary: Partial<Record<ImportErrorCode, number>>;
    };

// ─── API Response Types ─────────────────────────────────────────────
export interface TradesQueryParams {
  page?: number;
  pageSize?: number;
  symbol?: Symbol;
  exchange?: Exchange;
  side?: Side;
  from?: string; // ISO-8601
  to?: string; // ISO-8601
  sort?: 'asc' | 'desc';
}

export interface TradesResponse {
  rows: TradeSnapshot[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
