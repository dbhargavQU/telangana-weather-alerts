import { Queue } from 'bullmq';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/db';
import { getAllAreasPoints } from '@/adapters/openMeteoAdapter';
import { logInfo, logWarn } from '@/lib/logger';

export async function runFetchStations() {
  const areas = await prisma.area.findMany();
  const rows = await getAllAreasPoints(areas.map(a => ({ id: a.id, name: a.name, centroidLat: (a as any).centroidLat ?? null, centroidLng: (a as any).centroidLng ?? null })));
  const failed = rows.filter((r) => r.stale).map((r) => r.areaId);
  if (failed.length > 0) logWarn('Some OpenMeteo areas failed', { failed });
  logInfo('Fetched stations (OpenMeteo)', { count: rows.length, expected: areas.length });
  return rows;
}

export const fetchStationsQueue = new Queue('fetchStations', { connection: redis });


