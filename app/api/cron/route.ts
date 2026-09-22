import { NextRequest, NextResponse } from 'next/server';
import { runBypass } from '@/app/api/run/route';

// GET /api/cron — called by Vercel Cron (daily at midnight)
export async function GET(req: NextRequest) {
  // Verify this is coming from Vercel Cron (optional security)
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runBypass();
    return NextResponse.json({
      ok: true,
      ran: new Date().toISOString(),
      count: results.length,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
