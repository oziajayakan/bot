import { NextResponse } from 'next/server';
import { getRedis, KEYS } from '@/lib/kv';
import { LinkLog } from '@/lib/bypass';

// GET /api/logs — get last 100 logs
export async function GET() {
  try {
    const logs = await getRedis().lrange<LinkLog>(KEYS.logs, 0, 99);
    return NextResponse.json({ logs: logs || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
