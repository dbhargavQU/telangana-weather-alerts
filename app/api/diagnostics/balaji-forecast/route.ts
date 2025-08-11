import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const areas = await prisma.area.findMany({});
  const obs = await prisma.observation.findMany({
    where: { observedAt: { gte: since } },
    orderBy: { observedAt: 'desc' },
  });
  const alerts = await prisma.alert.findMany({ where: { issuedAt: { gte: since } } });
  const byArea = new Map<string, typeof obs[0]>();
  for (const o of obs) {
    if (!byArea.has(o.areaId)) byArea.set(o.areaId, o);
  }
  const results = areas.map((a) => {
    const o = byArea.get(a.id);
    const alert = alerts.find((al) => al.areaId === a.id);
    const triggered = Boolean(alert);
    const severity = alert?.severity ?? null;
    const confidence = alert?.confidence ?? null;
    const sources = alert?.sources ?? [];
    return {
      area: a.name,
      probability: (o as any)?.probability ?? null,
      precipHour: (o as any)?.precipHour ?? null,
      max_prob_12h: (o as any)?.maxProb12h ?? null,
      sum_precip_12h: (o as any)?.sumPrecip12h ?? null,
      peak_hour_local: (o as any)?.peakHourLocal ?? null,
      radarFrameAgeMin: null, // not tracked granularly in MVP
      triggered,
      severity,
      confidence,
      observedAt: o?.observedAt ?? null,
      sources,
      scope: alerts.find((al) => al.areaId === a.id)?.scope ?? 'now',
    };
  });
  return NextResponse.json(results);
}


