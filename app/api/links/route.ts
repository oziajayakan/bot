import { NextRequest, NextResponse } from 'next/server';
import { getRedis, KEYS } from '@/lib/kv';
import { SafeLink } from '@/lib/bypass';
import { v4 as uuidv4 } from 'uuid';

// GET /api/links — list all links
export async function GET() {
  try {
    const links = await getRedis().lrange<SafeLink>(KEYS.links, 0, -1);
    return NextResponse.json({ links: links || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/links — add a new link
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, label } = body;
    if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

    const link: SafeLink = {
      id: uuidv4(),
      url: url.trim(),
      label: label?.trim() || url.trim(),
      active: true,
      createdAt: new Date().toISOString(),
    };

    await getRedis().rpush(KEYS.links, link);
    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
