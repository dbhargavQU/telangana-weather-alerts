import { Queue } from 'bullmq';
import { redis } from '@/lib/redis';
import { getFrames } from '@/adapters/radarAdapter';
import { logInfo } from '@/lib/logger';

export async function runFetchRadar() {
  const frames = await getFrames();
  logInfo('Fetched radar frames', { count: frames.length });
  return frames;
}

export const fetchRadarQueue = new Queue('fetchRadar', { connection: redis });


