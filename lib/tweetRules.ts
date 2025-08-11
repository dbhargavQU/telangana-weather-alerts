import crypto from 'node:crypto';

export type Scope = 'now' | 'today' | 'week';

export type NowBlock = {
  radarEtaMin?: { from: number | null; to: number | null };
  mmhHigh?: number;
  thunderFlag?: boolean;
  intensityWordNow?: string | null;
  radarDuration?: { from: number | null; to: number | null } | number | null;
  confidence?: number | null;
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
  const duration = typeof now.radarDuration === 'number' ? now.radarDuration : (now.radarDuration && now.radarDuration.to != null ? now.radarDuration.to : null);
  const mmhHigh = now.mmhHigh ?? 0;
  const intensity = (now.intensityWordNow || '').toLowerCase();
  const conf = Number(now.confidence ?? 0);
  // Permissive NOW for testing
  if (mmhHigh >= 0.5) return true;
  if (intensity === 'light' && conf >= 80) return true;
  if (duration != null && duration >= 120) return true;
  if (now.thunderFlag) return true;
  if (eta && eta.from != null && eta.from <= 90) return true; // keep existing
  return false;
}

export function shouldTweetToday(today: TodayBlock | null | undefined): boolean {
  if (!today) return false;
  const prob = today.maxProb12h ?? 0;
  const okInt = ['light', 'moderate', 'heavy', 'very heavy'].includes((today.intensityWordToday || '').toLowerCase());
  return prob >= 70 && okInt;
}

export function shouldTweetWeek(week: WeekDay[] | null | undefined): boolean {
  if (!Array.isArray(week)) return false;
  return week.some((d) => d.mmHigh >= 15 || ((d.intensityWord || '').toLowerCase() === 'light' && d.maxProb >= 80));
}

export function makeHash(areaId: string, scope: Scope, bucket: string, windowLabel: string | null | undefined): string {
  const h = crypto.createHash('sha1');
  h.update(`${areaId}|${scope}|${bucket}|${windowLabel || ''}`);
  return h.digest('hex');
}

export function isHyderabad(areaId: string): boolean {
  return areaId === 'dist-hyderabad' || areaId.startsWith('nbhd-');
}

export function sourceTagFor(payload: {
  now?: { radarEtaMin?: { from: number | null; to: number | null } | null } | null;
  observation?: { radarIntensity?: string | null } | null;
}): 'Model' | 'Model+Radar' {
  const hasEta = !!payload?.now?.radarEtaMin && payload.now.radarEtaMin!.from != null;
  const hasRadarIntensity = (payload?.observation?.radarIntensity || 'none') !== 'none';
  return hasEta || hasRadarIntensity ? 'Model+Radar' : 'Model';
}


