import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const areas = await prisma.area.findMany();
  const alerts = await prisma.alert.groupBy({ by: ['areaId'], _max: { issuedAt: true } });
  const areaIdToLatest = new Map(alerts.map((a) => [a.areaId, a._max.issuedAt]));
  const lastObs = await prisma.observation.groupBy({ by: ['areaId'], _max: { observedAt: true } });
  const areaToObs = new Map(lastObs.map((o) => [o.areaId, o._max.observedAt]));
  return NextResponse.json(
    areas.map((a) => {
      const obsAt = areaToObs.get(a.id);
      const stale = obsAt ? Date.now() - new Date(obsAt).getTime() > 30 * 60 * 1000 : true;
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        polygon: a.polygon,
        latestAlertAt: areaIdToLatest.get(a.id) ?? null,
        stale,
      };
    }),
    { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } },
  );
}


