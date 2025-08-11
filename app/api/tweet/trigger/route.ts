import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { runTweetRunner } from '@/jobs/tweetRunner';

const LOCK_KEY = 'tweet:trigger:lock';
let lastTriggerAtMs: number | null = null;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const areaId: string | undefined = body?.areaId;
  // Try Redis rate-limit; fall back to in-memory if Redis unavailable
  try {
    const set = await redis.set(LOCK_KEY, String(Date.now()), 'NX', 'EX', 60);
    if (set !== 'OK') {
      const ttl = await redis.ttl(LOCK_KEY);
      return NextResponse.json({ ok: false, error: `Try again in ${ttl}s` });
    }
  } catch {
    const now = Date.now();
    if (lastTriggerAtMs && now - lastTriggerAtMs < 60_000) {
      const wait = Math.ceil((60_000 - (now - lastTriggerAtMs)) / 1000);
      return NextResponse.json({ ok: false, error: `Try again in ${wait}s` });
    }
    lastTriggerAtMs = now;
  }
  const result = await runTweetRunner(areaId ? [areaId] : undefined);
  return NextResponse.json({ ok: true, ...result });
}


