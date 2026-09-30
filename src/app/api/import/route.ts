/**
 * POST /api/import — Upload CSV file, validate, and replace all trades.
 * Returns 200 on success or 422 with detailed error list.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb, runMigrations } from '@/db/client';
import { replaceAllTrades, replaceAllPrices } from '@/db/repository';
import { validateAndParse, validateAndParsePrices } from '@/import/validate';

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    await runMigrations(db);

    const formData = await request.formData();
    const file = formData.get('file');
    const requestedType = formData.get('type') as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: { code: 'NO_FILE', message: 'No file uploaded. Please select a CSV file.' } },
        { status: 400 },
      );
    }

    const content = await file.text();

    // Auto-detect or use explicit type: 'prices' vs 'trades'
    const lowerFirstLine = content.slice(0, 200).toLowerCase();
    const isPrices =
      requestedType === 'prices' ||
      file.name.toLowerCase().includes('price') ||
      (lowerFirstLine.includes('as_of') && lowerFirstLine.includes('price_usd') && !lowerFirstLine.includes('trade_id'));

    if (isPrices) {
      const result = validateAndParsePrices(content, file.size);
      if (!result.ok) {
        return NextResponse.json(
          {
            ok: false,
            type: 'prices',
            errors: result.errors,
            summary: result.summary,
            message: 'Price validation failed. No data was changed.',
          },
          { status: 422 },
        );
      }

      await replaceAllPrices(db, result.prices);

      return NextResponse.json({
        ok: true,
        type: 'prices',
        message: `Successfully imported ${result.count} asset prices.`,
        count: result.count,
      });
    }

    // Default: trades
    const result = validateAndParse(content, file.size);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          type: 'trades',
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
      type: 'trades',
      message: `Successfully imported ${result.count} trades.`,
      count: result.count,
    });
  } catch (err) {
    console.error('Import API error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to import CSV data.' } },
      { status: 500 },
    );
  }
}
