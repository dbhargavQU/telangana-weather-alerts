import { shouldTweetNow, shouldTweetToday, shouldTweetWeek, makeHash, type Scope } from '@/lib/tweetRules';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { config } from '@/lib/config';

export async function decideTweets(areaIds?: string[]): Promise<
  Array<{ areaId: string; scope: Scope; bucket: string; windowLabel: string | null }>
> {
  const areas = areaIds?.length ? await prisma.area.findMany({ where: { id: { in: areaIds } } }) : await prisma.area.findMany();
  const picks: Array<{ areaId: string; scope: Scope; bucket: string; windowLabel: string | null }> = [];
  for (const a of areas) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/areas/${a.id}`, { cache: 'no-store' });
    const data = await res.json();
    const now = data?.now;
    const today = data?.today;
    const week = data?.week;
    // NOW
    if (shouldTweetNow(now)) {
      const bucket = (now?.intensityWordNow || 'now').toLowerCase();
      const hash = makeHash(a.id, 'now', bucket, now?.radarEtaMin ? `${now.radarEtaMin.from}-${now.radarEtaMin.to}` : '');
      const ok = await allowTweet(hash);
      if (ok) picks.push({ areaId: a.id, scope: 'now', bucket, windowLabel: now?.radarEtaMin ? `${now.radarEtaMin.from}-${now.radarEtaMin.to}` : null });
    }
    // TODAY
    if (shouldTweetToday(today)) {
      const bucket = (today?.intensityWordToday || 'today').toLowerCase();
      const hash = makeHash(a.id, 'today', bucket, today?.windowLabel || '');
      const ok = await allowTweet(hash);
      if (ok) picks.push({ areaId: a.id, scope: 'today', bucket, windowLabel: today?.windowLabel || null });
    }
    // WEEK
    if (shouldTweetWeek(week)) {
      const top = (week || []).find((d: any) => d.mmHigh >= 15);
      const bucket = top ? new Date(top.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short' }) : 'week';
      const hash = makeHash(a.id, 'week', bucket, 'week');
      const ok = await allowTweet(hash);
      if (ok) picks.push({ areaId: a.id, scope: 'week', bucket, windowLabel: 'week' });
    }
  }
  return picks;
}

async function allowTweet(hash: string): Promise<boolean> {
  const key = `tweet:hash:${hash}`;
  const exists = await redis.get(key);
  if (exists) return false;
  await redis.set(key, '1', 'EX', config.tweetMinGapMin * 60);
  const dayKey = `tweet:budget:${new Date().toISOString().slice(0, 10)}`;
  const count = await redis.incr(dayKey);
  if (count === 1) await redis.expire(dayKey, 24 * 60 * 60);
  if (count > config.tweetDailyBudget) return false;
  return true;
}


