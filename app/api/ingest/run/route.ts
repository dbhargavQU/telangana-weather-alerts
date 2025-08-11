import { NextResponse } from 'next/server';
import { runFetchStations } from '@/jobs/fetchStations';
import { runFetchRadar } from '@/jobs/fetchRadar';
import { runBuildFeaturesAndAlerts } from '@/jobs/buildFeaturesAndAlerts';
import { config } from '@/lib/config';

export async function POST(req: Request) {
  const token = req.headers.get('x-token');
  if (!token || token !== config.devIngestToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let status: 'ok' | 'degraded' = 'ok';
  try {
    const stations = await runFetchStations();
    const radar = await runFetchRadar();
    const features = await runBuildFeaturesAndAlerts();
    return NextResponse.json({ status, radar: radar.length, stations: stations.length, features: features.length });
  } catch (e: any) {
    status = 'degraded';
    return NextResponse.json({ status, radar: 0, stations: 0, features: 0, error: String(e?.message || e) });
  }
}