/**
 * seed.ts — Seed the database from CSV files.
 * Uses the same validation pipeline as import (no shortcuts).
 * Idempotent: only seeds if DB is empty.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { validateAndParse, validateAndParsePrices } from '../import/validate';
import { replaceAllTrades, replaceAllPrices, hasAnyTrades, getAllTrades } from './repository';
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
 * Load prices from CSV using the validation pipeline.
 */
function loadPricesFromCsv(csvPath: string): PriceEntry[] {
  const content = readFileSync(csvPath, 'utf-8');
  const result = validateAndParsePrices(content, content.length);
  if (!result.ok) {
    throw new Error(
      `Seed prices validation failed:\n${result.errors.map((e) => `  Row ${e.row}: ${e.message}`).join('\n')}`,
    );
  }
  return result.prices;
}

const seedMutex = new WeakMap<any, Promise<void>>();

async function runSeed(db: Database, forceReseed: boolean) {
  // Run migrations (create tables if needed)
  await runMigrations(db);

  // Check if already seeded (unless force)
  if (!forceReseed) {
    const hasTrades = await hasAnyTrades(db);
    if (hasTrades) {
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

  // Load and validate trades through the same pipeline as import
  const trades = loadTradesFromCsv(tradesPath);

  // Load prices
  const priceEntries = loadPricesFromCsv(pricesPath);

  // Insert into DB
  await replaceAllTrades(db, trades);
  await replaceAllPrices(db, priceEntries);
}

/**
 * Seed the database with sample data.
 * Runs migrations, then loads CSV files through the validation pipeline.
 * Mutexed per db instance so parallel requests (e.g. /api/portfolio and /api/trades) don't collide.
 */
export async function seedDatabase(db: Database, forceReseed = false) {
  if (forceReseed) {
    return runSeed(db, true);
  }

  let active = seedMutex.get(db);
  if (!active) {
    active = runSeed(db, false);
    seedMutex.set(db, active);
  }
  return active;
}
