import { NextRequest, NextResponse } from 'next/server';
import { getRedis, KEYS } from '@/lib/kv';
import { SafeLink } from '@/lib/bypass';

// DELETE /api/links/[id] — delete a link by id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const redis = getRedis();
    const links = await redis.lrange<SafeLink>(KEYS.links, 0, -1);
    const target = links.find((l) => l.id === id);
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await redis.lrem(KEYS.links, 1, target);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH /api/links/[id] — toggle active status or update fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const redis = getRedis();
    const links = await redis.lrange<SafeLink>(KEYS.links, 0, -1);
    const idx = links.findIndex((l) => l.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated: SafeLink = { ...links[idx], ...body };

    // Redis list: update in-place
    const pipe = redis.pipeline();
    pipe.lset(KEYS.links, idx, updated);
    await pipe.exec();

    return NextResponse.json({ link: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
