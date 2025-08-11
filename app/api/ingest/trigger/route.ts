import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { config } from '@/lib/config';

const LOCK_KEY = 'ingest:trigger:lock';

export async function POST(req: NextRequest) {
  try {
    // simple 60s rate limit
    const set = await redis.set(LOCK_KEY, String(Date.now()), 'NX', 'EX', 60);
    if (set !== 'OK') {
      const ttl = await redis.ttl(LOCK_KEY);
      const wait = ttl > 0 ? ttl : 60;
      return NextResponse.json({ ok: false, error: `Try again in ${wait}s` });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const url = `${proto}://${host}/api/ingest/run`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-token': config.devIngestToken },
    });
    const data = await res.json();
    if (!res.ok && !data?.status) {
      return NextResponse.json({ ok: false, error: data?.error || 'Failed' });
    }
    // Normalize shape
    const radar = data?.radar ?? 0;
    const stations = data?.stations ?? 0;
    const features = data?.features ?? 0;
    return NextResponse.json({ ok: true, radar, stations, features });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) });
  }
}


