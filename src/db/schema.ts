/**
 * Drizzle ORM schema for the crypto portfolio database.
 * Uses NUMERIC(38,18) for maximum precision with crypto amounts.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  numeric,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const trades = pgTable(
  'trades',
  {
    id: serial('id').primaryKey(),
    seq: integer('seq').notNull(),
    trade_id: text('trade_id').notNull(),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
    exchange: text('exchange').notNull(),
    symbol: text('symbol').notNull(),
    side: text('side').notNull(),
    quantity: numeric('quantity', { precision: 38, scale: 18 }).notNull(),
    price_usd: numeric('price_usd', { precision: 38, scale: 18 }).notNull(),
    fee_usd: numeric('fee_usd', { precision: 38, scale: 18 }).notNull(),
  },
  (table) => [
    uniqueIndex('trades_trade_id_idx').on(table.trade_id),
  ],
);

export const prices = pgTable('prices', {
  symbol: text('symbol').primaryKey(),
  price_usd: numeric('price_usd', { precision: 38, scale: 18 }).notNull(),
  as_of: timestamp('as_of', { withTimezone: true }).notNull(),
});
