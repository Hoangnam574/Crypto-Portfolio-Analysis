/**
 * seed.ts — Seed the database from CSV files.
 * Uses the same validation pipeline as import (no shortcuts).
 * Idempotent: only seeds if DB is empty.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { validateAndParse } from '../import/validate';
import { replaceAllTrades, replaceAllPrices, hasAnyTrades } from './repository';
import { runMigrations } from './client';
import type { Database } from './client';
import type { PriceEntry, Symbol as AssetSymbol } from '../domain/types';
import { parse } from 'csv-parse/sync';

/**
 * Load and validate trades from CSV, using the full validation pipeline.
 */
function loadTradesFromCsv(csvPath: string) {
  const content = readFileSync(csvPath, 'utf-8');
  const result = validateAndParse(content, content.length);
  if (!result.ok) {
    throw new Error(
      `Seed data validation failed:\n${result.errors.map((e) => `  Row ${e.row}: ${e.message}`).join('\n')}`,
    );
  }
  return result.trades;
}

/**
 * Load prices from CSV.
 */
function loadPricesFromCsv(csvPath: string): PriceEntry[] {
  const content = readFileSync(csvPath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  return records.map((r: any) => ({
    symbol: r.symbol as AssetSymbol,
    price_usd: r.price_usd,
    as_of: r.as_of,
  }));
}

/**
 * Seed the database with sample data.
 * Runs migrations, then loads CSV files through the validation pipeline.
 */
export async function seedDatabase(db: Database, forceReseed = false) {
  // Run migrations (create tables if needed)
  await runMigrations(db);

  // Check if already seeded (unless force)
  if (!forceReseed) {
    const hasTrades = await hasAnyTrades(db);
    if (hasTrades) {
      console.log('Database already seeded, skipping.');
      return;
    }
  }

  // Find CSV files
  const dataDir = join(process.cwd(), 'data');
  const tradesPath = existsSync(join(dataDir, 'trades.csv'))
    ? join(dataDir, 'trades.csv')
    : join(process.cwd(), 'trades.csv');
  const pricesPath = existsSync(join(dataDir, 'prices.csv'))
    ? join(dataDir, 'prices.csv')
    : join(process.cwd(), 'prices.csv');

  console.log('Seeding database...');

  // Load and validate trades through the same pipeline as import
  const trades = loadTradesFromCsv(tradesPath);
  console.log(`Validated ${trades.length} trades.`);

  // Load prices
  const priceEntries = loadPricesFromCsv(pricesPath);
  console.log(`Loaded ${priceEntries.length} prices.`);

  // Insert into DB
  await replaceAllTrades(db, trades);
  await replaceAllPrices(db, priceEntries);

  console.log('Database seeded successfully.');
}
