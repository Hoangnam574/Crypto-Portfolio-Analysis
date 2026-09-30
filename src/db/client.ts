/**
 * client.ts — The ONLY place that selects the database driver.
 *
 * Strategy:
 * - If DATABASE_URL is set → use Neon serverless (WebSocket Pool for transactions)
 * - Otherwise → use PGlite with local file storage at ./.data/pglite
 *
 * Exports a single `getDb()` that returns a Drizzle instance.
 * repository.ts and all other code only receive this Drizzle instance.
 */
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema';

// Global singleton pattern to prevent multiple instances during Next.js hot reload
const globalForDb = globalThis as unknown as {
  dbInstance?: Database | null;
  pgliteInstance?: PGlite | null;
  migrationPromise?: Promise<void> | null;
};

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export async function getDb(): Promise<Database> {
  if (globalForDb.dbInstance) return globalForDb.dbInstance;

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    // Production: use Neon serverless with WebSocket for transaction support
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const ws = await import('ws');
    neonConfig.webSocketConstructor = ws.default;
    
    const { drizzle: drizzleNeon } = await import('drizzle-orm/neon-serverless');
    const pool = new Pool({ connectionString: databaseUrl });
    globalForDb.dbInstance = drizzleNeon(pool, { schema }) as unknown as Database;
  } else {
    // Local dev: use PGlite with file persistence
    // Falls back to system tmpdir if OneDrive/cloud-sync causes reparse point issues
    const { mkdirSync } = await import('fs');
    const { resolve, join } = await import('path');
    const os = await import('os');

    const primaryDir = process.env.PGLITE_DIR || resolve(process.cwd(), '.data', 'pglite');
    let client: PGlite;

    try {
      mkdirSync(primaryDir, { recursive: true });
      client = new PGlite(primaryDir);
      await client.query('SELECT 1');
    } catch (err) {
      console.warn('Primary PGlite directory failed (e.g. cloud sync lock), using system temp directory instead.');
      const fallbackDir = join(os.tmpdir(), 'crypto-portfolio-pglite');
      mkdirSync(fallbackDir, { recursive: true });
      client = new PGlite(fallbackDir);
      await client.query('SELECT 1');
    }

    globalForDb.pgliteInstance = client;
    globalForDb.dbInstance = drizzle(client, { schema });
  }

  return globalForDb.dbInstance;
}

/**
 * Set the database instance (used for injecting in-memory test databases).
 */
export function setDb(db: Database | null) {
  globalForDb.dbInstance = db;
  globalForDb.migrationPromise = null;
}

/**
 * Close database connection if using local PGlite.
 */
export async function closeDb() {
  if (globalForDb.pgliteInstance) {
    await globalForDb.pgliteInstance.close();
    globalForDb.pgliteInstance = null;
    globalForDb.dbInstance = null;
    globalForDb.migrationPromise = null;
  }
}

/**
 * Create an in-memory PGlite instance for testing.
 * Each test gets a fresh database.
 */
export function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  return { db, client };
}

const migrationMap = new WeakMap<any, Promise<void>>();

/**
 * Run migrations (create tables) using raw SQL.
 * Mutexed per db instance so parallel requests (e.g. /api/portfolio and /api/trades) don't collide.
 */
export async function runMigrations(db: Database) {
  let promise = migrationMap.get(db);
  if (!promise) {
    promise = (async () => {
      await (db as any).execute(`
        CREATE TABLE IF NOT EXISTS trades (
          id SERIAL PRIMARY KEY,
          seq INTEGER NOT NULL,
          trade_id TEXT NOT NULL,
          ts TIMESTAMPTZ NOT NULL,
          exchange TEXT NOT NULL,
          symbol TEXT NOT NULL,
          side TEXT NOT NULL,
          quantity NUMERIC(38,18) NOT NULL,
          price_usd NUMERIC(38,18) NOT NULL,
          fee_usd NUMERIC(38,18) NOT NULL
        );
      `);

      await (db as any).execute(`
        CREATE UNIQUE INDEX IF NOT EXISTS trades_trade_id_idx ON trades (trade_id);
      `);

      await (db as any).execute(`
        CREATE TABLE IF NOT EXISTS prices (
          symbol TEXT PRIMARY KEY,
          price_usd NUMERIC(38,18) NOT NULL,
          as_of TIMESTAMPTZ NOT NULL
        );
      `);
    })();
    migrationMap.set(db, promise);
  }
  return promise;
}
