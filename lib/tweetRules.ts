import crypto from 'node:crypto';

export type Scope = 'now' | 'today' | 'week';

export type NowBlock = {
  radarEtaMin?: { from: number | null; to: number | null };
  mmhHigh?: number;
  thunderFlag?: boolean;
};

export type TodayBlock = {
  maxProb12h?: number | null;
  intensityWordToday?: string | null;
  windowLabel?: string | null;
};

export type WeekDay = { date: string; mmHigh: number; maxProb: number; intensityWord: string };

export function shouldTweetNow(now: NowBlock | null | undefined): boolean {
  if (!now) return false;
  const eta = now.radarEtaMin;
  if (eta && eta.from != null && eta.from <= 90) return true;
  if ((now.mmhHigh ?? 0) >= 0.5) return true;
  if (now.thunderFlag) return true;
  return false;
}

export function shouldTweetToday(today: TodayBlock | null | undefined): boolean {
  if (!today) return false;
  const prob = today.maxProb12h ?? 0;
  const okInt = ['moderate', 'heavy', 'very heavy'].includes((today.intensityWordToday || '').toLowerCase());
  if (!(prob >= 70 && okInt)) return false;
  // window starts within next 9h: we only have a label; assume yes
  return true;
}

export function shouldTweetWeek(week: WeekDay[] | null | undefined): boolean {
  if (!Array.isArray(week)) return false;
  return week.some((d) => d.mmHigh >= 15);
}

export function makeHash(areaId: string, scope: Scope, bucket: string, windowLabel: string | null | undefined): string {
  const h = crypto.createHash('sha1');
  h.update(`${areaId}|${scope}|${bucket}|${windowLabel || ''}`);
  return h.digest('hex');
}


