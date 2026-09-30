/**
 * POST /api/reset — Reset database to sample data.
 * GET /api/health — Health check.
 */
import { NextResponse } from 'next/server';
import { getDb, runMigrations } from '@/db/client';
import { seedDatabase } from '@/db/seed';

export async function POST() {
  try {
    const db = await getDb();
    await runMigrations(db);
    await seedDatabase(db, true); // force reseed

    return NextResponse.json({
      ok: true,
      message: 'Database reset to sample data successfully.',
    });
  } catch (err) {
    console.error('Reset API error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to reset database.' } },
      { status: 500 },
    );
  }
}
