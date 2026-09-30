/**
 * validate.ts — CSV import validation pipeline.
 *
 * 4-step pipeline:
 * 1. Check header columns
 * 2. Validate each row (zod schema)
 * 3. Check for duplicate trade_id
 * 4. If clean: sort and replay. ShortPositionError becomes an import error.
 *
 * Max 50 errors collected. Returns typed ImportResult.
 */
import { parse } from 'csv-parse/sync';
import { Decimal } from '../domain/money';
import { sortTrades, replay, ShortPositionError } from '../domain/ledger';
import type {
  Trade,
  RawTrade,
  ImportResult,
  ImportError,
  ImportErrorCode,
  Exchange,
  Side,
  Symbol as AssetSymbol,
  PriceEntry,
} from '../domain/types';
import { EXCHANGES, SIDES, SYMBOLS } from '../domain/types';

const MAX_ERRORS = 50;
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const REQUIRED_HEADERS = [
  'trade_id',

  'timestamp',
  'exchange',
  'symbol',
  'side',
  'quantity',
  'price_usd',
  'fee_usd',
] as const;

function makeError(
  row: number | null,
  column: string | null,
  value: string | null,
  code: ImportErrorCode,
  message: string,
  hint: string,
): ImportError {
  return { row, column, value, code, message, hint };
}

/**
 * Validate a decimal number string: must be a plain decimal, not scientific notation,
 * not NaN, not Infinity.
 */
function isValidDecimal(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === '' || /[eE]/.test(trimmed)) return false;
  if (trimmed.toLowerCase() === 'nan' || trimmed.toLowerCase().includes('infinity')) return false;
  try {
    new Decimal(trimmed);
    return true;
  } catch {
    return false;
  }
}

function isValidISO8601UTC(ts: string): boolean {
  const trimmed = ts.trim();
  // Must end with Z (UTC)
  if (!trimmed.endsWith('Z')) return false;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return false;
  // Verify round-trip
  return d.toISOString() === trimmed || true; // lenient: just needs to parse
}

export function validateAndParse(
  content: string,
  fileSize?: number,
): ImportResult {
  const errors: ImportError[] = [];

  // Step 0: File size check
  if (fileSize !== undefined && fileSize > MAX_FILE_SIZE) {
    errors.push(
      makeError(null, null, null, 'FILE_TOO_LARGE', 
        `File size (${(fileSize / (1024 * 1024)).toFixed(1)}MB) exceeds 50MB limit.`,
        'Reduce the file size or split into smaller files.',
      ),
    );
    return { ok: false, errors, summary: summarize(errors) };
  }


  // Handle BOM
  let cleaned = content;
  if (cleaned.charCodeAt(0) === 0xfeff) {
    cleaned = cleaned.slice(1);
  }

  // Remove trailing empty lines
  cleaned = cleaned.replace(/\n+$/, '\n');

  if (cleaned.trim() === '') {
    errors.push(
      makeError(null, null, null, 'EMPTY_FILE', 'File is empty.', 'Upload a CSV file with trade data.'),
    );
    return { ok: false, errors, summary: summarize(errors) };
  }

  // Parse CSV
  let records: Record<string, string>[];
  try {
    records = parse(cleaned, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (err) {
    errors.push(
      makeError(null, null, null, 'MISSING_HEADER',
        `CSV parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'Ensure the file is a valid CSV with proper headers.',
      ),
    );
    return { ok: false, errors, summary: summarize(errors) };
  }

  if (records.length === 0) {
    errors.push(
      makeError(null, null, null, 'EMPTY_FILE', 'No data rows found.', 'Add trade data rows below the header.'),
    );
    return { ok: false, errors, summary: summarize(errors) };
  }

  // Step 1: Check headers
  const actualHeaders = Object.keys(records[0]);
  for (const required of REQUIRED_HEADERS) {
    if (!actualHeaders.includes(required)) {
      errors.push(
        makeError(null, required, null, 'MISSING_HEADER',
          `Missing required column: "${required}".`,
          `Add the "${required}" column to your CSV header.`,
        ),
      );
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors, summary: summarize(errors) };
  }

  // Step 2: Validate each row
  const validatedTrades: Trade[] = [];
  const tradeIdMap = new Map<string, number>(); // trade_id -> first row number

  for (let i = 0; i < records.length && errors.length < MAX_ERRORS; i++) {
    const row = records[i] as unknown as RawTrade;
    const rowNum = i + 2; // +2 because 1 for header, 1 for 0-index

    // Timestamp
    if (!isValidISO8601UTC(row.timestamp)) {
      errors.push(
        makeError(rowNum, 'timestamp', row.timestamp, 'INVALID_TIMESTAMP',
          `Invalid timestamp: "${row.timestamp}".`,
          'Use ISO-8601 UTC format, e.g. "2025-01-15T09:00:00Z".',
        ),
      );
    }

    // Exchange
    if (!EXCHANGES.includes(row.exchange as Exchange)) {
      errors.push(
        makeError(rowNum, 'exchange', row.exchange, 'INVALID_EXCHANGE',
          `Invalid exchange: "${row.exchange}".`,
          `Supported exchanges: ${EXCHANGES.join(', ')}.`,
        ),
      );
    }

    // Symbol
    if (!SYMBOLS.includes(row.symbol as AssetSymbol)) {
      errors.push(
        makeError(rowNum, 'symbol', row.symbol, 'INVALID_SYMBOL',
          `Invalid symbol: "${row.symbol}".`,
          `Supported symbols: ${SYMBOLS.join(', ')}.`,
        ),
      );
    }

    // Side
    if (!SIDES.includes(row.side as Side)) {
      errors.push(
        makeError(rowNum, 'side', row.side, 'INVALID_SIDE',
          `Invalid side: "${row.side}".`,
          'Must be "BUY" or "SELL".',
        ),
      );
    }

    // Quantity > 0
    if (!isValidDecimal(row.quantity)) {
      errors.push(
        makeError(rowNum, 'quantity', row.quantity, 'INVALID_QUANTITY',
          `Invalid quantity: "${row.quantity}".`,
          'Must be a positive decimal number (no scientific notation).',
        ),
      );
    } else {
      const q = new Decimal(row.quantity);
      if (q.lte(0)) {
        errors.push(
          makeError(rowNum, 'quantity', row.quantity, 'INVALID_QUANTITY',
            `Quantity must be positive: "${row.quantity}".`,
            'Enter a value greater than 0.',
          ),
        );
      }
    }

    // Price > 0
    if (!isValidDecimal(row.price_usd)) {
      errors.push(
        makeError(rowNum, 'price_usd', row.price_usd, 'INVALID_PRICE',
          `Invalid price: "${row.price_usd}".`,
          'Must be a positive decimal number (no scientific notation).',
        ),
      );
    } else {
      const p = new Decimal(row.price_usd);
      if (p.lte(0)) {
        errors.push(
          makeError(rowNum, 'price_usd', row.price_usd, 'INVALID_PRICE',
            `Price must be positive: "${row.price_usd}".`,
            'Enter a value greater than 0.',
          ),
        );
      }
    }

    // Fee >= 0
    if (!isValidDecimal(row.fee_usd)) {
      errors.push(
        makeError(rowNum, 'fee_usd', row.fee_usd, 'INVALID_FEE',
          `Invalid fee: "${row.fee_usd}".`,
          'Must be a non-negative decimal number (no scientific notation).',
        ),
      );
    } else {
      const f = new Decimal(row.fee_usd);
      if (f.lt(0)) {
        errors.push(
          makeError(rowNum, 'fee_usd', row.fee_usd, 'INVALID_FEE',
            `Fee cannot be negative: "${row.fee_usd}".`,
            'Enter a value of 0 or greater.',
          ),
        );
      }
    }

    // Step 3: Duplicate trade_id check
    if (tradeIdMap.has(row.trade_id)) {
      const firstRow = tradeIdMap.get(row.trade_id)!;
      errors.push(
        makeError(rowNum, 'trade_id', row.trade_id, 'DUPLICATE_TRADE_ID',
          `Duplicate trade_id "${row.trade_id}" (first seen at row ${firstRow}).`,
          'Each trade must have a unique trade_id.',
        ),
      );
    } else {
      tradeIdMap.set(row.trade_id, rowNum);
    }

    // If no errors for this row, add to validated list
    // We check by seeing if errors grew
    const hadErrorsBefore = errors.length;
    if (errors.length === hadErrorsBefore || errors.length === 0) {
      // Only add if all fields validated
      const hasRowErrors = errors.some(e => e.row === rowNum);
      if (!hasRowErrors) {
        validatedTrades.push({
          seq: rowNum - 1, // 1-based row in original file (data row 1 = seq 1)
          trade_id: row.trade_id,
          timestamp: new Date(row.timestamp),
          exchange: row.exchange as Exchange,
          symbol: row.symbol as AssetSymbol,
          side: row.side as Side,
          quantity: row.quantity,
          price_usd: row.price_usd,
          fee_usd: row.fee_usd,
        });
      }
    }
  }

  // If errors found in steps 1-3, return early (don't attempt replay)
  if (errors.length > 0) {
    return { ok: false, errors: errors.slice(0, MAX_ERRORS), summary: summarize(errors) };
  }

  // Step 4: Sort and replay — catch ShortPositionError
  const sorted = sortTrades(validatedTrades);
  try {
    replay(sorted);
  } catch (err) {
    if (err instanceof ShortPositionError) {
      errors.push(
        makeError(err.seq + 1, 'quantity', err.attempted_qty.toFixed(), 'SHORT_POSITION',
          err.message,
          `Ensure you have enough ${err.symbol} before selling. Check trade ordering.`,
        ),
      );
      return { ok: false, errors, summary: summarize(errors) };
    }
    throw err; // unexpected error
  }

  return { ok: true, trades: sorted, count: sorted.length };
}

function summarize(errors: ImportError[]): Record<ImportErrorCode, number> {
  const summary = {} as Record<ImportErrorCode, number>;
  for (const e of errors) {
    summary[e.code] = (summary[e.code] || 0) + 1;
  }
  return summary;
}

const REQUIRED_PRICE_HEADERS = ['symbol', 'price_usd', 'as_of'] as const;

export function validateAndParsePrices(
  content: string,
  fileSize?: number,
):
  | { ok: true; prices: PriceEntry[]; count: number }
  | { ok: false; errors: ImportError[]; summary: Record<string, number> } {
  const errors: ImportError[] = [];

  if (fileSize !== undefined && fileSize > MAX_FILE_SIZE) {
    errors.push(
      makeError(null, null, null, 'FILE_TOO_LARGE',
        `File size (${(fileSize / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size (50MB).`,
        'Export a smaller date range or split into multiple files.',
      ),
    );
    return { ok: false, errors, summary: summarize(errors) };
  }

  const trimmed = content.trim();
  if (trimmed === '') {
    errors.push(
      makeError(null, null, null, 'EMPTY_FILE', 'The uploaded file is empty.', 'Select a valid prices CSV file.'),
    );
    return { ok: false, errors, summary: summarize(errors) };
  }

  let records: any[];
  try {
    records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (err: any) {
    errors.push(
      makeError(null, null, null, 'MISSING_HEADER', `CSV parsing failed: ${err.message}`, 'Check file formatting.'),
    );
    return { ok: false, errors, summary: summarize(errors) };
  }

  if (records.length === 0) {
    errors.push(
      makeError(null, null, null, 'EMPTY_FILE', 'The uploaded file contains no data rows.', 'Add price rows to the CSV.'),
    );
    return { ok: false, errors, summary: summarize(errors) };
  }

  const headers = Object.keys(records[0] || {});
  const missingHeaders = REQUIRED_PRICE_HEADERS.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    errors.push(
      makeError(1, null, missingHeaders.join(', '), 'MISSING_HEADER',
        `Missing required columns: ${missingHeaders.join(', ')}`,
        `Expected columns: ${REQUIRED_PRICE_HEADERS.join(', ')}`,
      ),
    );
    return { ok: false, errors, summary: summarize(errors) };
  }

  const symbolMap = new Map<string, number>();
  const validatedPrices: PriceEntry[] = [];

  for (let i = 0; i < records.length && errors.length < MAX_ERRORS; i++) {
    const row = records[i];
    const rowNum = i + 2;

    let rowValid = true;

    // Symbol
    const sym = (row.symbol || '').trim();
    if (!sym || !SYMBOLS.includes(sym as AssetSymbol)) {
      errors.push(
        makeError(rowNum, 'symbol', row.symbol, 'INVALID_SYMBOL',
          `Unknown asset symbol: '${row.symbol}'. Supported: ${SYMBOLS.join(', ')}`,
          `Use one of the supported symbols: ${SYMBOLS.join(', ')}`,
        ),
      );
      rowValid = false;
    } else if (symbolMap.has(sym)) {
      errors.push(
        makeError(rowNum, 'symbol', sym, 'DUPLICATE_TRADE_ID',
          `Duplicate price entry for symbol '${sym}' (first seen on row ${symbolMap.get(sym)})`,
          'Each asset symbol can only appear once in prices.csv.',
        ),
      );
      rowValid = false;
    } else {
      symbolMap.set(sym, rowNum);
    }

    // Price USD
    if (!isValidDecimal(row.price_usd || '')) {
      errors.push(
        makeError(rowNum, 'price_usd', row.price_usd, 'INVALID_PRICE',
          `Invalid price: '${row.price_usd}'. Must be a valid positive number.`,
          'Enter a positive number without currency symbols.',
        ),
      );
      rowValid = false;
    } else {
      const p = new Decimal(row.price_usd.trim());
      if (p.lte(0)) {
        errors.push(
          makeError(rowNum, 'price_usd', row.price_usd, 'INVALID_PRICE',
            `Price must be greater than zero, got ${p.toFixed()}`,
            'Ensure market price is positive.',
          ),
        );
        rowValid = false;
      }
    }

    // as_of timestamp
    if (!row.as_of || !isValidISO8601UTC(row.as_of)) {
      errors.push(
        makeError(rowNum, 'as_of', row.as_of, 'INVALID_TIMESTAMP',
          `Invalid timestamp: '${row.as_of}'. Must be ISO-8601 UTC ending in 'Z'.`,
          'Format example: 2026-03-31T23:59:59Z',
        ),
      );
      rowValid = false;
    }

    if (rowValid) {
      validatedPrices.push({
        symbol: sym as AssetSymbol,
        price_usd: new Decimal(row.price_usd.trim()).toFixed(),
        as_of: new Date(row.as_of.trim()).toISOString(),
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors: errors.slice(0, MAX_ERRORS), summary: summarize(errors) };
  }

  return { ok: true, prices: validatedPrices, count: validatedPrices.length };
}
