import { Worker, Queue } from 'bullmq';
import { redis } from '@/lib/redis';
import { runFetchRadar } from '@/jobs/fetchRadar';
import { runFetchStations } from '@/jobs/fetchStations';
import { runBuildFeaturesAndAlerts } from '@/jobs/buildFeaturesAndAlerts';
import { logInfo } from '@/lib/logger';
import { runTweetRunner } from '@/jobs/tweetRunner';

const fetchRadarWorker = new Worker('fetchRadar', async () => runFetchRadar(), { connection: redis });
const fetchStationsWorker = new Worker('fetchStations', async () => runFetchStations(), { connection: redis });
const buildFeaturesWorker = new Worker(
  'buildFeaturesAndAlerts',
  async () => {
    const res = await runBuildFeaturesAndAlerts();
    // best-effort tweet enqueue after ingest
    await runTweetRunner();
    return res;
  },
  { connection: redis },
);

const fetchRadarQueue = new Queue('fetchRadar', { connection: redis });
const fetchStationsQueue = new Queue('fetchStations', { connection: redis });
const buildFeaturesQueue = new Queue('buildFeaturesAndAlerts', { connection: redis });

async function ensureRepeatables() {
  // enforce order per cycle by staggering with delays
  await fetchRadarQueue.add('tick', {}, { repeat: { pattern: '*/10 * * * *' } as any });
  await fetchStationsQueue.add('tick', {}, { repeat: { pattern: '*/10 * * * *' }, delay: 60_000 } as any);
  await buildFeaturesQueue.add('tick', {}, { repeat: { pattern: '*/10 * * * *' }, delay: 120_000 } as any);
  logInfo('Repeatable jobs scheduled');
}

ensureRepeatables().catch((e) => console.error(e));

// Keep process alive
process.on('SIGINT', () => process.exit(0));


