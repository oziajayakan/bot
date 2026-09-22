import { NextRequest, NextResponse } from 'next/server';
import { getRedis, KEYS } from '@/lib/kv';
import { SafeLink, LinkLog, bypassSafelink } from '@/lib/bypass';
import { v4 as uuidv4 } from 'uuid';

// Shared runner used by both cron and manual trigger
export async function runBypass(linkId?: string): Promise<LinkLog[]> {
  const redis = getRedis();
  const links = await redis.lrange<SafeLink>(KEYS.links, 0, -1);
  const targets = linkId
    ? links.filter((l) => l.id === linkId)
    : links.filter((l) => l.active);

  const results: LinkLog[] = [];

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (!targets.find((t) => t.id === link.id)) continue;

    let log: LinkLog;
    try {
      const dest = await bypassSafelink(link.url);
      log = {
        id: uuidv4(),
        linkId: link.id,
        linkLabel: link.label,
        originalUrl: link.url,
        destUrl: dest,
        status: 'success',
        timestamp: new Date().toISOString(),
      };

      const updated: SafeLink = {
        ...link,
        lastRun: log.timestamp,
        lastResult: 'success',
        lastDestUrl: dest,
      };
      await redis.lset(KEYS.links, i, updated);
    } catch (err) {
      log = {
        id: uuidv4(),
        linkId: link.id,
        linkLabel: link.label,
        originalUrl: link.url,
        status: 'failed',
        error: String(err),
        timestamp: new Date().toISOString(),
      };

      const updated: SafeLink = {
        ...link,
        lastRun: log.timestamp,
        lastResult: 'failed',
      };
      await redis.lset(KEYS.links, i, updated);
    }

    results.push(log);

    // Prepend to log list (newest first), keep max 500 entries
    await redis.lpush(KEYS.logs, log);
    const logLen = await redis.llen(KEYS.logs);
    if (logLen > 500) await redis.ltrim(KEYS.logs, 0, 499);
  }

  return results;
}

// POST /api/run — manual trigger { linkId?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { linkId } = body as { linkId?: string };
    const results = await runBypass(linkId);
    return NextResponse.json({ ok: true, count: results.length, results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
