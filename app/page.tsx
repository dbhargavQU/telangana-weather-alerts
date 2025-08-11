import Link from 'next/link';
import { prisma } from '@/lib/db';
import WeatherMap from '@/components/Map';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { format } from 'date-fns';

export default async function Home() {
  const areas = await prisma.area.findMany({ orderBy: { name: 'asc' } });
  const latestAlerts = await prisma.alert.groupBy({ by: ['areaId'], _max: { issuedAt: true } });
  const areaToAlert = new Map<string, Date>();
  latestAlerts.forEach((a) => a._max.issuedAt && areaToAlert.set(a.areaId, a._max.issuedAt));
  const diagSince = new Date(Date.now() - 60 * 60 * 1000);
  const diags = await prisma.alert.findMany({ where: { issuedAt: { gte: diagSince } }, orderBy: { issuedAt: 'desc' } });
  const lastRun = diags[0]?.issuedAt ?? null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>State Map</CardHeader>
        <CardContent>
          {lastRun ? (
            <div className="mb-2 text-sm inline-flex items-center gap-2 px-2 py-1 rounded bg-yellow-100 text-yellow-900">
              <span>Short-range forecast test: Last run {format(lastRun, 'HH:mm')}</span>
            </div>
          ) : null}
          <WeatherMap areas={areas.map((a) => ({ id: a.id, name: a.name, polygon: a.polygon }))} />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {areas.map((a) => (
          <Link key={a.id} href={`/area/${a.id}`}>
            <Card className="hover:shadow-md transition">
              <CardHeader>{a.name}</CardHeader>
              <CardContent className="text-sm text-gray-600">
                {areaToAlert.get(a.id) ? `Alert at ${areaToAlert.get(a.id)?.toLocaleString()}` : 'No alert'}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}


