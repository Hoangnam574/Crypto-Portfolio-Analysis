/**
 * POST /api/import — Upload CSV file, validate, and replace all trades.
 * Returns 200 on success or 422 with detailed error list.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb, runMigrations } from '@/db/client';
import { replaceAllTrades } from '@/db/repository';
import { validateAndParse } from '@/import/validate';

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    await runMigrations(db);

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: { code: 'NO_FILE', message: 'No file uploaded. Please select a CSV file.' } },
        { status: 400 },
      );
    }

    const content = await file.text();
    const result = validateAndParse(content, file.size);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          errors: result.errors,
          summary: result.summary,
          message: 'Validation failed. No data was changed.',
        },
        { status: 422 },
      );
    }

    // Validation passed — replace all trades atomically
    await replaceAllTrades(db, result.trades);

    return NextResponse.json({
      ok: true,
      message: `Successfully imported ${result.count} trades.`,
      count: result.count,
    });
  } catch (err) {
    console.error('Import API error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to import trades.' } },
      { status: 500 },
    );
  }
}
